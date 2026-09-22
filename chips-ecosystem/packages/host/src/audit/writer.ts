/**
 * 权限审计 JSONL 写入器（工单046 段二 / W3-P0-3 立项书段二主件）。
 *
 * 权威与母型：
 * - 《08.08》§8.3：落盘 `<userData>/logs/audit/audit-YYYY-MM-DD.jsonl`，JSON Lines
 *   一行一条对象（`JSON.stringify` + `\\n`；键序不作契约）；
 * - §8.1：审计写入以异步追加执行，写入失败不阻塞调用，但必须记录内部告警；
 * - §8.4：按日切分 + 当日超过 10 MB 切同日序号文件；到期平台清理（`retention.ts`）；
 * - §8.5：脱敏在落盘前单点执行（`sanitize.ts`，本模块每行写入前唯一调用）；
 * - 工单041 / RFC §六条 2：**常开**（无环境门控臂）、有界队列满则丢 + 计数 + dropped
 *   告警载荷、同步入口永不抛错。
 * - 工程母型 `shared/host-trace.ts`：同序 Promise 链保序异步追加、故障隔离只落诊断、
 *   `flush` 等待链尾——只借形态，`CHIPS_TRACE` 门控语义禁借。
 *
 * @remarks 生命周期接线比照 `carrier/` 母型：由组合根构造并注入宿主运行时，
 * 启动期即挂一轮留存清理（构造期入链），shutdown 中最后关闭（终态可观察一致性，
 * 见 `runtime/host-runtime.ts` 注）。
 */

import { appendFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { isUlid, type IPermissionAuditEntry } from '@chips/bridge';

import type { DiagnosticsSink } from '../shared/diagnostics.js';
import { sanitizeAuditEntry } from './sanitize.js';
import { sweepExpiredAuditFiles } from './retention.js';
import {
  AUDIT_DIRECTORY,
  AUDIT_MAX_FILE_BYTES,
  AUDIT_QUEUE_CAPACITY,
  auditFileName,
  isPermissionDenyReason,
  isPermissionAuditAction,
  isPermissionAuditActor,
  isPermissionAuditSource,
  type IPermissionAuditWriter,
  type IPermissionAuditWriterReport,
} from './types.js';

/** ISO 8601 UTC 时刻文法（§8.2「ISO 8601 UTC 时间」；样例 `2026-09-19T10:20:31.482Z` 同形）。 */
const AUDIT_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/** 写入器构造选项（全部注入面，供确定性测试；生产缺省即文档口径）。 */
export interface PermissionAuditWriterOptions {
  /** 用户数据目录（`app.getPath('userData')`；落位 `<userData>/logs/audit/`，比照 production-assembly 既有注入形）。 */
  readonly userDataPath: string;
  /** 诊断口（写失败 / 丢弃 / 清理失败留痕，§8.1「必须记录内部告警」）。 */
  readonly diagnostics: DiagnosticsSink;
  /** 当前时刻（Unix 毫秒）；仅留存清理到期判定消费，缺省 `Date.now`。 */
  readonly now?: () => number;
  /** 有界队列容量覆盖（测试注入面；生产恒 {@link AUDIT_QUEUE_CAPACITY}）。 */
  readonly queueCapacity?: number;
  /** 轮转阈值字节覆盖（测试注入面；生产恒 {@link AUDIT_MAX_FILE_BYTES}）。 */
  readonly maxFileBytes?: number;
}

/** 条目形状校验：返回 `null` 为合法，否则为首个非法点的可读定性。 */
export function validateAuditEntry(entry: IPermissionAuditEntry): string | null {
  if (typeof entry !== 'object' || entry === null) {
    return 'entry 非对象';
  }
  const record = entry as unknown as Record<string, unknown>;
  for (const field of [
    'id',
    'timestamp',
    'action',
    'actor',
    'pluginId',
    'pluginVersion',
    'permission',
    'traceId',
  ] as const) {
    const value = record[field];
    if (typeof value !== 'string' || value.length === 0) {
      return `必填字段 ${field} 缺失或为空`;
    }
  }
  if (!isUlid(record['id'] as string)) {
    return 'id 非 ULID（§8.2）';
  }
  const timestamp = record['timestamp'] as string;
  if (!AUDIT_TIMESTAMP_PATTERN.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    return 'timestamp 非 ISO 8601 UTC（§8.2）';
  }
  if (!isPermissionAuditAction(record['action'] as string)) {
    return 'action 越 §8.2 词表';
  }
  if (!isPermissionAuditActor(record['actor'] as string)) {
    return 'actor 越 §8.2 词表';
  }
  for (const field of ['sessionId', 'qualifier', 'capabilityId', 'target', 'resourceUri', 'requestId'] as const) {
    const value = record[field];
    if (value !== undefined && typeof value !== 'string') {
      return `可选字段 ${field} 非字符串`;
    }
  }
  const source = record['source'];
  if (source !== undefined && (typeof source !== 'string' || !isPermissionAuditSource(source))) {
    return 'source 越 §8.2 词表';
  }
  const reason = record['reason'];
  if (reason !== undefined && (typeof reason !== 'string' || !isPermissionDenyReason(reason))) {
    return 'reason 越 §8.2 词表';
  }
  return null;
}

/** 当日文件的轮转游标。 */
interface RotationState {
  day: string | null;
  serial: number;
  /** 当前活跃文件已有字节数；`-1` 表示当日首写前待探测播种（跨进程重启续写既有文件）。 */
  bytes: number;
}

/**
 * 创建权限审计写入器（常开；纯对象无进程级副作用，目录惰性创建）。
 */
export function createPermissionAuditWriter(options: PermissionAuditWriterOptions): IPermissionAuditWriter {
  const directory = join(options.userDataPath, ...AUDIT_DIRECTORY);
  const diagnostics = options.diagnostics;
  const now = options.now ?? ((): number => Date.now());
  const capacity = options.queueCapacity ?? AUDIT_QUEUE_CAPACITY;
  const maxFileBytes = options.maxFileBytes ?? AUDIT_MAX_FILE_BYTES;

  const queue: IPermissionAuditEntry[] = [];
  const rotation: RotationState = { day: null, serial: 0, bytes: -1 };
  let createdDirectory = false;
  let written = 0;
  let dropped = 0;
  let closed = false;
  let chain: Promise<void> = Promise.resolve();

  /** 丢弃记账 + 内部告警（dropped 计数入告警载荷，立项书段二逐字）。 */
  function dropWithAlarm(message: string, reason: string): void {
    dropped += 1;
    diagnostics.error('permission-audit', message, { droppedCount: dropped, reason });
  }

  async function ensureDirectory(): Promise<void> {
    if (!createdDirectory) {
      await mkdir(directory, { recursive: true });
      createdDirectory = true;
    }
  }

  /** 定位当日活跃序号文件：首写前逐序号探测体量（超阈值即进入下一序号，含进程重启续档臂）。 */
  async function resolveTargetFile(day: string): Promise<string> {
    if (rotation.day !== day) {
      rotation.day = day;
      rotation.serial = 0;
      rotation.bytes = -1;
    }
    if (rotation.bytes === -1) {
      for (;;) {
        const candidate = join(directory, auditFileName(day, rotation.serial));
        try {
          const info = await stat(candidate);
          if (info.size > maxFileBytes) {
            rotation.serial += 1;
            continue;
          }
          rotation.bytes = info.size;
        } catch {
          rotation.bytes = 0;
        }
        break;
      }
    } else if (rotation.bytes > maxFileBytes) {
      rotation.serial += 1;
      rotation.bytes = 0;
    }
    return join(directory, auditFileName(day, rotation.serial));
  }

  /** 落一帧（脱敏单点在此： sanitize → stringify 一行 + `\n`；失败只落诊断不抛出）。 */
  async function appendEntry(entry: IPermissionAuditEntry): Promise<void> {
    const day = entry.timestamp.slice(0, 10);
    const crossedDay = rotation.day !== null && rotation.day !== day;
    try {
      const line = `${JSON.stringify(sanitizeAuditEntry(entry))}\n`;
      await ensureDirectory();
      const filePath = await resolveTargetFile(day);
      await appendFile(filePath, line, 'utf8');
      rotation.bytes += Buffer.byteLength(line, 'utf8');
      written += 1;
    } catch (error: unknown) {
      dropWithAlarm('审计落盘写入失败', error instanceof Error ? error.message : String(error));
    }
    if (crossedDay) {
      await runSweep(); // §8.4 触发时机之「跨日界到期清理」。
    }
  }

  async function drainQueue(): Promise<void> {
    while (queue.length > 0) {
      const entry = queue.shift() as IPermissionAuditEntry;
      await appendEntry(entry);
    }
  }

  /** 留存清理（同序链上串行执行，清理失败只落诊断）。 */
  async function runSweep(): Promise<void> {
    try {
      const report = await sweepExpiredAuditFiles(directory, now(), diagnostics);
      if (report.deleted > 0 || report.retainedHighRisk > 0) {
        diagnostics.warn('permission-audit', '审计留存清理完成', { ...report });
      }
    } catch (error: unknown) {
      diagnostics.error('permission-audit', '审计留存清理异常', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** 同序链挂载一步（宿主 `flush` 等待链尾；步骤内部已全量兜底，此处再吞异常保链不断）。 */
  function schedule(step: () => Promise<void>): void {
    chain = chain.then(step).catch(() => undefined);
  }

  // 启动期清理（立项书段二逐字：启动期 + 跨日界到期清理）——入同序链首位。
  schedule(() => runSweep());

  return {
    enqueue(entry: IPermissionAuditEntry): void {
      if (closed) {
        dropWithAlarm('审计写入器已关闭，条目拒收', 'writer-closed');
        return;
      }
      const invalidReason = validateAuditEntry(entry);
      if (invalidReason !== null) {
        dropWithAlarm('审计条目形状非法，拒绝落盘（§8.2 十六字段契约）', invalidReason);
        return;
      }
      if (queue.length >= capacity) {
        dropWithAlarm('审计队列满载，丢弃新条目（判定面不阻塞）', `queue-full:${String(capacity)}`);
        return;
      }
      queue.push(entry);
      schedule(() => drainQueue());
    },
    async flush(): Promise<void> {
      await chain;
    },
    async close(): Promise<void> {
      if (closed) {
        return;
      }
      closed = true;
      await chain;
    },
    report(): IPermissionAuditWriterReport {
      return { directory, written, dropped, queued: queue.length, closed };
    },
  };
}
