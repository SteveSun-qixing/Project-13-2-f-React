import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/engine/layout-calculator';

describe('layout-calculator', () => {
  it('正文分页在宽视口下会输出双页 spread 和完整引擎度量', () => {
    expect(
      computeLayout({
        viewportWidth: 1440,
        viewportHeight: 980,
        preferredContentWidth: 760,
        readingMode: 'paginated',
        sectionKind: 'chapter',
        fontScale: 1,
      })
    ).toMatchObject({
      forcedColCount: '2',
      shouldUseSpread: true,
      spreadWidthPx: 1440,
      windowBreakpoint: 'large',
    });
  });

  it('封面和窄窗口会保持单页布局', () => {
    expect(
      computeLayout({
        viewportWidth: 1440,
        viewportHeight: 980,
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
        viewportHeight: 820,
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

  it('更大的字号会收紧正文最大行长', () => {
    const regular = computeLayout({
      viewportWidth: 1720,
      viewportHeight: 900,
      preferredContentWidth: 760,
      readingMode: 'paginated',
      sectionKind: 'chapter',
      fontScale: 1,
    });
    const enlarged = computeLayout({
      viewportWidth: 1720,
      viewportHeight: 900,
      preferredContentWidth: 760,
      readingMode: 'paginated',
      sectionKind: 'chapter',
      fontScale: 1.3,
    });

    expect(enlarged.maxLineLengthPx).toBeLessThan(regular.maxLineLengthPx);
    expect(enlarged.effectiveContentWidth).toBe(regular.effectiveContentWidth);
  });

  it('章节和插图页会得到不同的上下留白策略', () => {
    const chapter = computeLayout({
      viewportWidth: 1024,
      viewportHeight: 900,
      preferredContentWidth: 760,
      readingMode: 'scroll',
      sectionKind: 'chapter',
      fontScale: 1,
    });
    const illustration = computeLayout({
      viewportWidth: 1024,
      viewportHeight: 900,
      preferredContentWidth: 760,
      readingMode: 'scroll',
      sectionKind: 'illustration',
      fontScale: 1,
    });

    expect(chapter.verticalPadding.top).toBeGreaterThan(illustration.verticalPadding.top);
    expect(chapter.verticalPadding.bottom).toBeGreaterThan(illustration.verticalPadding.bottom);
  });
});
