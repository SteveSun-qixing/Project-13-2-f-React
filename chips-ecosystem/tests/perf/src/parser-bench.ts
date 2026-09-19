import { PerfError } from './errors';
import type { MetricId } from './metrics';
import { computeStats, type NumericStats } from './stats';

/**
 * 解析基准：对 `.card` / `.box` 夹具执行 warmup + 多轮计时。
 *
 * 口径见《文档解析器设计》§9.2、§9.5：夹具固定、索引可访问、多轮取中位数，
 * 资源字节读取不计入解析器指标。
 */

/** 基准夹具：固定入库的文档载荷。 */
export interface ParseFixture {
  readonly id: string;
  readonly title: string;
  readonly totalBytes: number;
  readonly payload: Uint8Array;
}

/** 被测解析器；真实实现由 `chips-native`（Neon 绑定）适配，自测使用合成实现。 */
export interface ParserUnderTest {
  readonly name: string;
  parse(fixture: ParseFixture): Promise<void> | void;
}

/** 基准执行参数。 */
export interface ParserBenchOptions {
  readonly metricId: MetricId;
  readonly rounds: number;
  readonly warmupRounds: number;
  /** 可注入时钟（毫秒）；缺省使用 `performance.now`。 */
  readonly now?: () => number;
}

/** 基准结果。 */
export interface ParserBenchResult {
  readonly parserName: string;
  readonly fixtureId: string;
  readonly metricId: MetricId;
  readonly fixtureBytes: number;
  readonly samplesMs: readonly number[];
  readonly stats: NumericStats;
}

function validateOptions(options: ParserBenchOptions): void {
  if (!Number.isInteger(options.rounds) || options.rounds < 1) {
    throw new PerfError(
      'PERF_INPUT_INVALID',
      `基准轮次必须是 ≥1 的整数：${String(options.rounds)}`
    );
  }
  if (!Number.isInteger(options.warmupRounds) || options.warmupRounds < 0) {
    throw new PerfError(
      'PERF_INPUT_INVALID',
      `warmup 轮次必须是 ≥0 的整数：${String(options.warmupRounds)}`
    );
  }
}

function validateFixture(fixture: ParseFixture): void {
  if (fixture.id.length === 0) {
    throw new PerfError('PERF_FIXTURE_INVALID', '夹具 ID 不能为空');
  }
  if (fixture.payload.byteLength !== fixture.totalBytes) {
    throw new PerfError(
      'PERF_FIXTURE_INVALID',
      `夹具 ${fixture.id} 声明字节数 ${String(fixture.totalBytes)} 与实际载荷 ${String(fixture.payload.byteLength)} 不一致`
    );
  }
  if (fixture.totalBytes <= 0) {
    throw new PerfError('PERF_FIXTURE_INVALID', `夹具 ${fixture.id} 载荷不能为空`);
  }
}

/**
 * 执行解析基准；计时含 await 完整时长，样本不足时抛出 `PERF_STATS_EMPTY`。
 *
 * 计时协议：每一轮（含 warmup）都以同一路径读取注入时钟两次；
 * warmup 轮结果只校验不记录，样本只来自正式轮次。
 */
export async function runParserBench(
  parser: ParserUnderTest,
  fixture: ParseFixture,
  options: ParserBenchOptions
): Promise<ParserBenchResult> {
  if (parser.name.length === 0 || typeof parser.parse !== 'function') {
    throw new PerfError('PERF_FIXTURE_INVALID', '被测解析器必须提供 name 与 parse()');
  }
  validateFixture(fixture);
  validateOptions(options);
  const now = options.now ?? ((): number => performance.now());
  const measureRound = async (): Promise<number> => {
    const startedAt = now();
    await parser.parse(fixture);
    const elapsed = now() - startedAt;
    if (!Number.isFinite(elapsed) || elapsed < 0) {
      throw new PerfError('PERF_INPUT_INVALID', `计时结果非法：${String(elapsed)}`);
    }
    return elapsed;
  };
  for (let round = 0; round < options.warmupRounds; round += 1) {
    await measureRound();
  }
  const samplesMs: number[] = [];
  for (let round = 0; round < options.rounds; round += 1) {
    samplesMs.push(await measureRound());
  }
  return {
    parserName: parser.name,
    fixtureId: fixture.id,
    metricId: options.metricId,
    fixtureBytes: fixture.totalBytes,
    samplesMs,
    stats: computeStats(samplesMs),
  };
}
