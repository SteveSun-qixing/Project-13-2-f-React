/**
 * 宿主调试追踪导出面（`CHIPS_TRACE`，工单041 修复波 / 任务 #135）。
 *
 * 权威（在册形态，逐条对齐）：
 * - 《调试指南》§2.1：调试追踪落位 `<userData>/logs/trace/trace-YYYY-MM-DD.jsonl`，
 *   按日切分、异步追加，仅供开发诊断，不进入审计留存；
 * - §2.2：开关 `CHIPS_TRACE` 取 `startup,plugin,bridge,event,render,resource` 逗号组合；
 *   开发构建默认开启除 `resource` 外的全部类别，发布构建默认关闭；
 * - §2.3：每行一条 JSON 记录，公共字段 `timestamp / category / traceId / pluginId /
 *   pluginVersion / sessionId / windowId / phase / outcome / errorCode / durationMs /
 *   details`；§5.2 补充 Bridge 专属字段（`requestId / channel / direction /
 *   capabilityId / operation / retryable`，`durationMs` = Bridge 收到请求到返回结果的
 *   耗时）；§6.1 补充渲染侧 `message` 字段；
 * - §2.5：一次用户操作或外部触发产生一个 `traceId`。工单041 修复波在册的「链路未贯通、
 *   操作边界就地生成」自认缺口已由工单046 段一翻正：`bridge:request` 请求帧携
 *   `traceId` 全链贯通（preload→`bridge:request`→router→事件下行四段），Bridge 插桩点
 *   以请求帧取值为记录源；仅当帧上缺键或触发源本就不是 Bridge 请求（启动里程碑、
 *   文档服务操作边界等）时，经 {@link IHostTrace.newTraceId} 就地生成兜底，
 *   禁另造关联键；
 * - §8.2：`startup` 类别记录进程启动与窗口就绪等里程碑时间戳；
 * - 《渲染引擎设计》§10.1 与 `@chips/perf` 工具在册命名（`tests/perf/src/scenarios.ts`
 *   `MARKERS`：「规范标记点名称：Host / RenderEngine / 解析器经 CHIPS_TRACE 导出时的
 *   统一命名」）：`phase` 取规范标记点名（如 `render:request-accepted` /
 *   `document:parsed`），使测量工具可无歧义还原阶段边界。
 *
 * @remarks
 * - **进程级诊断设施**：与 `native-bridge` 模块缓存单例同理（Node 模块缓存保证主进程
 *   bundle 内单例语义），经 {@link initHostTrace} 在壳启动装配后初始化、
 *   {@link shutdownHostTrace} 在退出收口时落盘。未初始化时 {@link getHostTrace} 交付
 *   恒关单例——所有插桩点零行为变化（能力单测与未初始化臂天然回退，不强制每个夹具
 *   注入替身）。跨层签名透传（router/service/channel 全链路加参）不在本波展开：
 *   追踪是横切诊断设施而非业务能力，形态见 findings 交主智能体备案。
 * - **故障隔离**：记录面永不向调用方抛错；写盘失败经诊断口留痕并保留计数
 *   （`droppedCount`），追踪缺位不得影响宿主任何功能路径。
 * - **异步追加**：写入经同序 Promise 链排队（保序）；`flush()` 等待链尾完成，
 *   壳退出前由 `main.ts` 收口调用，保证采集侧在进程结束后读取无缺口。
 * - `details` 不含字节内容与平台外敏感路径（§2.3 红线）：插桩点只放受管引用与
 *   稳定标识。
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** 追踪类别（§2.1/§2.2 在册全集）。 */
export const HOST_TRACE_CATEGORIES = ['startup', 'plugin', 'bridge', 'event', 'render', 'resource'] as const;

/** 追踪类别。 */
export type HostTraceCategory = (typeof HOST_TRACE_CATEGORIES)[number];

/** `outcome` 在册取值（§2.3）。 */
export type HostTraceOutcome = 'allow' | 'deny' | 'ok' | 'error' | 'timeout' | 'cancelled';

/** 一条追踪记录的可写入形态（各章专属字段按在册集合全量落行，缺位以 `null` 呈现）。 */
export interface HostTraceRecord {
  /** 记录时刻，ISO 8601 UTC（§2.3）。 */
  readonly timestamp: string;
  readonly category: HostTraceCategory;
  readonly traceId: string | null;
  readonly pluginId: string | null;
  readonly pluginVersion: string | null;
  readonly sessionId: string | null;
  readonly windowId: number | null;
  readonly phase: string;
  readonly outcome: HostTraceOutcome | null;
  readonly errorCode: string | null;
  readonly durationMs: number | null;
  readonly details: Readonly<Record<string, unknown>> | null;
  /** Bridge 专属（§5.2）。 */
  readonly requestId: string | null;
  readonly channel: string | null;
  readonly direction: 'in' | 'out' | null;
  readonly capabilityId: string | null;
  readonly operation: string | null;
  readonly retryable: boolean | null;
  /** 渲染侧补充（§6.1）。 */
  readonly message: string | null;
}

/** 记录输入（公共字段子集 + 各章专属字段；缺位落 `null`）。 */
export interface HostTraceRecordInput {
  readonly category: HostTraceCategory;
  readonly phase: string;
  readonly traceId?: string;
  readonly pluginId?: string;
  readonly pluginVersion?: string;
  readonly sessionId?: string;
  readonly windowId?: number;
  readonly outcome?: HostTraceOutcome;
  readonly errorCode?: string | null;
  readonly durationMs?: number;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly requestId?: string;
  readonly channel?: string;
  readonly direction?: 'in' | 'out';
  readonly capabilityId?: string;
  readonly operation?: string;
  readonly retryable?: boolean;
  readonly message?: string;
  /** 覆盖记录时刻（仅供启动里程碑按事实时刻回填，如 `startup:process-start`）。 */
  readonly timestampOverride?: string;
}

/** 追踪器接口。 */
export interface IHostTrace {
  /** 该类别当前是否启用（调用侧可用其短路昂贵的 details 构造）。 */
  enabled(category: HostTraceCategory): boolean;
  /** 生成一个操作级 traceId（§2.5：一次用户操作/外部触发一个 ID；类别全关时也可调用）。 */
  newTraceId(): string;
  /** 追加一条记录（永不抛错）。 */
  record(input: HostTraceRecordInput): void;
  /** 等待全部在途写入落盘（壳退出收口与采集侧确定性读取用）。 */
  flush(): Promise<void>;
  /** 关闭（后续 `record` 静默丢弃）；幂等。 */
  close(): Promise<void>;
  /** 累计写入条数（诊断与测试）。 */
  writtenCount(): number;
  /** 累计因故障丢弃条数（诊断与测试）。 */
  droppedCount(): number;
}

/** 追踪器构造选项（全部注入面，供确定性测试）。 */
export interface HostTraceOptions {
  /** 用户数据目录（`app.getPath('userData')`；追踪落位 `<userData>/logs/trace/`）。 */
  readonly userDataPath: string;
  /** 生效类别集合（经 {@link resolveHostTraceCategories} 解析，或调用方直给）。 */
  readonly categories: ReadonlySet<HostTraceCategory>;
  /** 环境读取（仅 `resolveHostTraceCategories` 消费）。 */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** ISO 时钟；缺省 `new Date().toISOString()`。 */
  readonly clock?: () => string;
  /** traceId 生成器；缺省单调计数 + 随机段（§2.5 操作级 ID，非安全用途）。 */
  readonly traceIdFactory?: () => string;
  /** 诊断口（写盘失败留痕）。 */
  readonly onFault?: (message: string, reason: string) => void;
}

/** 缺省 traceId 前缀（与《调试指南》样例 `t-xxxx` 同族可读形态）。 */
const TRACE_ID_PREFIX = 't-host';

function defaultTraceIdFactory(): () => string {
  let counter = 0;
  const salt = Math.random().toString(36).slice(2, 8);
  return () => {
    counter += 1;
    return `${TRACE_ID_PREFIX}-${salt}-${String(counter.toString(36))}`;
  };
}

/**
 * 解析生效追踪类别（§2.2 开关语义）：
 *
 * - `CHIPS_TRACE` 显式给定 → 逐逗号取在册类别名（非法 token 忽略并留痕）；空串 = 全关；
 * - `CHIPS_TRACE` 缺位 → 开发构建开启除 `resource` 外全部类别；发布构建关闭。
 *
 * @param env 进程环境。
 * @param isPackaged 发布打包判据（Electron `app.isPackaged`）。
 * @param onIgnored 非法 token 回调（诊断留痕）。
 */
export function resolveHostTraceCategories(
  env: Readonly<Record<string, string | undefined>>,
  isPackaged: boolean,
  onIgnored?: (token: string) => void,
): ReadonlySet<HostTraceCategory> {
  const raw = env['CHIPS_TRACE'];
  if (raw === undefined) {
    if (isPackaged) {
      return new Set<HostTraceCategory>();
    }
    return new Set<HostTraceCategory>(HOST_TRACE_CATEGORIES.filter((category) => category !== 'resource'));
  }
  const categories = new Set<HostTraceCategory>();
  for (const token of raw.split(',')) {
    const trimmed = token.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if ((HOST_TRACE_CATEGORIES as readonly string[]).includes(trimmed)) {
      categories.add(trimmed as HostTraceCategory);
    } else {
      onIgnored?.(trimmed);
    }
  }
  return categories;
}

/** 按日期取追踪文件名（§2.1 按日切分；UTC 日期，与 `timestamp` 同一时间轴）。 */
export function hostTraceFileName(isoTimestamp: string): string {
  return `trace-${isoTimestamp.slice(0, 10)}.jsonl`;
}

/** 恒关单例（未初始化缺省臂）。 */
const DISABLED_TRACE: IHostTrace = {
  enabled: () => false,
  newTraceId: defaultTraceIdFactory(),
  record: () => undefined,
  flush: () => Promise.resolve(),
  close: () => Promise.resolve(),
  writtenCount: () => 0,
  droppedCount: () => 0,
};

/**
 * 构造追踪器（纯对象，无进程级副作用；单例经 {@link initHostTrace} 持有）。
 */
export function createHostTrace(options: HostTraceOptions): IHostTrace {
  const clock = options.clock ?? (() => new Date().toISOString());
  const nextTraceId = options.traceIdFactory ?? defaultTraceIdFactory();
  const traceDir = join(options.userDataPath, 'logs', 'trace');
  const enabledCategories = options.categories;
  let queue: Promise<void> = Promise.resolve();
  let createdDirs = new Set<string>();
  let written = 0;
  let dropped = 0;
  let closed = false;

  function toRecord(input: HostTraceRecordInput): HostTraceRecord {
    const timestamp = input.timestampOverride ?? clock();
    return {
      timestamp,
      category: input.category,
      traceId: input.traceId ?? null,
      pluginId: input.pluginId ?? null,
      pluginVersion: input.pluginVersion ?? null,
      sessionId: input.sessionId ?? null,
      windowId: input.windowId ?? null,
      phase: input.phase,
      outcome: input.outcome ?? null,
      errorCode: input.errorCode ?? null,
      durationMs: input.durationMs ?? null,
      details: input.details ?? null,
      requestId: input.requestId ?? null,
      channel: input.channel ?? null,
      direction: input.direction ?? null,
      capabilityId: input.capabilityId ?? null,
      operation: input.operation ?? null,
      retryable: input.retryable ?? null,
      message: input.message ?? null,
    };
  }

  async function appendLine(record: HostTraceRecord): Promise<void> {
    const filePath = join(traceDir, hostTraceFileName(record.timestamp));
    try {
      if (!createdDirs.has(dirname(filePath))) {
        await mkdir(dirname(filePath), { recursive: true });
        createdDirs = new Set(createdDirs).add(dirname(filePath));
      }
      await appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
      written += 1;
    } catch (error: unknown) {
      dropped += 1;
      options.onFault?.('调试追踪写入失败', error instanceof Error ? error.message : String(error));
    }
  }

  return {
    enabled: (category) => !closed && enabledCategories.has(category),
    newTraceId: () => nextTraceId(),
    record: (input) => {
      if (closed || !enabledCategories.has(input.category)) {
        return;
      }
      let record: HostTraceRecord;
      try {
        record = toRecord(input);
      } catch (error: unknown) {
        dropped += 1;
        options.onFault?.('调试追踪记录构造失败', error instanceof Error ? error.message : String(error));
        return;
      }
      // 同序链：记录按调用序落行（§2.4 异步追加语义 + 崩溃前尾部放宽口径不变）。
      queue = queue.then(() => appendLine(record));
      queue.catch(() => undefined);
    },
    flush: async () => {
      await queue;
    },
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      await queue;
    },
    writtenCount: () => written,
    droppedCount: () => dropped,
  };
}

/** 进程级单例持有位（主进程 bundle 内唯一；vitest 经 `resetHostTrace` 隔离）。 */
let activeTrace: IHostTrace = DISABLED_TRACE;

/**
 * 初始化进程级追踪单例（壳启动 `app.whenReady()` 取得 `userDataPath` 后调用）。
 * 重复调用即重建（旧实例由调用方负责 `close`；启动路径上不存在并发初始化）。
 */
export function initHostTrace(options: HostTraceOptions): IHostTrace {
  activeTrace = createHostTrace(options);
  return activeTrace;
}

/** 取当前追踪器（未初始化时为恒关单例——插桩点零行为变化）。 */
export function getHostTrace(): IHostTrace {
  return activeTrace;
}

/** 复位为恒关单例（退出收口与测试隔离）。 */
export function resetHostTrace(): void {
  activeTrace = DISABLED_TRACE;
}

/** 关闭当前追踪器并复位单例（壳退出收口）。 */
export async function shutdownHostTrace(): Promise<void> {
  const trace = activeTrace;
  resetHostTrace();
  await trace.close();
}
