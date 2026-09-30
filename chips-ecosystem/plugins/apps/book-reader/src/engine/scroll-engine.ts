/**
 * 滚动引擎。
 *
 * 负责滚动模式下的度量、滚动目标计算、边界检测和 fragment 定位。
 *
 * 与 `PaginationEngine` 互为独立——`DocumentController` 根据当前
 * `readingMode` 选择委托给哪一个引擎。
 */

import type {
  DocumentDirectionality,
  PageDirection,
  ReadingBoundary,
  ScrollMetrics,
} from './types';

import { resolveDocumentScrollingElement } from '../core/dom';

// ─── 内部常量 ─────────────────────────────────────────────────

/** 边界检测阈值占视口尺寸的比例（4%）。 */
const BOUNDARY_THRESHOLD_RATIO = 0.04;

/** 边界检测最小阈值像素值。 */
const MIN_BOUNDARY_THRESHOLD_PX = 24;

// ─── ScrollEngine ────────────────────────────────────────────

export class ScrollEngine {
  // ─── 度量 ───────────────────────────────────────────────────

  /**
   * 对当前 iframe 文档做滚动模式度量。
   *
   * 滚动模式下：
   * - 横排文本（LTR/RTL）纵向滚动，度量主轴为 Y。
   * - 竖排文本纵向滚动变为横轴滚动，度量主轴为 X。
   */
  measure(document: Document, directionality: DocumentDirectionality): ScrollMetrics {
    const scrollEl = resolveDocumentScrollingElement(document);

    if (directionality.isVertical) {
      // 竖排模式：主滚动轴为水平方向
      const scrollOffset = Math.abs(scrollEl.scrollLeft);
      const viewportSize = scrollEl.clientWidth;
      const contentSize = scrollEl.scrollWidth;
      const maxScrollOffset = Math.max(0, contentSize - viewportSize);
      const scrollFraction = maxScrollOffset > 0 ? scrollOffset / maxScrollOffset : 0;

      return {
        scrollOffset,
        maxScrollOffset,
        viewportSize,
        contentSize,
        scrollFraction: Math.max(0, Math.min(1, scrollFraction)),
      };
    }

    // 常规横排模式：主滚动轴为垂直方向
    const scrollOffset = Math.max(0, scrollEl.scrollTop);
    const viewportSize = scrollEl.clientHeight;
    const contentSize = scrollEl.scrollHeight;
    const maxScrollOffset = Math.max(0, contentSize - viewportSize);
    const scrollFraction = maxScrollOffset > 0 ? scrollOffset / maxScrollOffset : 0;

    return {
      scrollOffset,
      maxScrollOffset,
      viewportSize,
      contentSize,
      scrollFraction: Math.max(0, Math.min(1, scrollFraction)),
    };
  }

  // ─── 滚动进度 ─────────────────────────────────────────────

  /**
   * 计算滚动进度比例。
   *
   * @returns 0–1 之间的线性值。
   */
  computeScrollFraction(scrollOffset: number, maxOffset: number): number {
    if (maxOffset <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(1, scrollOffset / maxOffset));
  }

  // ─── 边界检测（精确版） ────────────────────────────────────

  /**
   * 检测滚动位置是否接近章节边界。
   *
   * 使用视口尺寸的 4%（不低于 24px）作为检测阈值，
   * 比旧实现的固定像素阈值更适应不同屏幕尺寸。
   *
   * @param thresholdPx — 可选的自定义阈值覆盖。
   */
  isNearBoundary(metrics: ScrollMetrics, direction: PageDirection, thresholdPx?: number): boolean {
    const threshold =
      thresholdPx ??
      Math.max(
        MIN_BOUNDARY_THRESHOLD_PX,
        Math.round(metrics.viewportSize * BOUNDARY_THRESHOLD_RATIO)
      );

    if (direction === 'previous') {
      return metrics.scrollOffset <= threshold;
    }

    return metrics.scrollOffset >= Math.max(0, metrics.maxScrollOffset - threshold);
  }

  // ─── 是否精确处于边界 ─────────────────────────────────────

  /**
   * 检测滚动位置是否精确处于边界（容差 1px）。
   */
  isAtBoundary(metrics: ScrollMetrics, boundary: ReadingBoundary): boolean {
    if (boundary === 'start') {
      return metrics.scrollOffset <= 1;
    }
    return metrics.scrollOffset >= Math.max(0, metrics.maxScrollOffset - 1);
  }

  // ─── 滚动目标计算 ─────────────────────────────────────────

  /**
   * 计算施加 `delta` 后的滚动目标位置，同时检测是否到达边界。
   *
   * @returns `target` — clamp 后的安全偏移值；
   *          `reachedBoundary` — 如果到达边界则返回 `"start"` 或 `"end"`，否则 `null`。
   */
  computeScrollTarget(
    current: number,
    delta: number,
    maxOffset: number
  ): { target: number; reachedBoundary: ReadingBoundary | null } {
    const target = Math.max(0, Math.min(current + delta, maxOffset));

    let reachedBoundary: ReadingBoundary | null = null;
    if (target <= 0 && delta < 0) {
      reachedBoundary = 'start';
    } else if (target >= maxOffset && delta > 0) {
      reachedBoundary = 'end';
    }

    return { target, reachedBoundary };
  }

  // ─── 滚动到边界 ──────────────────────────────────────────

  /**
   * 计算跳转到章节首（start）或尾（end）的滚动偏移。
   */
  computeBoundaryOffset(boundary: ReadingBoundary, maxOffset: number): number {
    return boundary === 'start' ? 0 : maxOffset;
  }

  // ─── 从 fragment 计算滚动位置 ─────────────────────────────

  /**
   * 根据 fragment 目标元素的布局位置计算其在滚动轴上的偏移。
   */
  resolveFragmentOffset(element: Element, directionality: DocumentDirectionality): number {
    const ownerDoc = element.ownerDocument;
    const scrollEl = resolveDocumentScrollingElement(ownerDoc);
    const rect = element.getBoundingClientRect();

    if (directionality.isVertical) {
      // 竖排模式：水平滚动
      const currentScroll = Math.abs(scrollEl.scrollLeft);
      return Math.max(0, rect.left + currentScroll);
    }

    // 横排模式：垂直滚动
    const currentScroll = scrollEl.scrollTop;
    return Math.max(0, rect.top + currentScroll);
  }
}
