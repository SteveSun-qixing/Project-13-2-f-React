/**
 * HTML 转图片服务：转换编排核心。
 *
 * 流水线：取消检查 → 输入归一 → 选项归一 → 几何解析 → 渲染承载光栅化 →
 * 结果校验（非空、尺寸、字节上限）→ 结果装配（warnings 合并、诊断）。
 * 错误面只用已登记码（见 errors.ts）；取消在安全点检查并抛 BRIDGE_CANCELLED。
 */

import { MAX_OUTPUT_BYTES } from './descriptor.js';
import {
  cancelled,
  normalizeEngineError,
  outputTooLarge,
  renderFailed,
} from './errors.js';
import { outputPixelWidth, resolveRasterGeometry } from './geometry.js';
import { normalizeHtmlToImageInput } from './normalize.js';
import { normalizeHtmlToImageOptions } from './options.js';
import type {
  IConverterCallContext,
  IConverterWarning,
  IHtmlRasterEngine,
  IHtmlToImageInput,
  IHtmlToImageOptions,
  IHtmlToImageResult,
  IHtmlToImageService,
} from './types.js';

const MIME_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export function getMimeType(format: string): string {
  return MIME_TYPES[format] ?? 'application/octet-stream';
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw cancelled('HTML 转图片调用已被取消。', { capability: 'content-converter.html-to-image' });
  }
}

/** 去重警告：code + message + details 全等视为同一条。 */
export function uniqueWarnings(
  warnings: readonly IConverterWarning[]
): IConverterWarning[] {
  const seen = new Set<string>();
  return warnings.filter((item) => {
    const key = JSON.stringify([item.code, item.message, item.details ?? null]);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/** 服务装配依赖：渲染承载端口必须由宿主渲染链路提供。 */
export interface IHtmlToImageServiceDependencies {
  readonly engine: IHtmlRasterEngine;
}

/** 创建 content-html-to-image Cordis 服务对象。 */
export function createHtmlToImageService(
  dependencies: IHtmlToImageServiceDependencies
): IHtmlToImageService {
  const engine = dependencies.engine;
  if (typeof engine !== 'object' || engine === null || typeof engine.rasterize !== 'function') {
    throw new TypeError('渲染承载端口缺失：必须提供 IHtmlRasterEngine 实现。');
  }

  return {
    capabilityId: 'content-converter.html-to-image',

    async htmlToImage(
      input: IHtmlToImageInput,
      options?: IHtmlToImageOptions,
      call?: IConverterCallContext
    ): Promise<IHtmlToImageResult> {
      const signal = call?.signal;
      throwIfCancelled(signal);

      const normalizedInput = normalizeHtmlToImageInput(input);
      throwIfCancelled(signal);

      const { options: normalizedOptions, warnings: optionWarnings } =
        normalizeHtmlToImageOptions(options);
      const { geometry, warnings: geometryWarnings } = resolveRasterGeometry(
        normalizedOptions,
        normalizedInput
      );
      throwIfCancelled(signal);

      let raster;
      try {
        raster = await engine.rasterize({
          html: normalizedInput.html,
          assets: normalizedInput.assets,
          viewport: geometry.viewport,
          scaleFactor: geometry.scaleFactor,
          background: geometry.background,
          format: normalizedOptions.format,
          ...(signal ? { signal } : {}),
        });
      } catch (error) {
        throw normalizeEngineError(error, engine.id);
      }
      throwIfCancelled(signal);

      if (typeof raster !== 'object' || raster === null || !(raster.bytes instanceof Uint8Array)) {
        throw renderFailed('渲染承载返回了无效的光栅化结果。', { engine: engine.id });
      }
      if (raster.bytes.byteLength === 0) {
        throw renderFailed('渲染承载返回了空图片数据。', { engine: engine.id });
      }
      if (raster.bytes.byteLength > MAX_OUTPUT_BYTES) {
        throw outputTooLarge('图片字节超出 64 MiB 输出上限。', {
          engine: engine.id,
          bytes: raster.bytes.byteLength,
          limit: MAX_OUTPUT_BYTES,
        });
      }
      if (!Number.isInteger(raster.width) || raster.width <= 0) {
        throw renderFailed('渲染承载返回的图片宽度非法。', { engine: engine.id });
      }
      if (!Number.isInteger(raster.height) || raster.height <= 0) {
        throw renderFailed('渲染承载返回的图片高度非法。', { engine: engine.id });
      }

      const warnings = uniqueWarnings([...optionWarnings, ...geometryWarnings]);
      return {
        format: normalizedOptions.format,
        mimeType: getMimeType(normalizedOptions.format),
        bytes: raster.bytes,
        width: raster.width,
        height: raster.height,
        scaleFactor: geometry.scaleFactor,
        background: geometry.background,
        warnings,
        diagnostics: {
          engineId: engine.id,
          assetCount: Object.keys(normalizedInput.assets).length,
          viewportWidthPx: geometry.viewport.width,
          viewportHeightPx: geometry.viewport.height,
        },
      };
    },
  };
}

/** 供编排层复用的输出像素宽换算。 */
export { outputPixelWidth };
