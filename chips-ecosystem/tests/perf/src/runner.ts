import { PerfError } from './errors';
import {
  assertValidAdapter,
  validateMetricSamples,
  type AdapterRunResult,
  type PerfAdapter,
} from './adapters';
import { summarizeFrames } from './fps';
import { timelineFromMarkers } from './markers';
import { metricDefinition, type MetricId } from './metrics';
import { summarizeMemory } from './memory';
import {
  REPORT_SCHEMA_VERSION,
  buildMetricResult,
  buildPhaseResult,
  buildReport,
  reportIdFor,
  type MetricResult,
  type PerformanceReport,
  type PhaseResult,
  type ReportMeta,
} from './report';
import {
  scenarioDefinition,
  scenarioPhaseBudgets,
  type ScenarioDefinition,
  type ScenarioId,
} from './scenarios';
import { resolveThresholds, type PerfConfig, type ThresholdResolution } from './thresholds';

/**
 * 测量编排：驱动适配器采集原始信号，产出该场景的性能报告。
 *
 * 判定、统计与报告全部由本工具负责；适配器只提供原始信号。
 */

/** 测量元数据（写入报告，供回归比较判断环境可比性）。 */
export interface MeasurementMeta {
  readonly buildType: 'release' | 'debug';
  readonly deviceLabel: string;
  readonly platform: string;
  readonly nodeVersion: string;
  readonly hostVersion?: string;
  readonly notes?: readonly string[];
}

/** 单场景测量请求。 */
export interface MeasureScenarioRequest {
  readonly scenarioId: ScenarioId;
  readonly adapter: PerfAdapter;
  readonly config: PerfConfig;
  readonly meta: MeasurementMeta;
  /** 报告生成时间（ISO 8601）；由调用方注入以保证可复现。 */
  readonly generatedAt: string;
  readonly configPath?: string;
}

function ensureScenarioProvided(adapter: PerfAdapter, scenarioId: ScenarioId): void {
  if (!adapter.provides.includes(scenarioId)) {
    throw new PerfError(
      'PERF_ADAPTER_INVALID',
      `适配器 ${adapter.id} 未声明场景 ${scenarioId}（provides：${adapter.provides.join('、')}）`
    );
  }
}

function mergeExplicitSamples(
  definition: ScenarioDefinition,
  result: AdapterRunResult,
  target: Map<MetricId, number[]>,
  notes: string[]
): void {
  const explicit = validateMetricSamples(result.metricSamples);
  for (const [metricId, samples] of Object.entries(explicit)) {
    if (samples === undefined) {
      continue;
    }
    if (!definition.metricIds.includes(metricId as MetricId)) {
      throw new PerfError(
        'PERF_ADAPTER_INVALID',
        `场景 ${definition.id} 未声明指标 ${metricId}，适配器不得上报`
      );
    }
    target.set(metricId as MetricId, [...samples]);
  }
  if (result.notes !== undefined) {
    notes.push(...result.notes);
  }
}

function requiresMarkers(result: AdapterRunResult, scenarioId: ScenarioId): void {
  if (result.markers === undefined || result.markers.length === 0) {
    throw new PerfError('PERF_ADAPTER_INVALID', `场景 ${scenarioId} 需要适配器返回 markers`);
  }
}

function requiresFrames(result: AdapterRunResult, scenarioId: ScenarioId): void {
  if (result.frameTimestampsMs === undefined || result.frameTimestampsMs.length === 0) {
    throw new PerfError(
      'PERF_ADAPTER_INVALID',
      `场景 ${scenarioId} 需要适配器返回 frameTimestampsMs`
    );
  }
}

function requiresMemory(result: AdapterRunResult, scenarioId: ScenarioId): void {
  if (result.memorySamples === undefined || result.memorySamples.length === 0) {
    throw new PerfError('PERF_ADAPTER_INVALID', `场景 ${scenarioId} 需要适配器返回 memorySamples`);
  }
}

async function collectMarkersScenario(
  definition: ScenarioDefinition,
  request: MeasureScenarioRequest,
  samplesByMetric: Map<MetricId, number[]>,
  phaseSamples: Map<string, number[]>,
  notes: string[]
): Promise<void> {
  const totalMetricId = definition.metricIds[0];
  if (
    definition.metricIds.length !== 1 ||
    definition.totalSpan === undefined ||
    totalMetricId === undefined
  ) {
    throw new PerfError(
      'PERF_CONFIG_INVALID',
      `标记点场景 ${definition.id} 必须声明唯一指标与 totalSpan`
    );
  }
  const phases = scenarioPhaseBudgets(definition);
  const totalSamples: number[] = [];
  for (let iteration = 0; iteration < request.config.measurement.rounds; iteration += 1) {
    const result = await request.adapter.run({ scenarioId: definition.id, iteration });
    requiresMarkers(result, definition.id);
    if (result.markers === undefined) {
      throw new PerfError('PERF_ADAPTER_INVALID', `场景 ${definition.id} 缺少 markers`);
    }
    const timeline = timelineFromMarkers(result.markers);
    totalSamples.push(timeline.duration(definition.totalSpan));
    for (const { phase } of phases) {
      const bucket = phaseSamples.get(phase.id) ?? [];
      bucket.push(timeline.duration({ from: phase.from, to: phase.to }));
      phaseSamples.set(phase.id, bucket);
    }
    mergeExplicitSamples(definition, result, samplesByMetric, notes);
  }
  samplesByMetric.set(totalMetricId, totalSamples);
}

async function collectFramesScenario(
  definition: ScenarioDefinition,
  request: MeasureScenarioRequest,
  samplesByMetric: Map<MetricId, number[]>,
  notes: string[]
): Promise<void> {
  const result = await request.adapter.run({ scenarioId: definition.id, iteration: 0 });
  requiresFrames(result, definition.id);
  if (result.frameTimestampsMs === undefined) {
    throw new PerfError('PERF_ADAPTER_INVALID', `场景 ${definition.id} 缺少 frameTimestampsMs`);
  }
  const summary = summarizeFrames(result.frameTimestampsMs);
  const requiredMs = definition.sampling.minDurationMs;
  if (requiredMs !== undefined && Math.round(summary.durationMs) < requiredMs) {
    throw new PerfError(
      'PERF_ADAPTER_INVALID',
      `场景 ${definition.id} 要求至少 ${String(requiredMs)} ms 帧采样，适配器仅返回 ${summary.durationMs.toFixed(1)} ms`
    );
  }
  samplesByMetric.set(
    'sustained_fps',
    summary.buckets.map((bucket) => bucket.fps)
  );
  notes.push(
    `帧数 ${String(summary.frameCount)}，时长 ${summary.durationMs.toFixed(0)} ms，平均帧率 ${summary.averageFps.toFixed(2)} fps，帧时间 P95 ${summary.frameTimeStats.p95.toFixed(2)} ms，长帧（> ${summary.frameBudgetMs.toFixed(2)} ms）${String(summary.longFrameCount)} 个（${(summary.longFrameRatio * 100).toFixed(1)}%）`
  );
  mergeExplicitSamples(definition, result, samplesByMetric, notes);
}

async function collectMemoryScenario(
  definition: ScenarioDefinition,
  request: MeasureScenarioRequest,
  samplesByMetric: Map<MetricId, number[]>,
  notes: string[]
): Promise<void> {
  const result = await request.adapter.run({ scenarioId: definition.id, iteration: 0 });
  requiresMemory(result, definition.id);
  if (result.memorySamples === undefined) {
    throw new PerfError('PERF_ADAPTER_INVALID', `场景 ${definition.id} 缺少 memorySamples`);
  }
  const summary = summarizeMemory(result.memorySamples, {
    idleWindowMs: request.config.measurement.idleWindowMs,
  });
  samplesByMetric.set('idle_memory_mb', [...summary.stableSamplesMb]);
  notes.push(
    `采样 ${String(summary.sampleCount)} 次，空闲窗口 ${String(summary.stableWindowMs)} ms 内 ${String(summary.stableSampleCount)} 次，峰值 ${summary.peakRssMb.toFixed(1)} MB，趋势 ${summary.trendMbPerMinute.toFixed(2)} MB/分钟`
  );
  mergeExplicitSamples(definition, result, samplesByMetric, notes);
}

async function collectSamplesScenario(
  definition: ScenarioDefinition,
  request: MeasureScenarioRequest,
  samplesByMetric: Map<MetricId, number[]>,
  notes: string[]
): Promise<void> {
  const result = await request.adapter.run({ scenarioId: definition.id, iteration: 0 });
  mergeExplicitSamples(definition, result, samplesByMetric, notes);
}

/** 执行单场景测量并产出报告。 */
export async function measureScenario(request: MeasureScenarioRequest): Promise<PerformanceReport> {
  assertValidAdapter(request.adapter);
  const definition = scenarioDefinition(request.scenarioId);
  ensureScenarioProvided(request.adapter, definition.id);
  const thresholds = resolveThresholds(request.config);
  const samplesByMetric = new Map<MetricId, number[]>();
  const phaseSamples = new Map<string, number[]>();
  const notes: string[] = [];

  switch (definition.kind) {
    case 'markers':
      await collectMarkersScenario(definition, request, samplesByMetric, phaseSamples, notes);
      break;
    case 'frames':
      await collectFramesScenario(definition, request, samplesByMetric, notes);
      break;
    case 'memory':
      await collectMemoryScenario(definition, request, samplesByMetric, notes);
      break;
    case 'samples':
      await collectSamplesScenario(definition, request, samplesByMetric, notes);
      break;
  }

  const metrics: MetricResult[] = definition.metricIds.map((metricId) => {
    const threshold = thresholds.get(metricId);
    if (threshold === undefined) {
      throw new PerfError('PERF_CONFIG_INVALID', `缺少指标门禁解析：${metricId}`);
    }
    return buildMetricResult(
      metricDefinition(metricId),
      samplesByMetric.get(metricId) ?? [],
      threshold
    );
  });

  const phases: PhaseResult[] = scenarioPhaseBudgets(definition).map(({ phase, budget }) =>
    buildPhaseResult(phase, budget, phaseSamples.get(phase.id) ?? [])
  );

  const meta: ReportMeta = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: request.generatedAt,
    reportId: reportIdFor(definition.id, request.generatedAt),
    scenarioId: definition.id,
    scenarioTitle: definition.title,
    buildType: request.meta.buildType,
    phase: request.config.phase,
    deviceLabel: request.meta.deviceLabel,
    platform: request.meta.platform,
    nodeVersion: request.meta.nodeVersion,
    adapterId: request.adapter.id,
    adapterTitle: request.adapter.title,
    ...(request.meta.hostVersion !== undefined ? { hostVersion: request.meta.hostVersion } : {}),
    ...(request.configPath !== undefined ? { configPath: request.configPath } : {}),
    ...([...(request.meta.notes ?? []), ...notes].length > 0
      ? { notes: [...(request.meta.notes ?? []), ...notes] }
      : {}),
  };

  return buildReport(meta, metrics, phases);
}

/** 导出该场景门禁解析（CLI/测试用）。 */
export function scenarioThresholds(config: PerfConfig): ReadonlyMap<MetricId, ThresholdResolution> {
  return resolveThresholds(config);
}
