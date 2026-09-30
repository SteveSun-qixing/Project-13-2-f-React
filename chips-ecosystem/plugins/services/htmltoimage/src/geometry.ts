/**
 * HTML 转图片服务：光栅化几何。
 *
 * 视口、缩放系数与背景解析：把归一选项与输入携带的主题底色
 * 解析为渲染承载可直接消费的光栅化请求几何。
 */

import { isHexColor } from './descriptor.js';
import { inputUnsupported, warning } from './errors.js';
import { WARN_THEME_BACKGROUND_MISSING } from './options.js';
import type {
  IConverterWarning,
  INormalizedHtmlToImageInput,
  INormalizedHtmlToImageOptions,
  IRasterGeometry,
} from './types.js';

/** 背景模式对应的固定底色。 */
export const WHITE_BACKGROUND = '#ffffff';
export const TRANSPARENT_BACKGROUND = 'transparent';

/** 计算输出像素宽：视口宽 × 缩放系数（四舍五入取整）。 */
export function outputPixelWidth(viewportWidthPx: number, scaleFactor: number): number {
  return Math.round(viewportWidthPx * scaleFactor);
}

/**
 * 解析光栅化几何：
 * - 视口宽缺省 794（A4 纵向 @96dpi）；高为 null 表示按内容自适应；
 * - background=white 解析为 #ffffff；theme 使用输入携带的主题底色（缺失时回退
 *   white 并给出警告——选项归一层已在无 themeBackground 输入时回退，此处覆盖
 *   「options 请求 theme 但输入携带的底色非法被拒绝」之外的残余路径）；
 * - transparent 原样传递，由渲染承载决定透明语义。
 */
export function resolveRasterGeometry(
  options: INormalizedHtmlToImageOptions,
  input: INormalizedHtmlToImageInput
): { geometry: IRasterGeometry; warnings: IConverterWarning[] } {
  const width = options.width;
  if (!Number.isInteger(width) || width <= 0) {
    throw inputUnsupported('视口宽必须是正整数像素。', { field: 'options.width' });
  }

  const warnings: IConverterWarning[] = [];
  let background: string;
  switch (options.background) {
    case 'transparent':
      background = TRANSPARENT_BACKGROUND;
      break;
    case 'white':
      background = WHITE_BACKGROUND;
      break;
    case 'theme': {
      const themeColor =
        typeof options.themeBackground === 'string' && isHexColor(options.themeBackground)
          ? options.themeBackground
          : typeof input.themeBackground === 'string' && isHexColor(input.themeBackground)
            ? input.themeBackground
            : undefined;
      if (typeof themeColor === 'undefined') {
        background = WHITE_BACKGROUND;
        warnings.push(
          warning(WARN_THEME_BACKGROUND_MISSING, '主题底色不可用，背景已回退为白色。')
        );
      } else {
        background = themeColor;
      }
      break;
    }
  }

  return {
    geometry: {
      viewport: { width, height: options.height },
      scaleFactor: options.scaleFactor,
      background,
    },
    warnings,
  };
}
