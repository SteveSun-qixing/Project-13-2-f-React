import { metricDefinition, type MetricId } from '../src/metrics';
import {
  buildMetricResult,
  buildReport,
  reportIdFor,
  REPORT_SCHEMA_VERSION,
  type PerformanceReport,
} from '../src/report';
import type { ScenarioId } from '../src/scenarios';
import { DEFAULT_CONFIG, resolveThreshold, type PerfConfig } from '../src/thresholds';

/** 测试辅助：用显式样本构建报告（走真实门禁判定与报告组装）。 */

export interface MakeReportOptions {
  readonly scenarioId?: ScenarioId;
  readonly generatedAt?: string;
  readonly buildType?: 'release' | 'debug';
  readonly deviceLabel?: string;
  readonly phase?: 2 | 4;
  readonly samples: Readonly<Partial<Record<MetricId, readonly number[]>>>;
  readonly config?: PerfConfig;
}

export const REPORT_BASE_TIME = '2026-09-19T00:00:00.000Z';

/** 构建测试报告：未给出样本的指标记为 no-data。 */
export function makeReport(options: MakeReportOptions): PerformanceReport {
  const scenarioId = options.scenarioId ?? 'open-card';
  const generatedAt = options.generatedAt ?? REPORT_BASE_TIME;
  const config = options.config ?? DEFAULT_CONFIG;
  const phase = options.phase ?? config.phase;
  const metrics = (Object.keys(options.samples) as MetricId[]).map((metricId) => {
    const definition = metricDefinition(metricId);
    const threshold = { ...resolveThreshold(metricId, config), phase };
    return buildMetricResult(definition, options.samples[metricId] ?? [], threshold);
  });
  return buildReport(
    {
      schemaVersion: REPORT_SCHEMA_VERSION,
      generatedAt,
      reportId: reportIdFor(scenarioId, generatedAt),
      scenarioId,
      scenarioTitle: scenarioId,
      buildType: options.buildType ?? 'release',
      phase,
      deviceLabel: options.deviceLabel ?? 'test-device',
      platform: 'test',
      nodeVersion: 'v0.0.0-test',
      adapterId: 'test-adapter',
      adapterTitle: '测试适配器',
    },
    metrics,
    []
  );
}

/** 生成 `count` 个围绕 `center` 的值（确定性，不带随机）。 */
export function spread(center: number, count = 5, stepPercent = 1): readonly number[] {
  return Array.from(
    { length: count },
    (_, index) => center * (1 + ((index - (count - 1) / 2) * stepPercent) / 100)
  );
}
