import { isSyntheticAdapterId } from './adapters';
import { PerfError } from './errors';
import { metricDefinition, type MetricDefinition, type MetricId } from './metrics';
import {
  PARSE_DOMAIN_SCENARIO_IDS,
  SCENARIO_IDS,
  isScenarioId,
  type ScenarioId,
} from './scenarios';

/**
 * §4.2 五项性能基线 × 全场景「真测臂」登记表（性能真测重验 2026-10-01 的机械承载）。
 *
 * 口径（W3 §五裁决A 与工单056 双向闸的延伸登记面）：
 * - 读数的数值语义三态：`real`（真测臂在册，数值来自被测系统真实执行）与
 *   `contract-only`（本仓无数值测臂，仅场景/门禁契约登记与 ingest 外部样本承载位）；
 *   合成臂（`synthetic-*`）只承载合成自测（`fixtures/synthetic.ts`），**不进入本登记表**——
 *   「合成读数不成立」裁决A 后不存在任何「synthetic-only」场景分类。
 * - 真测臂的数值语义二级标注：`real-load`（数值即被测负载实测）与
 *   `real-proxy`（真进程实测的外部观测代理口径，代理口径差已逐臂登记）。
 * - 候臂（`waitingArms`）：权威口径中尚无交付测臂的段，逐臂登记在册码与引用；
 *   候臂交付时必须先翻正本登记表再接数（锁测会点名失效行），防止带口径差接数。
 *
 * 本表只登记「哪只臂测什么、数值语义真假」；门禁数值一律经 `metrics.ts` 注册表解析，
 * 本表不复制任何门禁数值（锁测以注册表现值镜像校验）。
 */

/** §4.2 五项基线指标（全库唯一权威：薯片生态文档库《架构原则》§4.2 · 附录 R18）。 */
export const BASELINE_FIVE_METRIC_IDS = [
  'cold_start_ms',
  'open_card_ms',
  'open_box_ms',
  'sustained_fps',
  'idle_memory_mb',
] as const;

/** §4.2 五项基线指标 ID 联合类型。 */
export type BaselineMetricId = (typeof BASELINE_FIVE_METRIC_IDS)[number];

/** 真测臂数值语义：`real-load` 被测负载实测；`real-proxy` 真进程外部观测代理（口径差在册）。 */
export type RealNumericSemantics = 'real-load' | 'real-proxy';

/** 场景三态：`real` 真测臂在册；`contract-only` 本仓无数值测臂（契约登记位）。 */
export type ArmTriState = 'real' | 'contract-only';

/** 候臂登记：权威口径中的缺位测臂（候交付，不折算、不造数）。 */
export interface WaitingArmRegistration {
  /** 在册候臂码（锁测点名锚）。 */
  readonly code: string;
  /** 候臂标题。 */
  readonly title: string;
  /** 缺位原因与交付波位引用。 */
  readonly reason: string;
}

/** 数据链承接证据：UI 帧段候臂期间，以哪只解析/数据链真测臂数值承接基线判读。 */
export interface DataChainEvidenceRegistration {
  /** 承接场景。 */
  readonly scenarioId: ScenarioId;
  /** 承接指标（门禁承接的权威预算口径，数值仍以 `metrics.ts` 注册表为准）。 */
  readonly metricId: Exclude<MetricId, BaselineMetricId>;
}

/** 单场景真测臂登记行。 */
export interface ScenarioArmRegistration {
  /** 场景 ID（必须已在 `scenarios.ts` 登记表在册）。 */
  readonly scenarioId: ScenarioId;
  /** 三态分类。 */
  readonly triState: ArmTriState;
  /** 提供真测数值的适配器在册 ID（`real` 态必填且非空；禁 `synthetic-*` 命名）。 */
  readonly realAdapterIds?: readonly string[];
  /** 真测臂数值语义（`real` 态必填）。 */
  readonly numericSemantics?: RealNumericSemantics;
  /** 候臂登记（缺位测臂逐臂在册）。 */
  readonly waitingArms?: readonly WaitingArmRegistration[];
  /** 数据链承接证据（UI 帧段候臂期间的承接读数位）。 */
  readonly dataChainEvidence?: DataChainEvidenceRegistration;
  /** 登记说明（报告与回执引用；不参与判定）。 */
  readonly note: string;
}

/** 真进程宿主采集适配器在册 ID（`src/real/adapter.ts`）。 */
export const REAL_HOST_ADAPTER_ID = 'chips-host-real-process';

/** 在册场景真测臂登记表（覆盖 `SCENARIO_IDS` 全集，一场景一行）。 */
export const SCENARIO_ARM_REGISTRY: Readonly<Record<ScenarioId, ScenarioArmRegistration>> = {
  'cold-start': {
    scenarioId: 'cold-start',
    triState: 'real',
    realAdapterIds: [REAL_HOST_ADAPTER_ID],
    numericSemantics: 'real-proxy',
    note: '真进程实测（外部观测代理口径：electron.launch 发起 → 首窗口 + Bridge 就绪，含启动器往返开销，偏保守）；门禁口径主进程启动 → 首个应用窗口可用，宿主 startup:* 里程碑导出面已建（工单041①），两口径差对照归真进程复测，门禁数值源不变更。',
  },
  'open-card': {
    scenarioId: 'open-card',
    triState: 'real',
    realAdapterIds: [REAL_HOST_ADAPTER_ID],
    numericSemantics: 'real-proxy',
    waitingArms: [
      {
        code: 'FIRST-FRAME-COMMIT-ANCHOR',
        title: '首帧提交锚点（渲染臂 #99）',
        reason:
          'totalSpan 终点以 document:open 回包 resolve 代理「首帧提交」；render:first-frame-commit 为渲染进程侧事实（卡片 DOM 渲染臂在册集成缝 #99），主进程导出面无该可观测量。装载/解析/视图构建三段已经宿主 CHIPS_TRACE 实测还原（工单041①）。',
      },
    ],
    note: '真进程实测（外部观测代理口径 + CHIPS_TRACE 三段分解）：解析域全链另由 parse-card-10mb 真测臂（chips-native-parser-real-process）承接。2026-10-01 起本臂受工单070 阻断（E2E 接线模块落后宿主波 B2 闸），候收口复采。',
  },
  'open-box': {
    scenarioId: 'open-box',
    triState: 'contract-only',
    waitingArms: [
      {
        code: 'W4-BOX-VIEW-GATE',
        title: '箱子视图面（W4 箱子渲染波）',
        reason:
          "kind:'box' 视图构建在主进程构建侧以 BRIDGE_INVALID_INPUT 在册闸诚实拒绝（document-view-builder.ts 交付面声明），首屏条目帧无任何外部可观测量；UI 首屏段随 W4 箱子渲染正式波原子交付（W3 §五裁决A）。",
      },
    ],
    dataChainEvidence: {
      scenarioId: 'parse-box-10k',
      metricId: 'parse_box_full_ms',
    },
    note: '整场景无宿主侧真测臂（真进程适配器 provides 显式不含本场景）；基线判读候渲染帧通道：以 parse-box-10k 真测臂 parse_box_full_ms（openBox → structure → layoutConfig 全链，门 ≤200 ms，承接《文档解析器设计》§9.2 既有权威口径）的数据链真测读数承接；真进程不可测性探针（observeOpenBox）坐实在册拒绝码，零数值。',
  },
  'scroll-fps': {
    scenarioId: 'scroll-fps',
    triState: 'real',
    realAdapterIds: [REAL_HOST_ADAPTER_ID],
    numericSemantics: 'real-proxy',
    waitingArms: [
      {
        code: 'RENDER-LOAD-FRAME-CHANNEL',
        title: '真实渲染负载帧通道（渲染臂 #99）',
        reason:
          '帧时间戳来自壳窗口 rAF（宿主窗口合成器口径），非真实渲染负载；render_update_ms（单帧更新任务 P95）属渲染引擎内部计时，无在册导出。W3 裁决A 注记：真渲染路径复采随 W4 渲染臂。',
      },
    ],
    note: '真进程实测（合成器口径 rAF，1 s 分桶中点归属）：门禁均值 ≥60（工单045 算子修口）与分桶协议零改动；render_update_ms 缺测臂在册（no-data 如实呈现，exit 式 fail+noData>0 保留）。2026-10-01 起本臂受工单070 阻断，候收口复采。',
  },
  'idle-memory': {
    scenarioId: 'idle-memory',
    triState: 'real',
    realAdapterIds: [REAL_HOST_ADAPTER_ID],
    numericSemantics: 'real-load',
    note: '真进程实测（app.getAppMetrics() 全进程 RSS 合计，空闲窗口结束后稳定窗中位数；G7 默认窗口 5 分钟）。',
  },
  'parse-card-10mb': {
    scenarioId: 'parse-card-10mb',
    triState: 'real',
    realAdapterIds: ['chips-native-parser-real-process'],
    numericSemantics: 'real-load',
    note: '真实 .card 归档字节（运行时确定性生成，1 MiB content YAML + 9 MiB 资源）经 chips-native.node 解析域导出实测（工单056 形 A）；parse_metadata_ms / parse_model_build_ms 为解析器内部阶段缺测臂（no-data 如实登记，不折算）。',
  },
  'parse-metadata': {
    scenarioId: 'parse-metadata',
    triState: 'contract-only',
    note: '契约锁测场景（criterion 四组之一的 ingest 承载位）：解析器内部阶段在导出面无独立可测形（工单056 形 A 在册口径），本仓无数值测臂；外部 criterion 样本经 `cli ingest` 进入判定，合成自测面读数不得冒充本场景实测。',
  },
  'parse-box-10k': {
    scenarioId: 'parse-box-10k',
    triState: 'real',
    realAdapterIds: ['chips-native-parser-real-process'],
    numericSemantics: 'real-load',
    note: '真实 .box 归档字节（10 000 外部引用条目，ZIP Store）经 chips-native.node 解析域导出实测（工单056 形 A；#263 补 parse_box_full_ms 箱全量解析臂）；同时是 open-box 基线判读的数据链承接臂。',
  },
  'kernel-latency': {
    scenarioId: 'kernel-latency',
    triState: 'contract-only',
    note: '契约锁测场景：criterion 基准（Rust）或等价测量导出样本经 `cli ingest` 进入判定；本仓内无进程内真测臂，合成自测面读数不得冒充本场景实测。',
  },
  'resource-caps': {
    scenarioId: 'resource-caps',
    triState: 'contract-only',
    note: '契约锁测场景：稳定态观测帧池/解析缓存/封面缓存峰值规模的承载位；渲染引擎稳定态观测臂未交付（候 W4 渲染臂），本仓内无真测臂。',
  },
};

/** 三态计数形态（报告/回执引用）。 */
export interface ArmTriStateCounts {
  readonly real: number;
  readonly contractOnly: number;
}

/** 校验任意字符串是否为 §4.2 五项基线指标。 */
export function isBaselineMetricId(value: string): value is BaselineMetricId {
  return (BASELINE_FIVE_METRIC_IDS as readonly string[]).includes(value);
}

/** §4.2 五项基线指标 ↔ 场景映射（场景登记表逐项核对，未知映射即抛错）。 */
const BASELINE_METRIC_SCENARIOS: Readonly<Record<BaselineMetricId, ScenarioId>> = {
  cold_start_ms: 'cold-start',
  open_card_ms: 'open-card',
  open_box_ms: 'open-box',
  sustained_fps: 'scroll-fps',
  idle_memory_mb: 'idle-memory',
};

/** 取 §4.2 五项基线指标对应的场景 ID。 */
export function baselineScenarioOf(metricId: BaselineMetricId): ScenarioId {
  return BASELINE_METRIC_SCENARIOS[metricId];
}

/** 取 §4.2 五项基线指标的注册表定义（镜像位，门禁数值仍以 `metrics.ts` 为唯一来源）。 */
export function baselineMetricDefinition(metricId: BaselineMetricId): MetricDefinition {
  return metricDefinition(metricId);
}

/** 三态计数（登记表全场景统计）。 */
export function armTriStateCounts(): ArmTriStateCounts {
  const counts = { real: 0, contractOnly: 0 };
  for (const scenarioId of SCENARIO_IDS) {
    const row = SCENARIO_ARM_REGISTRY[scenarioId];
    if (row === undefined) {
      throw new PerfError(
        'PERF_CONFIG_INVALID',
        `真测臂登记表缺场景行：${scenarioId}（登记表必须覆盖场景全集）`
      );
    }
    if (row.triState === 'real') {
      counts.real += 1;
    } else {
      counts.contractOnly += 1;
    }
  }
  return counts;
}

/** 校验任意字符串是否为在册候臂码（按场景）。 */
export function waitingArmCodesOf(scenarioId: string): readonly string[] {
  if (!isScenarioId(scenarioId)) {
    throw new PerfError('PERF_CONFIG_INVALID', `未知性能场景：${scenarioId}`);
  }
  return (SCENARIO_ARM_REGISTRY[scenarioId]?.waitingArms ?? []).map((arm) => arm.code);
}

/** 解析域场景清单的再导出（登记表消费方单一入口）。 */
export const REGISTERED_PARSE_DOMAIN_SCENARIO_IDS = PARSE_DOMAIN_SCENARIO_IDS;

/** 断言登记行内的适配器 ID 全部非合成命名（合成臂禁止进入真测登记表）。 */
export function assertNoSyntheticAdapterInRegistry(): void {
  for (const scenarioId of SCENARIO_IDS) {
    const row = SCENARIO_ARM_REGISTRY[scenarioId];
    for (const adapterId of row?.realAdapterIds ?? []) {
      if (isSyntheticAdapterId(adapterId)) {
        throw new PerfError(
          'PERF_CONFIG_INVALID',
          `真测臂登记表场景 ${scenarioId} 登记了合成臂命名 ${adapterId}（裁决A：合成读数不成立，禁入真测登记表）`
        );
      }
    }
  }
}
