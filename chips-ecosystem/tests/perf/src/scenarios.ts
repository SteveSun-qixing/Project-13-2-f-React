import { PerfError } from './errors';
import type { MetricId } from './metrics';
import { phaseBudgetOf, type MetricPhaseBudget } from './metrics';

/**
 * 场景定义：把「测量方法」编码为可执行结构。
 *
 * 测量路径：
 * - `markers`：适配器每次运行产出一条标记点时间线；多轮取中位数，并按阶段预算分解；
 * - `frames`：适配器产出 rAF 时间戳序列（滚动/编辑场景），按 1 s 分桶求帧率；
 * - `memory`：适配器产出 RSS 采样序列，取空闲窗口稳定态；
 * - `samples`：适配器直接产出指标样本（解析基准、内核 μs 级指标、容量核查）。
 *
 * 无论哪种路径，适配器都可在 `metricSamples` 中补充场景声明的其余指标样本
 * （例如滚动场景同时上报单帧更新任务耗时）。
 */

/** 场景 ID 清单（新增场景必须在此登记）。 */
export const SCENARIO_IDS = [
  'cold-start',
  'open-card',
  'open-box',
  'scroll-fps',
  'idle-memory',
  'parse-card-10mb',
  'parse-metadata',
  'parse-box-10k',
  'kernel-latency',
  'resource-caps',
] as const;

/** 场景 ID 联合类型。 */
export type ScenarioId = (typeof SCENARIO_IDS)[number];

/**
 * 解析域场景清单（工单056 在册口径）：`parse-box-10k` 与 `parse-card-10mb` 两场景的
 * 读数必须以**真实解析链**（`chips-native` 解析域导出）产生才算实测；合成臂读数
 * 一律按「合成自测」定性，不得冒充该两场景的实测证据（分流闸见
 * `src/adapters.ts` 的 `assertRealParseDomainAdapter`）。
 */
export const PARSE_DOMAIN_SCENARIO_IDS = ['parse-box-10k', 'parse-card-10mb'] as const;

/** 解析域场景 ID 联合类型。 */
export type ParseDomainScenarioId = (typeof PARSE_DOMAIN_SCENARIO_IDS)[number];

/** 判断任意场景 ID 是否属于解析域。 */
export function isParseDomainScenario(scenarioId: ScenarioId): scenarioId is ParseDomainScenarioId {
  return (PARSE_DOMAIN_SCENARIO_IDS as readonly string[]).includes(scenarioId);
}

/** 标记点场景内的阶段：跨度 + 预算引用（预算值只存于指标注册表）。 */
export interface ScenarioPhase {
  readonly id: string;
  readonly title: string;
  readonly from: string;
  readonly to: string;
  readonly metricId: MetricId;
  readonly budgetId: string;
}

/** 场景定义。 */
export interface ScenarioDefinition {
  readonly id: ScenarioId;
  readonly title: string;
  readonly kind: 'markers' | 'frames' | 'memory' | 'samples';
  readonly metricIds: readonly MetricId[];
  /** 标记点场景的总耗时跨度（取该跨度时长作为指标样本）。 */
  readonly totalSpan?: { readonly from: string; readonly to: string };
  readonly phases?: readonly ScenarioPhase[];
  readonly citation: string;
  readonly measurement: string;
  readonly sampling: {
    /** 场景最短采样时长（毫秒）；`frames` 场景默认 10 s。 */
    readonly minDurationMs?: number;
    /** 采样点间隔（毫秒），供适配器实现参考。 */
    readonly sampleIntervalMs?: number;
  };
}

/** 规范标记点名称：Host / RenderEngine / 解析器经 `CHIPS_TRACE` 导出时的统一命名。 */
export const MARKERS = {
  processStart: 'startup:process-start',
  windowReady: 'startup:window-ready',
  openCalled: 'render:open-called',
  requestAccepted: 'render:request-accepted',
  documentParsed: 'document:parsed',
  frameCreated: 'render:frame-created',
  frameReady: 'render:frame-ready',
  firstFrameCommit: 'render:first-frame-commit',
  firstScreenCommit: 'render:first-screen-commit',
  entriesFirstScreenCommit: 'render:entries-first-screen-commit',
  // 工单041 验收裁定②（工单045 随波在册）：主进程视图通道导出面在册相位名，
  // 与宿主 `view-channel.ts` `DOCUMENT_VIEW_TRACE_PHASES` 字面逐字一致。
  viewBuilt: 'render:view-built',
  viewBuildFailed: 'render:view-build-failed',
} as const;

/**
 * 场景注册表。
 *
 * 门禁与阶段预算数值一律经指标注册表解析，场景层不复制数值。
 */
export const SCENARIOS: Readonly<Record<ScenarioId, ScenarioDefinition>> = {
  'cold-start': {
    id: 'cold-start',
    title: '冷启动',
    kind: 'markers',
    metricIds: ['cold_start_ms'],
    totalSpan: { from: MARKERS.processStart, to: MARKERS.windowReady },
    citation: '《架构原则》§4.2 · R18；《调试指南》§8.1',
    measurement: '主进程启动到首个应用窗口可用；release 构建、同一设备、多轮取中位数。',
    sampling: {},
  },
  'open-card': {
    id: 'open-card',
    title: '打开卡片',
    kind: 'markers',
    metricIds: ['open_card_ms'],
    totalSpan: { from: MARKERS.openCalled, to: MARKERS.firstFrameCommit },
    phases: [
      {
        id: 'open_card.parse',
        title: '请求接受 → 解析完成',
        from: MARKERS.requestAccepted,
        to: MARKERS.documentParsed,
        metricId: 'open_card_ms',
        budgetId: 'open_card.parse',
      },
      {
        id: 'open_card.frame-ready',
        title: '帧创建 → frame:ready',
        from: MARKERS.frameCreated,
        to: MARKERS.frameReady,
        metricId: 'open_card_ms',
        budgetId: 'open_card.frame-ready',
      },
      {
        id: 'open_card.first-commit',
        title: 'frame:ready → 首帧提交',
        from: MARKERS.frameReady,
        to: MARKERS.firstFrameCommit,
        metricId: 'open_card_ms',
        budgetId: 'open_card.first-commit',
      },
    ],
    citation: '《架构原则》§4.2 · R18；《渲染引擎设计》§10.1',
    measurement:
      'RenderEngine.open() → 会话 ready（首帧提交完成），按解析、frame:ready、首帧提交分解。',
    sampling: {},
  },
  'open-box': {
    id: 'open-box',
    title: '打开箱子',
    kind: 'markers',
    metricIds: ['open_box_ms'],
    totalSpan: { from: MARKERS.openCalled, to: MARKERS.entriesFirstScreenCommit },
    phases: [
      {
        id: 'open_box.parse',
        title: '请求接受 → 解析完成',
        from: MARKERS.requestAccepted,
        to: MARKERS.documentParsed,
        metricId: 'open_box_ms',
        budgetId: 'open_box.parse',
      },
      {
        id: 'open_box.frame-ready',
        title: '顶层帧创建 → frame:ready',
        from: MARKERS.frameCreated,
        to: MARKERS.frameReady,
        metricId: 'open_box_ms',
        budgetId: 'open_box.frame-ready',
      },
      {
        id: 'open_box.first-screen',
        title: '首屏条目帧提交',
        from: MARKERS.frameReady,
        to: MARKERS.entriesFirstScreenCommit,
        metricId: 'open_box_ms',
        budgetId: 'open_box.first-screen',
      },
    ],
    citation: '《架构原则》§4.2 · R18；《渲染引擎设计》§10.1',
    measurement: '与打开卡片同口径，含首屏条目帧。',
    sampling: {},
  },
  'scroll-fps': {
    id: 'scroll-fps',
    title: '滚动持续渲染帧率',
    kind: 'frames',
    metricIds: ['sustained_fps', 'render_update_ms'],
    citation: '《架构原则》§4.2 · R18；《CICD与质量门禁》§3.3 · G7；《渲染引擎设计》§10.1',
    measurement:
      '标准滚动场景持续 10 s 采样 rAF 时间戳，按 1 s 分桶求平均帧率；同一场景上报每帧更新任务耗时的 P95。',
    sampling: { minDurationMs: 10_000 },
  },
  'idle-memory': {
    id: 'idle-memory',
    title: '空闲内存',
    kind: 'memory',
    metricIds: ['idle_memory_mb'],
    citation: '《架构原则》§4.2 · R18；《CICD与质量门禁》§3.3 · G7；《调试指南》§8.4',
    measurement: '稳定态平台级 RSS：空闲窗口结束后取样本中位数；窗口默认 5 分钟。',
    sampling: { sampleIntervalMs: 5_000 },
  },
  'parse-card-10mb': {
    id: 'parse-card-10mb',
    title: '10 MB 卡片全量解析',
    kind: 'samples',
    metricIds: [
      'parse_10mb_ms',
      'parse_open_ms',
      'parse_metadata_ms',
      'parse_structure_ms',
      'parse_content_yaml_ms',
      'parse_model_build_ms',
    ],
    citation: '《文档解析器设计》§9.2、§9.5',
    measurement: '夹具 10 MB（1 MB YAML + 9 MB 资源）；warmup 后多轮取中位数；不含资源字节读取。',
    sampling: {},
  },
  'parse-metadata': {
    id: 'parse-metadata',
    title: 'metadata 单独解析',
    kind: 'samples',
    metricIds: ['parse_metadata_ms', 'parse_open_ms'],
    citation: '《文档解析器设计》§9.2、§9.5',
    measurement: 'metadata 单独解析基准（criterion 四组之一）。',
    sampling: {},
  },
  'parse-box-10k': {
    id: 'parse-box-10k',
    title: '10 000 条目箱子解析',
    kind: 'samples',
    // 工单056 后续处置（W3 登记口径翻正）：伴生指标 `parse_10mb_ms` 的注册口径为
    // 「10 MB 卡片夹具全量解析」（`metrics.ts` measurement 文面），属卡片形制，
    // 不得挂在箱子场景，已自本场景登记移除（一个场景只登记它真正测量的指标）。
    // 箱侧「全量解析」目前无已登记且形制匹配的指标定义可挂——箱全量解析测臂缺位，
    // 归工单056 后续处置项（新指标 id 属新增测量面，本波禁造，此处如实登记为缺位）。
    metricIds: ['parse_entries_10k_ms'],
    citation: '《文档解析器设计》§9.2、§9.5',
    measurement: '10 000 条目、并行解析；打开箱子总预算 ≤ 200 ms。',
    sampling: {},
  },
  'kernel-latency': {
    id: 'kernel-latency',
    title: '内核与事件延迟',
    kind: 'samples',
    metricIds: [
      'plugin_load_ms',
      'kernel_service_call_us',
      'kernel_event_emit_us',
      'kernel_event_emit_empty_us',
      'bridge_forward_enqueue_ms',
    ],
    citation: '《薯片内核设计》§11.1、§11.3；《事件系统设计》§9.1；《调试指南》§8.1',
    measurement: 'criterion 基准（Rust）或等价测量导出样本；按各指标声明的统计量判定。',
    sampling: {},
  },
  'resource-caps': {
    id: 'resource-caps',
    title: '渲染资源上限核查',
    kind: 'samples',
    metricIds: ['frame_pool_size', 'parse_cache_entries', 'cover_cache_entries'],
    citation: '《渲染引擎设计》§10.4；《调试指南》§8.3',
    measurement: '稳定态观测各池/缓存的峰值规模；超限应有 LRU 淘汰，持续增长即泄漏。',
    sampling: {},
  },
};

/** 场景阶段解析：返回跨度与预算（预算来自指标注册表）。 */
export function scenarioPhaseBudgets(definition: ScenarioDefinition): readonly {
  readonly phase: ScenarioPhase;
  readonly budget: MetricPhaseBudget;
}[] {
  const phases = definition.phases ?? [];
  return phases.map((phase) => ({ phase, budget: phaseBudgetOf(phase.metricId, phase.budgetId) }));
}

/** 按 ID 取场景定义；未知 ID 抛出 `PERF_CONFIG_INVALID`。 */
export function scenarioDefinition(scenarioId: ScenarioId): ScenarioDefinition {
  const definition = SCENARIOS[scenarioId];
  if (definition === undefined) {
    throw new PerfError('PERF_CONFIG_INVALID', `未知性能场景：${scenarioId}`);
  }
  return definition;
}

/** 校验任意字符串是否为已登记场景 ID。 */
export function isScenarioId(value: string): value is ScenarioId {
  return (SCENARIO_IDS as readonly string[]).includes(value);
}

/** 按字符串取场景定义；未登记时抛出 `PERF_CONFIG_INVALID`。 */
export function scenarioById(scenarioId: string): ScenarioDefinition {
  if (!isScenarioId(scenarioId)) {
    throw new PerfError('PERF_CONFIG_INVALID', `未知性能场景：${scenarioId}`);
  }
  return scenarioDefinition(scenarioId);
}
