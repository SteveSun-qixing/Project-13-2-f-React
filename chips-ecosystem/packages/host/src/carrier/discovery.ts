/**
 * 承载登记文件（发现文件）写入、读取与陈旧双判据（《17-CLI承载链路契约》§2.4–§2.5）。
 *
 * 权威：§2.4（记录形状与权限模式）、§2.5（原子写、bind 前清理、陈旧双判据、清理权与停机顺序）、
 * §2.8（token 不落日志）。
 *
 * @remarks
 * - 原子写：同目录临时文件 `chips-carrier.json.tmp-<instanceId>` + `rename` 替换；
 *   文件 `0600`、所在 `userData` 目录 `0700`（POSIX；win32 无 POSIX 权限语义，《17》§1.4-3 挂账）。
 * - 陈旧双判据（必须同时实现，防 PID 回收窗口的假活）：PID 不存在；或 PID 存在但进程
 *   创建时间晚于记录 `startedAt`。创建时间探测注入化，缺省实现走平台进程查询，探测不可得
 *   时**保守判定为不陈旧**（宁可不删，bind 冲突再走 §2.5-2 的 fail-closed 收口）。
 * - 清理权只属于宿主写入方（启动前清陈旧 + 停机自删）；本模块只被宿主承载服务调用。
 */

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

import {
  CARRIER_DISCOVERY_FILE_NAME,
  CARRIER_ENDPOINT_DIR_MODE,
  CARRIER_ENDPOINT_FILE_MODE,
  CARRIER_PROTOCOL,
  type ICarrierDiscoveryRecord,
} from '@chips/bridge';

/** 发现文件在册字段键集合（§2.4：未知字段拒绝，缺失/类型不符同判无效）。 */
const RECORD_KEYS: readonly (keyof ICarrierDiscoveryRecord)[] = [
  'protocol',
  'instanceId',
  'socketPath',
  'pid',
  'startedAt',
  'bearerToken',
];

/** 进程判据探针：PID 存活与进程创建时间（epoch 毫秒；不可得时 `null`）。 */
export interface IPidProbe {
  /** PID 是否存在（本 OS 用户视角）。 */
  pidAlive(pid: number): boolean;
  /** 进程创建时间（epoch 毫秒）；探测不可得返回 `null`（保守不判陈旧）。 */
  processCreatedAt(pid: number): number | null;
}

/** 缺省系统探针：POSIX `ps -o etime=`，win32 `Get-Process StartTime`；解析失败即 `null`。 */
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
          const output = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
            encoding: 'utf8',
            timeout: 5000,
          });
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

/** 陈旧判定结果（`reason` 为宿主诊断定性，不在线上传输）。 */
export type CarrierStaleness =
  { readonly stale: false } | { readonly stale: true; readonly reason: 'pid_dead' | 'pid_recycled' };

/** 陈旧双判据（§2.5-3：两判据同时实现）。 */
export function judgeDiscoveryStaleness(record: ICarrierDiscoveryRecord, probe: IPidProbe): CarrierStaleness {
  if (!probe.pidAlive(record.pid)) {
    return { stale: true, reason: 'pid_dead' };
  }
  const createdAt = probe.processCreatedAt(record.pid);
  if (createdAt !== null && createdAt > record.startedAt) {
    return { stale: true, reason: 'pid_recycled' };
  }
  return { stale: false };
}

/**
 * 读取并严格校验发现文件（§2.4：未知字段拒绝、字段缺失/类型不符按无效记录视同陈旧）。
 *
 * @returns 合法记录；文件缺失、JSON 非法或形状无效时 `null`（调用方按陈旧处置，§5.4 定性由消费侧执行）。
 */
export function readDiscoveryRecord(file: string): ICarrierDiscoveryRecord | null {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
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
  const requiredKeys = RECORD_KEYS as readonly string[];
  if (keys.length !== requiredKeys.length || !requiredKeys.every((key) => keys.includes(key))) {
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

/** 以 {@link ICarrierDiscoveryRecord} 形状原子落盘（tmp + rename，`0600`；目录 `0700`）。 */
export function discoveryFilePath(userDataRoot: string): string {
  return join(userDataRoot, CARRIER_DISCOVERY_FILE_NAME);
}

/** 原子写指定发现文件（POSIX 权限位逐字 §2.4；win32 无权限语义按 §1.4-3 挂账，不伪装成功位）。 */
export function writeDiscoveryRecordTo(file: string, record: ICarrierDiscoveryRecord): void {
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true, mode: CARRIER_ENDPOINT_DIR_MODE });
  if (process.platform !== 'win32') {
    chmodSync(dir, CARRIER_ENDPOINT_DIR_MODE);
  }
  const tmp = join(dir, `${CARRIER_DISCOVERY_FILE_NAME}.tmp-${record.instanceId}`);
  writeFileSync(tmp, JSON.stringify(record), { mode: CARRIER_ENDPOINT_FILE_MODE });
  if (process.platform !== 'win32') {
    chmodSync(tmp, CARRIER_ENDPOINT_FILE_MODE);
  }
  renameSync(tmp, file);
  if (process.platform !== 'win32') {
    chmodSync(file, CARRIER_ENDPOINT_FILE_MODE);
  }
}

/** 静默删除（陈旧清理与停机自删共用；不存在即成功）。 */
export function removeQuiet(path: string): void {
  rmSync(path, { force: true });
}

/** 端点文件是否残留（POSIX socket 文件存在性；win32 pipe 无文件系统残留义务，§2.1-5）。 */
export function endpointFileExists(socketPath: string): boolean {
  if (process.platform === 'win32') {
    return false;
  }
  return existsSync(socketPath);
}

/** 生成发现记录（`protocol` 恒为契约字面量；`bearerToken` 为 CSPRNG 32 字节小写 hex 64 字符）。 */
export function buildDiscoveryRecord(input: {
  readonly instanceId: string;
  readonly socketPath: string;
  readonly pid: number;
  readonly startedAt: number;
  readonly bearerToken: string;
}): ICarrierDiscoveryRecord {
  return {
    protocol: CARRIER_PROTOCOL,
    instanceId: input.instanceId,
    socketPath: input.socketPath,
    pid: input.pid,
    startedAt: input.startedAt,
    bearerToken: input.bearerToken,
  };
}

/** CSPRNG 32 字节小写 hex token（§2.4；不落日志与结果信封，§2.8）。 */
export function generateBearerToken(): string {
  return randomBytes(32).toString('hex');
}
