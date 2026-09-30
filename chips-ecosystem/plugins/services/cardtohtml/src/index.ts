/**
 * `chips.service.cardtohtml` 入口模块。
 *
 * 默认导出实现 `IServicePlugin` 的服务对象（10-服务插件接口 §2.1）；
 * 命名导出仅供类型化消费与测试辅助，运行时面以默认导出与
 * `IContentConverterService` 契约为准。
 */

import { default as cardToHtmlServicePlugin } from './plugin.js';

export default cardToHtmlServicePlugin;

export { CONTENT_CONVERTER_SERVICE_NAME } from './plugin.js';
export { convertCardToHtml, normalizeCardToHtmlInput, planAssetCopy } from './converter.js';
export { buildCardHtml, buildConversionManifest, renderBlockValue } from './html.js';
export { escapeHtml } from './html-escape.js';
export { CONVERTER_ERROR_CODES } from './errors.js';
export {
  basenameNormalized,
  dirnameNormalized,
  encodeRelativeUrlPath,
  isSafePackageRelativePath,
  joinNormalized,
  normalizePath,
} from './paths.js';
export type {
  CardToHtmlPackageMode,
  CardToHtmlWarningCode,
  ICardDocumentModel,
  ICardToHtmlInput,
  ICardToHtmlOptions,
  ICardToHtmlOutput,
  ICardToHtmlOutputTarget,
  ICardToHtmlWarning,
  ICardContentNodeModel,
  ICardMetadataView,
  ICardResourceEntry,
  ICardStructureEntry,
  IContentConverterService,
  INormalizedCardToHtmlRequest,
} from './types.js';
