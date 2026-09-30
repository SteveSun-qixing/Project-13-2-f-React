/**
 * 分页引擎。
 *
 * 负责分页模式下的所有度量、翻页偏移计算、spread 对齐和边界检测。
 *
 * **核心修复**：使用基于 spread 索引的绝对定位（`spreadIndex × spreadWidth`），
 * 而非旧实现中的相对偏移累加（`current ± viewportUnit`），彻底消除连续翻页
 * 时 `Math.ceil` / `Math.floor` 引入的舍入误差累积。
 */

import type {
  DocumentDirectionality,
  PageDirection,
  PaginationMetrics,
  ReadingBoundary,
} from './types';

import { resolveDocumentScrollingElement } from '../core/dom';

// ─── 内部常量 ─────────────────────────────────────────────────

/**
 * 子像素容差。
 *
 * 浏览器可能在 scroll 偏移上产生小于 1px 的子像素渲染偏差，
 * `resolveSpreadIndex` 用 `Math.round` 化解；此容差用于边界比较。
 */
const SUB_PIXEL_TOLERANCE = 2;

// ─── 辅助：获取滚动根 ────────────────────────────────────────

function resolveScrollingElement(document: Document): HTMLElement {
  return resolveDocumentScrollingElement(document);
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeFloat(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function resolveColumnLayoutMetrics(
  document: Document,
  scrollElement: HTMLElement
): { columnCount: number; columnGap: number } {
  const view = document.defaultView;
  if (!view) {
    return { columnCount: 1, columnGap: 0 };
  }

  const candidates = [scrollElement, document.documentElement, document.body].filter(
    (value): value is HTMLElement => Boolean(value)
  );

  let columnCount = 1;
  let columnGap = 0;

  for (const candidate of candidates) {
    const style = view.getComputedStyle(candidate);
    const parsedCount =
      parsePositiveInteger(style.getPropertyValue('column-count')) ??
      parsePositiveInteger(style.columnCount);
    const parsedGap =
      parseNonNegativeFloat(style.getPropertyValue('column-gap')) ??
      parseNonNegativeFloat(style.columnGap);

    if (parsedCount !== null) {
      columnCount = Math.max(columnCount, parsedCount);
    }
    if (parsedGap !== null) {
      columnGap = Math.max(columnGap, parsedGap);
    }
  }

  return { columnCount, columnGap };
}

// ─── PaginationEngine ────────────────────────────────────────

export class PaginationEngine {
  // ─── 度量 ───────────────────────────────────────────────────

  /**
   * 对当前 iframe 文档做分页度量。
   *
   * @returns 描述 CSS column 分页状态的 `PaginationMetrics`。
   *          其中 `currentSpreadIndex` 固定返回 0，由调用方填充。
   */
  measure(document: Document, directionality: DocumentDirectionality): PaginationMetrics {
    const scrollEl = resolveScrollingElement(document);
    const viewportSpan = Math.max(
      1,
      directionality.isVertical
        ? scrollEl.clientHeight || scrollEl.offsetHeight
        : scrollEl.clientWidth || scrollEl.offsetWidth
    );
    const contentSpan = Math.max(
      viewportSpan,
      directionality.isVertical ? scrollEl.scrollHeight : scrollEl.scrollWidth
    );
    const { columnCount: colCount, columnGap: colGap } = resolveColumnLayoutMetrics(
      document,
      scrollEl
    );
    const spreadAdvancePx = viewportSpan + colGap;

    // 单列宽度 = (offsetWidth - (colCount - 1) * colGap) / colCount
    const colWidth =
      colCount > 1 ? (viewportSpan - (colCount - 1) * colGap) / colCount : viewportSpan;

    // 最大可滚动偏移
    const maxScrollOffset = Math.max(0, contentSpan - viewportSpan);
    const spreadCount =
      maxScrollOffset > 0 ? Math.ceil(maxScrollOffset / Math.max(1, spreadAdvancePx)) + 1 : 1;

    return {
      totalColumns: colCount * spreadCount,
      columnsPerSpread: colCount,
      spreadCount,
      currentSpreadIndex: 0,
      spreadWidthPx: viewportSpan,
      spreadAdvancePx,
      columnWidthPx: colWidth,
      columnGapPx: colGap,
      totalScrollableWidth: contentSpan,
      maxScrollOffset,
    };
  }

  // ─── 翻页（基于 spread 索引，非相对偏移） ──────────────────

  /**
   * 根据当前 spread 索引和翻页方向，计算目标 spread 的绝对像素偏移。
   *
   * 核心策略：`targetOffset = targetIndex × spreadAdvance`。
   * 由于每次都从索引计算绝对位置，不存在舍入误差累积。
   */
  computeTargetOffset(
    currentIndex: number,
    direction: PageDirection,
    metrics: PaginationMetrics
  ): { targetIndex: number; targetOffset: number } {
    const targetIndex =
      direction === 'next'
        ? Math.min(currentIndex + 1, metrics.spreadCount - 1)
        : Math.max(currentIndex - 1, 0);

    // 绝对定位：targetOffset = targetIndex × spreadAdvance
    // clamp 到 maxScrollOffset，避免超出
    const targetOffset = Math.min(targetIndex * metrics.spreadAdvancePx, metrics.maxScrollOffset);

    return { targetIndex, targetOffset };
  }

  // ─── 从当前滚动位置反推 spread 索引 ────────────────────────

  /**
   * 从 scroll 偏移量反推当前 spread 索引。
   *
   * 使用 `Math.round` 而非 ceil/floor，因为 scroll 偏移可能因子像素
   * 渲染有微小偏差，round 可以容忍 ±0.5 spread 的抖动。
   */
  resolveSpreadIndex(scrollOffset: number, spreadAdvance: number): number {
    if (spreadAdvance <= 0) {
      return 0;
    }
    return Math.max(0, Math.round(scrollOffset / spreadAdvance));
  }

  // ─── 对齐到最近的 spread 边界 ──────────────────────────────

  /**
   * 将任意 scroll 偏移对齐到最近的 spread 边界。
   *
   * 对齐结果 = `round(offset / spreadWidth) × spreadWidth`。
   */
  snapToSpread(scrollOffset: number, spreadAdvance: number): number {
    if (spreadAdvance <= 0) {
      return Math.max(0, scrollOffset);
    }
    return Math.max(0, Math.round(scrollOffset / spreadAdvance) * spreadAdvance);
  }

  // ─── 边界检测 ──────────────────────────────────────────────

  /**
   * 检测当前 scroll 偏移是否已处于章节边界。
   *
   * @param direction — `"previous"` 检测章节开头，`"next"` 检测章节末尾。
   */
  isAtBoundary(
    scrollOffset: number,
    metrics: PaginationMetrics,
    direction: PageDirection
  ): boolean {
    if (direction === 'previous') {
      return scrollOffset <= SUB_PIXEL_TOLERANCE;
    }

    return scrollOffset >= Math.max(0, metrics.maxScrollOffset - SUB_PIXEL_TOLERANCE);
  }

  // ─── 跳转到指定 spread ────────────────────────────────────

  /**
   * 计算跳转到指定 spread 索引时的绝对 scroll 偏移。
   *
   * @returns clamp 后的安全偏移值。
   */
  computeOffsetForSpread(spreadIndex: number, spreadAdvance: number, maxOffset: number): number {
    const safeIndex = Math.max(0, spreadIndex);
    return Math.max(0, Math.min(safeIndex * spreadAdvance, maxOffset));
  }

  // ─── 跳转到边界 ──────────────────────────────────────────

  /**
   * 计算跳转到章节首（start）或尾（end）的 scroll 偏移。
   */
  computeOffsetForBoundary(boundary: ReadingBoundary, metrics: PaginationMetrics): number {
    return boundary === 'start' ? 0 : metrics.maxScrollOffset;
  }

  // ─── 从 fragment 元素位置反推目标 spread ────────────────────

  /**
   * 根据 fragment 目标元素的布局位置计算其所在的 spread 索引。
   *
   * 使用 `element.getBoundingClientRect()` 加 scroll 偏移换算。
   */
  resolveFragmentSpread(element: Element, spreadAdvance: number): number {
    if (spreadAdvance <= 0) {
      return 0;
    }

    const ownerDoc = element.ownerDocument;
    const scrollEl = resolveScrollingElement(ownerDoc);
    const currentScroll = Math.abs(scrollEl.scrollLeft);
    const rect = element.getBoundingClientRect();

    // 元素相对于文档起始位置的绝对偏移 = rect.left + currentScroll
    // （LTR 场景；RTL 需要镜像，但 spread 索引计算逻辑相同）
    const absoluteLeft = rect.left + currentScroll;

    return Math.max(0, Math.round(absoluteLeft / spreadAdvance));
  }
}
