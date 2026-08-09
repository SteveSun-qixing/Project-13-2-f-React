import type { ReaderReadingMode } from "../../utils/book-reader";

export type ReadiumSectionKind = "chapter" | "illustration" | "full-page-image" | "cover";

export interface ReadiumResponsiveLayoutInput {
  viewportWidth: number;
  preferredContentWidth: number;
  readingMode: ReaderReadingMode;
  sectionKind?: string | null;
}

export interface ReadiumResponsiveLayout {
  forcedColCount: "1" | "2";
  pageWidthPx: number;
  pageGutterPx: number;
  columnGapPx: number;
  maxLineLengthPx: number;
  illustrationWidthPx: number;
  shouldUseSpread: boolean;
}

function clampRounded(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function normalizeSectionKind(value: string | null | undefined): ReadiumSectionKind {
  return value === "illustration" || value === "full-page-image" || value === "cover" ? value : "chapter";
}

export function computeResponsiveReadiumLayout(input: ReadiumResponsiveLayoutInput): ReadiumResponsiveLayout {
  const viewportWidth = clampRounded(input.viewportWidth || 0, 320, 4096);
  const preferredContentWidth = clampRounded(input.preferredContentWidth || 760, 560, 980);
  const sectionKind = normalizeSectionKind(input.sectionKind);
  const pageGutterPx = clampRounded(viewportWidth * 0.038, 18, viewportWidth < 720 ? 28 : 56);
  const columnGapPx = clampRounded(viewportWidth * 0.03, 20, 44);
  const singlePageWidthPx = clampRounded(
    Math.min(preferredContentWidth + pageGutterPx * 2, viewportWidth - pageGutterPx * 2),
    360,
    Math.max(360, viewportWidth - pageGutterPx * 2),
  );
  const spreadThresholdPx = preferredContentWidth * 1.4 + columnGapPx + pageGutterPx * 2;
  const shouldUseSpread =
    input.readingMode === "paginated" &&
    sectionKind === "chapter" &&
    viewportWidth >= Math.max(1024, Math.round(spreadThresholdPx));
  const pageWidthPx = shouldUseSpread
    ? clampRounded((viewportWidth - pageGutterPx * 2 - columnGapPx) / 2, 320, viewportWidth)
    : clampRounded(viewportWidth - pageGutterPx * 2, 360, viewportWidth);
  const maxLineLengthPx = clampRounded(
    Math.min(preferredContentWidth, Math.max(320, pageWidthPx - pageGutterPx)),
    320,
    Math.max(320, pageWidthPx),
  );
  const illustrationWidthPx = clampRounded(viewportWidth - pageGutterPx * 2, 320, viewportWidth);

  return {
    forcedColCount: shouldUseSpread ? "2" : "1",
    pageWidthPx,
    pageGutterPx,
    columnGapPx: shouldUseSpread ? columnGapPx : 0,
    maxLineLengthPx,
    illustrationWidthPx,
    shouldUseSpread,
  };
}
