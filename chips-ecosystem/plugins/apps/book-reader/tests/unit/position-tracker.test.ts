// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { PositionTracker } from '../../src/engine/position-tracker';
import type {
  DocumentDirectionality,
  PaginationMetrics,
  ScrollMetrics,
} from '../../src/engine/types';

const HORIZONTAL_LTR: DocumentDirectionality = {
  isVertical: false,
  isRtl: false,
};

function createReaderDocument(input: {
  offsetWidth?: number;
  clientWidth?: number;
  scrollWidth?: number;
  scrollLeft?: number;
  clientHeight?: number;
  scrollHeight?: number;
  scrollTop?: number;
  columnCount?: string;
  columnGap?: string;
}): Document {
  const document = window.document.implementation.createHTMLDocument('reader');
  const root = document.documentElement;
  Object.defineProperty(document, 'defaultView', {
    configurable: true,
    value: window,
  });
  root.style.columnCount = input.columnCount ?? '';
  root.style.columnGap = input.columnGap ?? '';

  Object.defineProperty(document, 'scrollingElement', {
    configurable: true,
    value: root,
  });
  Object.defineProperty(root, 'offsetWidth', {
    configurable: true,
    value: input.offsetWidth ?? 1440,
  });
  Object.defineProperty(root, 'clientWidth', {
    configurable: true,
    value: input.clientWidth ?? input.offsetWidth ?? 1440,
  });
  Object.defineProperty(root, 'scrollWidth', {
    configurable: true,
    value: input.scrollWidth ?? 4320,
  });
  Object.defineProperty(root, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: input.scrollLeft ?? 0,
  });
  Object.defineProperty(root, 'clientHeight', {
    configurable: true,
    value: input.clientHeight ?? 900,
  });
  Object.defineProperty(root, 'scrollHeight', {
    configurable: true,
    value: input.scrollHeight ?? 2700,
  });
  Object.defineProperty(root, 'scrollTop', {
    configurable: true,
    writable: true,
    value: input.scrollTop ?? 0,
  });

  return document;
}

describe('PositionTracker', () => {
  it('分页模式会捕获 spread 索引并在同尺寸视口中恢复到原位置', () => {
    const tracker = new PositionTracker();
    const document = createReaderDocument({
      offsetWidth: 1440,
      scrollWidth: 4320,
      scrollLeft: 1440,
    });

    const anchor = tracker.captureAnchor(document, 'paginated', HORIZONTAL_LTR);
    expect(anchor.spreadIndex).toBe(1);
    expect(anchor.spreadFraction).toBe(0.5);

    const restored = tracker.restoreAnchor(anchor, document, 'paginated', HORIZONTAL_LTR);
    expect(restored).toBe(1440);
  });

  it('分页模式在窗口缩放后会按 spreadFraction 映射到新 spread', () => {
    const tracker = new PositionTracker();
    const previousDocument = createReaderDocument({
      offsetWidth: 1440,
      scrollWidth: 4320,
      scrollLeft: 1440,
    });
    const resizedDocument = createReaderDocument({
      offsetWidth: 960,
      scrollWidth: 4800,
      scrollLeft: 0,
    });

    const anchor = tracker.captureAnchor(previousDocument, 'paginated', HORIZONTAL_LTR);
    const restored = tracker.restoreAnchor(anchor, resizedDocument, 'paginated', HORIZONTAL_LTR);
    expect(restored).toBe(1920);
  });

  it('双页 spread 会把 columnGap 计入锚点捕获与恢复', () => {
    const tracker = new PositionTracker();
    const document = createReaderDocument({
      offsetWidth: 1440,
      clientWidth: 1440,
      scrollWidth: 4400,
      scrollLeft: 1480,
      columnCount: '2',
      columnGap: '40px',
    });

    const anchor = tracker.captureAnchor(document, 'paginated', HORIZONTAL_LTR);
    expect(anchor.spreadIndex).toBe(1);

    const restored = tracker.restoreAnchor(anchor, document, 'paginated', HORIZONTAL_LTR);
    expect(restored).toBe(1480);
  });

  it('滚动模式会保存并恢复滚动比例', () => {
    const tracker = new PositionTracker();
    const document = createReaderDocument({
      clientHeight: 800,
      scrollHeight: 2800,
      scrollTop: 1000,
    });

    const anchor = tracker.captureAnchor(document, 'scroll', HORIZONTAL_LTR);
    expect(anchor.scrollFraction).toBeCloseTo(0.5, 3);

    const restored = tracker.restoreAnchor(anchor, document, 'scroll', HORIZONTAL_LTR);
    expect(restored).toBe(1000);
  });

  it('会根据当前模式和章节位置计算全书进度', () => {
    const tracker = new PositionTracker();
    const metrics: PaginationMetrics = {
      totalColumns: 4,
      columnsPerSpread: 1,
      spreadCount: 4,
      currentSpreadIndex: 1,
      spreadWidthPx: 1000,
      spreadAdvancePx: 1000,
      columnWidthPx: 1000,
      columnGapPx: 0,
      totalScrollableWidth: 4000,
      maxScrollOffset: 3000,
    };

    tracker.update(1, metrics, 'paginated');

    const progress = tracker.computeProgress(1, 3, '第二章');
    expect(progress.currentPage).toBe(2);
    expect(progress.totalPages).toBe(4);
    expect(progress.bookFraction).toBeCloseTo((1 + 1 / 3) / 3, 3);
    expect(progress.bookPercentage).toBe(44);
  });

  it('带权重时会按章节权重分配全书进度', () => {
    const tracker = new PositionTracker();
    const metrics: ScrollMetrics = {
      scrollOffset: 750,
      maxScrollOffset: 1500,
      viewportSize: 900,
      contentSize: 2400,
      scrollFraction: 0.5,
    };

    tracker.update(0, metrics, 'scroll');

    const progress = tracker.computeProgress(1, 3, '第二章', [1, 4, 1]);
    expect(progress.sectionFraction).toBe(0.5);
    expect(progress.bookFraction).toBeCloseTo(0.5, 3);
    expect(progress.bookPercentage).toBe(50);
  });
});
