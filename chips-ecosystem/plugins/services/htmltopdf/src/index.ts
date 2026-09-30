/**
 * HTML 转 PDF 服务：拆分导出面。
 *
 * 消费方（文件处理服务、测试与联调工具）从这里取类型、描述符与装配工厂；
 * 插件入口模块是 src/main.ts（默认导出 IServicePlugin 实现）。
 */

export {
  CONTENT_CAPABILITY_ID,
  CORDIS_SERVICE_NAME,
  DEFAULT_MARGIN_MM,
  MAX_ASSET_PATH_LENGTH,
  MAX_HTML_BYTES,
  MAX_INLINE_INPUT_BYTES,
  MAX_MARGIN_MM,
  MAX_PAGE_COUNT,
  MAX_PRINT_SCALE,
  MAX_TEMPLATE_LENGTH,
  MIN_MARGIN_MM,
  MIN_PRINT_SCALE,
  PROVIDER_PLUGIN_ID,
  htmlToPdfCapabilityDescriptor,
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
export {
  PAGE_SIZES_MM,
  clampMargins,
  cssPxToMm,
  mmToCssPx,
  paginationHintPageCount,
  printableHeightPx,
  resolvePrintGeometry,
} from './geometry.js';
export { isValidAssetPath, normalizeBlocks, normalizeHtmlToPdfInput, utf8ByteLength } from './normalize.js';
export { normalizeHtmlToPdfOptions } from './options.js';
export { WARN_PAGE_OVERFLOW_KEEP_BLOCK, paginateBlocks } from './pagination.js';
export { createHtmlToPdfService, uniqueWarnings } from './service.js';
export type {
  IContentCapabilityDescriptor,
  IConverterCallContext,
  IConverterWarning,
  IHtmlToPdfInput,
  IHtmlToPdfOptions,
  IHtmlToPdfResult,
  IHtmlToPdfService,
  INormalizedHtmlToPdfInput,
  INormalizedHtmlToPdfOptions,
  IPaginatedBlock,
  IPaginationResult,
  IPaginationSegment,
  IPdfHeaderFooter,
  IPdfHeaderFooterSettings,
  IPdfMargins,
  IPdfPrintEngine,
  IPrintGeometry,
  IPrintRequest,
  IPrintResult,
  IPageSizeMm,
  PdfPageSize,
} from './types.js';
export { UNBOUND_PRINT_ENGINE_ID, createUnboundPrintEngine } from './engine/port.js';
