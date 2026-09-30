/**
 * HTML 转图片服务：登记描述符与常量。
 *
 * 能力 ID 使用 04-能力契约规范 §8.4 登记的 canonical 值（一经登记即稳定）；
 * Cordis 服务名按 §8.2 文法（content- 前缀）由本插件注册。
 */

import type { IContentCapabilityDescriptor } from './types.js';

/** 内容处理能力 ID（04-能力契约规范 §8.4 登记项）。 */
export const CONTENT_CAPABILITY_ID = 'content-converter.html-to-image';

/** 本插件注册的 Cordis 服务名。 */
export const CORDIS_SERVICE_NAME = 'content-html-to-image';

/** 提供方插件 ID。 */
export const PROVIDER_PLUGIN_ID = 'chips.service.htmltoimage';

/** 输入上限：HTML 文本 8 MiB（UTF-8 字节）。 */
export const MAX_HTML_BYTES = 8 * 1024 * 1024;

/** 输入上限：HTML 与资源合计 32 MiB（与描述符 maxInlineInputBytes 一致）。 */
export const MAX_INLINE_INPUT_BYTES = 32 * 1024 * 1024;

/** 输出上限：图片字节 64 MiB。 */
export const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

/** 视口宽缺省值：A4 纵向 @96dpi（210mm ≈ 794px）。 */
export const DEFAULT_VIEWPORT_WIDTH_PX = 794;

/** 视口边界（CSS 像素）。 */
export const MIN_VIEWPORT_PX = 16;
export const MAX_VIEWPORT_PX = 20000;

/** 缩放系数边界。 */
export const MIN_SCALE_FACTOR = 1;
export const MAX_SCALE_FACTOR = 4;

/** 资源路径长度上限。 */
export const MAX_ASSET_PATH_LENGTH = 256;

/** 提供方契约：十六进制 CSS 颜色文法（#RGB / #RGBA / #RRGGBB / #RRGGBBAA）。 */
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** 提供方契约：HTML 转图片能力描述符（与 contracts/descriptor.schema.json 一致）。 */
export const htmlToImageCapabilityDescriptor: IContentCapabilityDescriptor = {
  id: CONTENT_CAPABILITY_ID,
  service: CORDIS_SERVICE_NAME,
  provider: PROVIDER_PLUGIN_ID,
  operations: ['htmlToImage'],
  sourceFormats: ['html-directory'],
  targetFormats: ['png', 'jpeg', 'webp'],
  streaming: { input: false, output: false },
  maxInlineInputBytes: MAX_INLINE_INPUT_BYTES,
  contractPackage: `${PROVIDER_PLUGIN_ID}/contracts`,
};

/** 判定值是否为十六进制 CSS 颜色。 */
export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}
