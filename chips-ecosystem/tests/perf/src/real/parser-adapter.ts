import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AdapterRunContext, AdapterRunResult, RealMeasurementAdapter } from '../adapters';
import { PerfError } from '../errors';
import type { MetricId } from '../metrics';
import { PARSE_DOMAIN_SCENARIO_IDS } from '../scenarios';
import { DEFAULT_CONFIG } from '../thresholds';
import {
  assertNoErrorDiagnostics,
  loadNativeParserSurface,
  type NativeParserSurface,
} from './native-parser';
import {
  PERF_CARD_NODE_ID,
  writePerfParseFixtures,
  type PerfParseFixturePaths,
} from './parse-fixtures';

/**
 * 解析域真测适配器（工单056 · 形 A：真 `.card`/`.box` 字节 × 真 `chips-parser` 解析链）。
 *
 * 链路：运行时确定性生成真实归档夹具（`parse-fixtures.ts`，>1 MB 字节不入库）→
 * `chips-native.node` 解析域导出（`native-parser.ts` fail-closed 装载闸）→
 * `openCard` / `openBox` 与惰性访问器逐项实测计时 → `metricSamples` 落报告。
 *
 * 计时协议（与 `src/parser-bench.ts` 同一族规）：warmup 轮只校验不记录；
 * 正式轮逐轮以 `performance.now` 打点；统计量与门禁判定归工具层（runner）。
 *
 * 指标口径映射（在册裁决，读数全部来自真解析调用）：
 * - `parse_open_ms`：`openCard` 调用完整往返（容器打开 + L0 metadata 解析校验，
 *   即《解析器设计》§9.2「目录扫描/EOCD+中央目录 与 metadata 解析校验之和」的导出面形态）；
 * - `parse_structure_ms`：同轮内 `documentStructure` 段（L1 惰性解析触发）；
 * - `parse_10mb_ms`：同轮内 open → structure → content 全链总时长（全量惰性层级解析
 *   收口；资源字节按 §9.5 不进入计时，严格校验 `documentValidate` 另列口径不计入）；
 * - `parse_entries_10k_ms`：同轮内 `openBox` → `documentStructure` 的条目索引解析段
 *  （10 000 条 `structure.yaml` 惰性解析触发）；
 * - `parse_box_full_ms`（#263 补臂）：同轮内 `openBox` → `documentStructure` →
 *   `documentLayoutConfig` 全链总时长（箱全量解析，门禁承接《解析器设计》§9.2
 *   「打开箱子总预算 ≤ 200 ms」；严格校验另列口径不计入）；
 * - `parse_metadata_ms` / `parse_model_build_ms`：解析器内部阶段，导出面无独立可测形
 *  （metadata 融于 open、model build 融于全链），**如实登记缺测臂**（noData + notes），
 *   不做折算、不造数；
 * - `parse_content_yaml_ms`（#263 核对翻正）：在册口径为「10 MB 全为 YAML 的最坏情况」
 *  （§9.2 原文），本卡片臂夹具的 content YAML 为 1 MiB（10 MB = 1 MiB YAML + 9 MiB
 *   资源），形制不符——已自 `parse-card-10mb` 场景登记移除，本卡臂不再为其供样
 *  （不冒充、不折算），其专用夹具测臂缺位如实登记（归后续处置项）；
 * - 箱子场景登记口径（W3 翻正）：`parse_10mb_ms` 系卡片口径指标，已从 `parse-box-10k`
 *   场景登记移除（一个场景只登记它真正测量的指标），本适配器箱臂不为其供样。
 */

/** 适配器在册 ID（非 `synthetic-*`；报告 `meta.adapterId` 判定真/合成臂的锚）。 */
export const REAL_PARSE_ADAPTER_ID = 'chips-native-parser-real-process';

/** 夹具缺省落盘目录（系统临时目录，运行时生成、不入库）。 */
export const PERF_PARSE_FIXTURE_DIR = join(tmpdir(), 'chips-perf-parse-real-fixtures');

/** 构造选项（全部可注入，供纯逻辑锁测替换装载器/时钟/夹具落位）。 */
export interface RealParseAdapterOptions {
  /** 原生解析面装载器；缺省真装载 `packages/host/native/chips-native.node`（fail-closed）。 */
  readonly loadSurface?: () => NativeParserSurface;
  /** 单调时钟（毫秒）；缺省 `performance.now`。 */
  readonly clock?: () => number;
  /** 正式轮次数；缺省取策略默认 `DEFAULT_CONFIG.measurement.rounds`。 */
  readonly rounds?: number;
  /** warmup 轮次数；缺省取策略默认 `DEFAULT_CONFIG.measurement.warmupRounds`。 */
  readonly warmupRounds?: number;
  /** 夹具落盘目录；缺省 {@link PERF_PARSE_FIXTURE_DIR}。 */
  readonly fixtureDir?: string;
}

/** 单轮解析域测量的阶段打点（毫秒，均为相邻打点差值）。 */
interface ParseRoundTimings {
  readonly openMs: number;
  readonly structureMs: number;
  readonly contentMs: number;
  readonly layoutConfigMs: number;
}

function validateRounds(rounds: number, warmupRounds: number): void {
  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new PerfError('PERF_INPUT_INVALID', `解析域真测轮次必须是 ≥1 的整数：${String(rounds)}`);
  }
  if (!Number.isInteger(warmupRounds) || warmupRounds < 0) {
    throw new PerfError(
      'PERF_INPUT_INVALID',
      `解析域真测 warmup 轮次必须是 ≥0 的整数：${String(warmupRounds)}`
    );
  }
}

/** 执行一轮卡片全链解析（open → structure → content），逐段打点。 */
async function runCardRound(
  surface: NativeParserSurface,
  clock: () => number,
  cardPath: string
): Promise<ParseRoundTimings> {
  const startedAt = clock();
  const handle = await surface.openCard(cardPath);
  const openedAt = clock();
  try {
    const structure = await surface.documentStructure(handle);
    assertNoErrorDiagnostics('documentStructure（卡片）', structure.diagnostics);
    const structuredAt = clock();
    const content = await surface.documentContent(handle, PERF_CARD_NODE_ID);
    assertNoErrorDiagnostics('documentContent（卡片）', content.diagnostics);
    assertNoErrorDiagnostics('documentContent.value（卡片）', content.value?.diagnostics);
    const contentAt = clock();
    return {
      openMs: openedAt - startedAt,
      structureMs: structuredAt - openedAt,
      contentMs: contentAt - structuredAt,
      layoutConfigMs: 0,
    };
  } finally {
    await surface.documentClose(handle);
  }
}

/** 执行一轮箱子全链解析（open → structure 条目索引 → layoutConfig），逐段打点。 */
async function runBoxRound(
  surface: NativeParserSurface,
  clock: () => number,
  boxPath: string
): Promise<ParseRoundTimings> {
  const startedAt = clock();
  const handle = await surface.openBox(boxPath);
  const openedAt = clock();
  try {
    const structure = await surface.documentStructure(handle);
    assertNoErrorDiagnostics('documentStructure（箱子）', structure.diagnostics);
    const structuredAt = clock();
    const layout = await surface.documentLayoutConfig(handle);
    assertNoErrorDiagnostics('documentLayoutConfig（箱子）', layout.diagnostics);
    const layoutAt = clock();
    return {
      openMs: openedAt - startedAt,
      structureMs: structuredAt - openedAt,
      contentMs: 0,
      layoutConfigMs: layoutAt - structuredAt,
    };
  } finally {
    await surface.documentClose(handle);
  }
}

/** warmup + 正式轮驱动：warmup 只跑不记录，样本只来自正式轮。 */
async function benchRounds(
  rounds: number,
  warmupRounds: number,
  runRound: () => Promise<ParseRoundTimings>
): Promise<ParseRoundTimings[]> {
  for (let round = 0; round < warmupRounds; round += 1) {
    await runRound();
  }
  const samples: ParseRoundTimings[] = [];
  for (let round = 0; round < rounds; round += 1) {
    samples.push(await runRound());
  }
  return samples;
}

/** 创建解析域真测适配器（构造零副作用：不装载产物、不写夹具）。 */
export function createRealParseAdapter(
  options: RealParseAdapterOptions = {}
): RealMeasurementAdapter {
  const clock = options.clock ?? (() => performance.now());
  const rounds = options.rounds ?? DEFAULT_CONFIG.measurement.rounds;
  const warmupRounds = options.warmupRounds ?? DEFAULT_CONFIG.measurement.warmupRounds;
  const fixtureDir = options.fixtureDir ?? PERF_PARSE_FIXTURE_DIR;
  validateRounds(rounds, warmupRounds);

  let surfacePromise: Promise<NativeParserSurface> | null = null;
  let fixturesPromise: Promise<PerfParseFixturePaths> | null = null;

  async function surface(): Promise<NativeParserSurface> {
    if (surfacePromise === null) {
      const load = options.loadSurface ?? loadNativeParserSurface;
      // 经微任务队列装载：装载器同步抛错同样收敛为 rejected Promise（run 侧 await 可见）。
      surfacePromise = Promise.resolve().then(() => load());
    }
    return await surfacePromise;
  }

  async function fixtures(): Promise<PerfParseFixturePaths> {
    if (fixturesPromise === null) {
      fixturesPromise = writePerfParseFixtures(fixtureDir);
    }
    return await fixturesPromise;
  }

  /** 末轮之后的一次严格校验体检：夹具必须被解析器判为非 invalid（真实可读文档）。 */
  async function validateSanity(
    native: NativeParserSurface,
    filePath: string,
    kind: 'card' | 'box'
  ): Promise<string> {
    const handle =
      kind === 'card' ? await native.openCard(filePath) : await native.openBox(filePath);
    try {
      const structure = await native.documentStructure(handle);
      assertNoErrorDiagnostics(`documentStructure（${kind} 体检）`, structure.diagnostics);
      const report = await native.documentValidate(handle);
      if (report.status === 'invalid') {
        const first = report.diagnostics.find((entry) => entry.severity === 'error');
        throw new PerfError(
          'PERF_FIXTURE_INVALID',
          `夹具严格校验判 invalid（${kind}）：${first?.code ?? '无诊断码'}（${first?.message ?? '无消息'}）`
        );
      }
      return `status=${report.status}，yaml_bytes=${String(report.statistics.yaml_bytes)}，entry_count=${String(report.statistics.entry_count)}，member_count=${String(report.statistics.member_count)}`;
    } finally {
      await native.documentClose(handle);
    }
  }

  async function runCardScenario(): Promise<AdapterRunResult> {
    const native = await surface();
    const fixturePaths = await fixtures();
    const samples = await benchRounds(rounds, warmupRounds, async () =>
      runCardRound(native, clock, fixturePaths.cardPath)
    );
    const sanity = await validateSanity(native, fixturePaths.cardPath, 'card');
    const totalMs = samples.map((sample) => sample.openMs + sample.structureMs + sample.contentMs);
    const metricSamples: Partial<Record<MetricId, readonly number[]>> = {
      parse_10mb_ms: totalMs,
      parse_open_ms: samples.map((sample) => sample.openMs),
      parse_structure_ms: samples.map((sample) => sample.structureMs),
    };
    return {
      metricSamples,
      notes: [
        `解析域真测（工单056 形 A）：真实 .card 归档字节（${String(fixturePaths.cardBytes)} 字节，ZIP Store）经 chips-native.node 解析域导出实测；coreVersion=${native.coreVersion()}，coreAbiVersion=${String(native.coreAbiVersion())}。`,
        `口径：parse_open_ms=openCard 往返；parse_structure_ms=同轮惰性段；parse_10mb_ms=open→structure→content 全链（资源字节读取按 §9.5 不计入）。样本 ${String(rounds)} 轮（warmup ${String(warmupRounds)} 轮不计）。`,
        '缺测臂（不折算不造数）：parse_metadata_ms 与 parse_model_build_ms 为解析器内部阶段，导出面无独立可测形（metadata 解析融于 open、模型构建融于全链），如实 noData；parse_content_yaml_ms 在册口径为「10 MB 全为 YAML 的最坏情况」（§9.2），本臂 content YAML 为 1 MiB、形制不符，已自场景登记翻正移除，其专用夹具测臂缺位（#263 登记，归后续处置项）。',
        `夹具严格校验体检（documentValidate，另列口径不计入解析样本）：${sanity}。`,
      ],
    };
  }

  async function runBoxScenario(): Promise<AdapterRunResult> {
    const native = await surface();
    const fixturePaths = await fixtures();
    const samples = await benchRounds(rounds, warmupRounds, async () =>
      runBoxRound(native, clock, fixturePaths.boxPath)
    );
    const sanity = await validateSanity(native, fixturePaths.boxPath, 'box');
    const metricSamples: Partial<Record<MetricId, readonly number[]>> = {
      parse_entries_10k_ms: samples.map((sample) => sample.structureMs),
      parse_box_full_ms: samples.map(
        (sample) => sample.openMs + sample.structureMs + sample.layoutConfigMs
      ),
    };
    return {
      metricSamples,
      notes: [
        `解析域真测（工单056 形 A）：真实 .box 归档字节（${String(fixturePaths.boxBytes)} 字节，10 000 外部引用条目）经 chips-native.node 解析域导出实测；coreVersion=${native.coreVersion()}，coreAbiVersion=${String(native.coreAbiVersion())}。`,
        `口径：parse_entries_10k_ms=openBox 后 documentStructure 惰性条目索引解析段；parse_box_full_ms=同轮 open→structure→layoutConfig 全链总时长（#263 补臂，门禁承接《文档解析器设计》§9.2「打开箱子总预算 ≤ 200 ms」）。样本 ${String(rounds)} 轮（warmup ${String(warmupRounds)} 轮不计）。`,
        '缺测臂（不折算不造数）：卡片口径指标 parse_10mb_ms 已自本场景登记翻正移除（W3），箱臂不为其供样；箱内惰性层级无 content 单元可触发（外部引用条目形制），无其他缺测段。',
        `夹具严格校验体检（documentValidate，另列口径不计入解析样本）：${sanity}。`,
      ],
    };
  }

  return {
    id: REAL_PARSE_ADAPTER_ID,
    title: '薯片解析域真测适配器（chips-native 解析链，工单056 形 A）',
    description:
      '运行时确定性生成真实 .card/.box 归档字节，经 chips-native.node 解析域 13 导出的 openCard/openBox/documentStructure/documentContent/documentLayoutConfig 链路逐段实测计时；数值全部来自真实解析调用，fail-closed，不降级。',
    measurementForm: 'real',
    provides: [...PARSE_DOMAIN_SCENARIO_IDS],
    async run(context: AdapterRunContext): Promise<AdapterRunResult> {
      switch (context.scenarioId) {
        case 'parse-card-10mb':
          return await runCardScenario();
        case 'parse-box-10k':
          return await runBoxScenario();
        default:
          throw new PerfError(
            'PERF_ADAPTER_INVALID',
            `解析域真测适配器仅提供 ${PARSE_DOMAIN_SCENARIO_IDS.join('、')}，未提供场景 ${context.scenarioId}`
          );
      }
    },
  };
}

/** `measure --adapter src/real/parser-adapter.ts` 的缺省实例（构造零副作用）。 */
export const adapter: RealMeasurementAdapter = createRealParseAdapter();

export default adapter;
