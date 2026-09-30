/**
 * 打印几何断言：纸张基线、毫米↔CSS 像素换算、边距钳制、方向互换、
 * 页眉页脚预留扣除、可打印区非正防御与分页预估提示换算。
 */

import { describe, expect, it } from 'vitest';

import { isChipsErrorLike } from '../src/errors.js';
import {
  PAGE_SIZES_MM,
  clampMargins,
  cssPxToMm,
  mmToCssPx,
  paginationHintPageCount,
  printableHeightPx,
  resolvePrintGeometry,
} from '../src/geometry.js';
import { normalizeHtmlToPdfOptions } from '../src/options.js';
import type { INormalizedHtmlToPdfOptions, IPaginationResult, PdfPageSize } from '../src/types.js';

const defaultOptions = (): INormalizedHtmlToPdfOptions => normalizeHtmlToPdfOptions(undefined);

describe('纸张基线与换算', () => {
  it('PAGE_SIZES_MM 与契约登记的四种规格基线一致（毫米，纵向）', () => {
    expect(PAGE_SIZES_MM).toEqual({
      A4: { width: 210, height: 297 },
      A3: { width: 297, height: 420 },
      Letter: { width: 215.9, height: 279.4 },
      Legal: { width: 215.9, height: 355.6 },
    });
  });

  it('毫米 ↔ CSS 像素按 96dpi 换算且互逆', () => {
    expect(mmToCssPx(25.4)).toBe(96);
    expect(cssPxToMm(96)).toBe(25.4);
    expect(mmToCssPx(210)).toBeCloseTo(793.7007874, 4);
    expect(cssPxToMm(mmToCssPx(277))).toBeCloseTo(277, 10);
  });
});

describe('clampMargins', () => {
  it('合法边距原样通过（含边界 0 与 50）', () => {
    const margins = { top: 0, right: 50, bottom: 12.5, left: 3 };
    expect(clampMargins(margins)).toEqual(margins);
  });

  it('每边越界或非有限数按 CONVERTER_INPUT_UNSUPPORTED 拒绝，field 精确到边', () => {
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      for (const value of [-1, 50.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        const margins = { top: 10, right: 10, bottom: 10, left: 10, [side]: value };
        try {
          clampMargins(margins);
          expect.unreachable(`margins.${side}=${String(value)} 应当抛出`);
        } catch (error) {
          expect(isChipsErrorLike(error)).toBe(true);
          expect((error as { code: string }).code).toBe('CONVERTER_INPUT_UNSUPPORTED');
          expect((error as { details?: { field?: string } }).details?.field).toBe(
            `options.margins.${side}`
          );
        }
      }
    }
  });
});

describe('resolvePrintGeometry', () => {
  it('A4 纵向缺省：可打印区 = 页面尺寸 − 四边 10mm', () => {
    const geometry = resolvePrintGeometry(defaultOptions());
    expect(geometry.pageSizeMm).toEqual({ width: 210, height: 297 });
    expect(geometry.marginMm).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
    expect(geometry.printableAreaMm).toEqual({ width: 190, height: 277 });
    expect(geometry.landscape).toBe(false);
  });

  it('横向打印宽高互换，可打印区随之互换', () => {
    const geometry = resolvePrintGeometry(normalizeHtmlToPdfOptions({ landscape: true }));
    expect(geometry.pageSizeMm).toEqual({ width: 297, height: 210 });
    expect(geometry.printableAreaMm).toEqual({ width: 277, height: 190 });
    expect(geometry.landscape).toBe(true);
  });

  it('每种登记规格的纵向可打印区按基线扣除边距', () => {
    expect(resolvePrintGeometry(normalizeHtmlToPdfOptions({ pageSize: 'A3' })).printableAreaMm).toEqual({
      width: 277,
      height: 400,
    });
    expect(
      resolvePrintGeometry(normalizeHtmlToPdfOptions({ pageSize: 'Letter' })).printableAreaMm
    ).toEqual({ width: 195.9, height: 259.4 });
    expect(
      resolvePrintGeometry(normalizeHtmlToPdfOptions({ pageSize: 'Legal' })).printableAreaMm
    ).toEqual({ width: 195.9, height: 335.6 });
  });

  it('启用页眉页脚：预留高度从可打印区高度中扣除', () => {
    const geometry = resolvePrintGeometry(
      normalizeHtmlToPdfOptions({
        headerFooter: { enabled: true, headerHeightMm: 5, footerHeightMm: 8 },
      })
    );
    expect(geometry.printableAreaMm).toEqual({ width: 190, height: 264 });
  });

  it('页眉页脚关闭时预留高度不生效（即使携带高度值）', () => {
    const geometry = resolvePrintGeometry(
      normalizeHtmlToPdfOptions({
        headerFooter: { enabled: false, headerHeightMm: 30, footerHeightMm: 30 },
      })
    );
    expect(geometry.printableAreaMm).toEqual({ width: 190, height: 277 });
  });

  it('未知纸张规格按 CONVERTER_INPUT_UNSUPPORTED 拒绝（防御直连面）', () => {
    const options: INormalizedHtmlToPdfOptions = {
      ...defaultOptions(),
      pageSize: 'B5' as PdfPageSize,
    };
    try {
      resolvePrintGeometry(options);
      expect.unreachable('应当抛出');
    } catch (error) {
      expect((error as { code: string }).code).toBe('CONVERTER_INPUT_UNSUPPORTED');
      expect((error as { details?: { field?: string } }).details?.field).toBe('options.pageSize');
    }
  });

  it('边距越界在几何解析内先被钳制守卫拒绝', () => {
    const options = {
      ...defaultOptions(),
      margins: { top: 60, right: 10, bottom: 10, left: 10 },
    } as INormalizedHtmlToPdfOptions;
    expect(() => resolvePrintGeometry(options)).toThrowError();
  });

  it('可打印区非正按 PRINTABLE_AREA_NON_POSITIVE 收口并携带诊断数值', () => {
    const options: INormalizedHtmlToPdfOptions = {
      ...defaultOptions(),
      headerFooter: { enabled: true, headerHeightMm: 300, footerHeightMm: 0 },
    };
    try {
      resolvePrintGeometry(options);
      expect.unreachable('应当抛出');
    } catch (error) {
      expect((error as { code: string }).code).toBe('CONVERTER_INPUT_UNSUPPORTED');
      expect((error as { details?: Record<string, unknown> }).details).toEqual({
        field: 'options.margins',
        reason: 'PRINTABLE_AREA_NON_POSITIVE',
        printableWidthMm: 190,
        printableHeightMm: -23,
      });
    }
  });
});

describe('可打印区与分页提示换算', () => {
  it('printableHeightPx 给出 A4 缺省可打印区高的 CSS 像素值', () => {
    const geometry = resolvePrintGeometry(defaultOptions());
    expect(printableHeightPx(geometry)).toBeCloseTo(1046.9291, 3);
  });

  it('paginationHintPageCount：无预估为 null，有预估取 pageCount', () => {
    expect(paginationHintPageCount(null)).toBeNull();
    const pagination = { pages: [[], []], pageCount: 2, warnings: [] } as unknown as IPaginationResult;
    expect(paginationHintPageCount(pagination)).toBe(2);
  });
});
