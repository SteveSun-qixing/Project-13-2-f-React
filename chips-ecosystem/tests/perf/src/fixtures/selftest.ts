import { compareReports, writeComparison, type ComparisonReport } from '../compare';
import { metricDefinition, type MetricId } from '../metrics';
import { runParserBench, type ParserUnderTest } from '../parser-bench';
import { parseReport, reportToJson, writeReport, type PerformanceReport } from '../report';
import { measureScenario } from '../runner';
import { SCENARIO_IDS, type ScenarioId } from '../scenarios';
import { DEFAULT_CONFIG, type PerfConfig } from '../thresholds';
import {
  createSyntheticAdapter,
  payloadDigest,
  syntheticCard10mbFixture,
  syntheticMarkers,
  type SyntheticQuality,
} from './synthetic';

/**
 * 合成数据端到端自测。
 *
 * 自测只替换「数据来源」（合成样本），测量编排、统计、门禁判定、报告与回归比较
 * 全部走真实实现；检查项同时覆盖达标必过、劣化必拦、引用完整与确定性。
 */

/** 单项自测检查。 */
export interface SelftestCheck {
  readonly id: string;
  readonly title: string;
  readonly passed: boolean;
  readonly detail: string;
}

/** 自测结果。 */
export interface SyntheticSelftestResult {
  readonly passed: boolean;
  readonly checks: readonly SelftestCheck[];
  readonly goldenReports: readonly PerformanceReport[];
  readonly regressedReports: readonly PerformanceReport[];
  readonly comparisons: readonly ComparisonReport[];
  readonly writtenPaths: readonly string[];
}

/** 自测参数。 */
export interface RunSyntheticSelftestOptions {
  readonly config?: PerfConfig;
  readonly outputDir?: string;
  readonly writeReports?: boolean;
  readonly generatedAt?: string;
}

/** 合成测量元数据：release 构建 + 固定设备标签，保证比较可比。 */
const SYNTHETIC_META = {
  buildType: 'release' as const,
  deviceLabel: 'synthetic-device',
  platform: process.platform,
  nodeVersion: process.version,
  notes: ['合成数据自测（非真实设备测量）'],
};

const CORE_R18_METRICS: readonly MetricId[] = [
  'cold_start_ms',
  'open_card_ms',
  'open_box_ms',
  'sustained_fps',
  'idle_memory_mb',
];

function addSeconds(iso: string, seconds: number): string {
  return new Date(Date.parse(iso) + seconds * 1000).toISOString();
}

function check(id: string, title: string, passed: boolean, detail: string): SelftestCheck {
  return { id, title, passed, detail };
}

function collectMetrics(
  reports: readonly PerformanceReport[]
): readonly PerformanceReport['metrics'][number][] {
  return reports.flatMap((report) => [...report.metrics]);
}

function citationsComplete(reports: readonly PerformanceReport[]): {
  readonly passed: boolean;
  readonly detail: string;
} {
  const problems: string[] = [];
  for (const metric of collectMetrics(reports)) {
    if (metric.gate.citation.length === 0 || !metric.gate.citation.includes('《')) {
      problems.push(`${metric.metricId} 缺少权威引用`);
    }
  }
  for (const metricId of CORE_R18_METRICS) {
    const definition = metricDefinition(metricId);
    if (!definition.citation.includes('R18')) {
      problems.push(`${metricId} 未引用 R18`);
    }
  }
  return {
    passed: problems.length === 0,
    detail:
      problems.length === 0
        ? `全部 ${String(collectMetrics(reports).length)} 项指标引用完整，五项基线引用 R18`
        : problems.join('；'),
  };
}

async function checkBenchHarness(): Promise<SelftestCheck> {
  const scanningParser: ParserUnderTest = {
    name: 'synthetic-scan',
    parse(fixture): void {
      let sink = 0;
      for (let index = 0; index < fixture.payload.length; index += 64) {
        sink += fixture.payload[index] ?? 0;
      }
      void sink;
    },
  };
  const result = await runParserBench(scanningParser, syntheticCard10mbFixture(), {
    metricId: 'parse_10mb_ms',
    rounds: 2,
    warmupRounds: 1,
  });
  const passed =
    result.samplesMs.length === 2 &&
    result.stats.count === 2 &&
    result.fixtureBytes === 10 * 1024 * 1024;
  return check(
    'bench-harness-executes',
    '解析基准执行器可运行（真实时钟、结构校验）',
    passed,
    `样本 ${String(result.samplesMs.length)} 个，夹具 ${String(result.fixtureBytes)} 字节，中位数 ${result.stats.median.toFixed(3)} ms（合成扫描器，不参与门禁）`
  );
}

function checkDeterminism(): SelftestCheck {
  const firstRun = JSON.stringify(syntheticMarkers('open-card', 'golden', 0));
  const secondRun = JSON.stringify(syntheticMarkers('open-card', 'golden', 0));
  const firstDigest = payloadDigest(syntheticCard10mbFixture().payload);
  const secondDigest = payloadDigest(syntheticCard10mbFixture().payload);
  const passed = firstRun === secondRun && firstDigest === secondDigest;
  return check(
    'synthetic-determinism',
    '合成数据确定性（同种子同输出）',
    passed,
    `标记点一致：${firstRun === secondRun ? '是' : '否'}；夹具 SHA-256 一致：${firstDigest === secondDigest ? '是' : '否'}`
  );
}

async function measureAll(
  quality: SyntheticQuality,
  config: PerfConfig,
  generatedAt: string
): Promise<readonly PerformanceReport[]> {
  const adapter = createSyntheticAdapter(quality);
  const reports: PerformanceReport[] = [];
  for (const scenarioId of SCENARIO_IDS) {
    reports.push(
      await measureScenario({ scenarioId, adapter, config, meta: SYNTHETIC_META, generatedAt })
    );
  }
  return reports;
}

/** 运行合成数据自测；`writeReports=true` 时把报告与比较结果写入 `outputDir`。 */
export async function runSyntheticSelftest(
  options: RunSyntheticSelftestOptions = {}
): Promise<SyntheticSelftestResult> {
  const config = options.config ?? DEFAULT_CONFIG;
  const outputDir = options.outputDir ?? config.reports.outputDir;
  const write = options.writeReports ?? true;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const goldenAt = generatedAt;
  const regressedAt = addSeconds(generatedAt, 1);
  const compareAt = addSeconds(generatedAt, 2);

  const goldenReports = await measureAll('golden', config, goldenAt);
  const regressedReports = await measureAll('regressed', config, regressedAt);
  const comparisons = goldenReports.map((golden, index) => {
    const regressed = regressedReports[index];
    if (regressed === undefined) {
      throw new Error(`自测缺少劣化档报告：${golden.meta.scenarioId}`);
    }
    return compareReports(golden, regressed, config, { generatedAt: compareAt });
  });

  const goldenMetrics = collectMetrics(goldenReports);
  const regressedMetrics = collectMetrics(regressedReports);
  const checks: SelftestCheck[] = [];
  checks.push(
    check(
      'golden-all-pass',
      '达标档全部指标通过',
      goldenMetrics.length > 0 && goldenMetrics.every((metric) => metric.verdict === 'pass'),
      `达标档 ${String(goldenMetrics.length)} 项指标，通过 ${String(goldenMetrics.filter((metric) => metric.verdict === 'pass').length)} 项`
    )
  );
  checks.push(
    check(
      'golden-phases-pass',
      '达标档阶段预算全部通过',
      goldenReports.every((report) => report.phases.every((phase) => phase.verdict === 'pass')),
      `阶段总数 ${String(goldenReports.reduce((sum, report) => sum + report.phases.length, 0))}`
    )
  );
  checks.push(
    check(
      'regressed-all-fail',
      '劣化档全部指标被拦截',
      regressedMetrics.length > 0 && regressedMetrics.every((metric) => metric.verdict === 'fail'),
      `劣化档 ${String(regressedMetrics.length)} 项指标，失败 ${String(regressedMetrics.filter((metric) => metric.verdict === 'fail').length)} 项`
    )
  );
  const regressedPhaseReports = regressedReports.filter((report) => report.phases.length > 0);
  checks.push(
    check(
      'regressed-phases-detected',
      '劣化档阶段预算被检出',
      regressedPhaseReports.length > 0 &&
        regressedPhaseReports.every((report) =>
          report.phases.some((phase) => phase.verdict === 'fail')
        ),
      `含阶段场景 ${String(regressedPhaseReports.length)} 个`
    )
  );
  checks.push(
    check(
      'comparison-all-fail',
      '回归比较全部判定失败',
      comparisons.length > 0 &&
        comparisons.every(
          (comparison) =>
            comparison.summary.verdict === 'fail' &&
            comparison.summary.regressions + comparison.summary.gateFailures > 0
        ),
      comparisons
        .map(
          (comparison) =>
            `${comparison.scenarioId}:${comparison.summary.verdict}(回归${String(comparison.summary.regressions)}/门禁${String(comparison.summary.gateFailures)})`
        )
        .join(' ')
    )
  );
  const citationResult = citationsComplete(goldenReports);
  checks.push(
    check(
      'gate-citations',
      '门禁引用完整且含 R18 基线',
      citationResult.passed,
      citationResult.detail
    )
  );
  checks.push(checkDeterminism());
  checks.push(await checkBenchHarness());
  const roundTripTarget = goldenReports[0];
  const roundTripPassed =
    roundTripTarget !== undefined &&
    reportToJson(parseReport(reportToJson(roundTripTarget))) === reportToJson(roundTripTarget);
  checks.push(
    check(
      'report-roundtrip',
      '报告 JSON 往返一致',
      roundTripPassed,
      roundTripPassed ? '往返一致' : '往返不一致'
    )
  );

  const writtenPaths: string[] = [];
  if (write) {
    for (const report of [...goldenReports, ...regressedReports]) {
      const paths = await writeReport(report, outputDir);
      writtenPaths.push(paths.jsonPath, paths.markdownPath);
    }
    for (const comparison of comparisons) {
      const paths = await writeComparison(comparison, outputDir);
      writtenPaths.push(paths.jsonPath, paths.markdownPath);
    }
  }

  return {
    passed: checks.every((entry) => entry.passed),
    checks,
    goldenReports,
    regressedReports,
    comparisons,
    writtenPaths,
  };
}

/** 场景 ID 清单再导出一份（便于调用方迭代自测范围）。 */
export const SELFTEST_SCENARIOS: readonly ScenarioId[] = [...SCENARIO_IDS];
