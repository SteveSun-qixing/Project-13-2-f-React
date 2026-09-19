import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PerfError } from './errors';
import { isMetricId, type MetricDirection, type MetricId, type MetricUnit } from './metrics';
import {
  reportMetricValue,
  sanitizeTimestamp,
  type MetricResult,
  type PerformanceReport,
} from './report';
import { formatMetricValue } from './report';
import type { ScenarioId } from './scenarios';
import type { PerfConfig, RegressionPolicy } from './thresholds';
import type { StatisticName } from './stats';

/**
 * 基线回归比较：绝对门禁 + 相对回归 + 环境可比性。
 *
 * 判定规则：
 * - `gate-fail`：候选报告该指标自身判定为失败（绝对门禁）；
 * - `regression`：候选值相对基线劣化超过「相对容差 × 基线值」与「绝对噪声下限」中的较大者；
 * - `no-data`：候选或基线缺少有效数据（含基线缺失该指标）；回归门禁要求全指标可测；
 * - `no-baseline`：候选新增指标且基线未测量（信息项，不单独判失败，但仍受绝对门禁约束）；
 * - 可比性：构建类型、设备、Phase、报告模式版本任一不一致 → `incomparable`（退出码 3，不作为门禁结论）。
 */

/** 比较模式版本；第一版发布前不做兼容。 */
export const COMPARISON_SCHEMA_VERSION = '1.0.0';

/** 单指标比较结果。 */
export interface MetricComparison {
  readonly metricId: MetricId;
  readonly title: string;
  readonly unit: MetricUnit;
  readonly statistic: StatisticName;
  readonly direction: MetricDirection;
  readonly baselineValue: number | null;
  readonly candidateValue: number | null;
  readonly deltaPercent: number | null;
  readonly allowedDelta: number | null;
  readonly gateValue: number | null;
  readonly status: 'pass' | 'regression' | 'gate-fail' | 'no-data' | 'no-baseline';
  readonly messages: readonly string[];
}

/** 环境可比性。 */
export interface Comparability {
  readonly sameSchemaVersion: boolean;
  readonly sameScenario: boolean;
  readonly samePhase: boolean;
  readonly sameBuildType: boolean;
  readonly sameDevice: boolean;
  readonly gatesApplicable: boolean;
  readonly reasons: readonly string[];
}

/** 比较汇总。 */
export interface ComparisonSummary {
  readonly total: number;
  readonly passed: number;
  readonly regressions: number;
  readonly gateFailures: number;
  readonly noData: number;
  readonly noBaseline: number;
  readonly verdict: 'pass' | 'fail' | 'incomparable';
}

/** 回归比较报告。 */
export interface ComparisonReport {
  readonly schemaVersion: string;
  readonly generatedAt: string;
  readonly scenarioId: ScenarioId;
  readonly baselineReportId: string;
  readonly candidateReportId: string;
  readonly comparability: Comparability;
  readonly policy: RegressionPolicy;
  readonly metrics: readonly MetricComparison[];
  readonly summary: ComparisonSummary;
}

function candidateMetricIds(
  candidate: PerformanceReport,
  baseline: PerformanceReport
): readonly MetricId[] {
  const ids = new Set<MetricId>();
  for (const metric of [...candidate.metrics, ...baseline.metrics]) {
    const metricId: string = metric.metricId;
    if (!isMetricId(metricId)) {
      throw new PerfError('PERF_REPORT_INVALID', `比较含未登记指标：${metricId}`);
    }
    ids.add(metricId);
  }
  return [...ids];
}

function comparabilityOf(baseline: PerformanceReport, candidate: PerformanceReport): Comparability {
  const reasons: string[] = [];
  const sameSchemaVersion = baseline.schemaVersion === candidate.schemaVersion;
  const sameScenario = baseline.meta.scenarioId === candidate.meta.scenarioId;
  const samePhase = baseline.meta.phase === candidate.meta.phase;
  const sameBuildType = baseline.meta.buildType === candidate.meta.buildType;
  const sameDevice = baseline.meta.deviceLabel === candidate.meta.deviceLabel;
  if (!sameSchemaVersion) {
    reasons.push(
      `报告模式版本不同：基线 ${baseline.schemaVersion}，候选 ${candidate.schemaVersion}`
    );
  }
  if (!sameScenario) {
    reasons.push(`场景不同：基线 ${baseline.meta.scenarioId}，候选 ${candidate.meta.scenarioId}`);
  }
  if (!samePhase) {
    reasons.push(
      `Phase 不同：基线 ${String(baseline.meta.phase)}，候选 ${String(candidate.meta.phase)}`
    );
  }
  if (!sameBuildType) {
    reasons.push(`构建类型不同：基线 ${baseline.meta.buildType}，候选 ${candidate.meta.buildType}`);
  }
  if (!sameDevice) {
    reasons.push(`设备不同：基线 ${baseline.meta.deviceLabel}，候选 ${candidate.meta.deviceLabel}`);
  }
  if (candidate.meta.buildType === 'debug' && baseline.meta.buildType === 'debug') {
    reasons.push('debug 构建数据只用于相对比较，不作为门禁结论（《调试指南》§8.2）');
  }
  const gatesApplicable =
    sameSchemaVersion &&
    sameScenario &&
    samePhase &&
    sameBuildType &&
    sameDevice &&
    candidate.meta.buildType === 'release';
  return {
    sameSchemaVersion,
    sameScenario,
    samePhase,
    sameBuildType,
    sameDevice,
    gatesApplicable,
    reasons,
  };
}

function compareOne(
  metricId: MetricId,
  baselineMetric: MetricResult | undefined,
  candidateMetric: MetricResult | undefined,
  policy: RegressionPolicy
): MetricComparison {
  const reference = candidateMetric ?? baselineMetric;
  if (reference === undefined) {
    throw new PerfError('PERF_REPORT_INVALID', `比较指标 ${metricId} 无任何一侧数据`);
  }
  const base: Omit<MetricComparison, 'status' | 'messages'> = {
    metricId,
    title: reference.title,
    unit: reference.unit,
    statistic: reference.gate.statistic,
    direction: reference.direction,
    baselineValue: baselineMetric === undefined ? null : reportMetricValue(baselineMetric),
    candidateValue: candidateMetric === undefined ? null : reportMetricValue(candidateMetric),
    deltaPercent: null,
    allowedDelta: null,
    gateValue: candidateMetric === undefined ? null : candidateMetric.gate.value,
  };
  if (candidateMetric === undefined) {
    return {
      ...base,
      status: 'no-data',
      messages: [`候选报告缺少指标 ${reference.title}，无法比较（回归门禁要求全指标可测）`],
    };
  }
  if (candidateMetric.verdict === 'fail') {
    return {
      ...base,
      status: 'gate-fail',
      messages: [...candidateMetric.failures],
    };
  }
  if (base.candidateValue === null) {
    return { ...base, status: 'no-data', messages: ['候选报告该指标无有效测量数据'] };
  }
  if (base.baselineValue === null) {
    return {
      ...base,
      status: 'no-baseline',
      messages: ['基线未测量该指标；仅执行绝对门禁，不进行回归比较'],
    };
  }
  const tolerancePercent = policy.tolerancePercent[reference.unit];
  const absoluteFloor = policy.absoluteFloor[reference.unit];
  const allowedDelta = Math.max(
    (Math.abs(base.baselineValue) * tolerancePercent) / 100,
    absoluteFloor
  );
  const deltaPercent =
    base.baselineValue === 0
      ? null
      : ((base.candidateValue - base.baselineValue) / Math.abs(base.baselineValue)) * 100;
  const worsened =
    reference.direction === 'lower-is-better'
      ? base.candidateValue - base.baselineValue > allowedDelta
      : base.baselineValue - base.candidateValue > allowedDelta;
  if (worsened) {
    return {
      ...base,
      deltaPercent,
      allowedDelta,
      status: 'regression',
      messages: [
        `${reference.title} 相对基线劣化：${formatMetricValue(base.baselineValue, reference.unit)} → ${formatMetricValue(base.candidateValue, reference.unit)}，超出允许变化 ${allowedDelta.toFixed(3)} ${reference.unit}（相对容差 ${String(tolerancePercent)}% 与绝对噪声下限 ${String(absoluteFloor)} ${reference.unit} 取大）`,
      ],
    };
  }
  return {
    ...base,
    deltaPercent,
    allowedDelta,
    status: 'pass',
    messages: [],
  };
}

/** 执行回归比较；`generatedAt` 由调用方注入以保证可复现。 */
export function compareReports(
  baseline: PerformanceReport,
  candidate: PerformanceReport,
  config: PerfConfig,
  options: { readonly generatedAt: string }
): ComparisonReport {
  const comparability = comparabilityOf(baseline, candidate);
  const metrics = candidateMetricIds(candidate, baseline).map((metricId) =>
    compareOne(
      metricId,
      baseline.metrics.find((metric) => metric.metricId === metricId),
      candidate.metrics.find((metric) => metric.metricId === metricId),
      config.regression
    )
  );
  let passed = 0;
  let regressions = 0;
  let gateFailures = 0;
  let noData = 0;
  let noBaseline = 0;
  for (const metric of metrics) {
    switch (metric.status) {
      case 'pass':
        passed += 1;
        break;
      case 'regression':
        regressions += 1;
        break;
      case 'gate-fail':
        gateFailures += 1;
        break;
      case 'no-baseline':
        noBaseline += 1;
        break;
      case 'no-data':
        noData += 1;
        break;
    }
  }
  const failed = gateFailures > 0 || regressions > 0 || noData > 0;
  const verdict: ComparisonSummary['verdict'] = !comparability.gatesApplicable
    ? 'incomparable'
    : failed
      ? 'fail'
      : 'pass';
  return {
    schemaVersion: COMPARISON_SCHEMA_VERSION,
    generatedAt: options.generatedAt,
    scenarioId: candidate.meta.scenarioId,
    baselineReportId: baseline.meta.reportId,
    candidateReportId: candidate.meta.reportId,
    comparability,
    policy: config.regression,
    metrics,
    summary: {
      total: metrics.length,
      passed,
      regressions,
      gateFailures,
      noData,
      noBaseline,
      verdict,
    },
  };
}

/** 比较报告基础文件名（不含扩展名）。 */
export function comparisonFileName(report: ComparisonReport): string {
  return `${sanitizeTimestamp(report.generatedAt)}-compare-${report.scenarioId}`;
}

/** 写出比较报告的 JSON 与 Markdown；返回文件路径。 */
export async function writeComparison(
  report: ComparisonReport,
  outputDir: string
): Promise<{ readonly jsonPath: string; readonly markdownPath: string }> {
  await mkdir(outputDir, { recursive: true });
  const baseName = comparisonFileName(report);
  const jsonPath = join(outputDir, `${baseName}.json`);
  const markdownPath = join(outputDir, `${baseName}.md`);
  await writeFile(jsonPath, comparisonToJson(report), 'utf8');
  await writeFile(markdownPath, comparisonToMarkdown(report), 'utf8');
  return { jsonPath, markdownPath };
}

/** 比较报告退出码：0 通过、1 失败、3 不可比（不作为门禁结论）。 */
export function comparisonExitCode(report: ComparisonReport): 0 | 1 | 3 {
  switch (report.summary.verdict) {
    case 'pass':
      return 0;
    case 'fail':
      return 1;
    case 'incomparable':
      return 3;
  }
}

/** 序列化为 JSON 文本。 */
export function comparisonToJson(report: ComparisonReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

const STATUS_LABELS: Readonly<Record<MetricComparison['status'], string>> = {
  pass: '通过',
  regression: '回归劣化',
  'gate-fail': '门禁失败',
  'no-data': '无数据',
  'no-baseline': '无基线',
};

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function formatDelta(metric: MetricComparison): string {
  if (metric.deltaPercent === null) {
    return '—';
  }
  const sign = metric.deltaPercent > 0 ? '+' : '';
  return `${sign}${metric.deltaPercent.toFixed(2)}%`;
}

/** 渲染 Markdown 比较报告。 */
export function comparisonToMarkdown(report: ComparisonReport): string {
  const lines: string[] = [];
  lines.push('# 薯片生态性能回归比较');
  lines.push('');
  lines.push(`> 生成时间：${report.generatedAt}`);
  lines.push(`> 基线：${report.baselineReportId}`);
  lines.push(`> 候选：${report.candidateReportId}`);
  lines.push(
    `> 可比性：${report.comparability.gatesApplicable ? '可比（门禁结论有效）' : '不可比（不作为门禁结论）'}`
  );
  for (const reason of report.comparability.reasons) {
    lines.push(`> - ${reason}`);
  }
  lines.push(
    `> 回归策略：相对容差 ms ${String(report.policy.tolerancePercent.ms)}% / fps ${String(report.policy.tolerancePercent.fps)}% / MB ${String(report.policy.tolerancePercent.mb)}% / μs ${String(report.policy.tolerancePercent.us)}% / 个 ${String(report.policy.tolerancePercent.count)}%；噪声下限 ms ${String(report.policy.absoluteFloor.ms)} / fps ${String(report.policy.absoluteFloor.fps)} / MB ${String(report.policy.absoluteFloor.mb)} / μs ${String(report.policy.absoluteFloor.us)} / 个 ${String(report.policy.absoluteFloor.count)}`
  );
  lines.push('');
  const verdictLabel =
    report.summary.verdict === 'pass'
      ? '通过'
      : report.summary.verdict === 'fail'
        ? '失败'
        : '不可比';
  lines.push(
    `## 结论：${verdictLabel}（回归 ${String(report.summary.regressions)}，门禁失败 ${String(report.summary.gateFailures)}，无数据 ${String(report.summary.noData)}，无基线 ${String(report.summary.noBaseline)}，共 ${String(report.summary.total)} 项）`
  );
  lines.push('');
  lines.push('| 指标 | 基线 | 候选 | 变化 | 允许变化 | 门禁 | 状态 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const metric of report.metrics) {
    const baselineText =
      metric.baselineValue === null ? '—' : formatMetricValue(metric.baselineValue, metric.unit);
    const candidateText =
      metric.candidateValue === null ? '—' : formatMetricValue(metric.candidateValue, metric.unit);
    const allowedText =
      metric.allowedDelta === null ? '—' : `± ${metric.allowedDelta.toFixed(3)} ${metric.unit}`;
    const gateText =
      metric.gateValue === null ? '—' : formatMetricValue(metric.gateValue, metric.unit);
    lines.push(
      `| ${escapeCell(metric.title)} | ${baselineText} | ${candidateText} | ${formatDelta(metric)} | ${allowedText} | ${gateText} | ${STATUS_LABELS[metric.status]} |`
    );
  }
  lines.push('');
  const problems = report.metrics.filter(
    (metric) => metric.status !== 'pass' && metric.status !== 'no-baseline'
  );
  if (problems.length > 0) {
    lines.push('## 问题详情');
    lines.push('');
    for (const metric of problems) {
      for (const message of metric.messages) {
        lines.push(`- ${message}`);
      }
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('**文档结束**');
  return `${lines.join('\n')}\n`;
}
