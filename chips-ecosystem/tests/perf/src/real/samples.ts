import { validateMetricSamples } from '../adapters';
import { PerfError } from '../errors';
import type { MetricId } from '../metrics';
import type { PerformanceReport } from '../report';
import { isScenarioId, scenarioDefinition, type ScenarioId } from '../scenarios';
import { unmeasurableArmNotes } from './observations';

/**
 * 真进程样本文件组装（ingest 输入契约的生产侧）。
 *
 * 产出形状与 `src/cli.ts` 的 ingest 输入契约逐字段对齐：
 * `{ meta?: { buildType, deviceLabel, hostVersion, notes }, samples: { 指标ID: 数值数组 } }`。
 * 组装期即做与 `metricsFromIngest` 同语义的双闸（指标已登记 + 场景已声明），
 * 保证样本文件必可被 `pnpm run ingest` 消费。
 */

/** 样本文件 meta（与 ingest 契约的 meta 子集同形）。 */
export interface RealSamplesMeta {
  readonly buildType: 'release' | 'debug';
  readonly deviceLabel: string;
  readonly hostVersion?: string;
  readonly notes?: readonly string[];
}

/** 样本文件（ingest 输入契约形状）。 */
export interface RealSamplesDocument {
  readonly meta: RealSamplesMeta;
  readonly samples: Readonly<Record<string, readonly number[]>>;
}

/** 场景可测性判定：measured 场景产样本文件；unmeasurable 场景产结论文件。 */
export type ScenarioCollectionOutcome =
  | {
      readonly scenarioId: ScenarioId;
      readonly status: 'measured';
      /** 指标样本表：缺测指标以缺键/undefined 呈现，由缺测臂 notes 登记，不产空数组。 */
      readonly samples: Readonly<Partial<Record<string, readonly number[]>>>;
      readonly extraNotes?: readonly string[];
    }
  | {
      readonly scenarioId: ScenarioId;
      readonly status: 'unmeasurable';
      readonly reasons: readonly string[];
    };

/** 组装某场景的外部样本 JSON（真进程实测数值；口径差与缺测臂自动并入 notes）。 */
export function buildRealSamplesDocument(
  outcome: Extract<ScenarioCollectionOutcome, { readonly status: 'measured' }>,
  meta: RealSamplesMeta
): RealSamplesDocument {
  const definition = scenarioDefinition(outcome.scenarioId);
  const definedSamples: Record<string, readonly number[]> = {};
  for (const [metricId, samples] of Object.entries(outcome.samples)) {
    if (samples !== undefined) {
      definedSamples[metricId] = samples;
    }
  }
  const validated = validateMetricSamples(definedSamples);
  const declared = new Set<string>(definition.metricIds);
  for (const metricId of Object.keys(validated)) {
    if (!declared.has(metricId)) {
      throw new PerfError(
        'PERF_INPUT_INVALID',
        `场景 ${definition.id} 未声明指标 ${metricId}，样本文件不得含该键（ingest 会拒绝）`
      );
    }
  }
  const notes: string[] = [
    ...(meta.notes ?? []),
    ...unmeasurableArmNotes(definition.id),
    ...(outcome.extraNotes ?? []),
  ];
  return {
    meta: { ...meta, notes },
    samples: validated,
  };
}

/** 样本文件名（约定落点 `reports/real-samples-<scenario>.json`）。 */
export function realSamplesFileName(scenarioId: ScenarioId): string {
  return `real-samples-${scenarioId}.json`;
}

/** 不可测结论文件名（与样本文件同目录、不同形状，避免被 ingest 误消费）。 */
export function realUnmeasurableFileName(scenarioId: ScenarioId): string {
  return `real-unmeasurable-${scenarioId}.json`;
}

/** 不可测结论文件（如实登记原因，零数值零估算）。 */
export interface RealUnmeasurableDocument {
  readonly kind: 'chips-perf-real-unmeasurable';
  readonly scenarioId: ScenarioId;
  readonly scenarioTitle: string;
  readonly status: 'unmeasurable';
  readonly reasons: readonly string[];
  readonly generatedAt: string;
}

export function buildRealUnmeasurableDocument(
  scenarioId: string,
  reasons: readonly string[],
  generatedAt: string
): RealUnmeasurableDocument {
  if (!isScenarioId(scenarioId)) {
    throw new PerfError('PERF_CONFIG_INVALID', `未知性能场景：${scenarioId}`);
  }
  const definition = scenarioDefinition(scenarioId);
  const collected = [...reasons, ...unmeasurableArmNotes(scenarioId)];
  if (collected.length === 0) {
    throw new PerfError('PERF_INPUT_INVALID', '不可测结论必须至少登记一条原因');
  }
  return {
    kind: 'chips-perf-real-unmeasurable',
    scenarioId,
    scenarioTitle: definition.title,
    status: 'unmeasurable',
    reasons: [...new Set(collected)],
    generatedAt,
  };
}

/**
 * 从 `measureScenario` 产出的报告提取外部样本文件所需数值数组。
 *
 * 提取规则：只取有实测样本（`verdict !== 'no-data'` 且 `samples` 非空）的指标；
 * 无数据指标由缺测臂 notes 如实登记，不进入 `samples`（防止空数组违反 ingest 契约）。
 */
export function extractSamplesFromReport(
  report: PerformanceReport,
  scenarioId: ScenarioId
): Readonly<Partial<Record<MetricId, readonly number[]>>> {
  if (report.meta.scenarioId !== scenarioId) {
    throw new PerfError(
      'PERF_INPUT_INVALID',
      `报告场景 ${report.meta.scenarioId} 与目标场景 ${scenarioId} 不一致`
    );
  }
  const extracted: Partial<Record<MetricId, readonly number[]>> = {};
  for (const metric of report.metrics) {
    if (metric.verdict === 'no-data' || metric.samples.length === 0) {
      continue;
    }
    extracted[metric.metricId] = [...metric.samples];
  }
  if (Object.keys(extracted).length === 0) {
    throw new PerfError('PERF_STATS_EMPTY', `场景 ${scenarioId} 的报告无任何实测样本`);
  }
  return extracted;
}
