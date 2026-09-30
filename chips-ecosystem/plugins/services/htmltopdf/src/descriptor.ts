/**
 * HTML 转 PDF 服务：登记描述符与常量。
 *
 * 能力 ID 使用 04-能力契约规范 §8.4 登记的 canonical 值（一经登记即稳定）；
 * Cordis 服务名按 §8.2 文法（content- 前缀）由本插件注册。
 */

import type { IContentCapabilityDescriptor } from './types.js';

/** 内容处理能力 ID（04-能力契约规范 §8.4 登记项）。 */
export const CONTENT_CAPABILITY_ID = 'content-converter.html-to-pdf';

/** 本插件注册的 Cordis 服务名。 */
export const CORDIS_SERVICE_NAME = 'content-html-to-pdf';

/** 提供方插件 ID。 */
export const PROVIDER_PLUGIN_ID = 'chips.service.htmltopdf';

/** 输入上限：HTML 文本 8 MiB（UTF-8 字节）。 */
export const MAX_HTML_BYTES = 8 * 1024 * 1024;

/** 输入上限：HTML 与资源合计 32 MiB（与描述符 maxInlineInputBytes 一致）。 */
export const MAX_INLINE_INPUT_BYTES = 32 * 1024 * 1024;

/** 输出上限：PDF 字节 128 MiB。 */
export const MAX_OUTPUT_BYTES = 128 * 1024 * 1024;

/** 输出上限：页数 10000。 */
export const MAX_PAGE_COUNT = 10000;

/** 资源路径长度上限。 */
export const MAX_ASSET_PATH_LENGTH = 256;

/** 页边距边界（毫米）。 */
export const MIN_MARGIN_MM = 0;
export const MAX_MARGIN_MM = 50;

/** 缺省页边距（毫米）。 */
export const DEFAULT_MARGIN_MM = 10;

/** 打印缩放系数边界。 */
export const MIN_PRINT_SCALE = 0.1;
export const MAX_PRINT_SCALE = 2;

/** 页眉页脚模板长度上限。 */
export const MAX_TEMPLATE_LENGTH = 4096;

/** 提供方契约：HTML 转 PDF 能力描述符（与 contracts/descriptor.schema.json 一致）。 */
export const htmlToPdfCapabilityDescriptor: IContentCapabilityDescriptor = {
  id: CONTENT_CAPABILITY_ID,
  service: CORDIS_SERVICE_NAME,
  provider: PROVIDER_PLUGIN_ID,
  operations: ['htmlToPdf'],
  sourceFormats: ['html-directory'],
  targetFormats: ['pdf'],
  streaming: { input: false, output: false },
  maxInlineInputBytes: MAX_INLINE_INPUT_BYTES,
  contractPackage: `${PROVIDER_PLUGIN_ID}/contracts`,
};
