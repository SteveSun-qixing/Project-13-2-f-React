import { PerfError } from './errors';

/** 标记点：一条带时间的阶段边界（毫秒，同一次运行内单调时钟）。 */
export interface PerfMarker {
  readonly name: string;
  readonly at: number;
  readonly category?: string;
}

/** 标记点跨度：同一时间线内两个标记点之间的区间。 */
export interface MarkerSpan {
  readonly from: string;
  readonly to: string;
}

/**
 * 单次运行的标记点时间线。
 *
 * 约束：同一时间线内标记点名称唯一（重复即视为测量协议错误，抛出 `PERF_MARKER_DUPLICATE`），
 * 以保证跨度解析无歧义；多轮测量由每轮独立时间线承担。
 */
export class MarkerTimeline {
  private readonly markerList: PerfMarker[] = [];
  private readonly byName = new Map<string, PerfMarker>();

  /** 追加一个标记点；重复名称或非法时间抛出 `PerfError`。 */
  add(marker: PerfMarker): void {
    if (marker.name.length === 0) {
      throw new PerfError('PERF_INPUT_INVALID', '标记点名称不能为空');
    }
    if (!Number.isFinite(marker.at)) {
      throw new PerfError(
        'PERF_INPUT_INVALID',
        `标记点 ${marker.name} 的时间不是有限数值：${String(marker.at)}`
      );
    }
    if (this.byName.has(marker.name)) {
      throw new PerfError('PERF_MARKER_DUPLICATE', `同一时间线内重复标记点：${marker.name}`);
    }
    const stored: PerfMarker =
      marker.category === undefined
        ? { name: marker.name, at: marker.at }
        : { name: marker.name, at: marker.at, category: marker.category };
    this.markerList.push(stored);
    this.byName.set(stored.name, stored);
  }

  /** 标记点数量。 */
  get size(): number {
    return this.markerList.length;
  }

  /** 按加入顺序返回标记点副本。 */
  markers(): readonly PerfMarker[] {
    return [...this.markerList];
  }

  /** 全部标记点名称。 */
  names(): readonly string[] {
    return this.markerList.map((marker) => marker.name);
  }

  /** 是否存在指定名称的标记点。 */
  has(name: string): boolean {
    return this.byName.has(name);
  }

  /** 取指定名称标记点；不存在返回 `undefined`。 */
  first(name: string): PerfMarker | undefined {
    return this.byName.get(name);
  }

  /** 取指定名称标记点；不存在抛出 `PERF_MARKER_MISSING`。 */
  require(name: string): PerfMarker {
    const marker = this.byName.get(name);
    if (marker === undefined) {
      throw new PerfError('PERF_MARKER_MISSING', `时间线缺少标记点：${name}`);
    }
    return marker;
  }

  /**
   * 计算跨度时长（毫秒）。
   * 起点、终点都必须存在；`from === to` 时返回 0。
   */
  duration(span: MarkerSpan): number {
    const start = this.require(span.from);
    if (span.from === span.to) {
      return 0;
    }
    const end = this.require(span.to);
    if (end.at < start.at) {
      throw new PerfError(
        'PERF_INPUT_INVALID',
        `标记点顺序非法：${span.to}(${String(end.at)}) 早于 ${span.from}(${String(start.at)})`
      );
    }
    return end.at - start.at;
  }

  /** 导出为可序列化结构（按加入顺序）。 */
  toJSON(): readonly PerfMarker[] {
    return this.markers();
  }
}

/** 从标记点数组构建时间线。 */
export function timelineFromMarkers(markers: readonly PerfMarker[]): MarkerTimeline {
  const timeline = new MarkerTimeline();
  for (const marker of markers) {
    timeline.add(marker);
  }
  return timeline;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMarkerEntry(value: unknown, index: number): PerfMarker {
  if (!isRecord(value)) {
    throw new PerfError('PERF_INPUT_INVALID', `标记点[${String(index)}] 不是对象`);
  }
  const name = value['name'];
  const at = value['at'];
  const category = value['category'];
  if (typeof name !== 'string' || name.length === 0) {
    throw new PerfError('PERF_INPUT_INVALID', `标记点[${String(index)}] 缺少合法 name`);
  }
  if (typeof at !== 'number' || !Number.isFinite(at)) {
    throw new PerfError(
      'PERF_INPUT_INVALID',
      `标记点[${String(index)}] 的 at 必须是有限数值（毫秒）`
    );
  }
  if (category !== undefined && typeof category !== 'string') {
    throw new PerfError('PERF_INPUT_INVALID', `标记点[${String(index)}] 的 category 必须是字符串`);
  }
  return category === undefined ? { name, at } : { name, at, category };
}

/**
 * 解析 `CHIPS_TRACE` 导出的标记点 JSON。
 *
 * 接受两种形状：标记点数组，或 `{ "markers": [...] }`；其余形状抛出 `PERF_INPUT_INVALID`。
 */
export function parseMarkerTrace(input: unknown): MarkerTimeline {
  const rawMarkers = Array.isArray(input) ? input : isRecord(input) ? input['markers'] : undefined;
  if (!Array.isArray(rawMarkers)) {
    throw new PerfError('PERF_INPUT_INVALID', '标记点追踪必须是数组或 { markers: [...] } 结构');
  }
  const markers = rawMarkers.map((entry, index) => parseMarkerEntry(entry, index));
  return timelineFromMarkers(markers);
}
