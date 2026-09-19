import { PerfError } from './errors';
import { computeStats, type NumericStats } from './stats';

/** 1 MB 的字节数（1024 进制，与报告展示口径一致）。 */
export const BYTES_PER_MB = 1024 * 1024;

/** 一次进程内存采样。 */
export interface MemorySample {
  /** 采样时刻（毫秒，单调时钟）。 */
  readonly at: number;
  readonly rssBytes: number;
  readonly heapUsedBytes?: number;
  readonly heapTotalBytes?: number;
  readonly externalBytes?: number;
}

/** 内存采样序列的统计摘要。 */
export interface MemorySummary {
  readonly sampleCount: number;
  readonly peakRssMb: number;
  /** 空闲窗口内 RSS 的中位数（门禁比较值）。 */
  readonly stableRssMb: number;
  readonly stableSampleCount: number;
  readonly stableWindowMs: number;
  /** 空闲窗口内的 RSS 样本（MB），随报告留存。 */
  readonly stableSamplesMb: readonly number[];
  /** 全程 RSS 线性趋势（MB/分钟），仅作诊断信息，不参与门禁。 */
  readonly trendMbPerMinute: number;
  readonly stableStats: NumericStats;
}

/** 字节转 MB（1024 进制）。 */
export function toMegabytes(bytes: number): number {
  if (!Number.isFinite(bytes)) {
    throw new PerfError('PERF_INPUT_INVALID', `字节数不是有限数值：${String(bytes)}`);
  }
  return bytes / BYTES_PER_MB;
}

/** 采集当前 Node.js 进程内存；`at` 缺省取 `performance.now()`。 */
export function sampleProcessMemory(at: number = performance.now()): MemorySample {
  const usage = process.memoryUsage();
  return {
    at,
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    heapTotalBytes: usage.heapTotal,
    externalBytes: usage.external,
  };
}

function validateSamples(samples: readonly MemorySample[]): void {
  if (samples.length === 0) {
    throw new PerfError('PERF_STATS_EMPTY', '内存汇总需要至少一个采样');
  }
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (sample === undefined) {
      throw new PerfError('PERF_INPUT_INVALID', `内存采样[${String(index)}] 缺失`);
    }
    if (!Number.isFinite(sample.at) || !Number.isFinite(sample.rssBytes)) {
      throw new PerfError(
        'PERF_INPUT_INVALID',
        `内存采样[${String(index)}] 的 at/rssBytes 必须是有限数值`
      );
    }
  }
}

function linearTrendMbPerMinute(sorted: readonly MemorySample[]): number {
  if (sorted.length < 2) {
    return 0;
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) {
    return 0;
  }
  const spanMinutes = (last.at - first.at) / 60_000;
  if (spanMinutes <= 0) {
    return 0;
  }
  const meanAt = sorted.reduce((sum, sample) => sum + sample.at, 0) / sorted.length;
  const meanMb =
    sorted.reduce((sum, sample) => sum + toMegabytes(sample.rssBytes), 0) / sorted.length;
  let covariance = 0;
  let variance = 0;
  for (const sample of sorted) {
    const atDelta = sample.at - meanAt;
    covariance += atDelta * (toMegabytes(sample.rssBytes) - meanMb);
    variance += atDelta * atDelta;
  }
  if (variance === 0) {
    return 0;
  }
  const mbPerMs = covariance / variance;
  return mbPerMs * 60_000;
}

/**
 * 汇总内存采样：峰值 RSS、空闲窗口稳定态 RSS（中位数）与线性趋势。
 *
 * 空闲窗口以最后一个采样时刻为终点向前取 `idleWindowMs`；窗口内样本不足时以全部样本计算。
 *
 * @param samples RSS 采样（任意顺序）
 * @param options.idleWindowMs 空闲窗口时长（毫秒）；默认取《CICD与质量门禁》§3.3 G7 的 5 分钟
 */
export function summarizeMemory(
  samples: readonly MemorySample[],
  options: { readonly idleWindowMs: number }
): MemorySummary {
  validateSamples(samples);
  if (!Number.isFinite(options.idleWindowMs) || options.idleWindowMs <= 0) {
    throw new PerfError(
      'PERF_INPUT_INVALID',
      `空闲窗口必须是正有限数值：${String(options.idleWindowMs)}`
    );
  }
  const sorted = [...samples].sort((left, right) => left.at - right.at);
  const last = sorted[sorted.length - 1];
  if (last === undefined) {
    throw new PerfError('PERF_STATS_EMPTY', '内存汇总需要至少一个采样');
  }
  const windowStart = last.at - options.idleWindowMs;
  const stable = sorted.filter((sample) => sample.at >= windowStart);
  const stableMb = stable.map((sample) => toMegabytes(sample.rssBytes));
  const peakRssMb = Math.max(...sorted.map((sample) => toMegabytes(sample.rssBytes)));
  const stableStats = computeStats(stableMb);
  return {
    sampleCount: sorted.length,
    peakRssMb,
    stableRssMb: stableStats.median,
    stableSampleCount: stable.length,
    stableWindowMs: options.idleWindowMs,
    stableSamplesMb: stableMb,
    trendMbPerMinute: linearTrendMbPerMinute(sorted),
    stableStats,
  };
}
