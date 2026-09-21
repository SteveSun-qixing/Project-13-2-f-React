import { PerfError } from '../errors';
import { timelineFromMarkers, type MarkerTimeline, type PerfMarker } from '../markers';
import { MARKERS, isScenarioId, scenarioDefinition, type ScenarioId } from '../scenarios';

/**
 * 外部观测 → 标记点时间线归一（真进程采集纯逻辑面）。
 *
 * 宿主当前没有内建 `CHIPS_TRACE` 标记点导出（登记见 `真进程采集-设计.md` §三）；
 * 本模块把**外部可观测时间戳**（进程启动时刻、Bridge 往返时刻）归一为规范标记点命名，
 * 交由 `MarkerTimeline`（既有语义）求跨度——不新造第二套测量语义。
 * 每个归一标记点携带 `category: 'external-proxy:<可观测量>'`，报告与样本文件如实
 * 呈现代理口径，不冒充宿主内建标记。
 */

/** 冷启动外部观测：`electron.launch` 发起前时刻与 `launchHostApp` 返回（窗口+Bridge 就绪）时刻。 */
export interface ColdStartObservation {
  readonly launchedAtMs: number;
  readonly readyAtMs: number;
}

/** 打开卡片外部观测：`document:open` 请求发出与回包 resolve 时刻。 */
export interface OpenCardObservation {
  readonly openCalledAtMs: number;
  readonly openResolvedAtMs: number;
}

function assertOrdered(laterMs: number, earlierMs: number, what: string): void {
  if (!Number.isFinite(earlierMs) || !Number.isFinite(laterMs)) {
    throw new PerfError('PERF_INPUT_INVALID', `${what} 的观测时间戳必须是有限数值`);
  }
  if (laterMs < earlierMs) {
    throw new PerfError('PERF_INPUT_INVALID', `${what} 观测时序非法：终点早于起点`);
  }
}

/** 冷启动观测归一为 `startup:*` 规范标记点（时间线原点 = 启动发起时刻）。 */
export function coldStartMarkers(observation: ColdStartObservation): readonly PerfMarker[] {
  assertOrdered(observation.readyAtMs, observation.launchedAtMs, '冷启动');
  return [
    {
      name: MARKERS.processStart,
      at: 0,
      category: 'external-proxy:electron-launch-invoked',
    },
    {
      name: MARKERS.windowReady,
      at: observation.readyAtMs - observation.launchedAtMs,
      category: 'external-proxy:host-launch-ready',
    },
  ];
}

/** 打开卡片观测归一为 `render:open-called` → `render:first-frame-commit`（终点为 open 回包代理，口径差已登记）。 */
export function openCardMarkers(observation: OpenCardObservation): readonly PerfMarker[] {
  assertOrdered(observation.openResolvedAtMs, observation.openCalledAtMs, '打开卡片');
  return [
    {
      name: MARKERS.openCalled,
      at: 0,
      category: 'external-proxy:bridge-request-sent',
    },
    {
      name: MARKERS.firstFrameCommit,
      at: observation.openResolvedAtMs - observation.openCalledAtMs,
      category: 'external-proxy:document-open-resolved',
    },
  ];
}

/** 把归一后的标记点装配为时间线（复用既有 `MarkerTimeline` 校验与跨度语义）。 */
export function observationTimeline(markers: readonly PerfMarker[]): MarkerTimeline {
  return timelineFromMarkers(markers);
}

/** 缺测臂登记项。 */
export interface UnmeasurableArm {
  /** 缺测对象类型：阶段分解 / 指标 / 整场景。 */
  readonly kind: 'phase' | 'metric' | 'scenario';
  readonly target: string;
  readonly reason: string;
}

/**
 * 宿主侧标记缺口的缺测臂登记表（口径缺口，非测量失败）。
 *
 * 理由引用：卡片/箱子 DOM 渲染臂为在册集成缝（#99）；`kind:'box'` 视图面随 W4 箱子波
 * （刀3 `document-view-builder.ts` 在册闸以 `BRIDGE_INVALID_INPUT` 诚实拒绝）。
 */
export const HOST_MARKER_GAPS: Readonly<Partial<Record<ScenarioId, readonly UnmeasurableArm[]>>> = {
  'cold-start': [
    {
      kind: 'metric',
      target: 'cold_start_ms',
      reason:
        '宿主无 startup:* 内建标记：以 electron.launch 发起→launchHostApp 返回（首窗口+Bridge 就绪，与 e2e 启动器同口径）代理，含 Playwright 侧往返开销（偏保守）。',
    },
  ],
  'open-card': [
    {
      kind: 'metric',
      target: 'open_card_ms',
      reason:
        '终点以 document:open 回包 resolve 代理「首帧提交」（卡片 DOM 渲染臂为在册集成缝 #99，首帧提交不可外部观测）。',
    },
    {
      kind: 'phase',
      target: 'open_card.parse',
      reason: '宿主无 request-accepted / document-parsed 标记点导出，阶段缺测。',
    },
    {
      kind: 'phase',
      target: 'open_card.frame-ready',
      reason: '宿主无 frame-created / frame-ready 标记点导出，阶段缺测。',
    },
    {
      kind: 'phase',
      target: 'open_card.first-commit',
      reason: '宿主无 first-frame-commit 标记点导出，阶段缺测。',
    },
  ],
  'open-box': [
    {
      kind: 'scenario',
      target: 'open_box_ms',
      reason:
        "不可测：kind:'box' 视图面在主进程构建侧以 BRIDGE_INVALID_INPUT 在册闸诚实拒绝（箱子视图随 W4 箱子波），首屏条目帧无任何外部可观测量。",
    },
  ],
  'scroll-fps': [
    {
      kind: 'metric',
      target: 'render_update_ms',
      reason: '单帧更新任务耗时属渲染引擎内部标记，宿主无导出，外部不可测（缺测臂）。',
    },
  ],
};

/** 取某场景的缺测臂登记（未登记返回空数组）。 */
export function unmeasurableArmsOf(scenarioId: ScenarioId): readonly UnmeasurableArm[] {
  return HOST_MARKER_GAPS[scenarioId] ?? [];
}

/** 缺测臂的说明文本（写入样本文件 meta.notes，供段B与报告如实呈现）。 */
export function unmeasurableArmNotes(scenarioId: string): readonly string[] {
  if (!isScenarioId(scenarioId)) {
    throw new PerfError('PERF_CONFIG_INVALID', `未知性能场景：${scenarioId}`);
  }
  const definition = scenarioDefinition(scenarioId);
  return unmeasurableArmsOf(definition.id).map(
    (arm) =>
      `缺测臂（${arm.kind === 'scenario' ? '整场景' : arm.kind === 'phase' ? '阶段' : '指标'} ${arm.target}）：${arm.reason}`
  );
}
