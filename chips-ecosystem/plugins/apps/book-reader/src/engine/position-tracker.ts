import type {
  DocumentDirectionality,
  PaginationMetrics,
  ReadingMode,
  ReadingPositionAnchor,
  ReadingProgress,
  ScrollMetrics,
} from './types';

import { resolveDocumentScrollingElement } from '../core/dom';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeFloat(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function resolveColumnGap(document: Document, scrollElement: HTMLElement): number {
  const view = document.defaultView;
  if (!view) {
    return 0;
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

  return columnCount > 0 ? columnGap : 0;
}

function resolvePaginatedSnapshot(
  document: Document,
  directionality: DocumentDirectionality
): {
  spreadSize: number;
  spreadAdvance: number;
  contentSize: number;
  currentOffset: number;
  maxOffset: number;
  totalSpreads: number;
} {
  const scrollElement = resolveDocumentScrollingElement(document);
  const spreadSize = Math.max(
    1,
    directionality.isVertical
      ? scrollElement.clientHeight || scrollElement.offsetHeight
      : scrollElement.clientWidth || scrollElement.offsetWidth
  );
  const columnGap = resolveColumnGap(document, scrollElement);
  const spreadAdvance = spreadSize + columnGap;
  const contentSize = Math.max(
    spreadSize,
    directionality.isVertical ? scrollElement.scrollHeight : scrollElement.scrollWidth
  );
  const currentOffset = directionality.isVertical
    ? Math.max(0, scrollElement.scrollTop)
    : Math.max(0, Math.abs(scrollElement.scrollLeft));
  const maxOffset = Math.max(0, contentSize - spreadSize);
  const totalSpreads = maxOffset > 0 ? Math.ceil(maxOffset / spreadAdvance) + 1 : 1;

  return {
    spreadSize,
    spreadAdvance,
    contentSize,
    currentOffset,
    maxOffset,
    totalSpreads,
  };
}

function resolveScrollSnapshot(
  document: Document,
  directionality: DocumentDirectionality
): {
  currentOffset: number;
  maxOffset: number;
} {
  const scrollElement = resolveDocumentScrollingElement(document);

  if (directionality.isVertical) {
    const currentOffset = Math.max(0, Math.abs(scrollElement.scrollLeft));
    const maxOffset = Math.max(0, scrollElement.scrollWidth - scrollElement.clientWidth);
    return { currentOffset, maxOffset };
  }

  const currentOffset = Math.max(0, scrollElement.scrollTop);
  const maxOffset = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
  return { currentOffset, maxOffset };
}

export class PositionTracker {
  private currentAnchor: ReadingPositionAnchor = {
    spreadIndex: 0,
    spreadFraction: 0,
    scrollFraction: 0,
  };

  private currentMode: ReadingMode = 'paginated';
  private totalPages = 1;

  public initialize(
    mode: ReadingMode,
    document: Document,
    directionality: DocumentDirectionality
  ): void {
    this.currentMode = mode;
    this.currentAnchor = this.captureAnchor(document, mode, directionality);
    this.totalPages = mode === 'paginated' ? Math.max(1, this.currentAnchor.spreadIndex + 1) : 0;
  }

  public captureAnchor(
    document: Document,
    mode: ReadingMode,
    directionality: DocumentDirectionality
  ): ReadingPositionAnchor {
    if (mode === 'paginated') {
      const snapshot = resolvePaginatedSnapshot(document, directionality);
      const spreadIndex =
        snapshot.spreadAdvance > 0
          ? Math.round(snapshot.currentOffset / snapshot.spreadAdvance)
          : 0;
      const spreadFraction =
        snapshot.totalSpreads > 1 ? spreadIndex / (snapshot.totalSpreads - 1) : 0;
      const scrollFraction =
        snapshot.maxOffset > 0 ? snapshot.currentOffset / snapshot.maxOffset : 0;

      return {
        spreadIndex,
        spreadFraction: clamp(spreadFraction, 0, 1),
        scrollFraction: clamp(scrollFraction, 0, 1),
      };
    }

    const snapshot = resolveScrollSnapshot(document, directionality);
    const scrollFraction = snapshot.maxOffset > 0 ? snapshot.currentOffset / snapshot.maxOffset : 0;

    return {
      spreadIndex: 0,
      spreadFraction: clamp(scrollFraction, 0, 1),
      scrollFraction: clamp(scrollFraction, 0, 1),
    };
  }

  public restoreAnchor(
    anchor: ReadingPositionAnchor,
    document: Document,
    mode: ReadingMode,
    directionality: DocumentDirectionality
  ): number {
    if (mode === 'paginated') {
      const snapshot = resolvePaginatedSnapshot(document, directionality);
      if (snapshot.maxOffset <= 0) {
        return 0;
      }

      const mappedSpreadIndex =
        snapshot.totalSpreads > 1
          ? Math.round(clamp(anchor.spreadFraction, 0, 1) * (snapshot.totalSpreads - 1))
          : clamp(anchor.spreadIndex, 0, snapshot.totalSpreads - 1);

      return clamp(mappedSpreadIndex * snapshot.spreadAdvance, 0, snapshot.maxOffset);
    }

    const snapshot = resolveScrollSnapshot(document, directionality);
    return clamp(
      Math.round(clamp(anchor.scrollFraction, 0, 1) * snapshot.maxOffset),
      0,
      snapshot.maxOffset
    );
  }

  public update(
    spreadIndex: number,
    metrics: PaginationMetrics | ScrollMetrics,
    mode: ReadingMode
  ): void {
    this.currentMode = mode;

    if (mode === 'paginated') {
      const paginationMetrics = metrics as PaginationMetrics;
      const normalizedSpreadIndex = clamp(
        spreadIndex,
        0,
        Math.max(0, paginationMetrics.spreadCount - 1)
      );
      const targetOffset = Math.min(
        normalizedSpreadIndex * paginationMetrics.spreadAdvancePx,
        paginationMetrics.maxScrollOffset
      );

      this.currentAnchor = {
        spreadIndex: normalizedSpreadIndex,
        spreadFraction:
          paginationMetrics.spreadCount > 1
            ? normalizedSpreadIndex / (paginationMetrics.spreadCount - 1)
            : 0,
        scrollFraction:
          paginationMetrics.maxScrollOffset > 0
            ? targetOffset / paginationMetrics.maxScrollOffset
            : 0,
      };
      this.totalPages = Math.max(1, paginationMetrics.spreadCount);
      return;
    }

    const scrollMetrics = metrics as ScrollMetrics;
    this.currentAnchor = {
      spreadIndex: 0,
      spreadFraction: clamp(scrollMetrics.scrollFraction, 0, 1),
      scrollFraction: clamp(scrollMetrics.scrollFraction, 0, 1),
    };
    this.totalPages = 0;
  }

  public getCurrentAnchor(): ReadingPositionAnchor {
    return this.currentAnchor;
  }

  public computeProgress(
    sectionIndex: number,
    sectionCount: number,
    sectionTitle: string,
    sectionWeights?: number[]
  ): ReadingProgress {
    const safeSectionCount = Math.max(1, sectionCount);
    const safeSectionIndex = clamp(sectionIndex, 0, safeSectionCount - 1);
    const sectionFraction = clamp(
      this.currentMode === 'paginated'
        ? this.currentAnchor.spreadFraction
        : this.currentAnchor.scrollFraction,
      0,
      1
    );

    let bookFraction: number;
    if (Array.isArray(sectionWeights) && sectionWeights.length === safeSectionCount) {
      const totalWeight = sectionWeights.reduce((sum, item) => sum + Math.max(0, item), 0);
      const beforeWeight = sectionWeights
        .slice(0, safeSectionIndex)
        .reduce((sum, item) => sum + Math.max(0, item), 0);
      const currentWeight = Math.max(0, sectionWeights[safeSectionIndex] ?? 0);

      bookFraction =
        totalWeight > 0
          ? (beforeWeight + currentWeight * sectionFraction) / totalWeight
          : (safeSectionIndex + sectionFraction) / safeSectionCount;
    } else {
      bookFraction = (safeSectionIndex + sectionFraction) / safeSectionCount;
    }

    return {
      readingMode: this.currentMode,
      sectionIndex: safeSectionIndex,
      sectionCount: safeSectionCount,
      sectionTitle,
      sectionFraction,
      bookFraction: clamp(bookFraction, 0, 1),
      bookPercentage: Math.round(clamp(bookFraction, 0, 1) * 100),
      currentPage: this.currentMode === 'paginated' ? this.currentAnchor.spreadIndex + 1 : 0,
      totalPages: this.currentMode === 'paginated' ? this.totalPages : 0,
    };
  }
}
