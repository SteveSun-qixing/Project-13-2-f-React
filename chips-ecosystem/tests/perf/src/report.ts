import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PerfError, isPerfError } from './errors';
import {
  UNIT_LABELS,
  isMetricId,
  type GateComparison,
  type MetricDefinition,
  type MetricDirection,
  type MetricGroup,
  type MetricId,
  type MetricUnit,
} from './metrics';
import type { ScenarioId, ScenarioPhase } from './scenarios';
import { isScenarioId } from './scenarios';
import { computeStats, selectStatistic, type NumericStats, type StatisticName } from './stats';
import type { MetricPhaseBudget } from './metrics';
import type { ThresholdResolution } from './thresholds';

/**
 * 报告模型与序列化：同一份测量同时产出 JSON（机器消费/回归比较）与 Markdown（评审证据）。
 */

/** 报告模式版本；第一版发布前不做兼容，版本不匹配即拒绝解析。 */
export const REPORT_SCHEMA_VERSION = '1.0.0';

/** 指标判定结果。 */
export type MetricVerdict = 'pass' | 'fail' | 'no-data';

/** 报告中的门禁记录（含覆盖来源与理由）。 */
export interface MetricGate {
  readonly statistic: StatisticName;
  readonly value: number;
  readonly comparison: GateComparison;
  readonly phase: 2 | 4;
  readonly source: 'R18' | 'config';
  readonly citation: string;
  readonly phaseFallback?: boolean;
  readonly overrideRationale?: string;
}

/** 单个指标的测量结果。 */
export interface MetricResult {
  readonly metricId: MetricId;
  readonly title: string;
  readonly unit: MetricUnit;
  readonly group: MetricGroup;
  readonly direction: MetricDirection;
  readonly measurement: string;
  readonly gate: MetricGate;
  readonly samples: readonly number[];
  readonly stats: NumericStats | null;
  readonly verdict: MetricVerdict;
  readonly failures: readonly string[];
  readonly notes?: readonly string[];
}

/** 标记点场景的阶段分解结果。 */
export interface PhaseResult {
  readonly id: string;
  readonly title: string;
  readonly metricId: MetricId;
  readonly from: string;
  readonly to: string;
  readonly boundMs: number;
  readonly citation: string;
  readonly stats: NumericStats;
  readonly verdict: 'pass' | 'fail';
}

/** 报告元数据（构建类型、设备、场景、适配器与配置来源）。 */
export interface ReportMeta {
  readonly schemaVersion: string;
  readonly generatedAt: string;
  readonly reportId: string;
  readonly scenarioId: ScenarioId;
  readonly scenarioTitle: string;
  readonly buildType: 'release' | 'debug';
  readonly phase: 2 | 4;
  readonly deviceLabel: string;
  readonly platform: string;
  readonly nodeVersion: string;
  readonly hostVersion?: string;
  readonly adapterId: string;
  readonly adapterTitle: string;
  readonly configPath?: string;
  readonly notes?: readonly string[];
}

/** 报告汇总。 */
export interface ReportSummary {
  readonly total: number;
  readonly pass: number;
  readonly fail: number;
  readonly noData: number;
  readonly verdict: 'pass' | 'fail' | 'no-data';
}

/** 完整性能报告。 */
export interface PerformanceReport {
  readonly schemaVersion: string;
  readonly meta: ReportMeta;
  readonly metrics: readonly MetricResult[];
  readonly phases: readonly PhaseResult[];
  readonly summary: ReportSummary;
}

const STATISTIC_LABELS: Readonly<Record<StatisticName, string>> = {
  median: '中位数',
  mean: '均值',
  p50: 'P50',
  p95: 'P95',
  p99: 'P99',
  max: '最大值',
};

const COMPARISON_LABELS: Readonly<Record<GateComparison, string>> = {
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
};

/** 按比较符判定测量值是否满足门禁。 */
export function satisfiesComparison(
  value: number,
  comparison: GateComparison,
  bound: number
): boolean {
  switch (comparison) {
    case 'lt':
      return value < bound;
    case 'lte':
      return value <= bound;
    case 'gt':
      return value > bound;
    case 'gte':
      return value >= bound;
  }
}

/** 数值展示：按单位保留合适小数位（判定一律使用原始值）。 */
export function formatMetricValue(value: number, unit: MetricUnit): string {
  switch (unit) {
    case 'ms':
      return `${value.toFixed(2)} ms`;
    case 'fps':
      return `${value.toFixed(2)} fps`;
    case 'mb':
      return `${value.toFixed(1)} MB`;
    case 'us':
      return `${value.toFixed(3)} μs`;
    case 'count':
      return `${Math.round(value)} 个`;
  }
}

function gateRecordOf(threshold: ThresholdResolution): MetricGate {
  return {
    statistic: threshold.statistic,
    value: threshold.value,
    comparison: threshold.comparison,
    phase: threshold.phase,
    source: threshold.source,
    citation: threshold.citation,
    ...(threshold.phaseFallback === true ? { phaseFallback: true } : {}),
    ...(threshold.overrideRationale !== undefined
      ? { overrideRationale: threshold.overrideRationale }
      : {}),
  };
}

/**
 * 构建指标结果：空样本记为 `no-data`；否则按门禁统计量判定。
 */
export function buildMetricResult(
  definition: MetricDefinition,
  samples: readonly number[],
  threshold: ThresholdResolution,
  notes?: readonly string[]
): MetricResult {
  const base = {
    metricId: definition.id,
    title: definition.title,
    unit: definition.unit,
    group: definition.group,
    direction: definition.direction,
    measurement: definition.measurement,
    gate: gateRecordOf(threshold),
    samples: [...samples],
    ...(notes !== undefined && notes.length > 0 ? { notes: [...notes] } : {}),
  };
  if (samples.length === 0) {
    return { ...base, stats: null, verdict: 'no-data', failures: ['无测量数据'] };
  }
  const stats = computeStats(samples);
  const measured = selectStatistic(stats, threshold.statistic);
  const passed = satisfiesComparison(measured, threshold.comparison, threshold.value);
  const failure = `${definition.title}：${STATISTIC_LABELS[threshold.statistic]} ${formatMetricValue(measured, definition.unit)} 未满足 ${COMPARISON_LABELS[threshold.comparison]} ${formatMetricValue(threshold.value, definition.unit)}（${threshold.citation}）`;
  return { ...base, stats, verdict: passed ? 'pass' : 'fail', failures: passed ? [] : [failure] };
}

/**
 * 构建阶段结果：阶段预算为上限口径（≤），任一测量轮超过预算即判 fail（取样本最大值比较）。
 *
 * 总指标仍按《CICD与质量门禁》§3.3 的多轮中位数协议判定；阶段分解是诊断信息，
 * 采用更严格的上限口径可在总门禁通过时仍暴露单轮阶段尖峰。
 */
export function buildPhaseResult(
  phase: ScenarioPhase,
  budget: MetricPhaseBudget,
  samples: readonly number[]
): PhaseResult {
  if (samples.length === 0) {
    throw new PerfError('PERF_STATS_EMPTY', `阶段 ${phase.id} 无测量数据`);
  }
  const stats = computeStats(samples);
  return {
    id: phase.id,
    title: phase.title,
    metricId: phase.metricId,
    from: phase.from,
    to: phase.to,
    boundMs: budget.boundMs,
    citation: budget.citation,
    stats,
    verdict: stats.max <= budget.boundMs ? 'pass' : 'fail',
  };
}

/** 汇总指标判定。 */
export function summarizeMetrics(metrics: readonly MetricResult[]): ReportSummary {
  let pass = 0;
  let fail = 0;
  let noData = 0;
  for (const metric of metrics) {
    if (metric.verdict === 'pass') {
      pass += 1;
    } else if (metric.verdict === 'fail') {
      fail += 1;
    } else {
      noData += 1;
    }
  }
  const verdict: ReportSummary['verdict'] = fail > 0 ? 'fail' : noData > 0 ? 'no-data' : 'pass';
  return { total: metrics.length, pass, fail, noData, verdict };
}

/** 组装报告。 */
export function buildReport(
  meta: ReportMeta,
  metrics: readonly MetricResult[],
  phases: readonly PhaseResult[]
): PerformanceReport {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    meta,
    metrics,
    phases,
    summary: summarizeMetrics(metrics),
  };
}

/** 生成报告 ID：`<场景>@<ISO 时间>`。 */
export function reportIdFor(scenarioId: ScenarioId, generatedAt: string): string {
  return `${scenarioId}@${generatedAt}`;
}

/** 文件名安全的时间戳：ISO 8601 中的 `:` 与 `.` 替换为 `-`。 */
export function sanitizeTimestamp(generatedAt: string): string {
  return generatedAt.replace(/[:.]/g, '-');
}

/** 报告基础文件名（不含扩展名）。 */
export function reportFileName(report: PerformanceReport): string {
  return `${sanitizeTimestamp(report.meta.generatedAt)}-${report.meta.scenarioId}`;
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

const VERDICT_LABELS: Readonly<Record<MetricVerdict, string>> = {
  pass: '通过',
  fail: '失败',
  'no-data': '无数据',
};

const SUMMARY_LABELS: Readonly<Record<ReportSummary['verdict'], string>> = {
  pass: '通过',
  fail: '失败',
  'no-data': '无数据',
};

/** 序列化为 JSON 文本（2 空格缩进，结尾换行，便于 diff 与归档）。 */
export function reportToJson(report: PerformanceReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

/** 渲染为 Markdown 报告。 */
export function reportToMarkdown(report: PerformanceReport): string {
  const { meta, metrics, phases, summary } = report;
  const lines: string[] = [];
  lines.push(`# 薯片生态性能基线报告：${meta.scenarioTitle}`);
  lines.push('');
  lines.push(`> 报告 ID：${meta.reportId}`);
  lines.push(`> 生成时间：${meta.generatedAt}`);
  lines.push(`> 场景：${meta.scenarioId}（${meta.scenarioTitle}）`);
  lines.push(`> 构建类型：${meta.buildType} / Phase ${String(meta.phase)}`);
  lines.push(`> 设备：${meta.deviceLabel}（${meta.platform}，Node ${meta.nodeVersion}）`);
  lines.push(`> 适配器：${meta.adapterId}（${meta.adapterTitle}）`);
  if (meta.configPath !== undefined) {
    lines.push(`> 配置：${meta.configPath}`);
  }
  if (meta.hostVersion !== undefined) {
    lines.push(`> Host 版本：${meta.hostVersion}`);
  }
  lines.push('');
  lines.push(
    `## 汇总：${SUMMARY_LABELS[summary.verdict]}（通过 ${String(summary.pass)} / 失败 ${String(summary.fail)} / 无数据 ${String(summary.noData)}，共 ${String(summary.total)} 项）`
  );
  lines.push('');
  lines.push('## 指标判定');
  lines.push('');
  lines.push('| 指标 | 统计量 | 测量值 | 门禁 | 判定 | 权威来源 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const metric of metrics) {
    const statistic = STATISTIC_LABELS[metric.gate.statistic];
    const measured =
      metric.stats === null
        ? '—'
        : formatMetricValue(selectStatistic(metric.stats, metric.gate.statistic), metric.unit);
    const gate = `${COMPARISON_LABELS[metric.gate.comparison]} ${formatMetricValue(metric.gate.value, metric.unit)}`;
    lines.push(
      `| ${escapeMarkdownCell(metric.title)} | ${statistic} | ${measured} | ${gate} | ${VERDICT_LABELS[metric.verdict]} | ${escapeMarkdownCell(metric.gate.citation)} |`
    );
  }
  lines.push('');
  if (phases.length > 0) {
    lines.push('## 阶段分解');
    lines.push('');
    lines.push('| 阶段 | 中位数 | 最大值 | 预算 | 判定 | 来源 |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const phase of phases) {
      lines.push(
        `| ${escapeMarkdownCell(phase.title)} | ${formatMetricValue(phase.stats.median, 'ms')} | ${formatMetricValue(phase.stats.max, 'ms')} | ≤ ${formatMetricValue(phase.boundMs, 'ms')} | ${phase.verdict === 'pass' ? '通过' : '失败'} | ${escapeMarkdownCell(phase.citation)} |`
      );
    }
    lines.push('');
  }
  const failedMetrics = metrics.filter((metric) => metric.verdict !== 'pass');
  if (failedMetrics.length > 0) {
    lines.push('## 未通过详情');
    lines.push('');
    for (const metric of failedMetrics) {
      for (const failure of metric.failures) {
        lines.push(`- ${failure}`);
      }
    }
    lines.push('');
  }
  lines.push('## 测量口径');
  lines.push('');
  for (const metric of metrics) {
    const noteSuffix =
      metric.notes !== undefined && metric.notes.length > 0 ? `（${metric.notes.join('；')}）` : '';
    lines.push(`- ${metric.title}：${metric.measurement}${noteSuffix}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('**文档结束**');
  return `${lines.join('\n')}\n`;
}

/** 写出 JSON 与 Markdown 报告；返回文件路径。 */
export async function writeReport(
  report: PerformanceReport,
  outputDir: string
): Promise<{ readonly jsonPath: string; readonly markdownPath: string }> {
  await mkdir(outputDir, { recursive: true });
  const baseName = reportFileName(report);
  const jsonPath = join(outputDir, `${baseName}.json`);
  const markdownPath = join(outputDir, `${baseName}.md`);
  await writeFile(jsonPath, reportToJson(report), 'utf8');
  await writeFile(markdownPath, reportToMarkdown(report), 'utf8');
  return { jsonPath, markdownPath };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 判断任意值是否为字符串数组；报告与外部输入校验共用。 */
export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry): entry is string => typeof entry === 'string');
}

function invalid(path: string, reason: string): never {
  throw new PerfError('PERF_REPORT_INVALID', `报告字段 ${path} 非法：${reason}`);
}

function readString(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    invalid(`${path}.${key}`, '必须是非空字符串');
  }
  return value;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  path: string
): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    invalid(`${path}.${key}`, '必须是字符串');
  }
  return value;
}

function readStringArray(
  record: Record<string, unknown>,
  key: string,
  path: string
): readonly string[] | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (!isStringArray(value)) {
    invalid(`${path}.${key}`, '必须是字符串数组');
  }
  return value;
}

function readNumber(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    invalid(`${path}.${key}`, '必须是有限数值');
  }
  return value;
}

function readStringEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  path: string
): T {
  const value = record[key];
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    invalid(`${path}.${key}`, `必须是 ${allowed.join(' / ')} 之一`);
  }
  return value as T;
}

function parseStats(value: unknown, path: string): NumericStats | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    invalid(path, '必须是对象或 null');
  }
  const count = readNumber(value, 'count', path);
  if (!Number.isInteger(count) || count < 1) {
    invalid(`${path}.count`, '必须是 ≥1 的整数');
  }
  return {
    count,
    min: readNumber(value, 'min', path),
    max: readNumber(value, 'max', path),
    mean: readNumber(value, 'mean', path),
    median: readNumber(value, 'median', path),
    p50: readNumber(value, 'p50', path),
    p95: readNumber(value, 'p95', path),
    p99: readNumber(value, 'p99', path),
    stddev: readNumber(value, 'stddev', path),
  };
}

function parseMetricGate(value: unknown, path: string): MetricGate {
  if (!isRecord(value)) {
    invalid(path, '必须是对象');
  }
  const statistic = readStringEnum(
    value,
    'statistic',
    ['median', 'mean', 'p50', 'p95', 'p99', 'max'] as const,
    path
  );
  const comparison = readStringEnum(value, 'comparison', ['lt', 'lte', 'gt', 'gte'] as const, path);
  const phase = readNumber(value, 'phase', path);
  if (phase !== 2 && phase !== 4) {
    invalid(`${path}.phase`, '必须是 2 或 4');
  }
  const source = readStringEnum(value, 'source', ['R18', 'config'] as const, path);
  const phaseFallbackRaw = value['phaseFallback'];
  if (phaseFallbackRaw !== undefined && typeof phaseFallbackRaw !== 'boolean') {
    invalid(`${path}.phaseFallback`, '必须是布尔值');
  }
  const overrideRationale = readOptionalString(value, 'overrideRationale', path);
  return {
    statistic,
    value: readNumber(value, 'value', path),
    comparison,
    phase,
    source,
    citation: readString(value, 'citation', path),
    ...(phaseFallbackRaw === true ? { phaseFallback: true } : {}),
    ...(overrideRationale !== undefined ? { overrideRationale } : {}),
  };
}

function parseMetricResult(value: unknown, path: string): MetricResult {
  if (!isRecord(value)) {
    invalid(path, '必须是对象');
  }
  const metricIdRaw = readString(value, 'metricId', path);
  if (!isMetricId(metricIdRaw)) {
    invalid(`${path}.metricId`, `未登记指标：${metricIdRaw}`);
  }
  const unit = readStringEnum(value, 'unit', ['ms', 'fps', 'mb', 'us', 'count'] as const, path);
  const group = readStringEnum(
    value,
    'group',
    ['platform', 'render', 'parse', 'kernel', 'event', 'resource'] as const,
    path
  );
  const direction = readStringEnum(
    value,
    'direction',
    ['lower-is-better', 'higher-is-better'] as const,
    path
  );
  const verdict = readStringEnum(value, 'verdict', ['pass', 'fail', 'no-data'] as const, path);
  const samplesRaw = value['samples'];
  if (!Array.isArray(samplesRaw)) {
    invalid(`${path}.samples`, '必须是数值数组');
  }
  const samples: number[] = [];
  for (let index = 0; index < samplesRaw.length; index += 1) {
    const sample: unknown = samplesRaw[index];
    if (typeof sample !== 'number' || !Number.isFinite(sample)) {
      invalid(`${path}.samples[${String(index)}]`, '必须是有限数值');
    }
    samples.push(sample);
  }
  const failuresRaw = value['failures'];
  if (!isStringArray(failuresRaw)) {
    invalid(`${path}.failures`, '必须是字符串数组');
  }
  const notes = readStringArray(value, 'notes', path);
  return {
    metricId: metricIdRaw,
    title: readString(value, 'title', path),
    unit,
    group,
    direction,
    measurement: readString(value, 'measurement', path),
    gate: parseMetricGate(value['gate'], `${path}.gate`),
    samples,
    stats: parseStats(value['stats'], `${path}.stats`),
    verdict,
    failures: failuresRaw,
    ...(notes !== undefined ? { notes } : {}),
  };
}

function parsePhaseResult(value: unknown, path: string): PhaseResult {
  if (!isRecord(value)) {
    invalid(path, '必须是对象');
  }
  const metricIdRaw = readString(value, 'metricId', path);
  if (!isMetricId(metricIdRaw)) {
    invalid(`${path}.metricId`, `未登记指标：${metricIdRaw}`);
  }
  const stats = parseStats(value['stats'], `${path}.stats`);
  if (stats === null) {
    invalid(`${path}.stats`, '阶段统计不可为空');
  }
  return {
    id: readString(value, 'id', path),
    title: readString(value, 'title', path),
    metricId: metricIdRaw,
    from: readString(value, 'from', path),
    to: readString(value, 'to', path),
    boundMs: readNumber(value, 'boundMs', path),
    citation: readString(value, 'citation', path),
    stats,
    verdict: readStringEnum(value, 'verdict', ['pass', 'fail'] as const, path),
  };
}

function parseMeta(value: unknown, path: string): ReportMeta {
  if (!isRecord(value)) {
    invalid(path, '必须是对象');
  }
  const scenarioIdRaw = readString(value, 'scenarioId', path);
  if (!isScenarioId(scenarioIdRaw)) {
    invalid(`${path}.scenarioId`, `未登记场景：${scenarioIdRaw}`);
  }
  const phase = readNumber(value, 'phase', path);
  if (phase !== 2 && phase !== 4) {
    invalid(`${path}.phase`, '必须是 2 或 4');
  }
  const hostVersion = readOptionalString(value, 'hostVersion', path);
  const configPath = readOptionalString(value, 'configPath', path);
  const notes = readStringArray(value, 'notes', path);
  return {
    schemaVersion: readString(value, 'schemaVersion', path),
    generatedAt: readString(value, 'generatedAt', path),
    reportId: readString(value, 'reportId', path),
    scenarioId: scenarioIdRaw,
    scenarioTitle: readString(value, 'scenarioTitle', path),
    buildType: readStringEnum(value, 'buildType', ['release', 'debug'] as const, path),
    phase,
    deviceLabel: readString(value, 'deviceLabel', path),
    platform: readString(value, 'platform', path),
    nodeVersion: readString(value, 'nodeVersion', path),
    adapterId: readString(value, 'adapterId', path),
    adapterTitle: readString(value, 'adapterTitle', path),
    ...(hostVersion !== undefined ? { hostVersion } : {}),
    ...(configPath !== undefined ? { configPath } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
}

function parseSummary(value: unknown, path: string): ReportSummary {
  if (!isRecord(value)) {
    invalid(path, '必须是对象');
  }
  const readCount = (key: string): number => {
    const count = readNumber(value, key, path);
    if (!Number.isInteger(count) || count < 0) {
      invalid(`${path}.${key}`, '必须是 ≥0 的整数');
    }
    return count;
  };
  return {
    total: readCount('total'),
    pass: readCount('pass'),
    fail: readCount('fail'),
    noData: readCount('noData'),
    verdict: readStringEnum(value, 'verdict', ['pass', 'fail', 'no-data'] as const, path),
  };
}

/** 校验并解析报告（JSON 文本或已解析对象）；非法时抛出 `PERF_REPORT_INVALID`。 */
export function parseReport(input: unknown): PerformanceReport {
  let value: unknown = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new PerfError('PERF_REPORT_INVALID', `报告不是合法 JSON：${reason}`);
    }
  }
  if (!isRecord(value)) {
    invalid('report', '必须是对象');
  }
  const schemaVersion = readString(value, 'schemaVersion', 'report');
  if (schemaVersion !== REPORT_SCHEMA_VERSION) {
    throw new PerfError(
      'PERF_REPORT_INVALID',
      `报告模式版本不匹配：期望 ${REPORT_SCHEMA_VERSION}，实际 ${schemaVersion}（第一版发布前不做兼容）`
    );
  }
  const metricsRaw = value['metrics'];
  if (!Array.isArray(metricsRaw)) {
    invalid('report.metrics', '必须是数组');
  }
  const phasesRaw = value['phases'];
  if (!Array.isArray(phasesRaw)) {
    invalid('report.phases', '必须是数组');
  }
  const metrics = metricsRaw.map((entry, index) =>
    parseMetricResult(entry, `report.metrics[${String(index)}]`)
  );
  const phases = phasesRaw.map((entry, index) =>
    parsePhaseResult(entry, `report.phases[${String(index)}]`)
  );
  return {
    schemaVersion,
    meta: parseMeta(value['meta'], 'report.meta'),
    metrics,
    phases,
    summary: parseSummary(value['summary'], 'report.summary'),
  };
}

/** 按 ID 取报告中的指标结果；缺失返回 `undefined`。 */
export function reportMetricResult(
  report: PerformanceReport,
  metricId: MetricId
): MetricResult | undefined {
  return report.metrics.find((metric) => metric.metricId === metricId);
}

/** 取指标的门禁比较值；无数据返回 `null`。 */
export function reportMetricValue(metric: MetricResult): number | null {
  return metric.stats === null ? null : selectStatistic(metric.stats, metric.gate.statistic);
}

/** 报告解析包装：非 `PerfError` 统一转为 `PERF_REPORT_INVALID`。 */
export function toReportError(error: unknown): PerfError {
  if (isPerfError(error)) {
    return error;
  }
  const reason = error instanceof Error ? error.message : String(error);
  return new PerfError('PERF_REPORT_INVALID', `报告处理失败：${reason}`);
}

/** 单位标签（报告展示层使用）。 */
export function unitLabelOf(unit: MetricUnit): string {
  return UNIT_LABELS[unit];
}
