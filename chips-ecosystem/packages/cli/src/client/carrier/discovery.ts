/**
 * 发现文件消费侧读取与陈旧双判据（《17-CLI承载链路契约》§2.4、§2.5、§5.4）。
 *
 * 消费侧语义（CLI 是读取方，宿主是写入方）：
 * - 严格形状校验（§2.4）：字段缺失/类型不符/未知顶层字段一律视同无效记录（等同陈旧），
 *   记录形状类型 `ICarrierDiscoveryRecord` 与协议字面量 `CARRIER_PROTOCOL` 一律 import
 *   `@chips/bridge`（《17》§6.1-1 单一事实源，禁第二定义）；
 * - 陈旧双判据（§2.5-3）：`pid_dead`（PID 不存在）与 `pid_recycled`（PID 假活、进程创建时间晚于
 *   `startedAt`）必须同时实现，防 PID 回收窗口的假活；进程探针注入化，创建时间不可得时
 *   **保守判定不陈旧**（宁可不处置）；`pid_recycled` 判据带探针粒度容差
 *   （{@link PID_RECYCLE_PROBE_TOLERANCE_MS}）：POSIX `ps -o etime=` 为秒级粒度，宿主启动后
 *   每个粒度窗口内推算创建时间被截断抬高（可超前真实 `startedAt` 达 1 秒加探针延迟），
 *   零容差会把刚写入登记在册活宿主误判 `pid_recycled`（§5.2 拉起就绪轮询必被卡死）——
 *   粒度窗口内创建时间不可辨，按「不可得 → 保守不陈旧」同口径收口；
 * - 清理权只属写入方（宿主）：CLI 读出陈旧或连接失败**不得删除登记文件**（§2.5-4），
 *   对应定性是 §5.4 回退链（发现阶段失败）。
 */

import { spawnSync } from 'node:child_process';

import { CARRIER_PROTOCOL, type ICarrierDiscoveryRecord } from '@chips/bridge';

import type { IFileSystemPort } from '../../args/filesystem.js';

/** 进程判据探针：PID 存活与进程创建时间（epoch 毫秒；不可得 `null`）。 */
export interface IPidProbe {
  pidAlive(pid: number): boolean;
  /** 进程创建时间（epoch 毫秒）；探测不可得返回 `null`（保守判不陈旧）。 */
  processCreatedAt(pid: number): number | null;
}

/** 陈旧判定结果：`reason` 为消费侧诊断定性（不在线上传输，不进发现文件）。 */
export type CarrierStaleness =
  | { readonly stale: false }
  | { readonly stale: true; readonly reason: 'pid_dead' | 'pid_recycled' };

/** 发现文件读取结果（消费侧定性）。 */
export type CarrierDiscoveryRead =
  | { readonly status: 'ready'; readonly record: ICarrierDiscoveryRecord }
  /** 文件缺失或形状无效（未知字段/类型不符/JSON 非法）：视同陈旧，走 §5.4 定性。 */
  | { readonly status: 'unavailable'; readonly reason: 'missing' | 'invalid_shape' }
  /** `protocol` 字段不匹配：§5.3 `protocol_mismatch`（视同发现失败）。 */
  | { readonly status: 'protocol_mismatch'; readonly record: ICarrierDiscoveryRecord }
  /** 记录合法但双判据判陈旧：§5.4「发现文件陈旧残留」臂（不删除）。 */
  | {
      readonly status: 'stale';
      readonly reason: 'pid_dead' | 'pid_recycled';
      readonly record: ICarrierDiscoveryRecord;
    };

/** 发现文件在册字段键集合（§2.4 严格形状：未知字段拒绝、缺失同判无效）。 */
const RECORD_KEYS: readonly (keyof ICarrierDiscoveryRecord)[] = [
  'protocol',
  'instanceId',
  'socketPath',
  'pid',
  'startedAt',
  'bearerToken',
];

/** 严格解析并校验发现记录：文件缺失/JSON 非法/形状无效返回 `null`。 */
export function parseDiscoveryRecord(text: string | null): ICarrierDiscoveryRecord | null {
  if (text === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const source = parsed as Record<string, unknown>;
  const keys = Object.keys(source);
  const required = RECORD_KEYS as readonly string[];
  if (keys.length !== required.length || !required.every((key) => keys.includes(key))) {
    return null;
  }
  const { protocol, instanceId, socketPath, pid, startedAt, bearerToken } = source;
  if (
    typeof protocol !== 'string' ||
    typeof instanceId !== 'string' ||
    typeof socketPath !== 'string' ||
    !Number.isInteger(pid) ||
    !Number.isInteger(startedAt) ||
    typeof bearerToken !== 'string'
  ) {
    return null;
  }
  return {
    protocol,
    instanceId,
    socketPath,
    pid: pid as number,
    startedAt: startedAt as number,
    bearerToken,
  };
}

/**
 * `pid_recycled` 判据的探针粒度容差（毫秒）。
 *
 * 构成：POSIX `ps -o etime=` 秒级截断抬高上界 1000ms + 探针子进程（`ps`/`powershell`）
 * 启动与读取延迟预算 1000ms。粒度窗口内创建时间不可辨，按 §2.5-3「不可得 → 保守不陈旧」
 * 同口径不判；真实 PID 回收（记录写入进程死亡后 PID 被复用）与 `startedAt` 的间隔远超
 * 本容差，判据保护面不缩——`pid_dead` 判据仍即时生效，双判据之第一判据零放宽。
 */
export const PID_RECYCLE_PROBE_TOLERANCE_MS = 2_000;

/** 陈旧双判据（§2.5-3：两判据同时实现；`pid_recycled` 带探针粒度容差，《17》§2.5-3 保守口径）。 */
export function judgeStaleness(
  record: ICarrierDiscoveryRecord,
  probe: IPidProbe
): CarrierStaleness {
  if (!probe.pidAlive(record.pid)) {
    return { stale: true, reason: 'pid_dead' };
  }
  const createdAt = probe.processCreatedAt(record.pid);
  if (createdAt !== null && createdAt > record.startedAt + PID_RECYCLE_PROBE_TOLERANCE_MS) {
    return { stale: true, reason: 'pid_recycled' };
  }
  return { stale: false };
}

/**
 * 读取并定性发现文件（消费侧一站式：读 → 严格形状 → 协议字面量 → 双判据）。
 *
 * @param fileSystem 注入的文件端口（生产为 Node 实现，测试为内存实现）。
 * @param file 发现文件路径（由 `resolveCarrierTarget` 给出）。
 * @param probe 进程判据探针。
 */
export function readCarrierDiscovery(
  fileSystem: IFileSystemPort,
  file: string,
  probe: IPidProbe
): CarrierDiscoveryRead {
  const record = parseDiscoveryRecord(readFileOrNull(fileSystem, file));
  if (record === null) {
    return {
      status: 'unavailable',
      reason: fileLike(fileSystem, file) ? 'invalid_shape' : 'missing',
    };
  }
  if (record.protocol !== CARRIER_PROTOCOL) {
    return { status: 'protocol_mismatch', record };
  }
  const verdict = judgeStaleness(record, probe);
  if (verdict.stale) {
    return { status: 'stale', reason: verdict.reason, record };
  }
  return { status: 'ready', record };
}

/** 读取文件文本；不存在或不可读返回 `null`（区分「缺失」与「形状无效」用）。 */
function readFileOrNull(fileSystem: IFileSystemPort, file: string): string | null {
  if (!fileSystem.exists(file) || fileSystem.kind(file) !== 'file') {
    return null;
  }
  try {
    return fileSystem.readText(file);
  } catch {
    return null;
  }
}

/** 文件存在但读回为空/非法时判为形状无效；不存在判为缺失。 */
function fileLike(fileSystem: IFileSystemPort, file: string): boolean {
  return fileSystem.exists(file) && fileSystem.kind(file) === 'file';
}

/**
 * 缺省系统探针：POSIX `ps -o etime=`、win32 `Get-Process StartTime`；解析失败即 `null`。
 *
 * @remarks 与宿主写入侧探针语义一致（消费侧独立实现，不跨包 import 宿主内部），创建时间不可得
 * 时保守判不陈旧（§2.5-3）；探针只读，绝不删除发现文件（§2.5-4）。
 */
export function createSystemPidProbe(now: () => number = Date.now): IPidProbe {
  return {
    pidAlive(pid: number): boolean {
      if (!Number.isInteger(pid) || pid <= 0) {
        return false;
      }
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    },
    processCreatedAt(pid: number): number | null {
      if (!Number.isInteger(pid) || pid <= 0) {
        return null;
      }
      try {
        if (process.platform === 'win32') {
          const script =
            `$p = Get-Process -Id ${String(pid)} -ErrorAction Stop; ` +
            "[Math]::Round(($p.StartTime.ToUniversalTime() - [datetime]'1970-01-01').TotalMilliseconds)";
          const output = spawnSync(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', script],
            {
              encoding: 'utf8',
              timeout: 5000,
            }
          );
          if (output.status !== 0) {
            return null;
          }
          const value = Number.parseInt(output.stdout.trim(), 10);
          return Number.isFinite(value) ? value : null;
        }
        const output = spawnSync('ps', ['-p', String(pid), '-o', 'etime='], {
          encoding: 'utf8',
          timeout: 5000,
        });
        if (output.status !== 0) {
          return null;
        }
        const elapsedMs = parsePsEtime(output.stdout.trim());
        return elapsedMs === null ? null : now() - elapsedMs;
      } catch {
        return null;
      }
    },
  };
}

/** 解析 `ps` 的 `etime` 字段（`[[dd-]hh:]mm:ss`）为毫秒；不可解析返回 `null`。 */
function parsePsEtime(raw: string): number | null {
  const match = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/.exec(raw);
  if (match === null) {
    return null;
  }
  const days = Number.parseInt(match[1] ?? '0', 10);
  const hours = Number.parseInt(match[2] ?? '0', 10);
  const minutes = Number.parseInt(match[3] ?? '0', 10);
  const seconds = Number.parseInt(match[4] ?? '0', 10);
  return ((days * 24 + hours) * 3600 + minutes * 60 + seconds) * 1000;
}
