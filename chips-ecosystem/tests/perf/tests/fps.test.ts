import { describe, expect, it } from 'vitest';
import { PerfError } from '../src/errors';
import { FRAME_BUDGET_MS, summarizeFrames } from '../src/fps';

function constantIntervalTimestamps(intervalMs: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => index * intervalMs);
}

describe('帧率采样（fps）', () => {
  it('精确 60fps、10 秒采样：平均帧率约 60，分桶 10 个', () => {
    const timestamps = constantIntervalTimestamps(1000 / 60, 601);
    const summary = summarizeFrames(timestamps, 17);
    expect(summary.buckets).toHaveLength(10);
    expect(summary.averageFps).toBeCloseTo(60, 6);
    expect(summary.bucketFpsStats.mean).toBeCloseTo(60, 6);
    expect(summary.longFrameCount).toBe(0);
    expect(summary.frameCount).toBe(601);
    expect(summary.durationMs).toBeCloseTo(10_000, 6);
  });

  it('60Hz 真实节律（末间隔越过整秒边界）：分桶均值不再截断为 59.90', () => {
    // 复现工单041④ 探针场景：601 个帧时间戳、恒定间隔 16.667ms，
    // 总时长 10000.2ms 略超 10 个整秒桶。旧「结束时刻」口径下，
    // 末段间隔结束于 10000.2 > 末桶边界 10000，被整体丢弃 →
    // 分桶合计 599 个间隔 → 桶均值 59.90（结构性 −1 偏置）。
    // 中点口径下该间隔中点 9991.85 落入末桶 → 分桶合计 600 → 均值 60.0。
    const timestamps = constantIntervalTimestamps(10000.2 / 600, 601);
    const summary = summarizeFrames(timestamps);
    expect(summary.buckets).toHaveLength(10);
    expect(summary.averageFps).toBeCloseTo(59.9988, 4);
    expect(summary.buckets.reduce((sum, bucket) => sum + bucket.frameIntervals, 0)).toBe(600);
    expect(summary.bucketFpsStats.mean).toBeCloseTo(60, 6);
  });

  it('20fps：全部为长帧，平均帧率为 20', () => {
    const summary = summarizeFrames(constantIntervalTimestamps(50, 201));
    expect(summary.averageFps).toBeCloseTo(20, 6);
    expect(summary.longFrameCount).toBe(200);
    expect(summary.longFrameRatio).toBe(1);
    expect(summary.frameTimeStats.median).toBe(50);
    expect(summary.buckets).toHaveLength(10);
    expect(summary.buckets[0]?.fps).toBeCloseTo(20, 6);
  });

  it('不足 1 秒的采样作为一个桶', () => {
    const summary = summarizeFrames(constantIntervalTimestamps(25, 21));
    expect(summary.buckets).toHaveLength(1);
    expect(summary.buckets[0]?.durationMs).toBe(500);
    expect(summary.buckets[0]?.fps).toBeCloseTo(40, 6);
  });

  it('帧预算默认由 60fps 推导', () => {
    expect(FRAME_BUDGET_MS).toBeCloseTo(1000 / 60, 12);
  });

  it('非法输入抛出 PerfError', () => {
    expect(() => summarizeFrames([])).toThrowError(PerfError);
    expect(() => summarizeFrames([0])).toThrowError(PerfError);
    expect(() => summarizeFrames([0, 0])).toThrowError(PerfError);
    expect(() => summarizeFrames([10, 5])).toThrowError(PerfError);
    expect(() => summarizeFrames([0, Number.NaN])).toThrowError(PerfError);
    expect(() => summarizeFrames([0, 16], 0)).toThrowError(PerfError);
  });
});
