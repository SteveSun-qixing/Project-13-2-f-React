import { PerfError } from './errors';
import { computeStats, type NumericStats } from './stats';

/**
 * 60fps 对应的单帧时间预算（毫秒）。
 * 数值由《架构原则》§4.2 / R18 的 60fps 门禁推导，非自创指标。
 */
export const FRAME_BUDGET_MS = 1000 / 60;

/** 1 秒分桶的帧率样本。 */
export interface FpsBucket {
  readonly startMs: number;
  readonly durationMs: number;
  readonly frameIntervals: number;
  readonly fps: number;
}

/** 帧时间戳序列的统计摘要。 */
export interface FrameSummary {
  readonly frameCount: number;
  readonly durationMs: number;
  /** 全程平均帧率（帧间隔数 / 时长），与《CICD与质量门禁》§3.3「平均帧率」口径一致。 */
  readonly averageFps: number;
  readonly buckets: readonly FpsBucket[];
  readonly bucketFpsStats: NumericStats;
  readonly frameTimeStats: NumericStats;
  readonly longFrameCount: number;
  readonly longFrameRatio: number;
  readonly frameBudgetMs: number;
}

function validateTimestamps(timestampsMs: readonly number[]): void {
  if (timestampsMs.length < 2) {
    throw new PerfError(
      'PERF_INPUT_INVALID',
      `帧率采样需要至少两个时间戳，当前 ${String(timestampsMs.length)} 个`
    );
  }
  let previous = Number.NaN;
  for (let index = 0; index < timestampsMs.length; index += 1) {
    const current = timestampsMs[index];
    if (current === undefined || !Number.isFinite(current)) {
      throw new PerfError('PERF_INPUT_INVALID', `帧时间戳[${String(index)}] 不是有限数值`);
    }
    if (index > 0 && current <= previous) {
      throw new PerfError('PERF_INPUT_INVALID', `帧时间戳必须严格递增：index=${String(index)}`);
    }
    previous = current;
  }
}

/**
 * 汇总帧时间戳：全程平均帧率、1 s 分桶帧率、帧时间统计与长帧比例。
 *
 * 分桶规则：以首个时间戳为原点，每 1000 ms 一个桶；末尾不足 1 s 的余量不参与分桶
 * （不足 1 s 的采样整体作为一个桶）。
 *
 * 桶归属按帧间隔的中点时刻判定（工单041④ 口径修正）：旧实现按间隔的「结束时刻」
 * 判定，真实 60Hz 流（间隔 ≈16.667ms、末间隔总时长越过整秒边界）的最后一段间隔
 * 会落在末桶边界之外被整体丢弃，产生系统性的 −1 间隔截断偏置——10 秒采样报出
 * 59.90 而非 60.0（探针证据：/tmp/w135_fps_probe.json，全程 59.999 对比桶均值
 * 59.900，空白页对照组同偏差）。中点判定使跨桶间隔归属其几何中点所在桶，消除
 * 该截断；判定阈值与门禁逻辑不变，仅修正采集口径。
 *
 * @param timestampsMs 单调递增的帧时间戳（毫秒）
 * @param frameBudgetMs 单帧预算，默认由 60fps 推导
 */
export function summarizeFrames(
  timestampsMs: readonly number[],
  frameBudgetMs: number = FRAME_BUDGET_MS
): FrameSummary {
  validateTimestamps(timestampsMs);
  if (!Number.isFinite(frameBudgetMs) || frameBudgetMs <= 0) {
    throw new PerfError(
      'PERF_INPUT_INVALID',
      `帧时间预算必须是正有限数值：${String(frameBudgetMs)}`
    );
  }
  const first = timestampsMs[0];
  const last = timestampsMs[timestampsMs.length - 1];
  if (first === undefined || last === undefined) {
    throw new PerfError('PERF_INPUT_INVALID', '帧时间戳序列不完整');
  }
  const durationMs = last - first;
  const intervals: number[] = [];
  for (let index = 1; index < timestampsMs.length; index += 1) {
    const current = timestampsMs[index];
    const previous = timestampsMs[index - 1];
    if (current === undefined || previous === undefined) {
      throw new PerfError('PERF_INPUT_INVALID', `帧时间戳[${String(index)}] 缺失`);
    }
    intervals.push(current - previous);
  }
  const frameCount = timestampsMs.length;
  const intervalCount = intervals.length;
  const averageFps = intervalCount === 0 ? 0 : (intervalCount * 1000) / durationMs;

  const bucketCount = durationMs >= 1000 ? Math.floor(durationMs / 1000) : 1;
  const buckets: FpsBucket[] = [];
  for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
    const bucketStart = first + bucketIndex * 1000;
    const bucketDuration = durationMs >= 1000 ? 1000 : durationMs;
    const bucketEnd = bucketStart + bucketDuration;
    let frameIntervals = 0;
    for (let index = 1; index < timestampsMs.length; index += 1) {
      const current = timestampsMs[index];
      const previous = timestampsMs[index - 1];
      if (current === undefined || previous === undefined) {
        continue;
      }
      const midpoint = (previous + current) / 2;
      if (midpoint > bucketStart && midpoint <= bucketEnd) {
        frameIntervals += 1;
      }
    }
    buckets.push({
      startMs: bucketStart,
      durationMs: bucketDuration,
      frameIntervals,
      fps: (frameIntervals * 1000) / bucketDuration,
    });
  }

  const longFrameCount = intervals.filter((interval) => interval > frameBudgetMs).length;
  const bucketFpsStats = computeStats(buckets.map((bucket) => bucket.fps));
  const frameTimeStats = computeStats(intervals);
  return {
    frameCount,
    durationMs,
    averageFps,
    buckets,
    bucketFpsStats,
    frameTimeStats,
    longFrameCount,
    longFrameRatio: intervalCount === 0 ? 0 : longFrameCount / intervalCount,
    frameBudgetMs,
  };
}
