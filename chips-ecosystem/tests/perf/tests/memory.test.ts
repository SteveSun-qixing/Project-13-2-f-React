import { describe, expect, it } from 'vitest';
import { PerfError } from '../src/errors';
import {
  BYTES_PER_MB,
  sampleProcessMemory,
  summarizeMemory,
  toMegabytes,
  type MemorySample,
} from '../src/memory';

function megabytes(value: number): number {
  return value * BYTES_PER_MB;
}

describe('内存采样（memory）', () => {
  it('稳定态取空闲窗口内 RSS 中位数，峰值取全程最大', () => {
    const samples: MemorySample[] = [
      { at: 0, rssBytes: megabytes(100) },
      { at: 60_000, rssBytes: megabytes(200) },
      { at: 120_000, rssBytes: megabytes(300) },
      { at: 540_000, rssBytes: megabytes(420) },
      { at: 600_000, rssBytes: megabytes(440) },
    ];
    const summary = summarizeMemory(samples, { idleWindowMs: 120_000 });
    expect(summary.stableSampleCount).toBe(2);
    expect(summary.stableRssMb).toBe(430);
    expect(summary.stableSamplesMb).toEqual([420, 440]);
    expect(summary.peakRssMb).toBe(440);
    expect(summary.sampleCount).toBe(5);
    expect(summary.stableWindowMs).toBe(120_000);
  });

  it('稳定态样本按时间窗口截取（乱序输入亦正确）', () => {
    const samples: MemorySample[] = [
      { at: 600_000, rssBytes: megabytes(500) },
      { at: 0, rssBytes: megabytes(100) },
      { at: 300_000, rssBytes: megabytes(300) },
    ];
    const summary = summarizeMemory(samples, { idleWindowMs: 300_000 });
    expect(summary.stableSamplesMb).toEqual([300, 500]);
    expect(summary.stableRssMb).toBe(400);
  });

  it('趋势为斜率诊断（MB/分钟）', () => {
    const samples: MemorySample[] = [
      { at: 0, rssBytes: megabytes(100) },
      { at: 60_000, rssBytes: megabytes(110) },
      { at: 120_000, rssBytes: megabytes(120) },
    ];
    const summary = summarizeMemory(samples, { idleWindowMs: 60_000 });
    expect(summary.trendMbPerMinute).toBeCloseTo(10, 6);
  });

  it('toMegabytes 与采样器', () => {
    expect(toMegabytes(BYTES_PER_MB)).toBe(1);
    expect(() => toMegabytes(Number.NaN)).toThrowError(PerfError);
    const sample = sampleProcessMemory(123);
    expect(sample.at).toBe(123);
    expect(sample.rssBytes).toBeGreaterThan(0);
  });

  it('非法输入抛出 PerfError', () => {
    expect(() => summarizeMemory([], { idleWindowMs: 1000 })).toThrowError(PerfError);
    expect(() => summarizeMemory([{ at: 0, rssBytes: 1 }], { idleWindowMs: 0 })).toThrowError(
      PerfError
    );
    expect(() =>
      summarizeMemory([{ at: Number.NaN, rssBytes: 1 }], { idleWindowMs: 1 })
    ).toThrowError(PerfError);
  });
});
