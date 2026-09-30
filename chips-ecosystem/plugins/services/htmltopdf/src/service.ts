/**
 * HTML 转 PDF 服务：转换编排核心。
 *
 * 流水线：取消检查 → 输入归一 → 选项归一 → 打印几何解析 → 分页预估
 * （提供排版度量块时）→ 打印承载打印 → 结果校验（非空、字节与页数上限）→
 * 结果装配（warnings 合并、诊断）。
 * 错误面只用已登记码（见 errors.ts）；取消在安全点检查并抛 BRIDGE_CANCELLED。
 */

import { MAX_OUTPUT_BYTES, MAX_PAGE_COUNT } from './descriptor.js';
import {
  cancelled,
  normalizeEngineError,
  outputTooLarge,
  renderFailed,
} from './errors.js';
import { paginationHintPageCount, printableHeightPx, resolvePrintGeometry } from './geometry.js';
import { normalizeHtmlToPdfInput } from './normalize.js';
import { normalizeHtmlToPdfOptions } from './options.js';
import { paginateBlocks } from './pagination.js';
import type {
  IConverterCallContext,
  IConverterWarning,
  IHtmlToPdfInput,
  IHtmlToPdfOptions,
  IHtmlToPdfResult,
  IHtmlToPdfService,
  IPdfPrintEngine,
} from './types.js';

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw cancelled('HTML 转 PDF 调用已被取消。', { capability: 'content-converter.html-to-pdf' });
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

/** 服务装配依赖：打印承载端口必须由宿主渲染链路提供。 */
export interface IHtmlToPdfServiceDependencies {
  readonly engine: IPdfPrintEngine;
}

/** 创建 content-html-to-pdf Cordis 服务对象。 */
export function createHtmlToPdfService(
  dependencies: IHtmlToPdfServiceDependencies
): IHtmlToPdfService {
  const engine = dependencies.engine;
  if (typeof engine !== 'object' || engine === null || typeof engine.print !== 'function') {
    throw new TypeError('打印承载端口缺失：必须提供 IPdfPrintEngine 实现。');
  }

  return {
    capabilityId: 'content-converter.html-to-pdf',

    async htmlToPdf(
      input: IHtmlToPdfInput,
      options?: IHtmlToPdfOptions,
      call?: IConverterCallContext
    ): Promise<IHtmlToPdfResult> {
      const signal = call?.signal;
      throwIfCancelled(signal);

      const normalizedInput = normalizeHtmlToPdfInput(input);
      throwIfCancelled(signal);

      const normalizedOptions = normalizeHtmlToPdfOptions(options);
      const geometry = resolvePrintGeometry(normalizedOptions);
      throwIfCancelled(signal);

      const pagination =
        normalizedInput.blocks.length > 0
          ? paginateBlocks(normalizedInput.blocks, printableHeightPx(geometry))
          : null;
      throwIfCancelled(signal);

      let printed;
      try {
        printed = await engine.print({
          html: normalizedInput.html,
          assets: normalizedInput.assets,
          pageSizeMm: geometry.pageSizeMm,
          marginMm: geometry.marginMm,
          landscape: geometry.landscape,
          printBackground: normalizedOptions.printBackground,
          preferCSSPageSize: normalizedOptions.preferCSSPageSize,
          scale: normalizedOptions.scale,
          headerFooter: normalizedOptions.headerFooter,
          ...(signal ? { signal } : {}),
        });
      } catch (error) {
        throw normalizeEngineError(error, engine.id);
      }
      throwIfCancelled(signal);

      if (typeof printed !== 'object' || printed === null || !(printed.bytes instanceof Uint8Array)) {
        throw renderFailed('打印承载返回了无效的打印结果。', { engine: engine.id });
      }
      if (printed.bytes.byteLength === 0) {
        throw renderFailed('打印承载返回了空 PDF 数据。', { engine: engine.id });
      }
      if (printed.bytes.byteLength > MAX_OUTPUT_BYTES) {
        throw outputTooLarge('PDF 字节超出 128 MiB 输出上限。', {
          engine: engine.id,
          bytes: printed.bytes.byteLength,
          limit: MAX_OUTPUT_BYTES,
        });
      }
      if (!Number.isInteger(printed.pageCount) || printed.pageCount <= 0) {
        throw renderFailed('打印承载返回的页数非法。', { engine: engine.id });
      }
      if (printed.pageCount > MAX_PAGE_COUNT) {
        throw outputTooLarge('PDF 页数超出 10000 页输出上限。', {
          engine: engine.id,
          pages: printed.pageCount,
          limit: MAX_PAGE_COUNT,
        });
      }

      const warnings = uniqueWarnings(pagination ? [...pagination.warnings] : []);
      return {
        bytes: printed.bytes,
        pageCount: printed.pageCount,
        pageSizeMm: geometry.pageSizeMm,
        marginMm: geometry.marginMm,
        warnings,
        diagnostics: {
          engineId: engine.id,
          assetCount: Object.keys(normalizedInput.assets).length,
          printableAreaMm: geometry.printableAreaMm,
          paginationHintPageCount: paginationHintPageCount(pagination),
        },
      };
    },
  };
}
