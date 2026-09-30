/**
 * HTML 转图片服务：拆分导出面。
 *
 * 消费方（文件处理服务、测试与联调工具）从这里取类型、描述符与装配工厂；
 * 插件入口模块是 src/main.ts（默认导出 IServicePlugin 实现）。
 */

export {
  CONTENT_CAPABILITY_ID,
  CORDIS_SERVICE_NAME,
  DEFAULT_VIEWPORT_WIDTH_PX,
  MAX_ASSET_PATH_LENGTH,
  MAX_HTML_BYTES,
  MAX_INLINE_INPUT_BYTES,
  MAX_OUTPUT_BYTES,
  MAX_SCALE_FACTOR,
  MAX_VIEWPORT_PX,
  MIN_SCALE_FACTOR,
  MIN_VIEWPORT_PX,
  PROVIDER_PLUGIN_ID,
  htmlToImageCapabilityDescriptor,
  isHexColor,
} from './descriptor.js';
export {
  BRIDGE_CANCELLED,
  BRIDGE_TIMEOUT,
  CONVERTER_INPUT_UNSUPPORTED,
  CONVERTER_OUTPUT_TOO_LARGE,
  CONVERTER_RENDER_FAILED,
  RENDER_CARRIER_UNBOUND,
  cancelled,
  inputUnsupported,
  isChipsErrorLike,
  normalizeEngineError,
  outputTooLarge,
  renderFailed,
  warning,
} from './errors.js';
export { TRANSPARENT_BACKGROUND, WHITE_BACKGROUND, outputPixelWidth, resolveRasterGeometry } from './geometry.js';
export { isValidAssetPath, normalizeHtmlToImageInput, utf8ByteLength } from './normalize.js';
export {
  WARN_BACKGROUND_NORMALIZED_OPAQUE,
  WARN_THEME_BACKGROUND_MISSING,
  normalizeHtmlToImageOptions,
} from './options.js';
export { createHtmlToImageService, getMimeType, uniqueWarnings } from './service.js';
export type {
  IContentCapabilityDescriptor,
  IConverterCallContext,
  IConverterWarning,
  IHtmlRasterEngine,
  IHtmlToImageInput,
  IHtmlToImageOptions,
  IHtmlToImageResult,
  IHtmlToImageService,
  INormalizedHtmlToImageInput,
  INormalizedHtmlToImageOptions,
  ImageBackgroundMode,
  ImageOutputFormat,
  IRasterGeometry,
  IRasterizeRequest,
  IRasterizeResult,
} from './types.js';
export { createUnboundRasterEngine, UNBOUND_RASTER_ENGINE_ID } from './engine/port.js';
