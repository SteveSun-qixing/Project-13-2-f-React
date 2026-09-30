/**
 * `chips.service.file-conversion` 拆分导出面。
 *
 * 消费方（文件处理会话层、测试与联调工具）从这里取类型、描述符常量与装配工厂；
 * 插件入口模块是 src/main.ts（默认导出 IServicePlugin 实现）。
 */

export { default } from './main.js';

export {
  CARD_CONVERTER_SERVICE_NAME,
  CARD_TO_HTML_CAPABILITY_ID,
  FILE_CONVERSION_PLUGIN_ID,
  FILE_CONVERSION_SERVICE_NAME,
  HTML_ENTRY_FILE,
  HTML_TO_IMAGE_CAPABILITY_ID,
  HTML_TO_IMAGE_SERVICE_NAME,
  HTML_TO_PDF_CAPABILITY_ID,
  HTML_TO_PDF_SERVICE_NAME,
  STAGING_HTML_ROOT_PREFIX,
  STAGING_OUTPUT_ROOT_PREFIX,
} from './descriptor.js';
export { decodeBase64, encodeBase64 } from './base64.js';
export {
  BRIDGE_CANCELLED,
  CONVERTER_INPUT_UNSUPPORTED,
  CONVERTER_OUTPUT_TOO_LARGE,
  CONVERTER_RENDER_FAILED,
  FILE_NOT_FOUND_CODE,
  INPUT_UNSUPPORTED_REASONS,
  REGISTERED_CONVERTER_ERROR_CODES,
  RENDER_FAILED_REASONS,
  cancelled,
  createConverterError,
  hasChipsErrorCode,
  inputUnsupported,
  isChipsErrorLike,
  renderFailed,
} from './errors.js';
export { basename, dirname, joinPath, splitSegments } from './paths.js';
export { normalizeRequest, planConversion, resolveHtmlSource, toPipelineLeg } from './planner.js';
export {
  assertSourceExists,
  createBridgeFilePort,
  readHtmlPackage,
  resolveHtmlSourceShape,
} from './ports.js';
export type { IHtmlPackage } from './ports.js';
export { createFileConversionService } from './executor.js';
export type {
  FileConvertArtifactType,
  FileSourceType,
  FileTargetType,
  HtmlPackageMode,
  ICardToHtmlPort,
  IConversionPlan,
  IConverterCallContext,
  IFileConvertArtifact,
  IFileConvertMargins,
  IFileConvertPipelineLeg,
  IFileConvertRequest,
  IFileConvertResult,
  IFileConvertWarning,
  IFileConversionDependencies,
  IFileConversionService,
  IFilePort,
  IHtmlToImagePort,
  IHtmlToPdfPort,
  IImageRenderOptions,
  INormalizedConvertRequest,
  INormalizedHtmlSource,
  IPlannedCardToHtmlStep,
  IPlannedHtmlToImageStep,
  IPlannedHtmlToPdfStep,
  IPlannedStep,
  IPdfRenderOptions,
  ImageFormat,
  ISiblingPorts,
  PdfPageSize,
} from './types.js';
