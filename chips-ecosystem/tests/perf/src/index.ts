/**
 * `@chips/perf` 公共导出面。
 *
 * 性能基线与测量工具：指标注册表、标记点/采样测量、统计、JSON+Markdown 报告、
 * 回归比较与合成数据自测。数值权威来源见 `src/metrics.ts` 的 `citation` 记录。
 */

export { PerfError, isPerfError, type PerfErrorCode } from './errors';
export {
  CITATIONS,
  METRICS,
  METRIC_IDS,
  UNIT_LABELS,
  gateValueFor,
  isMetricId,
  metricById,
  metricDefinition,
  phaseBudgetOf,
  type GateComparison,
  type MetricDefinition,
  type MetricDirection,
  type MetricGroup,
  type MetricId,
  type MetricPhaseBudget,
  type MetricUnit,
} from './metrics';
export {
  MARKERS,
  SCENARIOS,
  SCENARIO_IDS,
  PARSE_DOMAIN_SCENARIO_IDS,
  isScenarioId,
  isParseDomainScenario,
  scenarioById,
  scenarioDefinition,
  scenarioPhaseBudgets,
  type ParseDomainScenarioId,
  type ScenarioDefinition,
  type ScenarioId,
  type ScenarioPhase,
} from './scenarios';
export {
  computeStats,
  percentile,
  roundTo,
  selectStatistic,
  type NumericStats,
  type StatisticName,
} from './stats';
export {
  MarkerTimeline,
  parseMarkerTrace,
  timelineFromMarkers,
  type MarkerSpan,
  type PerfMarker,
} from './markers';
export { FRAME_BUDGET_MS, summarizeFrames, type FpsBucket, type FrameSummary } from './fps';
export {
  BYTES_PER_MB,
  sampleProcessMemory,
  summarizeMemory,
  toMegabytes,
  type MemorySample,
  type MemorySummary,
} from './memory';
export {
  runParserBench,
  type ParseFixture,
  type ParserBenchOptions,
  type ParserBenchResult,
  type ParserUnderTest,
} from './parser-bench';
export {
  assertValidAdapter,
  assertRealParseDomainAdapter,
  isSyntheticAdapterId,
  validateMetricSamples,
  SYNTHETIC_ADAPTER_ID_PREFIX,
  type AdapterRunContext,
  type AdapterRunResult,
  type MeasurementForm,
  type PerfAdapter,
  type RealMeasurementAdapter,
} from './adapters';
export {
  measureScenario,
  scenarioThresholds,
  type MeasureScenarioRequest,
  type MeasurementMeta,
} from './runner';
export {
  REPORT_SCHEMA_VERSION,
  buildMetricResult,
  buildPhaseResult,
  buildReport,
  formatMetricValue,
  parseReport,
  reportFileName,
  reportIdFor,
  reportMetricResult,
  reportMetricValue,
  reportToJson,
  reportToMarkdown,
  sanitizeTimestamp,
  satisfiesComparison,
  summarizeMetrics,
  unitLabelOf,
  writeReport,
  type MetricGate,
  type MetricResult,
  type MetricVerdict,
  type PerformanceReport,
  type PhaseResult,
  type ReportMeta,
  type ReportSummary,
} from './report';
export {
  COMPARISON_SCHEMA_VERSION,
  compareReports,
  comparisonExitCode,
  comparisonFileName,
  comparisonToJson,
  comparisonToMarkdown,
  writeComparison,
  type Comparability,
  type ComparisonReport,
  type ComparisonSummary,
  type MetricComparison,
} from './compare';
export {
  CONFIG_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  loadConfigFile,
  parseConfig,
  resolveThreshold,
  resolveThresholds,
  type MeasurementPolicy,
  type PerfConfig,
  type RegressionPolicy,
  type ReportsPolicy,
  type ThresholdOverride,
  type ThresholdResolution,
} from './thresholds';
export {
  createSyntheticAdapter,
  deriveSeed,
  mulberry32,
  payloadDigest,
  syntheticBox10kFixture,
  syntheticCard10mbFixture,
  syntheticFrameTimestamps,
  syntheticMarkers,
  syntheticMemorySamples,
  syntheticSamples,
  syntheticYamlPayload,
  SYNTHETIC_NOTE,
  SYNTHETIC_SEED,
  type SyntheticQuality,
} from './fixtures/synthetic';
export {
  runSyntheticSelftest,
  SELFTEST_SCENARIOS,
  type SelftestCheck,
  type SyntheticSelftestResult,
} from './fixtures/selftest';
