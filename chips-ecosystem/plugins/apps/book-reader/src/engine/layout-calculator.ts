import type { ReadingMode, ResponsiveLayout, SectionKind, WindowBreakpoint } from './types';

export interface LayoutCalculatorInput {
  viewportWidth: number;
  viewportHeight: number;
  preferredContentWidth: number;
  readingMode: ReadingMode;
  sectionKind: SectionKind;
  fontScale: number;
}

export type LayoutCalculatorOutput = ResponsiveLayout;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampRounded(value: number, minimum: number, maximum: number): number {
  return Math.round(clamp(value, minimum, maximum));
}

function resolveWindowBreakpoint(viewportWidth: number): WindowBreakpoint {
  if (viewportWidth < 640) {
    return 'compact';
  }
  if (viewportWidth < 1024) {
    return 'medium';
  }
  if (viewportWidth < 1440) {
    return 'expanded';
  }
  return 'large';
}

function resolveVerticalPadding(
  viewportHeight: number,
  sectionKind: SectionKind
): { top: number; bottom: number } {
  if (sectionKind !== 'chapter') {
    const inset = clampRounded(viewportHeight * 0.04, 12, 32);
    return {
      top: inset,
      bottom: inset,
    };
  }

  return {
    top: clampRounded(viewportHeight * 0.06, 28, 88),
    bottom: clampRounded(viewportHeight * 0.08, 32, 96),
  };
}

export function computeLayout(input: LayoutCalculatorInput): LayoutCalculatorOutput {
  const viewportWidth = clampRounded(input.viewportWidth || 0, 320, 4096);
  const viewportHeight = clampRounded(input.viewportHeight || 0, 320, 4096);
  const preferredContentWidth = clampRounded(input.preferredContentWidth || 760, 560, 980);
  const fontScale = clamp(input.fontScale || 1, 0.85, 1.4);
  const windowBreakpoint = resolveWindowBreakpoint(viewportWidth);
  const isChapterSection = input.sectionKind === 'chapter';

  const gutterMaximum =
    windowBreakpoint === 'compact'
      ? 24
      : windowBreakpoint === 'medium'
        ? 34
        : windowBreakpoint === 'expanded'
          ? 48
          : 56;
  const pageGutterPx = clampRounded(
    viewportWidth * (isChapterSection ? 0.038 : 0.026),
    18,
    gutterMaximum
  );
  const baseColumnGapPx = clampRounded(viewportWidth * 0.03, 20, 44);

  // 字号越大，单页理想行长略微收窄，避免字符数过多造成阅读疲劳。
  const preferredMeasurePx = clampRounded(preferredContentWidth / fontScale, 320, 1040);
  const spreadThresholdPx = preferredMeasurePx * 1.42 + baseColumnGapPx + pageGutterPx * 2;
  const shouldUseSpread =
    input.readingMode === 'paginated' &&
    isChapterSection &&
    windowBreakpoint !== 'compact' &&
    viewportWidth >= Math.max(1024, Math.round(spreadThresholdPx));
  const columnGapPx = shouldUseSpread ? baseColumnGapPx : 0;
  const spreadWidthPx = viewportWidth;

  const availableWidthPx = shouldUseSpread
    ? viewportWidth - pageGutterPx * 2 - columnGapPx
    : viewportWidth - pageGutterPx * 2;
  const pageWidthPx = shouldUseSpread
    ? clampRounded(availableWidthPx / 2, 320, viewportWidth)
    : clampRounded(availableWidthPx, 360, viewportWidth);

  const effectiveContentWidth = isChapterSection
    ? clampRounded(pageWidthPx - pageGutterPx * 0.45, 320, pageWidthPx)
    : clampRounded(pageWidthPx, 320, pageWidthPx);
  const maxLineLengthPx = isChapterSection
    ? clampRounded(Math.min(preferredMeasurePx, effectiveContentWidth), 320, pageWidthPx)
    : clampRounded(Math.min(pageWidthPx, viewportWidth - pageGutterPx), 320, pageWidthPx);
  const illustrationWidthPx = isChapterSection
    ? clampRounded(
        Math.min(
          viewportWidth - pageGutterPx * 2,
          Math.max(pageWidthPx, effectiveContentWidth + pageGutterPx)
        ),
        320,
        viewportWidth
      )
    : clampRounded(viewportWidth - pageGutterPx, 320, viewportWidth);

  return {
    forcedColCount: shouldUseSpread ? '2' : '1',
    pageWidthPx,
    pageGutterPx,
    columnGapPx,
    maxLineLengthPx,
    illustrationWidthPx,
    shouldUseSpread,
    spreadWidthPx,
    effectiveContentWidth,
    windowBreakpoint,
    verticalPadding: resolveVerticalPadding(viewportHeight, input.sectionKind),
  };
}
