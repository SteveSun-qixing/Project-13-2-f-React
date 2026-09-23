import { pathToFileURL } from 'node:url';

import type { AdapterRunContext, AdapterRunResult, PerfAdapter } from '../adapters';
import { DEFAULT_CONFIG } from '../thresholds';
import { SCENARIOS } from '../scenarios';
import type { MemorySample } from '../memory';
import {
  collectHostRssBytes,
  collectHostUserDataPath,
  loadChipsE2eRuntime,
  resolveDocumentHostEntry,
  resolveFormalAppEntry,
  type ChipsE2eRuntimeSurface,
  type HostInstanceSurface,
  type PageSurface,
} from './e2e-runtime';
import { coldStartMarkers, openCardMarkers } from './observations';
import { waitForOpenCardStages } from './host-trace';

/**
 * 真进程宿主适配器（W2-P1-6 / 任务 #121 段A）。
 *
 * 把 `@chips/perf` 的四类原始信号（markers / frameTimestampsMs / memorySamples /
 * metricSamples）接到**真实宿主进程**：复用 `@chips/e2e` 公开承载辅助
 * （`launchHostApp` / `closeHostApp` / `createTestWorkspace` / `openDocument`，
 * 运行时惰性装载，见 `e2e-runtime.ts`），数值一律来自实测采样。
 *
 * `provides` 登记四个可采集场景；其中能走通既有 `measureScenario` 管线的是：
 * - `cold-start`（markers 路径，无阶段分解，标记点来自外部观测归一）；
 * - `scroll-fps`（frames 路径，rAF 时间戳；`render_update_ms` 为缺测臂，
 *   由 `observations.ts` 登记表如实呈现）；
 * - `idle-memory`（memory 路径，`app.getAppMetrics()` 全进程 RSS 合计）。
 * `open-card` 不经 `measureScenario`（阶段标记仍不完整：frame-created / frame-ready /
 * first-frame-commit 随 #99 渲染臂接入），由采集器按 `totalSpan` 单跨度组装；
 * 装载 / 解析 / 视图构建三段自工单041① 起经宿主 `CHIPS_TRACE` JSONL 导出面
 * 消费还原（`src/real/host-trace.ts` 关联链，fail-closed），逐轮写入 `notes`；
 * `open-box` 整场景不可测（视图面随 W4），不在 `provides`，由探针
 * {@link observeOpenBox} 产出真进程证据。缺口语义全部登记于 `真进程采集-设计.md` §三。
 */

/** 适配器构造选项（全部可注入，供纯逻辑测试替换时钟/运行时）。 */
export interface RealHostAdapterOptions {
  /** `@chips/e2e` 公开面装载器；缺省为真装载（fail-closed）。 */
  readonly runtime?: () => Promise<ChipsE2eRuntimeSurface>;
  /** 单调时钟（毫秒）；缺省 `performance.now`。 */
  readonly clock?: () => number;
  /** 空闲窗口（毫秒）；缺省取工具默认配置（权威口径 G7 的 5 分钟）。 */
  readonly idleWindowMs?: number;
  /** 内存采样间隔（毫秒）；缺省取场景登记的 `sampleIntervalMs`。 */
  readonly sampleIntervalMs?: number;
  /** 帧采样最短时长（毫秒）；缺省取场景登记的 `minDurationMs`。 */
  readonly frameDurationMs?: number;
}

const DEFAULT_SAMPLE_INTERVAL_MS = SCENARIOS['idle-memory'].sampling.sampleIntervalMs ?? 5_000;
const DEFAULT_FRAME_DURATION_MS = SCENARIOS['scroll-fps'].sampling.minDurationMs ?? 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** 阶段毫秒数报告形态（两位小数，不新造舍入口径，仅呈现层）。 */
function formatStageMs(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/**
 * open-card 视图构建探针回包闸：失败臂（带 `error` 面）与非对象回包 fail-closed
 * 抛错；成功臂回传判型字符串如实呈现。
 */
function assertViewProbeResolved(reply: unknown, what: string): string {
  if (typeof reply !== 'object' || reply === null) {
    throw new Error(`${what} 回包不是对象（真进程采集 fail-closed）。`);
  }
  const shape = reply as ViewChannelReplyShape;
  const replyType = typeof shape.type === 'string' ? shape.type : String(shape.type);
  const rawCode = shape.error?.code;
  if (
    rawCode !== undefined ||
    replyType === 'channel-missing' ||
    replyType === 'channel-rejected'
  ) {
    throw new Error(
      `${what} 被宿主拒绝（判型 ${replyType}${typeof rawCode === 'string' ? `，在册码 ${rawCode}` : ''}），阶段导出不可还原。`
    );
  }
  return replyType;
}

/** 文档能力场景的在册承载：E2E 入口 + 接线模块 + 工作区根 env（与金链路 spec 同源通道）。 */
async function launchDocumentHost(
  runtime: ChipsE2eRuntimeSurface,
  workspacePath: string,
  appEntry: string,
  wiringModulePath: string
): Promise<HostInstanceSurface> {
  return runtime.launchHostApp({
    appEntry,
    workspacePath,
    env: {
      CHIPS_E2E_DOCUMENT_WIRING_MODULE: wiringModulePath,
      CHIPS_E2E_DOCUMENT_ROOT: workspacePath,
      // 工单041①：显式钉住追踪类别（开发默认臂本就覆盖除 resource 外全部，此处
      // 显式化以隔绝外层 shell 环境污染/篡改，采集面只依赖 startup/bridge/render）。
      CHIPS_TRACE: 'startup,bridge,render',
    },
  });
}

/**
 * rAF 采集页面函数（纯 JS 字符串源）。
 *
 * 页面侧函数一律以字符串源码经 Playwright 求值：tsx/esbuild 的 `keepNames` 会给
 * 序列化函数注入 `__name` 辅助符，浏览器侧不存在该绑定（实测 `ReferenceError:
 * __name is not defined`）；字符串源码从根上消除该注入面。
 * 字符串表达式求值**不会**被 Playwright 自动调用（实测「字符串 + 参数」形态回包
 * 为 `undefined`），必须以 IIFE 调用表达式承载实参。
 */
const FRAME_TIMESTAMP_COLLECTION = `(duration) =>
  new Promise((resolve) => {
    const collected = [];
    let start = -1;
    const onFrame = (time) => {
      if (start < 0) {
        start = time;
      }
      const last = collected[collected.length - 1];
      if (last === undefined || time > last) {
        collected.push(time);
      }
      if (time - start < duration) {
        requestAnimationFrame(onFrame);
      } else {
        resolve(collected);
      }
    };
    requestAnimationFrame(onFrame);
  })`;

/** 在页面主框架收集 `durationMs` 的 rAF 时间戳（严格递增序列，浏览器侧去重）。 */
export async function collectFrameTimestamps(
  window: PageSurface,
  durationMs: number
): Promise<readonly number[]> {
  const raw = await window.evaluate<unknown>(
    `(${FRAME_TIMESTAMP_COLLECTION})(${JSON.stringify(durationMs)})`
  );
  if (
    !Array.isArray(raw) ||
    raw.length < 2 ||
    !raw.every((entry): entry is number => typeof entry === 'number')
  ) {
    throw new Error('rAF 时间戳采集回包不是有限数值的非空数组（真进程帧采样 fail-closed）。');
  }
  return raw;
}

/** 创建真进程适配器。 */
export function createRealHostAdapter(options: RealHostAdapterOptions = {}): PerfAdapter {
  const loadRuntime = options.runtime ?? loadChipsE2eRuntime;
  const clock = options.clock ?? (() => performance.now());
  const idleWindowMs = options.idleWindowMs ?? DEFAULT_CONFIG.measurement.idleWindowMs;
  const sampleIntervalMs = options.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS;
  const frameDurationMs = options.frameDurationMs ?? DEFAULT_FRAME_DURATION_MS;

  async function runColdStart(iteration: number): Promise<AdapterRunResult> {
    const runtime = await loadRuntime();
    const workspace = await runtime.createTestWorkspace({
      label: `perf-real-cold-start-${String(iteration)}`,
      fixtures: {},
    });
    let host: HostInstanceSurface | null = null;
    try {
      const launchedAtMs = clock();
      host = await runtime.launchHostApp({
        appEntry: resolveFormalAppEntry(runtime.resolveHostApp()),
        workspacePath: workspace.root,
      });
      const readyAtMs = clock();
      return {
        markers: coldStartMarkers({ launchedAtMs, readyAtMs }),
        notes: ['冷启动为外部观测代理口径（electron.launch 发起 → 首窗口 + Bridge 就绪）。'],
      };
    } finally {
      if (host !== null) {
        await runtime.closeHostApp(host);
      }
      await workspace.dispose();
    }
  }

  async function runOpenCard(iteration: number): Promise<AdapterRunResult> {
    const runtime = await loadRuntime();
    const wiring = resolveDocumentHostEntry(runtime.resolveHostApp());
    const workspace = await runtime.createTestWorkspace({
      label: `perf-real-open-card-${String(iteration)}`,
      fixtures: { cardArchive: true },
    });
    let host: HostInstanceSurface | null = null;
    try {
      if (workspace.cardArchivePath === null) {
        throw new Error('工作区未装配归档态卡片夹具（真进程采集 fail-closed）。');
      }
      // 追踪窗口起点先于宿主启动捕获：运行段锚 `startup:process-start` 的记录时刻
      // 是进程时间原点（早于 document:open），窗口必须覆盖它。
      const traceWindowStartIso = new Date().toISOString();
      host = await launchDocumentHost(
        runtime,
        workspace.root,
        wiring.appEntry,
        wiring.wiringModulePath
      );
      const userDataPath = await collectHostUserDataPath(host);
      const source = pathToFileURL(workspace.cardArchivePath).href;
      const openCalledAtMs = clock();
      const opened = await runtime.openDocument(host.window, { source, kind: 'card' });
      const openResolvedAtMs = clock();
      const openedRecord = opened as Record<string, unknown>;
      const openedKind = typeof openedRecord['kind'] === 'string' ? openedRecord['kind'] : 'card';
      if (
        typeof openedRecord['documentId'] !== 'string' ||
        typeof openedRecord['source'] !== 'string'
      ) {
        throw new Error(
          'document:open 回包缺少 documentId/source（阶段导出关联锚缺失，真进程采集 fail-closed）。'
        );
      }
      const openedId = openedRecord['documentId'];
      const managedSource = openedRecord['source'];
      // 视图构建段探针：当轮唯一 requestId 作关联链锚（host-trace.ts 消费侧同名闸）。
      const probeRequestId = `perf-real-open-card-view-${String(iteration)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const probeReply = await host.window.evaluate<unknown>(
        `(${VIEW_CHANNEL_PROBE})(${JSON.stringify({
          source: managedSource,
          documentId: openedId,
          kind: 'card',
          requestId: probeRequestId,
        })})`
      );
      const probeType = assertViewProbeResolved(probeReply, '卡片视图构建探针');
      const stages = await waitForOpenCardStages(userDataPath, traceWindowStartIso, probeRequestId);
      return {
        markers: openCardMarkers({ openCalledAtMs, openResolvedAtMs }),
        notes: [
          `document:open 真实往返（kind=${openedKind}，documentId=${openedId}）；视图构建探针回包判型 ${probeType}。`,
          `阶段分解（CHIPS_TRACE 宿主就地实测）：装载 ${formatStageMs(stages.loadMs)} ms / 解析 ${formatStageMs(stages.parseMs)} ms / 视图构建 ${formatStageMs(stages.viewBuildMs)} ms（traceId=${stages.traceId}）。`,
        ],
      };
    } finally {
      if (host !== null) {
        await runtime.closeHostApp(host);
      }
      await workspace.dispose();
    }
  }

  async function runScrollFps(): Promise<AdapterRunResult> {
    const runtime = await loadRuntime();
    const wiring = resolveDocumentHostEntry(runtime.resolveHostApp());
    const workspace = await runtime.createTestWorkspace({
      label: 'perf-real-scroll-fps',
      fixtures: { cardArchive: true },
    });
    let host: HostInstanceSurface | null = null;
    try {
      if (workspace.cardArchivePath === null) {
        throw new Error('工作区未装配归档态卡片夹具（真进程采集 fail-closed）。');
      }
      host = await launchDocumentHost(
        runtime,
        workspace.root,
        wiring.appEntry,
        wiring.wiringModulePath
      );
      const source = pathToFileURL(workspace.cardArchivePath).href;
      await runtime.openDocument(host.window, { source, kind: 'card' });
      const page = host.window;
      let scrolling = true;
      const scrollLoop = (async (): Promise<void> => {
        while (scrolling) {
          await page.mouse.wheel(0, 300);
          await sleep(100);
        }
      })();
      let timestamps: readonly number[];
      try {
        timestamps = await collectFrameTimestamps(page, frameDurationMs);
      } finally {
        scrolling = false;
        await scrollLoop;
      }
      return {
        frameTimestampsMs: timestamps,
        notes: [
          '帧时间戳来自壳窗口 rAF（W2 期卡片 DOM 渲染臂未接通 #99，帧率为宿主窗口合成器口径）。',
          '1 s 分桶按帧间隔中点判定（工单041④ 口径修正：旧结束时刻判定存在末桶 −1 间隔截断偏置，精确 60Hz 流报 59.90）。',
        ],
      };
    } finally {
      if (host !== null) {
        await runtime.closeHostApp(host);
      }
      await workspace.dispose();
    }
  }

  async function runIdleMemory(): Promise<AdapterRunResult> {
    const runtime = await loadRuntime();
    const workspace = await runtime.createTestWorkspace({
      label: 'perf-real-idle-memory',
      fixtures: {},
    });
    let host: HostInstanceSurface | null = null;
    try {
      host = await runtime.launchHostApp({
        appEntry: resolveFormalAppEntry(runtime.resolveHostApp()),
        workspacePath: workspace.root,
      });
      const startedAtMs = clock();
      const samples: MemorySample[] = [];
      // 采样总时长 = 空闲窗口 + 一个稳定间隔（`summarizeMemory` 以末尾窗口取稳定态）。
      const totalMs = idleWindowMs + sampleIntervalMs;
      for (;;) {
        const at = clock() - startedAtMs;
        const rssBytes = await collectHostRssBytes(host);
        samples.push({ at, rssBytes });
        if (at >= totalMs) {
          break;
        }
        await sleep(sampleIntervalMs);
      }
      return {
        memorySamples: samples,
        notes: ['RSS 为 app.getAppMetrics() 全进程（主 + 渲染 + GPU）workingSetSize 合计。'],
      };
    } finally {
      if (host !== null) {
        await runtime.closeHostApp(host);
      }
      await workspace.dispose();
    }
  }

  return {
    id: 'chips-host-real-process',
    title: '薯片宿主真进程采集适配器（W2-P1-6 段A）',
    description:
      '经 @chips/e2e 承载辅助拉起真实宿主进程，采集外部观测标记点、rAF 帧时间戳与 getAppMetrics RSS 采样；数值全部来自实测，宿主侧标记缺口见真进程采集-设计.md。',
    measurementForm: 'real',
    provides: ['cold-start', 'open-card', 'scroll-fps', 'idle-memory'],
    async run(context: AdapterRunContext): Promise<AdapterRunResult> {
      switch (context.scenarioId) {
        case 'cold-start':
          return await runColdStart(context.iteration);
        case 'open-card':
          return await runOpenCard(context.iteration);
        case 'scroll-fps':
          return await runScrollFps();
        case 'idle-memory':
          return await runIdleMemory();
        default:
          throw new Error(
            `真进程适配器未提供场景 ${context.scenarioId}（open-box 整场景不可测，见登记表）。`
          );
      }
    },
  };
}

/** 箱子视图面真进程探针证据。 */
export interface OpenBoxProbeEvidence {
  readonly documentOpened: boolean;
  readonly viewRequestType: string;
  readonly viewErrorCode: string | null;
  readonly notes: readonly string[];
}

interface ViewChannelReplyShape {
  readonly type?: unknown;
  readonly error?: { readonly code?: unknown };
}

/**
 * 取视图通道探针页面函数（纯 JS 字符串源，同帧采集的 `__name` 消除纪律；封套为 #105
 * 冻结形状；字符串表达式不被自动调用，实参以 IIFE 内联承载）。
 * `kind`/`requestId` 由调用方注入（open-box 探针与 open-card 阶段探针共用封套形状，
 * 不改线上契约）。
 */
const VIEW_CHANNEL_PROBE = `(input) => {
  const surface = window.__chipsHostViewChannel;
  if (surface === undefined || surface === null || typeof surface.requestView !== 'function') {
    return { type: 'channel-missing' };
  }
  return surface
    .requestView({
      protocol: 'chips-document-view/1',
      type: 'document-view:build',
      requestId: input.requestId,
      input: { source: input.source, documentId: input.documentId, kind: input.kind },
    })
    .then((result) => result)
    .catch((error) => ({
      type: 'channel-rejected',
      error: { code: error === undefined || error === null ? undefined : error.code },
    }));
}`;

/**
 * `open-box` 不可测性探针：在真实宿主进程内打开箱子并发起取视图请求，
 * 坐实主进程构建侧在册闸（`BRIDGE_INVALID_INPUT`，箱子视图随 W4 箱子波）。
 * 探针不产出任何性能数值。
 */
export async function observeOpenBox(
  options: RealHostAdapterOptions = {}
): Promise<OpenBoxProbeEvidence> {
  const loadRuntime = options.runtime ?? loadChipsE2eRuntime;
  const runtime = await loadRuntime();
  const wiring = resolveDocumentHostEntry(runtime.resolveHostApp());
  const workspace = await runtime.createTestWorkspace({
    label: 'perf-real-open-box',
    fixtures: { boxArchive: true },
  });
  let host: HostInstanceSurface | null = null;
  try {
    if (workspace.boxArchivePath === null) {
      throw new Error('工作区未装配归档态箱子夹具（真进程探针 fail-closed）。');
    }
    host = await launchDocumentHost(
      runtime,
      workspace.root,
      wiring.appEntry,
      wiring.wiringModulePath
    );
    const source = pathToFileURL(workspace.boxArchivePath).href;
    await runtime.openDocument(host.window, { source, kind: 'box' });
    const reply = await host.window.evaluate<unknown>(
      `(${VIEW_CHANNEL_PROBE})(${JSON.stringify({
        source,
        documentId: 'perfBoxPrb',
        kind: 'box',
        requestId: 'perf-real-open-box-probe',
      })})`
    );
    if (typeof reply !== 'object' || reply === null) {
      throw new Error('取视图通道探针回包不是对象（真进程探针 fail-closed）。');
    }
    const shape = reply as ViewChannelReplyShape;
    const viewRequestType = typeof shape.type === 'string' ? shape.type : String(shape.type);
    const rawCode = shape.error?.code;
    return {
      documentOpened: true,
      viewRequestType,
      viewErrorCode: typeof rawCode === 'string' ? rawCode : null,
      notes: [
        `真进程探针：document:open(kind='box') 成功，取视图通道回包判别 ${viewRequestType}${
          typeof rawCode === 'string' ? `（在册码 ${rawCode}）` : ''
        }。`,
      ],
    };
  } finally {
    if (host !== null) {
      await runtime.closeHostApp(host);
    }
    await workspace.dispose();
  }
}

/** `measure --adapter src/real/adapter.ts` 的缺省适配器实例（构造零副作用）。 */
export const adapter: PerfAdapter = createRealHostAdapter();

export default adapter;
