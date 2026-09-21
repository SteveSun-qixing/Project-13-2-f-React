import { hostname } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { assertValidAdapter, type PerfAdapter } from '../adapters';
import { isPerfError, PerfError } from '../errors';
import { type MetricId } from '../metrics';
import { writeReport } from '../report';
import { measureScenario, type MeasurementMeta } from '../runner';
import { scenarioDefinition, isScenarioId, type ScenarioId } from '../scenarios';
import { DEFAULT_CONFIG, loadConfigFile, type PerfConfig } from '../thresholds';
import { createRealHostAdapter, observeOpenBox } from './adapter';
import { loadChipsE2eRuntime } from './e2e-runtime';
import { observationTimeline } from './observations';
import {
  buildRealSamplesDocument,
  buildRealUnmeasurableDocument,
  extractSamplesFromReport,
  realSamplesFileName,
  realUnmeasurableFileName,
  type RealSamplesMeta,
} from './samples';

/**
 * 真进程性能采集器（W2-P1-6 / 任务 #121 段A 正式命令入口）。
 *
 * 用法（`tests/perf` 目录内，旗标门控，不入 CI 门禁）：
 *   CHIPS_PERF_REAL=1 pnpm exec tsx src/real/collect.ts [--scenario all|<场景,场景>] [--out <目录>] [--config <配置>]
 *
 * 行为：
 * - `cold-start` / `scroll-fps` / `idle-memory` 走 `measureScenario` 真实管线
 *   （markers 多轮 / frames 分桶 / memory 稳定窗），产出正式报告并从报告提取
 *   实测样本写入 `reports/real-samples-<scenario>.json`（ingest 输入契约形状）；
 * - `open-card` 因宿主阶段标记缺测不经 `measureScenario`，按场景登记 `totalSpan`
 *   以 `MarkerTimeline` 逐轮求时长后组装样本；
 * - `open-box` 整场景不可测（视图面随 W4），真进程探针坐实在册拒绝后产出
 *   `reports/real-unmeasurable-open-box.json` 结论文件（零数值）；
 * - 退出码只反映「采集是否完成」：0 完成（无论门禁达标与否）；1 采集失败；
 *   2 用法/旗标错误。门禁判定与基线入库归段B。
 */

const USAGE = `薯片宿主真进程性能采集器（@chips/perf，任务 #121 段A）

用法：
  CHIPS_PERF_REAL=1 pnpm exec tsx src/real/collect.ts [--scenario all|<场景,场景>] [--out <目录>] [--config <配置>]

可选场景：cold-start、open-card、open-box、scroll-fps、idle-memory（默认 all，即五指标场景）
说明：数值一律来自真实宿主进程实测采样；本采集器不做门禁判定，样本供 ingest / 段B 消费。
`;

/** 五指标采集场景（W2-P1-6 面；顺序即执行顺序）。 */
const REAL_SCENARIO_IDS: readonly ScenarioId[] = [
  'cold-start',
  'open-card',
  'open-box',
  'scroll-fps',
  'idle-memory',
];

/** 缺省策略配置路径（包根 `perf.config.json`，与 CLI 同一份文件）。 */
const DEFAULT_CONFIG_PATH = 'perf.config.json';

interface CollectArgs {
  readonly scenarioIds: readonly ScenarioId[];
  readonly outputDir: string;
  readonly config: PerfConfig;
  readonly configPath?: string;
}

function parseRealScenarioId(entry: string): ScenarioId {
  if (!isScenarioId(entry)) {
    throw new PerfError('PERF_CLI_USAGE', `未登记场景：${entry}`);
  }
  if (!REAL_SCENARIO_IDS.includes(entry)) {
    throw new PerfError(
      'PERF_CLI_USAGE',
      `场景 ${entry} 不在五指标采集面内（本采集器只覆盖 W2-P1-6 五场景）`
    );
  }
  return entry;
}

export function parseCollectArgs(argv: readonly string[]): CollectArgs {
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }
    if (!token.startsWith('--')) {
      throw new PerfError('PERF_CLI_USAGE', `多余的位置参数：${token}`);
    }
    const key = token.slice(2);
    if (key !== 'scenario' && key !== 'out' && key !== 'config') {
      throw new PerfError('PERF_CLI_USAGE', `未知选项：--${key}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new PerfError('PERF_CLI_USAGE', `选项 --${key} 缺少取值`);
    }
    flags.set(key, value);
    index += 1;
  }
  const scenarioRaw = flags.get('scenario') ?? 'all';
  let scenarioIds: readonly ScenarioId[];
  if (scenarioRaw === 'all') {
    scenarioIds = REAL_SCENARIO_IDS;
  } else {
    scenarioIds = scenarioRaw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map(parseRealScenarioId);
    if (scenarioIds.length === 0) {
      throw new PerfError('PERF_CLI_USAGE', '--scenario 至少需要一个场景 ID');
    }
  }
  const configPath = flags.get('config');
  let config: PerfConfig;
  let resolvedConfigPath: string | undefined;
  if (configPath !== undefined) {
    config = loadConfigFile(configPath);
    resolvedConfigPath = resolve(configPath);
  } else if (existsSync(DEFAULT_CONFIG_PATH)) {
    config = loadConfigFile(DEFAULT_CONFIG_PATH);
    resolvedConfigPath = resolve(DEFAULT_CONFIG_PATH);
  } else {
    config = DEFAULT_CONFIG;
  }
  return {
    scenarioIds,
    outputDir: flags.get('out') ?? config.reports.outputDir,
    config,
    ...(resolvedConfigPath !== undefined ? { configPath: resolvedConfigPath } : {}),
  };
}

function writeLine(line: string): void {
  process.stdout.write(`${line}\n`);
}

function deviceLabel(): string {
  return `${hostname()} (${process.platform} ${process.arch})`;
}

/** 读取宿主应用版本（写入样本 meta.hostVersion，供段B 可比性判断）。 */
async function readHostVersion(): Promise<string> {
  const runtime = await loadChipsE2eRuntime();
  const resolution = runtime.resolveHostApp();
  const manifest = JSON.parse(
    readFileSync(resolve(resolution.appPath, 'package.json'), 'utf8')
  ) as { version?: unknown };
  return typeof manifest.version === 'string' ? manifest.version : '未知';
}

function samplesMeta(configPath: string | undefined, hostVersion: string): RealSamplesMeta {
  return {
    buildType: 'debug',
    deviceLabel: deviceLabel(),
    hostVersion,
    notes: [
      '真进程采集（W2-P1-6 段A）：本地开发构建产物（非 release 打包形态），正式门禁结论须由 CI release 构建复测（《CICD与质量门禁》§3.3 G7）。',
      configPath !== undefined
        ? `策略配置：${configPath}`
        : '策略配置：DEFAULT_CONFIG（未提供 perf.config.json）',
    ],
  };
}

function measurementMeta(hostVersion: string): MeasurementMeta {
  return {
    buildType: 'debug',
    deviceLabel: deviceLabel(),
    platform: process.platform,
    nodeVersion: process.version,
    hostVersion,
    notes: ['真进程采集（CHIPS_PERF_REAL=1）：宿主侧标记缺口的代理口径见 真进程采集-设计.md §三。'],
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** 由策略配置派生管线适配器：空闲窗口等测量参数跟随配置，不第二套口径。 */
function pipelineAdapter(config: PerfConfig): PerfAdapter {
  return createRealHostAdapter({ idleWindowMs: config.measurement.idleWindowMs });
}

/** 采集一个走 `measureScenario` 管线的场景并写样本文件。 */
async function collectViaPipeline(
  scenarioId: ScenarioId,
  outputDir: string,
  config: PerfConfig,
  configPath: string | undefined,
  hostVersion: string
): Promise<string> {
  const generatedAt = new Date().toISOString();
  const report = await measureScenario({
    scenarioId,
    adapter: pipelineAdapter(config),
    config,
    meta: measurementMeta(hostVersion),
    generatedAt,
    ...(configPath !== undefined ? { configPath } : {}),
  });
  const writeResult = await writeReport(report, outputDir);
  const samples = extractSamplesFromReport(report, scenarioId);
  const document = buildRealSamplesDocument(
    { scenarioId, status: 'measured', samples },
    samplesMeta(configPath, hostVersion)
  );
  const samplesPath = resolve(outputDir, realSamplesFileName(scenarioId));
  await writeJson(samplesPath, document);
  const summary = report.summary;
  writeLine(
    `[采集完成] ${scenarioId}：报告判定 通过 ${String(summary.pass)} / 失败 ${String(summary.fail)} / 无数据 ${String(summary.noData)}（判定归段B） → ${samplesPath}（管线报告 ${writeResult.jsonPath}）`
  );
  return samplesPath;
}

/** 采集 `open-card`：外部观测 totalSpan 逐轮组装（不经 `measureScenario` 的原因见设计 §三/§四）。 */
async function collectOpenCard(
  outputDir: string,
  config: PerfConfig,
  configPath: string | undefined,
  hostVersion: string
): Promise<string> {
  const definition = scenarioDefinition('open-card');
  const totalMetricId = definition.metricIds[0];
  if (definition.totalSpan === undefined || totalMetricId === undefined) {
    throw new PerfError('PERF_CONFIG_INVALID', 'open-card 场景缺少 totalSpan / 总指标登记');
  }
  const realAdapter = createRealHostAdapter();
  assertValidAdapter(realAdapter);
  const samples: number[] = [];
  const stageNotes: string[] = [];
  for (let iteration = 0; iteration < config.measurement.rounds; iteration += 1) {
    const result = await realAdapter.run({ scenarioId: 'open-card', iteration });
    if (result.markers === undefined || result.markers.length === 0) {
      throw new PerfError(
        'PERF_ADAPTER_INVALID',
        `open-card 第 ${String(iteration)} 轮缺少标记点（真进程采集 fail-closed）`
      );
    }
    for (const note of result.notes ?? []) {
      if (!stageNotes.includes(note)) {
        stageNotes.push(note);
      }
    }
    const timeline = observationTimeline(result.markers);
    samples.push(timeline.duration(definition.totalSpan));
  }
  const samplesByMetric: Partial<Record<MetricId, readonly number[]>> = {
    [totalMetricId]: samples,
  };
  const document = buildRealSamplesDocument(
    {
      scenarioId: 'open-card',
      status: 'measured',
      samples: samplesByMetric,
      extraNotes: stageNotes,
    },
    samplesMeta(configPath, hostVersion)
  );
  const samplesPath = resolve(outputDir, realSamplesFileName('open-card'));
  await writeJson(samplesPath, document);
  writeLine(
    `[采集完成] open-card：${String(samples.length)} 轮实测 totalSpan 样本（装载/解析/视图构建三段经 CHIPS_TRACE 导出还原，逐轮注记见样本文件 notes；frame-ready/first-commit 缺测见登记表） → ${samplesPath}`
  );
  return samplesPath;
}

/** 采集 `open-box`：真进程探针坐实不可测并产出结论文件（零数值）。 */
async function collectOpenBox(outputDir: string, hostVersion: string): Promise<string> {
  const evidence = await observeOpenBox();
  const generatedAt = new Date().toISOString();
  const document = buildRealUnmeasurableDocument(
    'open-box',
    [...evidence.notes, `探针宿主版本：${hostVersion}`],
    generatedAt
  );
  const filePath = resolve(outputDir, realUnmeasurableFileName('open-box'));
  await writeJson(filePath, document);
  writeLine(`[不可测结论] open-box：${document.reasons[0] ?? ''} → ${filePath}`);
  return filePath;
}

/** 采集主流程；返回进程退出码。 */
export async function collectMain(argv: readonly string[]): Promise<number> {
  if (process.env.CHIPS_PERF_REAL !== '1') {
    process.stderr.write(
      '真进程采集未启用：需显式设置 CHIPS_PERF_REAL=1（旗标门控，不入 CI 门禁）。\n'
    );
    process.stderr.write(USAGE);
    return 2;
  }
  let args: CollectArgs;
  try {
    args = parseCollectArgs(argv);
  } catch (error) {
    const message = isPerfError(error) ? `[${error.code}] ${error.message}` : String(error);
    process.stderr.write(`${message}\n${USAGE}`);
    return 2;
  }
  const hostVersion = await readHostVersion();
  writeLine(
    `真进程采集开始：场景 ${args.scenarioIds.join('、')}；轮次 ${String(args.config.measurement.rounds)}；空闲窗口 ${String(args.config.measurement.idleWindowMs)} ms；宿主版本 ${hostVersion}`
  );
  let failed = 0;
  for (const scenarioId of args.scenarioIds) {
    try {
      switch (scenarioId) {
        case 'cold-start':
        case 'scroll-fps':
        case 'idle-memory':
          await collectViaPipeline(
            scenarioId,
            args.outputDir,
            args.config,
            args.configPath,
            hostVersion
          );
          break;
        case 'open-card':
          await collectOpenCard(args.outputDir, args.config, args.configPath, hostVersion);
          break;
        case 'open-box':
          await collectOpenBox(args.outputDir, hostVersion);
          break;
        default:
          throw new PerfError(
            'PERF_CLI_USAGE',
            `场景 ${scenarioId} 不在五指标采集面内（本采集器只覆盖 W2-P1-6 五场景）`
          );
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[采集失败] ${scenarioId}：${message}\n`);
    }
  }
  if (failed > 0) {
    process.stderr.write(`真进程采集结论：${String(failed)} 个场景采集失败。\n`);
    return 1;
  }
  writeLine('真进程采集结论：全部请求场景采集完成（门禁判定与基线入库归段B）。');
  return 0;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  const code = await collectMain(process.argv.slice(2));
  process.exitCode = code;
}
