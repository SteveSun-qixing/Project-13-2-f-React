/**
 * HTML 转图片服务：选项归一。
 *
 * 语义与缺省值与 contracts/html-to-image.options.schema.json 一致；
 * 越界与非法值统一为 CONVERTER_INPUT_UNSUPPORTED；可自动修正的归一
 * （JPEG 透明背景、theme 缺底色）以警告码随结果返回。
 */

import {
  DEFAULT_VIEWPORT_WIDTH_PX,
  isHexColor,
  MAX_SCALE_FACTOR,
  MAX_VIEWPORT_PX,
  MIN_SCALE_FACTOR,
  MIN_VIEWPORT_PX,
} from './descriptor.js';
import { inputUnsupported, warning } from './errors.js';
import type {
  ImageBackgroundMode,
  ImageOutputFormat,
  INormalizedHtmlToImageOptions,
  IConverterWarning,
  IHtmlToImageOptions,
} from './types.js';

const IMAGE_FORMATS: readonly ImageOutputFormat[] = ['png', 'jpeg', 'webp'];
const BACKGROUND_MODES: readonly ImageBackgroundMode[] = ['transparent', 'white', 'theme'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** 警告码：JPEG 不支持透明背景，背景已归一为白色。 */
export const WARN_BACKGROUND_NORMALIZED_OPAQUE = 'BACKGROUND_NORMALIZED_OPAQUE';

/** 警告码：请求 theme 背景但未提供主题底色，背景已回退为白色。 */
export const WARN_THEME_BACKGROUND_MISSING = 'THEME_BACKGROUND_MISSING';

function normalizeFormat(raw: unknown): ImageOutputFormat {
  if (typeof raw === 'undefined') {
    return 'png';
  }
  if (typeof raw === 'string' && IMAGE_FORMATS.includes(raw as ImageOutputFormat)) {
    return raw as ImageOutputFormat;
  }
  throw inputUnsupported('options.format 必须是 png、jpeg 或 webp。', { field: 'options.format' });
}

function normalizeDimension(raw: unknown, field: string): number | null {
  if (typeof raw === 'undefined') {
    return null;
  }
  if (raw === null) {
    return null;
  }
  if (!isFiniteNumber(raw) || !Number.isInteger(raw)) {
    throw inputUnsupported(`options.${field} 必须是整数像素或 null。`, { field: `options.${field}` });
  }
  if (raw < MIN_VIEWPORT_PX || raw > MAX_VIEWPORT_PX) {
    throw inputUnsupported(
      `options.${field} 超出范围 [${MIN_VIEWPORT_PX}, ${MAX_VIEWPORT_PX}]。`,
      { field: `options.${field}`, value: raw }
    );
  }
  return raw;
}

function normalizeScaleFactor(raw: unknown): number {
  if (typeof raw === 'undefined') {
    return 1;
  }
  if (!isFiniteNumber(raw) || raw < MIN_SCALE_FACTOR || raw > MAX_SCALE_FACTOR) {
    throw inputUnsupported(
      `options.scaleFactor 超出范围 [${MIN_SCALE_FACTOR}, ${MAX_SCALE_FACTOR}]。`,
      { field: 'options.scaleFactor' }
    );
  }
  return raw;
}

function normalizeBackgroundMode(raw: unknown, format: ImageOutputFormat): ImageBackgroundMode {
  if (typeof raw === 'undefined') {
    return format === 'jpeg' ? 'white' : 'transparent';
  }
  if (typeof raw === 'string' && BACKGROUND_MODES.includes(raw as ImageBackgroundMode)) {
    return raw as ImageBackgroundMode;
  }
  throw inputUnsupported('options.background 必须是 transparent、white 或 theme。', {
    field: 'options.background',
  });
}

function normalizeThemeBackground(raw: unknown): string | undefined {
  if (typeof raw === 'undefined') {
    return undefined;
  }
  if (typeof raw !== 'string' || !isHexColor(raw)) {
    throw inputUnsupported('options.themeBackground 必须是十六进制 CSS 颜色。', {
      field: 'options.themeBackground',
    });
  }
  return raw;
}

/**
 * 归一选项面：
 * - format / 尺寸 / 缩放系数 / 背景模式按契约校验与补全；
 * - JPEG + transparent 归一为 white（警告 BACKGROUND_NORMALIZED_OPAQUE）；
 * - theme 背景缺底色时回退 white（警告 THEME_BACKGROUND_MISSING）。
 */
export function normalizeHtmlToImageOptions(raw: unknown): {
  options: INormalizedHtmlToImageOptions;
  warnings: IConverterWarning[];
} {
  if (typeof raw === 'undefined') {
    raw = {};
  }
  if (!isRecord(raw)) {
    throw inputUnsupported('options 必须是对象。', { field: 'options' });
  }

  const format = normalizeFormat(raw['format']);
  const width = normalizeDimension(raw['width'], 'width') ?? DEFAULT_VIEWPORT_WIDTH_PX;
  const height = normalizeDimension(raw['height'], 'height');
  const scaleFactor = normalizeScaleFactor(raw['scaleFactor']);
  let background = normalizeBackgroundMode(raw['background'], format);
  const themeBackground = normalizeThemeBackground(raw['themeBackground']);

  const warnings: IConverterWarning[] = [];
  if (format === 'jpeg' && background === 'transparent') {
    background = 'white';
    warnings.push(
      warning(WARN_BACKGROUND_NORMALIZED_OPAQUE, 'JPEG 不支持透明背景，背景已归一为白色。', {
        requested: 'transparent',
        applied: 'white',
      })
    );
  }
  if (background === 'theme' && typeof themeBackground === 'undefined') {
    background = 'white';
    warnings.push(
      warning(WARN_THEME_BACKGROUND_MISSING, '请求主题背景但未提供主题底色，背景已回退为白色。')
    );
  }

  return {
    options: {
      format,
      width,
      height,
      scaleFactor,
      background,
      ...(typeof themeBackground === 'string' ? { themeBackground } : {}),
    },
    warnings,
  };
}

export type { IHtmlToImageOptions };
