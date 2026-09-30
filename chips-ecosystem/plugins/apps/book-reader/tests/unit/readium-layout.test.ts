import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/engine/layout-calculator';
import { PaginationEngine } from '../../src/engine/pagination-engine';

describe('reader layout', () => {
  it('正文分页会在足够宽的窗口启用双页 spread', () => {
    expect(
      computeLayout({
        viewportWidth: 1440,
        viewportHeight: 960,
        preferredContentWidth: 760,
        readingMode: 'paginated',
        sectionKind: 'chapter',
        fontScale: 1,
      })
    ).toMatchObject({
      forcedColCount: '2',
      shouldUseSpread: true,
      windowBreakpoint: 'large',
    });
  });

  it('插图页和窄窗口会保持单页布局', () => {
    expect(
      computeLayout({
        viewportWidth: 1440,
        viewportHeight: 960,
        preferredContentWidth: 760,
        readingMode: 'paginated',
        sectionKind: 'cover',
        fontScale: 1,
      })
    ).toMatchObject({
      forcedColCount: '1',
      shouldUseSpread: false,
    });

    expect(
      computeLayout({
        viewportWidth: 880,
        viewportHeight: 900,
        preferredContentWidth: 760,
        readingMode: 'paginated',
        sectionKind: 'chapter',
        fontScale: 1,
      })
    ).toMatchObject({
      forcedColCount: '1',
      shouldUseSpread: false,
      windowBreakpoint: 'medium',
    });
  });

  it('分页目标偏移会基于 spread 索引绝对计算，避免累积漂移', () => {
    const engine = new PaginationEngine();
    expect(
      engine.computeTargetOffset(65, 'next', {
        totalColumns: 66,
        columnsPerSpread: 1,
        spreadCount: 66,
        currentSpreadIndex: 65,
        spreadWidthPx: 1440,
        spreadAdvancePx: 1440,
        columnWidthPx: 1440,
        columnGapPx: 0,
        totalScrollableWidth: 95040,
        maxScrollOffset: 93600,
      })
    ).toEqual({
      targetIndex: 65,
      targetOffset: 93600,
    });

    expect(engine.computeOffsetForSpread(10, 1440, 93600)).toBe(14400);
  });
});
