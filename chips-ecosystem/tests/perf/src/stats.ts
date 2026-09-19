import { PerfError } from './errors';

/** 性能测量统计量名称；与指标注册表的 `gateStatistic` 一一对应。 */
export type StatisticName = 'median' | 'mean' | 'p50' | 'p95' | 'p99' | 'max';

/** 一组数值样本的统计摘要；`stddev` 为总体标准差（分母为样本数）。 */
export interface NumericStats {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly stddev: number;
}

function requireFiniteSample(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined || !Number.isFinite(value)) {
    throw new PerfError('PERF_INPUT_INVALID', `统计样本缺失或非有限数值：index=${String(index)}`);
  }
  return value;
}

/**
 * 百分位计算（R-7 线性插值，与 NumPy/Excel `PERCENTILE.INC` 同口径）。
 *
 * @param sortedAscending 已升序排序的样本数组
 * @param percentileValue 百分位（0–100）
 */
export function percentile(sortedAscending: readonly number[], percentileValue: number): number {
  if (sortedAscending.length === 0) {
    throw new PerfError('PERF_STATS_EMPTY', '百分位计算需要至少一个样本');
  }
  if (!Number.isFinite(percentileValue) || percentileValue < 0 || percentileValue > 100) {
    throw new PerfError(
      'PERF_INPUT_INVALID',
      `百分位必须在 0–100 之间：${String(percentileValue)}`
    );
  }
  if (sortedAscending.length === 1) {
    return requireFiniteSample(sortedAscending, 0);
  }
  const rank = (percentileValue / 100) * (sortedAscending.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  const lower = requireFiniteSample(sortedAscending, lowerIndex);
  const upper = requireFiniteSample(sortedAscending, upperIndex);
  return lower + (upper - lower) * (rank - lowerIndex);
}

/**
 * 计算样本统计摘要。样本必须全部为有限数值；空样本抛出 `PERF_STATS_EMPTY`。
 *
 * @param samples 原始样本（不要求有序，内部排序副本，不修改入参）
 */
export function computeStats(samples: readonly number[]): NumericStats {
  if (samples.length === 0) {
    throw new PerfError('PERF_STATS_EMPTY', '统计需要至少一个样本');
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const count = sorted.length;
  const min = requireFiniteSample(sorted, 0);
  const max = requireFiniteSample(sorted, count - 1);
  let sum = 0;
  for (const sample of sorted) {
    if (!Number.isFinite(sample)) {
      throw new PerfError('PERF_INPUT_INVALID', `样本包含非有限数值：${String(sample)}`);
    }
    sum += sample;
  }
  const mean = sum / count;
  const median = percentile(sorted, 50);
  let squaredDeviationSum = 0;
  for (const sample of sorted) {
    const deviation = sample - mean;
    squaredDeviationSum += deviation * deviation;
  }
  const stddev = Math.sqrt(squaredDeviationSum / count);
  return {
    count,
    min,
    max,
    mean,
    median,
    p50: median,
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    stddev,
  };
}

/** 从统计摘要中取出指定统计量；`p50` 与 `median` 同值。 */
export function selectStatistic(stats: NumericStats, name: StatisticName): number {
  switch (name) {
    case 'median':
    case 'p50':
      return stats.median;
    case 'mean':
      return stats.mean;
    case 'p95':
      return stats.p95;
    case 'p99':
      return stats.p99;
    case 'max':
      return stats.max;
  }
}

/** 数值保留 `decimals` 位小数（报告展示用，判定一律使用原始值）。 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
