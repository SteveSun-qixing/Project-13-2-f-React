/**
 * `chips.service.content-image` 入口模块：默认导出实现 `IServicePlugin` 的对象
 * （10-服务插件接口 §2.3）；模块顶层只声明、不产生副作用。
 *
 * 构建以本文件为入口产出完全自包含的 `dist/index.js`（service 角色不携带 render.js）。
 */

import { createContentImagePlugin } from './plugin.js';

/** 服务插件入口对象（平台激活时对同一对象调用 `start`）。 */
const contentImageServicePlugin = createContentImagePlugin();

export default contentImageServicePlugin;

export { createContentImagePlugin } from './plugin.js';
export {
  CONTENT_CAPABILITY_ID,
  CORDIS_SERVICE_NAME,
  DEFAULT_SAMPLE_SIZE,
  MAX_ACTIVE_PICK_TASKS,
  MAX_IMAGE_BYTES,
  MAX_SAMPLE_SIZE,
  MIN_SAMPLE_SIZE,
  PICK_COLORS_OPERATION,
  PROVIDER_PLUGIN_ID,
  RESULT_CACHE_LIMIT,
  SAMPLE_CACHE_LIMIT,
  pickColorsCapabilityDescriptor,
} from './descriptor.js';
export { analyzeColorSample } from './color-analysis.js';
export type { IColorAnalysisContext } from './color-analysis.js';
export { buildCacheKey, normalizeImageBytes, toOwnedBytes } from './bytes.js';
export {
  UNBOUND_DECODE_ENGINE_ID,
  assertImageBytes,
  assertRgbaSample,
  classifyDecodeError,
  clampSampleSize,
  clearSampleCache,
  createUnboundDecodeEngine,
} from './pixel-source.js';
export { clearResultCache, createPickColorsService } from './service.js';
export {
  BRIDGE_CANCELLED,
  IMAGE_ANALYSIS_FAILED,
  IMAGE_DECODE_FAILED,
  IMAGE_EMPTY,
  IMAGE_INPUT_UNSUPPORTED,
  PIXEL_SOURCE_UNBOUND,
} from './errors.js';
export type {
  ColorPaletteRole,
  IColorPaletteEntry,
  IContentCapabilityDescriptor,
  IDecodedImageInfo,
  IImageDecodeEngine,
  IImageDecodeOptions,
  IImageDecodeResult,
  IPickColorsCallContext,
  IPickColorsInput,
  IPickColorsMetadata,
  IPickColorsResult,
  IPickColorsSampleInfo,
  IPickColorsService,
  IPickColorsServiceDependencies,
  IRgbaPixelSample,
} from './types.js';
