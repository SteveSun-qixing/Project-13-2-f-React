import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PerfError } from '../errors';
import { MARKERS } from '../scenarios';

/**
 * 宿主 `CHIPS_TRACE` 导出面的采集侧消费（工单041① / 任务 #135）。
 *
 * 与宿主 `packages/host/src/shared/host-trace.ts` 的落盘形状逐字段对齐：
 * - 文件：`<userData>/logs/trace/trace-YYYY-MM-DD.jsonl`（《调试指南》§2.1，
 *   UTC 日期切分，与记录 `timestamp` 同一时间轴）；
 * - 每行一条 JSON 记录，公共字段 §2.3（缺位以 `null` 呈现）；
 * - `phase` 取 `@chips/perf` 在册规范标记点名（`scenarios.ts` `MARKERS`），
 *   `durationMs` 为该记录所代表分段的实测耗时。
 *
 * 共享 userData 的串扰防线（真进程采集为用户数据目录未重定向，宿主实例共用
 * 追踪目录）：① 采集串行纪律（同时至多一个宿主实例）；② 时间窗过滤——只消费
 * `sinceWallIso` 前移 §2.4 放宽窗（2 s）之后的记录；③ fail-closed 唯一性——
 * 每轮视图构建探针携带当轮唯一 `requestId` 作关联链锚，逐环配对必须**恰好一条**，
 * 歧义即抛错不猜数。
 */

/** 一条追踪记录的读取形状（消费侧只声明用到的字段，其余容忍存在）。 */
export interface HostTraceRecord {
  readonly timestamp: string;
  readonly category: string;
  readonly traceId: string | null;
  readonly sessionId: string | null;
  readonly phase: string;
  readonly outcome: string | null;
  readonly errorCode: string | null;
  readonly durationMs: number | null;
  readonly details: Readonly<Record<string, unknown>> | null;
}

/** 记录 `timestamp` 的按日文件名（与宿主 `hostTraceFileName` 同规则）。 */
export function hostTraceFileName(isoTimestamp: string): string {
  return `trace-${isoTimestamp.slice(0, 10)}.jsonl`;
}

/** 追踪目录（`<userData>/logs/trace`）。 */
export function hostTraceDir(userDataPath: string): string {
  return join(userDataPath, 'logs', 'trace');
}

/** 解析 JSONL 文本为记录序列；空行跳过，坏行/缺字段 fail-closed 抛错。 */
export function parseHostTraceLines(text: string): readonly HostTraceRecord[] {
  const records: HostTraceRecord[] = [];
  const lines = text.split('\n');
  for (const [index, line] of lines.entries()) {
    if (line.trim().length === 0) {
      continue;
    }
    let value: unknown;
    try {
      value = JSON.parse(line) as unknown;
    } catch (error: unknown) {
      throw new PerfError(
        'PERF_INPUT_INVALID',
        `追踪记录第 ${String(index + 1)} 行不是合法 JSON：${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new PerfError('PERF_INPUT_INVALID', `追踪记录第 ${String(index + 1)} 行不是对象`);
    }
    const raw = value as Record<string, unknown>;
    if (
      typeof raw['timestamp'] !== 'string' ||
      typeof raw['category'] !== 'string' ||
      typeof raw['phase'] !== 'string'
    ) {
      throw new PerfError(
        'PERF_INPUT_INVALID',
        `追踪记录第 ${String(index + 1)} 行缺少 timestamp/category/phase 必备字段`
      );
    }
    records.push({
      timestamp: raw['timestamp'],
      category: raw['category'],
      traceId: typeof raw['traceId'] === 'string' ? raw['traceId'] : null,
      sessionId: typeof raw['sessionId'] === 'string' ? raw['sessionId'] : null,
      phase: raw['phase'],
      outcome: typeof raw['outcome'] === 'string' ? raw['outcome'] : null,
      errorCode: typeof raw['errorCode'] === 'string' ? raw['errorCode'] : null,
      durationMs: typeof raw['durationMs'] === 'number' ? raw['durationMs'] : null,
      details:
        typeof raw['details'] === 'object' && raw['details'] !== null
          ? (raw['details'] as Readonly<Record<string, unknown>>)
          : null,
    });
  }
  return records;
}

/** §2.4 崩溃前放宽窗（毫秒）：时间窗过滤的统一放宽量。 */
export const TRACE_WINDOW_WIDEN_MS = 2_000;

/** 读取时间窗 `[sinceWallIso - widenMs, +∞)` 内的全部追踪记录（当日/跨日文件缺失以 EOF 容忍）。 */
export async function readHostTraceRecords(
  userDataPath: string,
  sinceWallIso: string,
  widenMs: number = TRACE_WINDOW_WIDEN_MS
): Promise<readonly HostTraceRecord[]> {
  const sinceMs = Date.parse(sinceWallIso);
  if (!Number.isFinite(sinceMs)) {
    throw new PerfError('PERF_INPUT_INVALID', `时间窗起点不是合法 ISO 时刻：${sinceWallIso}`);
  }
  const windowStartMs = sinceMs - widenMs;
  const windowStartIso = new Date(windowStartMs).toISOString();
  const currentDate = new Date();
  const dates: string[] = [];
  const cursor = new Date(windowStartMs);
  for (;;) {
    const iso = cursor.toISOString();
    dates.push(iso.slice(0, 10));
    if (iso.slice(0, 10) >= currentDate.toISOString().slice(0, 10)) {
      break;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const records: HostTraceRecord[] = [];
  for (const date of [...new Set(dates)]) {
    const filePath = join(hostTraceDir(userDataPath), `trace-${date}.jsonl`);
    let text: string;
    try {
      text = await readFile(filePath, 'utf8');
    } catch (error: unknown) {
      const code = (error as { code?: unknown }).code;
      if (code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    for (const record of parseHostTraceLines(text)) {
      if (record.timestamp >= windowStartIso) {
        records.push(record);
      }
    }
  }
  return records;
}

/** 视图构建段导出相位名（与宿主 `view-channel.ts` `DOCUMENT_VIEW_TRACE_PHASES` 字面量对齐；建议名在册化归 findings）。 */
export const VIEW_BUILT_PHASE = 'render:view-built';
/** 视图构建失败段导出相位名（同上）。 */
export const VIEW_BUILD_FAILED_PHASE = 'render:view-build-failed';

/** open-card 阶段分解的宿主导出结果。 */
export interface OpenCardStageDurations {
  /** 装载/路由段：请求进入 executeOpen → `render:request-accepted`（宿主就地实测）。 */
  readonly loadMs: number;
  /** 解析段：`render:request-accepted` → `document:parsed`（即场景登记 `open_card.parse` 边界）。 */
  readonly parseMs: number;
  /** 视图构建段：`document-view:build` 请求在主进程构建侧的实测耗时。 */
  readonly viewBuildMs: number;
  /** 三段共用的操作级 traceId（§2.5）。 */
  readonly traceId: string;
  /** 关联链锚定的文档 ID（交叉核验回带）。 */
  readonly documentId: string;
}

function uniqueStageRecord(
  records: readonly HostTraceRecord[],
  phase: string,
  matches: (record: HostTraceRecord) => boolean,
  what: string
): { readonly record: HostTraceRecord; readonly durationMs: number } {
  const found = records.filter(
    (record) => record.phase === phase && record.category === 'render' && matches(record)
  );
  if (found.length === 0) {
    throw new PerfError(
      'PERF_ADAPTER_INVALID',
      `宿主追踪窗口内缺少 ${what}（${phase}）记录：导出面已建，缺数据按真采集失败处理，不回落到缺测口径`
    );
  }
  if (found.length > 1) {
    throw new PerfError(
      'PERF_ADAPTER_INVALID',
      `宿主追踪窗口内 ${what}（${phase}）记录不唯一（${String(found.length)} 条）：fail-closed 不猜数`
    );
  }
  const record = found[0];
  if (record === undefined) {
    throw new PerfError('PERF_ADAPTER_INVALID', `宿主追踪记录 ${what} 缺失（数组越界）`);
  }
  if (record.durationMs === null || !Number.isFinite(record.durationMs)) {
    throw new PerfError('PERF_ADAPTER_INVALID', `宿主追踪记录 ${what} 缺少有效 durationMs`);
  }
  return { record, durationMs: record.durationMs };
}

function detailsField(record: HostTraceRecord, key: string): string | null {
  const value = record.details?.[key];
  return typeof value === 'string' ? value : null;
}

/**
 * 截取**当前宿主运行段**的记录（共享 userData 追踪目录的抗串扰主干）。
 *
 * 依据：① 采集串行纪律（前一实例退出后才启动下一实例，其全部记录必先于新实例
 * 落行）；② 宿主同序追加（§2.4，`startup:process-start` 是该实例第一条落行记录）。
 * 故文件中**最后一条** `startup:process-start` 之后的全部记录必属当前实例——
 * documentId/managedUri 等内容派生标识跨轮相同时，关联链只在单实例段内求唯一，
 * 不与历史轮次碰撞。无锚（startup 类别未导出/窗口未覆盖）fail-closed 抛错。
 */
export function selectCurrentHostRunRecords(
  records: readonly HostTraceRecord[]
): readonly HostTraceRecord[] {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record !== undefined && record.phase === MARKERS.processStart) {
      return records.slice(index + 1);
    }
  }
  throw new PerfError(
    'PERF_ADAPTER_INVALID',
    '追踪窗口内无 startup:process-start 运行段锚（宿主启动里程碑导出缺位，fail-closed）'
  );
}

/**
 * 从追踪记录还原 open-card 三段阶段耗时（装载 / 解析 / 视图构建）。
 *
 * 关联链（共享 userData 追踪目录下的抗串扰设计，每轮视图构建探针携带**当轮唯一**
 * `probeRequestId`）：
 * `render:view-built`（`details.requestId` = 探针 ID，唯一）→ 同 `details.documentId`
 * 的 `document:parsed`（唯一）→ 同 `traceId` 的 `render:request-accepted`（唯一），
 * 并交叉核验 accepted 与 built 的 `details.source` 一致。每一环 fail-closed：
 * 缺位或歧义即抛 `PERF_ADAPTER_INVALID`，不猜数、不回落缺测口径。
 */
export function openCardStagesFromTrace(
  records: readonly HostTraceRecord[],
  probeRequestId: string
): OpenCardStageDurations {
  const built = uniqueStageRecord(
    records,
    VIEW_BUILT_PHASE,
    (record) => detailsField(record, 'requestId') === probeRequestId,
    '视图构建段'
  );
  const documentId = detailsField(built.record, 'documentId');
  if (documentId === null) {
    throw new PerfError('PERF_ADAPTER_INVALID', '视图构建记录 details 缺少 documentId');
  }
  const parsed = uniqueStageRecord(
    records,
    MARKERS.documentParsed,
    (record) => detailsField(record, 'documentId') === documentId,
    '解析段'
  );
  if (parsed.record.traceId === null) {
    throw new PerfError('PERF_ADAPTER_INVALID', '解析段记录缺少 traceId（§2.5 操作级 ID 未闭合）');
  }
  const accepted = uniqueStageRecord(
    records,
    MARKERS.requestAccepted,
    (record) => record.traceId === parsed.record.traceId,
    '请求接受段'
  );
  const builtSource = detailsField(built.record, 'source');
  const acceptedSource = detailsField(accepted.record, 'source');
  if (builtSource === null || acceptedSource === null || builtSource !== acceptedSource) {
    throw new PerfError(
      'PERF_ADAPTER_INVALID',
      `open-card 阶段记录 source 交叉核验失败（accepted=${String(acceptedSource)}，view-built=${String(builtSource)}）`
    );
  }
  return {
    loadMs: accepted.durationMs,
    parseMs: parsed.durationMs,
    viewBuildMs: built.durationMs,
    traceId: parsed.record.traceId,
    documentId,
  };
}

/**
 * 轮等待待 open-card 阶段记录齐备后还原三段耗时。
 *
 * 宿主追踪为异步追加（§2.4），`document-view:build` 回包先于其落行完成属合法时序；
 * 同序链保证 `request-accepted → document:parsed → view-built` 落行有序，故以
 * 视图构建段出现为齐备信号，超时后仍走 `openCardStagesFromTrace` 如实抛错。
 * 窗口内若出现当轮探针的构建失败记录，立即抛错并附在册错误码（不再空等）。
 */
export async function waitForOpenCardStages(
  userDataPath: string,
  sinceWallIso: string,
  probeRequestId: string,
  options: { readonly timeoutMs?: number; readonly intervalMs?: number } = {}
): Promise<OpenCardStageDurations> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const intervalMs = options.intervalMs ?? 100;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const records = await readHostTraceRecords(userDataPath, sinceWallIso);
    let segment: readonly HostTraceRecord[] | null;
    try {
      segment = selectCurrentHostRunRecords(records);
    } catch {
      // 运行段锚尚未落行（宿主刚起步）：继续轮等，超时后由末次调用如实抛锚缺失。
      segment = null;
    }
    if (segment !== null) {
      const failed = segment.find(
        (record) =>
          record.phase === VIEW_BUILD_FAILED_PHASE &&
          detailsField(record, 'requestId') === probeRequestId
      );
      if (failed !== undefined) {
        throw new PerfError(
          'PERF_ADAPTER_INVALID',
          `视图构建探针被宿主拒绝（${failed.errorCode ?? '未带回错误码'}），阶段导出不可还原`
        );
      }
      const builtArrived = segment.some(
        (record) =>
          record.phase === VIEW_BUILT_PHASE && detailsField(record, 'requestId') === probeRequestId
      );
      if (builtArrived || Date.now() >= deadline) {
        return openCardStagesFromTrace(segment, probeRequestId);
      }
    } else if (Date.now() >= deadline) {
      // 时限到仍无运行段锚：窗口内一条记录都没有 → 「缺少视图构建段」是第一事实
      // （宿主可能根本没起来）；有记录却无锚 → 交由分段闸如实抛锚缺失，不静默降级。
      return openCardStagesFromTrace(
        records.length === 0 ? [] : selectCurrentHostRunRecords(records),
        probeRequestId
      );
    }
    await new Promise((resolveSleep) => {
      setTimeout(resolveSleep, intervalMs);
    });
  }
}
