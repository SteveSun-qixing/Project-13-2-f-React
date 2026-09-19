import { PerfError } from './errors';
import type { StatisticName } from './stats';

/**
 * 指标注册表：薯片生态性能门禁的**唯一编码处**。
 *
 * 规则（《架构原则》§4.2 与 R18；《施工规范》09 禁止转述数值）：
 * - 门禁数值全部来自权威文档，并与 `citation` 同记录编码，本工具不新立口径、不自创数值；
 * - `gateStatistic` 与 `gateComparison` 显式声明该指标的统计与比较口径；
 * - 文档未指定统计量的延迟类指标，统一采用《测试规范》§7.2 / 《CICD与质量门禁》§3.3
 *   「多轮取中位数」协议（`median`），并在 `measurement` 中写明。
 */

/** 指标单位；`mb` 在展示层写作 MB，换算基准为 1 MB = 1024 × 1024 字节；`count` 为容量计数。 */
export type MetricUnit = 'ms' | 'fps' | 'mb' | 'us' | 'count';

/** 指标优劣方向：延迟/占用越小越好，帧率越大越好。 */
export type MetricDirection = 'lower-is-better' | 'higher-is-better';

/** 与门禁值的比较运算符，逐指标映射文档原文的 `<` / `≤` / `>` 口径。 */
export type GateComparison = 'lt' | 'lte' | 'gt' | 'gte';

/** 指标分组，用于报告归类与场景归属。 */
export type MetricGroup = 'platform' | 'render' | 'parse' | 'kernel' | 'event' | 'resource';

/** 指标内部的阶段预算（如打开卡片的「解析 / frame:ready / 首帧提交」）。 */
export interface MetricPhaseBudget {
  readonly id: string;
  readonly title: string;
  readonly boundMs: number;
  readonly citation: string;
}

/** 单个性能指标的完整定义。 */
export interface MetricDefinition {
  readonly id: MetricId;
  readonly title: string;
  readonly unit: MetricUnit;
  readonly group: MetricGroup;
  readonly direction: MetricDirection;
  readonly gateStatistic: StatisticName;
  readonly gateComparison: GateComparison;
  /** Phase 4 起（正式）门禁值。 */
  readonly formalGate: number;
  /** Phase 2 放宽值；缺省表示该指标无放宽口径。 */
  readonly phase2Gate?: number;
  readonly citation: string;
  readonly measurement: string;
  readonly phaseBudgets?: readonly MetricPhaseBudget[];
}

/** 权威文档引用常量：报告、日志与测试统一从这里取，避免手写漂移。 */
export const CITATIONS = {
  architecturePrinciples: '《架构原则》§4.2 · 附录 R18',
  renderEngineBudget: '《渲染引擎设计》§10.1',
  renderEngineCache: '《渲染引擎设计》§10.4',
  parserBudget: '《文档解析器设计》§9.2',
  parserBench: '《文档解析器设计》§9.5',
  kernelPerf: '《薯片内核设计》§11.1',
  kernelBench: '《薯片内核设计》§11.3',
  eventPerf: '《事件系统设计》§9.1',
  debugMetrics: '《调试指南》§8.1',
  debugMemory: '《调试指南》§8.4',
  debugCache: '《调试指南》§8.3',
  cicdGate: '《CICD与质量门禁》§3.3 · G7',
  testSpec: '《测试规范》§7.2',
} as const;

/** 所有指标 ID 的权威清单（新增指标必须在此登记）。 */
export const METRIC_IDS = [
  'cold_start_ms',
  'open_card_ms',
  'open_box_ms',
  'sustained_fps',
  'idle_memory_mb',
  'render_update_ms',
  'parse_10mb_ms',
  'parse_open_ms',
  'parse_metadata_ms',
  'parse_structure_ms',
  'parse_content_yaml_ms',
  'parse_entries_10k_ms',
  'parse_model_build_ms',
  'plugin_load_ms',
  'kernel_service_call_us',
  'kernel_event_emit_us',
  'kernel_event_emit_empty_us',
  'bridge_forward_enqueue_ms',
  'frame_pool_size',
  'parse_cache_entries',
  'cover_cache_entries',
] as const;

/** 指标 ID 联合类型。 */
export type MetricId = (typeof METRIC_IDS)[number];

const RENDER_PHASE_BUDGETS = {
  card: [
    {
      id: 'open_card.parse',
      title: '请求接受 → 解析完成',
      boundMs: 30,
      citation: CITATIONS.renderEngineBudget,
    },
    {
      id: 'open_card.frame-ready',
      title: '帧创建 → frame:ready',
      boundMs: 40,
      citation: CITATIONS.renderEngineBudget,
    },
    {
      id: 'open_card.first-commit',
      title: 'frame:ready → 首帧提交',
      boundMs: 30,
      citation: CITATIONS.renderEngineBudget,
    },
  ],
  box: [
    {
      id: 'open_box.parse',
      title: '请求接受 → 解析完成',
      boundMs: 60,
      citation: CITATIONS.renderEngineBudget,
    },
    {
      id: 'open_box.frame-ready',
      title: '顶层帧创建 → frame:ready',
      boundMs: 80,
      citation: CITATIONS.renderEngineBudget,
    },
    {
      id: 'open_box.first-screen',
      title: '首屏条目帧提交',
      boundMs: 60,
      citation: CITATIONS.renderEngineBudget,
    },
  ],
} as const satisfies Record<string, readonly MetricPhaseBudget[]>;

/** 指标注册表（门禁值 + 口径 + 引用；测试以冻结期望表校验一致性）。 */
export const METRICS: Readonly<Record<MetricId, MetricDefinition>> = {
  cold_start_ms: {
    id: 'cold_start_ms',
    title: '冷启动',
    unit: 'ms',
    group: 'platform',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lt',
    formalGate: 1000,
    phase2Gate: 2000,
    citation: CITATIONS.architecturePrinciples,
    measurement:
      '主进程启动 → 首个应用窗口可用；release 构建、同一设备、多轮取中位数（《调试指南》§8.1、§8.2）。',
  },
  open_card_ms: {
    id: 'open_card_ms',
    title: '打开卡片',
    unit: 'ms',
    group: 'render',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lt',
    formalGate: 100,
    citation: `${CITATIONS.architecturePrinciples}；阶段预算见 ${CITATIONS.renderEngineBudget}`,
    measurement:
      'RenderEngine.open() 被调用 → 会话触发 ready（首帧提交完成）；阶段预算按请求接受 → 解析、帧创建 → frame:ready、ready → 首帧提交分解。',
    phaseBudgets: RENDER_PHASE_BUDGETS.card,
  },
  open_box_ms: {
    id: 'open_box_ms',
    title: '打开箱子',
    unit: 'ms',
    group: 'render',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lt',
    formalGate: 200,
    citation: `${CITATIONS.architecturePrinciples}；阶段预算见 ${CITATIONS.renderEngineBudget}`,
    measurement:
      '同上，含首屏条目帧；阶段预算按请求接受 → 解析、顶层帧创建 → frame:ready、首屏条目帧提交分解。',
    phaseBudgets: RENDER_PHASE_BUDGETS.box,
  },
  sustained_fps: {
    id: 'sustained_fps',
    title: '持续渲染帧率',
    unit: 'fps',
    group: 'render',
    direction: 'higher-is-better',
    gateStatistic: 'mean',
    gateComparison: 'gt',
    formalGate: 60,
    phase2Gate: 30,
    citation: `${CITATIONS.architecturePrinciples}；测量口径见 ${CITATIONS.cicdGate}`,
    measurement: `标准滚动场景持续采样（默认 10 s，${CITATIONS.cicdGate}），按 1 s 分桶后取平均帧率；帧时间预算 ${String(1000 / 60)} ms 由 60fps 推导。`,
  },
  idle_memory_mb: {
    id: 'idle_memory_mb',
    title: '空闲内存',
    unit: 'mb',
    group: 'platform',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lt',
    formalGate: 500,
    citation: `${CITATIONS.architecturePrinciples}；测量窗口见 ${CITATIONS.cicdGate}`,
    measurement: `空闲窗口结束后平台级 RSS 的中位数；默认窗口取空闲 5 分钟后平台 RSS（${CITATIONS.cicdGate}），可经配置 measurement.idleWindowMs 调整；${CITATIONS.debugMemory} 的 60 s 稳定态用于快速分析。`,
  },
  render_update_ms: {
    id: 'render_update_ms',
    title: '单帧更新任务耗时',
    unit: 'ms',
    group: 'render',
    direction: 'lower-is-better',
    gateStatistic: 'p95',
    gateComparison: 'lte',
    formalGate: 16,
    citation: CITATIONS.renderEngineBudget,
    measurement:
      '持续渲染场景内每帧更新任务的耗时；统计量取 P95 以排除偶发抖动，门禁值来自渲染引擎预算。',
  },
  parse_10mb_ms: {
    id: 'parse_10mb_ms',
    title: '10 MB 卡片全量解析',
    unit: 'ms',
    group: 'parse',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lte',
    formalGate: 100,
    citation: `${CITATIONS.parserBudget}；基准口径见 ${CITATIONS.parserBench}`,
    measurement:
      '夹具为 10 MB 卡片（1 MB YAML + 9 MB 资源）、条目 ≤ 10 000、索引已可访问、本地 SSD；多轮取中位数，不含资源字节读取。流水线各阶段预算另见 open / metadata / structure / content / model 指标。',
  },
  parse_open_ms: {
    id: 'parse_open_ms',
    title: '解析器打开总预算',
    unit: 'ms',
    group: 'parse',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lte',
    formalGate: 10,
    citation: CITATIONS.parserBudget,
    measurement: '目录扫描 / EOCD + 中央目录（≤ 3 ms）与 metadata 解析校验（≤ 5 ms）之和。',
  },
  parse_metadata_ms: {
    id: 'parse_metadata_ms',
    title: 'metadata 解析与校验',
    unit: 'ms',
    group: 'parse',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lte',
    formalGate: 5,
    citation: CITATIONS.parserBudget,
    measurement: 'metadata 单独解析基准（criterion 四组之一）。',
  },
  parse_structure_ms: {
    id: 'parse_structure_ms',
    title: 'structure 解析与引用校验',
    unit: 'ms',
    group: 'parse',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lte',
    formalGate: 10,
    citation: CITATIONS.parserBudget,
    measurement: '惰性触发；超限或缺失按诊断模型上报。',
  },
  parse_content_yaml_ms: {
    id: 'parse_content_yaml_ms',
    title: 'content YAML 解析',
    unit: 'ms',
    group: 'parse',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lte',
    formalGate: 60,
    citation: CITATIONS.parserBudget,
    measurement: '10 MB 全为 YAML 的最坏情况；L2 单元按文件并行。',
  },
  parse_entries_10k_ms: {
    id: 'parse_entries_10k_ms',
    title: '10 000 条目解析',
    unit: 'ms',
    group: 'parse',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lte',
    formalGate: 100,
    citation: CITATIONS.parserBudget,
    measurement: '10 000 条目箱子基准；打开箱子总预算 ≤ 200 ms（《文档解析器设计》§9.2）。',
  },
  parse_model_build_ms: {
    id: 'parse_model_build_ms',
    title: '模型构建、统计与诊断汇总',
    unit: 'ms',
    group: 'parse',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lte',
    formalGate: 8,
    citation: CITATIONS.parserBudget,
    measurement: '解析流水线最后阶段；模型常驻堆 ≤ 0.5 × 文件大小（§9.4）。',
  },
  plugin_load_ms: {
    id: 'plugin_load_ms',
    title: '插件加载',
    unit: 'ms',
    group: 'kernel',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lt',
    formalGate: 100,
    citation: `${CITATIONS.kernelPerf}；门禁口径见 ${CITATIONS.debugMetrics}`,
    measurement:
      '内核收到 LoadRequest → plugin:loaded 发布完成；不含包解压与校验、不含插件业务初始化。',
  },
  kernel_service_call_us: {
    id: 'kernel_service_call_us',
    title: '服务调用',
    unit: 'us',
    group: 'kernel',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lt',
    formalGate: 1,
    citation: CITATIONS.kernelPerf,
    measurement: '已绑定服务句柄上的一次方法调用，或内核内一次服务查找；不含业务耗时。',
  },
  kernel_event_emit_us: {
    id: 'kernel_event_emit_us',
    title: '事件发布（有监听器）',
    unit: 'us',
    group: 'event',
    direction: 'lower-is-better',
    gateStatistic: 'p99',
    gateComparison: 'lt',
    formalGate: 1,
    citation: CITATIONS.eventPerf,
    measurement: 'emit 入口至全部监听器调用或入队完毕（含快照与调度）；不含监听器与 JS 执行耗时。',
  },
  kernel_event_emit_empty_us: {
    id: 'kernel_event_emit_empty_us',
    title: '内核空发布（无监听器）',
    unit: 'us',
    group: 'event',
    direction: 'lower-is-better',
    gateStatistic: 'median',
    gateComparison: 'lt',
    formalGate: 0.1,
    citation: CITATIONS.eventPerf,
    measurement: '名称查表未命中直接返回，零分配、零序列化、零跨进程开销。',
  },
  bridge_forward_enqueue_ms: {
    id: 'bridge_forward_enqueue_ms',
    title: '桥接转发入队',
    unit: 'ms',
    group: 'event',
    direction: 'lower-is-better',
    gateStatistic: 'p95',
    gateComparison: 'lt',
    formalGate: 1,
    citation: CITATIONS.eventPerf,
    measurement: '含结构化克隆与 IPC 排队；不含渲染侧执行。',
  },
  frame_pool_size: {
    id: 'frame_pool_size',
    title: '帧池规模',
    unit: 'count',
    group: 'resource',
    direction: 'lower-is-better',
    gateStatistic: 'max',
    gateComparison: 'lte',
    formalGate: 32,
    citation: `${CITATIONS.renderEngineCache}；核查步骤见 ${CITATIONS.debugCache}`,
    measurement: '稳定态观测到的帧池最大规模（帧池上限在全平台统一为 32）。',
  },
  parse_cache_entries: {
    id: 'parse_cache_entries',
    title: '解析缓存条目数',
    unit: 'count',
    group: 'resource',
    direction: 'lower-is-better',
    gateStatistic: 'max',
    gateComparison: 'lte',
    formalGate: 64,
    citation: CITATIONS.renderEngineCache,
    measurement: '稳定态观测到的解析缓存最大条目数；超限应有 LRU 淘汰，持续增长即为泄漏。',
  },
  cover_cache_entries: {
    id: 'cover_cache_entries',
    title: '封面缓存条目数',
    unit: 'count',
    group: 'resource',
    direction: 'lower-is-better',
    gateStatistic: 'max',
    gateComparison: 'lte',
    formalGate: 64,
    citation: CITATIONS.renderEngineCache,
    measurement: '稳定态观测到的封面缓存最大条目数；超限应有 LRU 淘汰。',
  },
};

/** 单位展示标签（μs 为微秒，MB 为 1024 进制兆字节，个为容量计数）。 */
export const UNIT_LABELS: Readonly<Record<MetricUnit, string>> = {
  ms: 'ms',
  fps: 'fps',
  mb: 'MB',
  us: 'μs',
  count: '个',
};

/** 按 ID 取指标定义；未知 ID 抛出 `PERF_CONFIG_INVALID`。 */
export function metricDefinition(metricId: MetricId): MetricDefinition {
  const definition = METRICS[metricId];
  if (definition === undefined) {
    throw new PerfError('PERF_CONFIG_INVALID', `未知性能指标：${metricId}`);
  }
  return definition;
}

/** 校验任意字符串是否为已登记指标 ID。 */
export function isMetricId(value: string): value is MetricId {
  return (METRIC_IDS as readonly string[]).includes(value);
}

/** 按字符串取指标定义；未登记时抛出 `PERF_CONFIG_INVALID`。 */
export function metricById(metricId: string): MetricDefinition {
  if (!isMetricId(metricId)) {
    throw new PerfError('PERF_CONFIG_INVALID', `未知性能指标：${metricId}`);
  }
  return metricDefinition(metricId);
}

/** 在指标定义内查找阶段预算；缺失时抛出 `PERF_CONFIG_INVALID`。 */
export function phaseBudgetOf(metricId: MetricId, budgetId: string): MetricPhaseBudget {
  const budgets = metricDefinition(metricId).phaseBudgets ?? [];
  const budget = budgets.find((entry) => entry.id === budgetId);
  if (budget === undefined) {
    throw new PerfError('PERF_CONFIG_INVALID', `指标 ${metricId} 无阶段预算 ${budgetId}`);
  }
  return budget;
}

/** 指标门禁值按 Phase 解析；未知 Phase 抛出 `PERF_CONFIG_INVALID`。 */
export function gateValueFor(definition: MetricDefinition, phase: 2 | 4): number {
  if (phase === 2 && definition.phase2Gate !== undefined) {
    return definition.phase2Gate;
  }
  return definition.formalGate;
}
