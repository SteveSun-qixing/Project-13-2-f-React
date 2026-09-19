import { describe, expect, it } from 'vitest';
import { PerfError } from '../src/errors';
import { MarkerTimeline, parseMarkerTrace, timelineFromMarkers } from '../src/markers';

describe('标记点时间线（markers）', () => {
  it('按跨度计算时长', () => {
    const timeline = timelineFromMarkers([
      { name: 'a', at: 100 },
      { name: 'b', at: 140 },
      { name: 'c', at: 250 },
    ]);
    expect(timeline.duration({ from: 'a', to: 'b' })).toBe(40);
    expect(timeline.duration({ from: 'a', to: 'c' })).toBe(150);
    expect(timeline.duration({ from: 'b', to: 'b' })).toBe(0);
    expect(timeline.size).toBe(3);
    expect(timeline.names()).toEqual(['a', 'b', 'c']);
  });

  it('重复标记点、缺失标记点与非法顺序均抛出 PerfError', () => {
    expect(() =>
      timelineFromMarkers([
        { name: 'a', at: 1 },
        { name: 'a', at: 2 },
      ])
    ).toThrowError(PerfError);
    const timeline = timelineFromMarkers([{ name: 'a', at: 10 }]);
    expect(() => timeline.duration({ from: 'a', to: 'b' })).toThrowError(PerfError);
    const inverted = timelineFromMarkers([
      { name: 'a', at: 10 },
      { name: 'b', at: 5 },
    ]);
    expect(() => inverted.duration({ from: 'a', to: 'b' })).toThrowError(PerfError);
  });

  it('非法时间与空名称被拒绝', () => {
    const timeline = new MarkerTimeline();
    expect(() => timeline.add({ name: 'a', at: Number.NaN })).toThrowError(PerfError);
    expect(() => timeline.add({ name: '', at: 1 })).toThrowError(PerfError);
  });

  it('parseMarkerTrace 接受数组与 { markers } 两种形状', () => {
    const fromArray = parseMarkerTrace([{ name: 'a', at: 1, category: 'startup' }]);
    expect(fromArray.require('a')).toEqual({ name: 'a', at: 1, category: 'startup' });
    const fromObject = parseMarkerTrace({ markers: [{ name: 'b', at: 2 }] });
    expect(fromObject.first('b')?.at).toBe(2);
  });

  it('parseMarkerTrace 拒绝非法形状与字段', () => {
    expect(() => parseMarkerTrace(null)).toThrowError(PerfError);
    expect(() => parseMarkerTrace({ markers: [{ name: 'a' }] })).toThrowError(PerfError);
    expect(() => parseMarkerTrace({ markers: [{ at: 1 }] })).toThrowError(PerfError);
    expect(() => parseMarkerTrace({ markers: [{ name: 'a', at: 1, category: 7 }] })).toThrowError(
      PerfError
    );
  });

  it('toJSON 输出副本，外部修改不影响时间线', () => {
    const timeline = timelineFromMarkers([{ name: 'a', at: 1 }]);
    const exported = timeline.toJSON();
    expect(exported).toEqual([{ name: 'a', at: 1 }]);
    expect(timeline.markers()).not.toBe(exported);
  });
});
