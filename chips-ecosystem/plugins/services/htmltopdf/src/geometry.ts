/**
 * HTML 转 PDF 服务：打印几何。
 *
 * 纸张规格 → 页面尺寸（毫米）→ 方向互换 → 边距钳制 → 可打印区
 * （扣除页边距与页眉页脚预留）→ 毫米 ↔ CSS 像素换算（96dpi）。
 */

import { inputUnsupported } from './errors.js';
import type {
  INormalizedHtmlToPdfOptions,
  IPaginationResult,
  IPdfMargins,
  IPrintGeometry,
  IPageSizeMm,
} from './types.js';

/** 纸张规格基线尺寸（毫米，纵向）。 */
export const PAGE_SIZES_MM: Readonly<Record<string, IPageSizeMm>> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
};

const MM_PER_INCH = 25.4;
const CSS_PX_PER_INCH = 96;

/** 毫米 → CSS 像素（96dpi）。 */
export function mmToCssPx(mm: number): number {
  return (mm / MM_PER_INCH) * CSS_PX_PER_INCH;
}

/** CSS 像素 → 毫米（96dpi）。 */
export function cssPxToMm(px: number): number {
  return (px / CSS_PX_PER_INCH) * MM_PER_INCH;
}

/** 校验边距（毫米）：每边必须为有限数且在 [0, 50] 内。 */
export function clampMargins(margins: IPdfMargins): IPdfMargins {
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const value = margins[side];
    if (!Number.isFinite(value) || value < 0 || value > 50) {
      throw inputUnsupported(`页边距 ${side} 超出范围 [0, 50] 毫米。`, {
        field: `options.margins.${side}`,
      });
    }
  }
  return margins;
}

/**
 * 解析打印几何：
 * - 页面尺寸按规格基线取值，横向时宽高互换；
 * - 可打印区 = 页面尺寸 − 页边距 − 页眉页脚预留（启用时）；
 * - 任一方向可打印区非正即输入不支持。
 */
export function resolvePrintGeometry(options: INormalizedHtmlToPdfOptions): IPrintGeometry {
  const base = PAGE_SIZES_MM[options.pageSize];
  if (typeof base === 'undefined') {
    throw inputUnsupported('未知纸张规格。', { field: 'options.pageSize' });
  }
  const pageSizeMm: IPageSizeMm = options.landscape
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height };
  const marginMm = clampMargins(options.margins);

  const headerMm = options.headerFooter.enabled ? options.headerFooter.headerHeightMm : 0;
  const footerMm = options.headerFooter.enabled ? options.headerFooter.footerHeightMm : 0;
  const printableWidth = pageSizeMm.width - marginMm.left - marginMm.right;
  const printableHeight =
    pageSizeMm.height - marginMm.top - marginMm.bottom - headerMm - footerMm;
  if (printableWidth <= 0 || printableHeight <= 0) {
    throw inputUnsupported('页边距与页眉页脚预留超出页面尺寸，可打印区非正。', {
      field: 'options.margins',
      reason: 'PRINTABLE_AREA_NON_POSITIVE',
      printableWidthMm: Number(printableWidth.toFixed(3)),
      printableHeightMm: Number(printableHeight.toFixed(3)),
    });
  }

  return {
    pageSizeMm,
    marginMm,
    printableAreaMm: { width: printableWidth, height: printableHeight },
    landscape: options.landscape,
  };
}

/** 可打印区高（CSS 像素）：分页预估器的输入。 */
export function printableHeightPx(geometry: IPrintGeometry): number {
  return mmToCssPx(geometry.printableAreaMm.height);
}

/** 分页预估结果 → 预估页数（无分页预估时为 null）。 */
export function paginationHintPageCount(
  pagination: IPaginationResult | null
): number | null {
  return pagination ? pagination.pageCount : null;
}
