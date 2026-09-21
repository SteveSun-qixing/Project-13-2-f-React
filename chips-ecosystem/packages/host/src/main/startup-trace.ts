/**
 * 启动段调试追踪装配（工单041 修复波 / 任务 #135）。
 *
 * 权威：《调试指南》§2.1–§2.3（通道形态、开关与公共字段）、§8.2（`startup` 类别记录
 * 进程启动、平台就绪与窗口就绪等里程碑时间戳）；追踪器本体与门控见
 * `../shared/host-trace.ts`。
 *
 * @remarks
 * - 单例初始化点在 `startHostMain` 取得 `userDataPath` 之后（装配段），退出收口经
 *   `shutdownHostTrace` 等待写入链落盘（采集侧「进程结束后读取无缺口」的确定性前提）。
 * - `startup:process-start` 的 `timestamp` 按事实时刻回填（`performance.timeOrigin`），
 *   不是记录写出时刻——异步追加语义下里程碑值不失真。
 * - 打包判据取 Electron `app.isPackaged` 的窄读（`electronModule.app` 只读探测，
 *   不经 `IElectronRuntime` 扩面——追踪是诊断设施，不扩张壳能力面）。
 */

import { performance } from 'node:perf_hooks';

import {
  getHostTrace,
  initHostTrace,
  resolveHostTraceCategories,
  shutdownHostTrace,
  type HostTraceCategory,
  type IHostTrace,
} from '../shared/host-trace.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import { readMainProcessEnv } from './process-env.js';

/** 启动里程碑在册标记点名（《调试指南》§8.2 与 `@chips/perf` `MARKERS` 规范命名同源）。 */
export const STARTUP_TRACE_PHASES = {
  processStart: 'startup:process-start',
  platformReady: 'startup:platform-ready',
  windowReady: 'startup:window-ready',
} as const;

/** 从 `require('electron')` 返回值或测试替身窄读打包判据。 */
export function readIsPackaged(electronModule: unknown): boolean {
  if (typeof electronModule !== 'object' || electronModule === null) {
    return false;
  }
  const app = (electronModule as { app?: { isPackaged?: unknown } }).app;
  return app?.isPackaged === true;
}

/** 启动追踪装配结果（壳生命周期消费）。 */
export interface HostStartupTrace {
  /** 追踪器（门控判据已闭合；未启用类别时 `record` 静默）。 */
  readonly trace: IHostTrace;
  /** 本次进程运行级 traceId（`startup` 里程碑共用，§2.5「一次外部触发」口径）。 */
  readonly runTraceId: string;
  /** 记录一条 `startup` 里程碑（类别未启用即零开销短路）。 */
  recordStartup(phase: string, durationMs?: number): void;
  /** 收口：关闭追踪器并复位单例（幂等；退出链调用）。 */
  shutdown(): Promise<void>;
}

/**
 * 初始化启动段追踪（`app.whenReady()` 后、装配前调用）。
 *
 * @param options 装配项。
 */
export function createStartupTrace(options: {
  readonly electronModule: unknown;
  readonly userDataPath: string;
  readonly diagnostics: DiagnosticsSink;
}): HostStartupTrace {
  const env = readMainProcessEnv();
  const ignored: string[] = [];
  const categories: ReadonlySet<HostTraceCategory> = resolveHostTraceCategories(
    env,
    readIsPackaged(options.electronModule),
    (token) => ignored.push(token),
  );
  if (ignored.length > 0) {
    options.diagnostics.warn('trace', 'CHIPS_TRACE 含未登记类别，已忽略', { tokens: ignored });
  }
  const trace = initHostTrace({
    userDataPath: options.userDataPath,
    categories,
    env,
    onFault: (message, reason) => options.diagnostics.warn('trace', message, { reason }),
  });
  const runTraceId = trace.enabled('startup') ? trace.newTraceId() : '';
  if (runTraceId.length > 0) {
    trace.record({
      category: 'startup',
      phase: STARTUP_TRACE_PHASES.processStart,
      traceId: runTraceId,
      timestampOverride: new Date(Math.round(performance.timeOrigin)).toISOString(),
    });
    trace.record({
      category: 'startup',
      phase: STARTUP_TRACE_PHASES.platformReady,
      traceId: runTraceId,
      durationMs: performance.now(),
    });
  }
  return {
    trace,
    runTraceId,
    recordStartup: (phase, durationMs) => {
      if (!getHostTrace().enabled('startup')) {
        return;
      }
      getHostTrace().record({
        category: 'startup',
        phase,
        ...(runTraceId.length > 0 ? { traceId: runTraceId } : {}),
        ...(durationMs === undefined ? {} : { durationMs }),
      });
    },
    shutdown: async () => {
      await shutdownHostTrace();
    },
  };
}
