/**
 * HTML 转 PDF 服务：选项归一。
 *
 * 语义与缺省值与 contracts/html-to-pdf.options.schema.json 一致；
 * 越界与非法值统一为 CONVERTER_INPUT_UNSUPPORTED。
 */

import {
  DEFAULT_MARGIN_MM,
  MAX_MARGIN_MM,
  MAX_PRINT_SCALE,
  MAX_TEMPLATE_LENGTH,
  MIN_MARGIN_MM,
  MIN_PRINT_SCALE,
} from './descriptor.js';
import { inputUnsupported } from './errors.js';
import type {
  INormalizedHtmlToPdfOptions,
  IPdfHeaderFooter,
  IPdfMargins,
  IHtmlToPdfOptions,
  PdfPageSize,
} from './types.js';

const PAGE_SIZES: readonly PdfPageSize[] = ['A4', 'A3', 'Letter', 'Legal'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function normalizePageSize(raw: unknown): PdfPageSize {
  if (typeof raw === 'undefined') {
    return 'A4';
  }
  if (typeof raw === 'string' && PAGE_SIZES.includes(raw as PdfPageSize)) {
    return raw as PdfPageSize;
  }
  throw inputUnsupported('options.pageSize 必须是 A4、A3、Letter 或 Legal。', {
    field: 'options.pageSize',
  });
}

function normalizeBoolean(raw: unknown, field: string, fallback: boolean): boolean {
  if (typeof raw === 'undefined') {
    return fallback;
  }
  if (typeof raw === 'boolean') {
    return raw;
  }
  throw inputUnsupported(`options.${field} 必须是布尔值。`, { field: `options.${field}` });
}

function normalizeMargin(raw: unknown, field: string): number {
  if (typeof raw === 'undefined') {
    return DEFAULT_MARGIN_MM;
  }
  if (!isFiniteNumber(raw) || raw < MIN_MARGIN_MM || raw > MAX_MARGIN_MM) {
    throw inputUnsupported(
      `options.margins.${field} 超出范围 [${MIN_MARGIN_MM}, ${MAX_MARGIN_MM}] 毫米。`,
      { field: `options.margins.${field}` }
    );
  }
  return raw;
}

function normalizeMargins(raw: unknown): IPdfMargins {
  if (typeof raw === 'undefined') {
    return {
      top: DEFAULT_MARGIN_MM,
      right: DEFAULT_MARGIN_MM,
      bottom: DEFAULT_MARGIN_MM,
      left: DEFAULT_MARGIN_MM,
    };
  }
  if (!isRecord(raw)) {
    throw inputUnsupported('options.margins 必须是对象。', { field: 'options.margins' });
  }
  return {
    top: normalizeMargin(raw['top'], 'top'),
    right: normalizeMargin(raw['right'], 'right'),
    bottom: normalizeMargin(raw['bottom'], 'bottom'),
    left: normalizeMargin(raw['left'], 'left'),
  };
}

function normalizeScale(raw: unknown): number {
  if (typeof raw === 'undefined') {
    return 1;
  }
  if (!isFiniteNumber(raw) || raw < MIN_PRINT_SCALE || raw > MAX_PRINT_SCALE) {
    throw inputUnsupported(
      `options.scale 超出范围 [${MIN_PRINT_SCALE}, ${MAX_PRINT_SCALE}]。`,
      { field: 'options.scale' }
    );
  }
  return raw;
}

function normalizeTemplate(raw: unknown, field: string): string | undefined {
  if (typeof raw === 'undefined') {
    return undefined;
  }
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_TEMPLATE_LENGTH) {
    throw inputUnsupported(
      `options.headerFooter.${field} 必须是长度 1~${MAX_TEMPLATE_LENGTH} 的字符串。`,
      { field: `options.headerFooter.${field}` }
    );
  }
  return raw;
}

function normalizeHeaderFooterHeight(raw: unknown, field: string): number {
  if (typeof raw === 'undefined') {
    return DEFAULT_MARGIN_MM;
  }
  if (!isFiniteNumber(raw) || raw < MIN_MARGIN_MM || raw > MAX_MARGIN_MM) {
    throw inputUnsupported(
      `options.headerFooter.${field} 超出范围 [${MIN_MARGIN_MM}, ${MAX_MARGIN_MM}] 毫米。`,
      { field: `options.headerFooter.${field}` }
    );
  }
  return raw;
}

function normalizeHeaderFooter(raw: unknown): IPdfHeaderFooter {
  if (typeof raw === 'undefined') {
    return { enabled: false, headerHeightMm: DEFAULT_MARGIN_MM, footerHeightMm: DEFAULT_MARGIN_MM };
  }
  if (!isRecord(raw)) {
    throw inputUnsupported('options.headerFooter 必须是对象。', { field: 'options.headerFooter' });
  }
  const enabled = normalizeBoolean(raw['enabled'], 'headerFooter.enabled', false);
  const headerTemplate = normalizeTemplate(raw['headerTemplate'], 'headerTemplate');
  const footerTemplate = normalizeTemplate(raw['footerTemplate'], 'footerTemplate');
  return {
    enabled,
    headerHeightMm: normalizeHeaderFooterHeight(raw['headerHeightMm'], 'headerHeightMm'),
    footerHeightMm: normalizeHeaderFooterHeight(raw['footerHeightMm'], 'footerHeightMm'),
    ...(typeof headerTemplate === 'string' ? { headerTemplate } : {}),
    ...(typeof footerTemplate === 'string' ? { footerTemplate } : {}),
  };
}

/** 归一选项面：纸张、方向、边距、背景、CSS 页面优先、缩放与页眉页脚。 */
export function normalizeHtmlToPdfOptions(raw: unknown): INormalizedHtmlToPdfOptions {
  if (typeof raw === 'undefined') {
    raw = {};
  }
  if (!isRecord(raw)) {
    throw inputUnsupported('options 必须是对象。', { field: 'options' });
  }
  return {
    pageSize: normalizePageSize(raw['pageSize']),
    landscape: normalizeBoolean(raw['landscape'], 'landscape', false),
    margins: normalizeMargins(raw['margins']),
    printBackground: normalizeBoolean(raw['printBackground'], 'printBackground', true),
    preferCSSPageSize: normalizeBoolean(raw['preferCSSPageSize'], 'preferCSSPageSize', false),
    scale: normalizeScale(raw['scale']),
    headerFooter: normalizeHeaderFooter(raw['headerFooter']),
  };
}

export type { IHtmlToPdfOptions };
