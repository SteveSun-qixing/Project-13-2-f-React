/**
 * Excel 与 Univer 之间的几何单位换算。
 *
 * Excel 文件中：行高以磅（pt）存储，列宽以“标准字体数字宽（MDW）”为单位存储；
 * Univer 中行高与列宽均以像素（px）存储。换算公式遵循 OOXML 官方口径：
 *   px = Trunc(((256 × chars + Trunc(128 / MDW)) / 256) × MDW)
 *   chars = Trunc(((px - 5) / MDW × 100 + 0.5) / 100)
 * 行高按 1pt = 96/72 px 换算。
 */

const DEFAULT_MDW = 7;

export function columnCharsToPixels(chars: number, mdw = DEFAULT_MDW): number {
  return Math.trunc(((256 * chars + Math.trunc(128 / mdw)) / 256) * mdw);
}

export function columnPixelsToChars(pixels: number, mdw = DEFAULT_MDW): number {
  if (pixels <= 5) {
    return 0;
  }
  return Math.trunc(((pixels - 5) / mdw * 100 + 0.5) / 100);
}

export function rowPointsToPixels(points: number): number {
  return Math.round((points * 96) / 72);
}

export function rowPixelsToPoints(pixels: number): number {
  return (pixels * 72) / 96;
}

export const DEFAULT_ROW_HEIGHT_POINTS = 15;
export const DEFAULT_ROW_HEIGHT_PIXELS = rowPointsToPixels(DEFAULT_ROW_HEIGHT_POINTS);
export const DEFAULT_COLUMN_WIDTH_CHARS = 8.43;
export const DEFAULT_COLUMN_WIDTH_PIXELS = columnCharsToPixels(DEFAULT_COLUMN_WIDTH_CHARS);
