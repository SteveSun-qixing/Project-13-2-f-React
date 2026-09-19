import { describe, expect, it } from 'vitest';
import { PerfError } from '../src/errors';
import { computeStats, percentile, roundTo, selectStatistic } from '../src/stats';

describe('统计（stats）', () => {
  it('percentile 采用 R-7 线性插值', () => {
    const sorted = [1, 2, 3, 4];
    expect(percentile(sorted, 0)).toBe(1);
    expect(percentile(sorted, 25)).toBe(1.75);
    expect(percentile(sorted, 50)).toBe(2.5);
    expect(percentile(sorted, 95)).toBeCloseTo(3.85, 10);
    expect(percentile(sorted, 100)).toBe(4);
  });

  it('单样本的百分位等于该样本', () => {
    expect(percentile([7], 0)).toBe(7);
    expect(percentile([7], 95)).toBe(7);
  });

  it('computeStats 汇总全部统计量', () => {
    const stats = computeStats([4, 1, 3, 2]);
    expect(stats.count).toBe(4);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(4);
    expect(stats.mean).toBe(2.5);
    expect(stats.median).toBe(2.5);
    expect(stats.p50).toBe(2.5);
    expect(stats.p95).toBeCloseTo(3.85, 10);
    expect(stats.p99).toBeCloseTo(3.97, 10);
    expect(stats.stddev).toBeCloseTo(Math.sqrt(1.25), 10);
  });

  it('selectStatistic 按名称取值', () => {
    const stats = computeStats([10, 20, 30, 40]);
    expect(selectStatistic(stats, 'median')).toBe(25);
    expect(selectStatistic(stats, 'p50')).toBe(25);
    expect(selectStatistic(stats, 'mean')).toBe(25);
    expect(selectStatistic(stats, 'max')).toBe(40);
    expect(selectStatistic(stats, 'p95')).toBeCloseTo(38.5, 10);
  });

  it('空样本与非法样本抛出 PerfError', () => {
    expect(() => computeStats([])).toThrowError(PerfError);
    expect(() => computeStats([Number.NaN])).toThrowError(PerfError);
    expect(() => computeStats([1, Number.POSITIVE_INFINITY])).toThrowError(PerfError);
  });

  it('百分位越界抛出 PerfError', () => {
    expect(() => percentile([1, 2], -1)).toThrowError(PerfError);
    expect(() => percentile([1, 2], 101)).toThrowError(PerfError);
    expect(() => percentile([], 50)).toThrowError(PerfError);
  });

  it('roundTo 仅用于展示', () => {
    expect(roundTo(1.23456, 2)).toBe(1.23);
    expect(roundTo(1.005, 2)).toBe(1);
  });
});
