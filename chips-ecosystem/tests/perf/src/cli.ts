import { readFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertValidAdapter, validateMetricSamples, type PerfAdapter } from './adapters';
import { compareReports, comparisonExitCode, writeComparison } from './compare';
import { isPerfError, PerfError } from './errors';
import { createSyntheticAdapter } from './fixtures/synthetic';
import { runSyntheticSelftest } from './fixtures/selftest';
import { METRICS, UNIT_LABELS, metricDefinition, type MetricId } from './metrics';
import {
  REPORT_SCHEMA_VERSION,
  buildMetricResult,
  buildReport,
  isStringArray,
  parseReport,
  reportIdFor,
  writeReport,
  type MetricResult,
  type ReportMeta,
} from './report';
import { measureScenario, type MeasurementMeta } from './runner';
import {
  SCENARIO_IDS,
  SCENARIOS,
  scenarioById,
  scenarioDefinition,
  type ScenarioId,
} from './scenarios';
import {
  DEFAULT_CONFIG,
  loadConfigFile,
  resolveThreshold,
  resolveThresholds,
  type PerfConfig,
} from './thresholds';

/**
 * `@chips/perf` 命令行入口。
 *
 * 命令：
 * - `list`：列出已登记指标与场景（含门禁与引用）；
 * - `selftest`：合成数据端到端自测（达标必过、劣化必拦、比较可检出）；
 * - `measure`：运行适配器测量并写出 JSON + Markdown 报告；
 * - `ingest`：导入外部样本（如 criterion 导出）并生成报告；
 * - `compare`：基线报告与候选报告回归比较。
 *
 * 退出码：0 通过；1 门禁/回归失败；2 用法或配置错误；3 环境不可比（不作门禁结论）。
 */

const USAGE = `薯片生态性能基线工具（@chips/perf）

用法：
  tsx src/cli.ts list
  tsx src/cli.ts selftest [--out <目录>] [--config <配置>] [--no-write]
  tsx src/cli.ts measure --adapter <适配器模块|synthetic:golden|synthetic:regressed> [--scenario <场景,场景>] [--out <目录>] [--config <配置>] [--build-type release|debug] [--device <标签>] [--host-version <版本>]
  tsx src/cli.ts ingest --input <样本JSON> --scenario <场景> [--out <目录>] [--config <配置>] [--build-type release|debug] [--device <标签>]
  tsx src/cli.ts compare --baseline <报告JSON> --candidate <报告JSON> [--out <目录>] [--config <配置>] [--no-write]

说明：门禁数值以《架构原则》§4.2 / R18 等权威文档为唯一来源，工具内集中在 src/metrics.ts；
--config 只承载策略（回归容差、轮次、窗口、输出目录）与显式登记的门禁覆盖。
`;

interface ParsedArgs {
  readonly command: string | undefined;
  readonly flags: ReadonlyMap<string, string | boolean>;
}

const VALUE_FLAGS = new Set([
  'out',
  'config',
  'adapter',
  'scenario',
  'build-type',
  'device',
  'host-version',
  'baseline',
  'candidate',
  'input',
  'at',
]);

const BOOLEAN_FLAGS = new Set(['no-write', 'help']);

/** 解析命令行参数；未知选项抛出 `PERF_CLI_USAGE`。 */
export function parseCliArgs(argv: readonly string[]): ParsedArgs {
  const flags = new Map<string, string | boolean>();
  let command: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }
    if (token.startsWith('--')) {
      const body = token.slice(2);
      const equalsIndex = body.indexOf('=');
      const key = equalsIndex >= 0 ? body.slice(0, equalsIndex) : body;
      const inlineValue = equalsIndex >= 0 ? body.slice(equalsIndex + 1) : undefined;
      if (!VALUE_FLAGS.has(key) && !BOOLEAN_FLAGS.has(key)) {
        throw new PerfError('PERF_CLI_USAGE', `未知选项：--${key}`);
      }
      if (inlineValue !== undefined) {
        flags.set(key, inlineValue);
        continue;
      }
      if (BOOLEAN_FLAGS.has(key)) {
        flags.set(key, true);
        continue;
      }
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new PerfError('PERF_CLI_USAGE', `选项 --${key} 缺少取值`);
      }
      flags.set(key, next);
      index += 1;
      continue;
    }
    if (command === undefined) {
      command = token;
    } else {
      throw new PerfError('PERF_CLI_USAGE', `多余的位置参数：${token}`);
    }
  }
  return { command, flags };
}

function flagString(args: ParsedArgs, key: string): string | undefined {
  const value = args.flags.get(key);
  return typeof value === 'string' ? value : undefined;
}

function flagBoolean(args: ParsedArgs, key: string): boolean {
  return args.flags.get(key) === true;
}

function requireFlag(args: ParsedArgs, key: string): string {
  const value = flagString(args, key);
  if (value === undefined || value.length === 0) {
    throw new PerfError('PERF_CLI_USAGE', `缺少必填选项 --${key}`);
  }
  return value;
}

function loadConfig(args: ParsedArgs): {
  readonly config: PerfConfig;
  readonly configPath?: string;
} {
  const configPath = flagString(args, 'config');
  if (configPath === undefined) {
    return { config: DEFAULT_CONFIG };
  }
  return { config: loadConfigFile(configPath), configPath };
}

function buildTypeOf(args: ParsedArgs): 'release' | 'debug' {
  const value = flagString(args, 'build-type') ?? 'release';
  if (value !== 'release' && value !== 'debug') {
    throw new PerfError('PERF_CLI_USAGE', `--build-type 只支持 release 或 debug，实际 ${value}`);
  }
  return value;
}

function measurementMeta(args: ParsedArgs): MeasurementMeta {
  const hostVersion = flagString(args, 'host-version');
  return {
    buildType: buildTypeOf(args),
    deviceLabel:
      flagString(args, 'device') ?? `${hostname()} (${process.platform} ${process.arch})`,
    platform: process.platform,
    nodeVersion: process.version,
    ...(hostVersion !== undefined ? { hostVersion } : {}),
  };
}

function generatedAtOf(args: ParsedArgs): string {
  const value = flagString(args, 'at');
  if (value === undefined) {
    return new Date().toISOString();
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new PerfError('PERF_CLI_USAGE', `--at 不是合法时间：${value}`);
  }
  return new Date(parsed).toISOString();
}

function parseScenarioList(raw: string): readonly ScenarioId[] {
  const ids = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (ids.length === 0) {
    throw new PerfError('PERF_CLI_USAGE', '--scenario 至少需要一个场景 ID');
  }
  return ids.map((entry) => scenarioById(entry).id);
}

async function resolveAdapter(spec: string): Promise<PerfAdapter> {
  if (spec === 'synthetic:golden') {
    return createSyntheticAdapter('golden');
  }
  if (spec === 'synthetic:regressed') {
    return createSyntheticAdapter('regressed');
  }
  const moduleUrl = pathToFileURL(resolve(spec)).href;
  let loaded: unknown;
  try {
    loaded = await import(moduleUrl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new PerfError('PERF_ADAPTER_INVALID', `无法加载适配器模块 ${spec}：${reason}`);
  }
  if (typeof loaded !== 'object' || loaded === null) {
    throw new PerfError('PERF_ADAPTER_INVALID', `适配器模块 ${spec} 没有导出对象`);
  }
  const moduleRecord = loaded as Record<string, unknown>;
  const candidate = moduleRecord['default'] ?? moduleRecord['adapter'];
  assertValidAdapter(candidate);
  return candidate;
}

function writeLine(line: string): void {
  process.stdout.write(`${line}\n`);
}

interface IngestDocument {
  readonly meta?: {
    readonly buildType?: 'release' | 'debug';
    readonly deviceLabel?: string;
    readonly hostVersion?: string;
    readonly notes?: readonly string[];
  };
  readonly samples: Readonly<Record<string, readonly number[]>>;
}

function parseIngestMeta(value: unknown, source: string): IngestDocument['meta'] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PerfError('PERF_INPUT_INVALID', `样本文件 ${source} 的 meta 必须是对象`);
  }
  const record = value as Record<string, unknown>;
  const buildType = record['buildType'];
  if (buildType !== undefined && buildType !== 'release' && buildType !== 'debug') {
    throw new PerfError(
      'PERF_INPUT_INVALID',
      `样本文件 ${source} 的 meta.buildType 只支持 release 或 debug`
    );
  }
  const deviceLabel = record['deviceLabel'];
  if (deviceLabel !== undefined && typeof deviceLabel !== 'string') {
    throw new PerfError(
      'PERF_INPUT_INVALID',
      `样本文件 ${source} 的 meta.deviceLabel 必须是字符串`
    );
  }
  const hostVersion = record['hostVersion'];
  if (hostVersion !== undefined && typeof hostVersion !== 'string') {
    throw new PerfError(
      'PERF_INPUT_INVALID',
      `样本文件 ${source} 的 meta.hostVersion 必须是字符串`
    );
  }
  const notes = record['notes'];
  if (notes !== undefined && !isStringArray(notes)) {
    throw new PerfError('PERF_INPUT_INVALID', `样本文件 ${source} 的 meta.notes 必须是字符串数组`);
  }
  return {
    ...(buildType !== undefined ? { buildType } : {}),
    ...(deviceLabel !== undefined ? { deviceLabel } : {}),
    ...(hostVersion !== undefined ? { hostVersion } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
}

function parseIngestDocument(text: string, source: string): IngestDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new PerfError('PERF_INPUT_INVALID', `样本文件 ${source} 不是合法 JSON：${reason}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new PerfError('PERF_INPUT_INVALID', `样本文件 ${source} 必须是对象`);
  }
  const record = parsed as Record<string, unknown>;
  const samples = record['samples'];
  if (typeof samples !== 'object' || samples === null || Array.isArray(samples)) {
    throw new PerfError('PERF_INPUT_INVALID', `样本文件 ${source} 缺少 samples 对象`);
  }
  const meta = parseIngestMeta(record['meta'], source);
  return {
    ...(meta !== undefined ? { meta } : {}),
    samples: samples as IngestDocument['samples'],
  };
}

function metricsFromIngest(
  document: IngestDocument,
  scenarioId: ScenarioId,
  config: PerfConfig,
  source: string
): readonly MetricResult[] {
  const definition = scenarioDefinition(scenarioId);
  const validated = validateMetricSamples(document.samples);
  for (const metricId of Object.keys(validated) as MetricId[]) {
    if (!definition.metricIds.includes(metricId)) {
      throw new PerfError(
        'PERF_INPUT_INVALID',
        `样本文件 ${source} 含场景 ${scenarioId} 未声明的指标：${metricId}`
      );
    }
  }
  const thresholds = resolveThresholds(config);
  return definition.metricIds.map((metricId) => {
    const threshold = thresholds.get(metricId);
    if (threshold === undefined) {
      throw new PerfError('PERF_CONFIG_INVALID', `缺少指标门禁解析：${metricId}`);
    }
    return buildMetricResult(metricDefinition(metricId), validated[metricId] ?? [], threshold, [
      `来源：${source}`,
    ]);
  });
}

function commandList(args: ParsedArgs): number {
  const { config, configPath } = loadConfig(args);
  writeLine(
    `指标注册表（门禁唯一来源：权威文档；Phase ${String(config.phase)}${configPath !== undefined ? `，配置 ${configPath}` : ''}）：`
  );
  for (const [metricId, definition] of Object.entries(METRICS)) {
    const threshold = resolveThreshold(definition.id, config);
    const comparison = { lt: '<', lte: '≤', gt: '>', gte: '≥' }[threshold.comparison];
    writeLine(
      `  ${metricId.padEnd(28)} ${definition.title}（${UNIT_LABELS[definition.unit]}，${threshold.statistic}）${comparison} ${String(threshold.value)}  ${threshold.citation}`
    );
  }
  writeLine('');
  writeLine('场景：');
  for (const scenarioId of SCENARIO_IDS) {
    const definition = SCENARIOS[scenarioId];
    writeLine(
      `  ${scenarioId.padEnd(20)} ${definition.kind.padEnd(8)} ${definition.metricIds.join('、')}`
    );
  }
  return 0;
}

async function commandSelftest(args: ParsedArgs): Promise<number> {
  const { config } = loadConfig(args);
  const outputDir = flagString(args, 'out') ?? config.reports.outputDir;
  const writeReports = !flagBoolean(args, 'no-write');
  const result = await runSyntheticSelftest({ config, outputDir, writeReports });
  writeLine('合成数据自测：');
  for (const entry of result.checks) {
    writeLine(`  ${entry.passed ? '[通过]' : '[失败]'} ${entry.title}：${entry.detail}`);
  }
  if (writeReports) {
    writeLine(
      `报告与比较结果已写入：${resolve(outputDir)}（共 ${String(result.writtenPaths.length)} 个文件）`
    );
  }
  writeLine(`自测结论：${result.passed ? '通过' : '失败'}`);
  return result.passed ? 0 : 1;
}

async function commandMeasure(args: ParsedArgs): Promise<number> {
  const adapterSpec = requireFlag(args, 'adapter');
  const { config, configPath } = loadConfig(args);
  const adapter = await resolveAdapter(adapterSpec);
  const scenarioRaw = flagString(args, 'scenario');
  const scenarioIds =
    scenarioRaw !== undefined
      ? parseScenarioList(scenarioRaw)
      : SCENARIO_IDS.filter((scenarioId) => adapter.provides.includes(scenarioId));
  if (scenarioIds.length === 0) {
    throw new PerfError('PERF_CLI_USAGE', `适配器 ${adapter.id} 没有任何已登记场景`);
  }
  const outputDir = flagString(args, 'out') ?? config.reports.outputDir;
  const generatedAt = generatedAtOf(args);
  const meta = measurementMeta(args);
  let failed = 0;
  for (const scenarioId of scenarioIds) {
    const report = await measureScenario({
      scenarioId,
      adapter,
      config,
      meta,
      generatedAt,
      ...(configPath !== undefined ? { configPath } : {}),
    });
    const paths = await writeReport(report, outputDir);
    const summary = report.summary;
    failed += summary.fail + summary.noData;
    writeLine(
      `[${summary.verdict === 'pass' ? '通过' : '失败'}] ${scenarioId}：通过 ${String(summary.pass)} / 失败 ${String(summary.fail)} / 无数据 ${String(summary.noData)} → ${paths.jsonPath}`
    );
    for (const metric of report.metrics) {
      for (const message of metric.failures) {
        writeLine(`  - ${message}`);
      }
    }
  }
  return failed > 0 ? 1 : 0;
}

async function commandIngest(args: ParsedArgs): Promise<number> {
  const inputPath = requireFlag(args, 'input');
  const scenarioId = scenarioById(requireFlag(args, 'scenario')).id;
  const { config, configPath } = loadConfig(args);
  const outputDir = flagString(args, 'out') ?? config.reports.outputDir;
  const generatedAt = generatedAtOf(args);
  const meta = measurementMeta(args);
  let text: string;
  try {
    text = await readFile(inputPath, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new PerfError('PERF_INPUT_INVALID', `无法读取样本文件 ${inputPath}：${reason}`);
  }
  const document = parseIngestDocument(text, inputPath);
  const definition = scenarioDefinition(scenarioId);
  const metrics = metricsFromIngest(document, scenarioId, config, inputPath);
  const hostVersion = document.meta?.hostVersion ?? meta.hostVersion;
  const ingestMeta: ReportMeta = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt,
    reportId: reportIdFor(scenarioId, generatedAt),
    scenarioId,
    scenarioTitle: definition.title,
    buildType: document.meta?.buildType ?? meta.buildType,
    phase: config.phase,
    deviceLabel: document.meta?.deviceLabel ?? meta.deviceLabel,
    platform: meta.platform,
    nodeVersion: meta.nodeVersion,
    adapterId: 'ingest',
    adapterTitle: `外部样本导入（${inputPath}）`,
    ...(hostVersion !== undefined ? { hostVersion } : {}),
    ...(configPath !== undefined ? { configPath } : {}),
    ...(document.meta?.notes !== undefined ? { notes: document.meta.notes } : {}),
  };
  const report = buildReport(ingestMeta, metrics, []);
  const paths = await writeReport(report, outputDir);
  writeLine(
    `[${report.summary.verdict === 'pass' ? '通过' : '失败'}] ${scenarioId}：通过 ${String(report.summary.pass)} / 失败 ${String(report.summary.fail)} / 无数据 ${String(report.summary.noData)} → ${paths.jsonPath}`
  );
  return report.summary.fail + report.summary.noData > 0 ? 1 : 0;
}

async function commandCompare(args: ParsedArgs): Promise<number> {
  const baselinePath = requireFlag(args, 'baseline');
  const candidatePath = requireFlag(args, 'candidate');
  const { config } = loadConfig(args);
  const outputDir = flagString(args, 'out') ?? config.reports.outputDir;
  const generatedAt = generatedAtOf(args);
  const [baselineText, candidateText] = await Promise.all([
    readFile(baselinePath, 'utf8'),
    readFile(candidatePath, 'utf8'),
  ]);
  const report = compareReports(parseReport(baselineText), parseReport(candidateText), config, {
    generatedAt,
  });
  if (!flagBoolean(args, 'no-write')) {
    const paths = await writeComparison(report, outputDir);
    writeLine(`比较报告：${paths.jsonPath}`);
  }
  writeLine(
    `结论：${report.summary.verdict === 'pass' ? '通过' : report.summary.verdict === 'fail' ? '失败' : '不可比'}（回归 ${String(report.summary.regressions)}，门禁失败 ${String(report.summary.gateFailures)}，无数据 ${String(report.summary.noData)}，无基线 ${String(report.summary.noBaseline)}）`
  );
  for (const reason of report.comparability.reasons) {
    writeLine(`  - ${reason}`);
  }
  for (const metric of report.metrics) {
    if (metric.status !== 'pass' && metric.status !== 'no-baseline') {
      for (const message of metric.messages) {
        writeLine(`  - ${message}`);
      }
    }
  }
  return comparisonExitCode(report);
}

/** CLI 主函数；返回进程退出码。 */
export async function main(argv: readonly string[]): Promise<number> {
  try {
    const args = parseCliArgs(argv);
    if (args.command === undefined || args.command === 'help' || flagBoolean(args, 'help')) {
      process.stdout.write(USAGE);
      return 0;
    }
    switch (args.command) {
      case 'list':
        return commandList(args);
      case 'selftest':
        return await commandSelftest(args);
      case 'measure':
        return await commandMeasure(args);
      case 'ingest':
        return await commandIngest(args);
      case 'compare':
        return await commandCompare(args);
      default:
        throw new PerfError(
          'PERF_CLI_USAGE',
          `未知命令：${args.command}（可用：list、selftest、measure、ingest、compare）`
        );
    }
  } catch (error) {
    const message = isPerfError(error)
      ? `[${error.code}] ${error.message}`
      : error instanceof Error
        ? error.message
        : String(error);
    process.stderr.write(`@chips/perf 错误：${message}\n`);
    return 2;
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const code = await main(process.argv.slice(2));
  process.exitCode = code;
}
