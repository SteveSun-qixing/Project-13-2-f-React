/**
 * `cardToHtml` 原子操作编排：输入归一 → 输出就绪 → 模型消费 → HTML 组装 →
 * 资源复制 → 产物落盘 → 结果回执。
 *
 * 依赖域与状态（如实登记，无假接线）：
 * - `document:open` / `document:read`（宿主 resources:read）与 `file:*`（宿主 filesystem:*）
 *   均经本插件自身会话的 `ctx.bridge` 正式链路调用；
 * - 压缩态（`packageMode: 'zip'`）依赖宿主压缩能力域——该域不在 R19 六十四能力在册表内，
 *   就绪前本操作以 `CONVERTER_INPUT_UNSUPPORTED` 如实拒绝；
 * - 失败时对已准备的输出目录做尽力清理，不掩盖原始错误。
 */

import type { IServiceBridge } from '@chips/sdk';

import { buildCardHtml, buildConversionManifest, CONTENT_ASSET_DIR, ENTRY_FILE, MANIFEST_FILE } from './html.js';
import {
  FILE_NOT_FOUND_CODE,
  createInputUnsupportedError,
  hasChipsErrorCode,
} from './errors.js';
import { readCardDocumentModel } from './document-source.js';
import {
  basenameNormalized,
  dirnameNormalized,
  isSafePackageRelativePath,
  joinNormalized,
  normalizePath,
  toNativePath,
} from './paths.js';
import type {
  ICardToHtmlOutput,
  ICardToHtmlWarning,
  INormalizedCardToHtmlRequest,
} from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const asNonEmptyString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

/** 输入归一与运行时校验（schema 之外的业务级二次校验，§8.3 实现约束）。 */
export function normalizeCardToHtmlInput(input: unknown): INormalizedCardToHtmlRequest {
  if (!isRecord(input)) {
    throw createInputUnsupportedError('转换输入必须为对象。', 'input-not-object');
  }
  const source = asNonEmptyString(input.source);
  if (!source) {
    throw createInputUnsupportedError('source 为必填的卡片文档引用。', 'source-required');
  }
  if (!isRecord(input.output)) {
    throw createInputUnsupportedError('output 为必填的输出目标对象。', 'output-required');
  }
  const outputPath = asNonEmptyString(input.output.path);
  if (!outputPath) {
    throw createInputUnsupportedError('output.path 为必填的输出目录。', 'output-path-required');
  }
  const rawPackageMode = input.output.packageMode;
  if (rawPackageMode !== undefined && rawPackageMode !== 'directory' && rawPackageMode !== 'zip') {
    throw createInputUnsupportedError('output.packageMode 只接受 directory 或 zip。', 'package-mode-invalid');
  }
  return {
    source,
    output: {
      path: normalizePath(outputPath),
      packageMode: rawPackageMode === 'zip' ? 'zip' : 'directory',
      overwrite: input.output.overwrite === true,
    },
    options: {
      includeAssets: input.options === undefined || !isRecord(input.options) ? true : input.options.includeAssets !== false,
      includeManifest:
        input.options === undefined || !isRecord(input.options) ? true : input.options.includeManifest !== false,
    },
  };
}

function listDirectoryEntries(
  bridge: IServiceBridge,
  directory: string
): Promise<{ entries: readonly string[] }> {
  return bridge.request<{ entries: readonly string[] }>('file:list', { directory });
}

/** 输出就绪：按 `overwrite` 口径处理已存在目标，并确保输出目录存在。 */
export async function ensureOutputReady(
  bridge: IServiceBridge,
  outputPath: string,
  overwrite: boolean
): Promise<void> {
  if (outputPath === '/' || /^[A-Za-z]:\/$/.test(outputPath)) {
    throw createInputUnsupportedError('输出目录不能为文件系统根。', 'output-path-root');
  }
  const parent = dirnameNormalized(outputPath);
  const name = basenameNormalized(outputPath);
  if (parent !== '.' && name.length > 0) {
    try {
      const listed = await listDirectoryEntries(bridge, toNativePath(parent, outputPath));
      const exists = listed.entries.some((entry) => basenameNormalized(entry) === name);
      if (exists) {
        if (!overwrite) {
          throw createInputUnsupportedError('输出目标已存在且未请求覆盖。', 'output-exists');
        }
        await bridge.request('file:delete', { path: toNativePath(outputPath, outputPath), recursive: true });
      }
    } catch (error) {
      if (hasChipsErrorCode(error, 'FILE_NOT_FOUND')) {
        // 父目录不存在：交给下方递归 mkdir 创建。
      } else {
        throw error;
      }
    }
  }
  await bridge.request('file:mkdir', { path: toNativePath(outputPath, outputPath), recursive: true });
}

interface IPlannedAssetCopy {
  readonly sourcePath: string;
  readonly targetPath: string;
}

/** 资源复制计划：产物内相对路径与包内路径保持一致（URL 与落盘共用同一布局）。 */
export function planAssetCopy(
  references: readonly string[],
  documentSource: string,
  outputRoot: string
): readonly IPlannedAssetCopy[] {
  const plans: IPlannedAssetCopy[] = [];
  for (const reference of references) {
    if (!isSafePackageRelativePath(reference)) {
      continue;
    }
    plans.push({
      sourcePath: toNativePath(joinNormalized(documentSource, reference), documentSource),
      targetPath: toNativePath(
        joinNormalized(outputRoot, CONTENT_ASSET_DIR, reference),
        outputRoot
      ),
    });
  }
  return plans;
}

async function copyAssets(
  bridge: IServiceBridge,
  references: readonly string[],
  documentSource: string,
  outputRoot: string,
  warnings: ICardToHtmlWarning[]
): Promise<number> {
  const plans = planAssetCopy(references, documentSource, outputRoot);
  let copied = 0;
  for (const plan of plans) {
    const targetParent = dirnameNormalized(plan.targetPath);
    await bridge.request('file:mkdir', { path: targetParent, recursive: true });
    try {
      await bridge.request('file:copy', {
        source: plan.sourcePath,
        target: plan.targetPath,
        overwrite: true,
      });
      copied += 1;
    } catch (error) {
      if (hasChipsErrorCode(error, FILE_NOT_FOUND_CODE)) {
        warnings.push({
          code: 'CONVERTER_RESOURCE_MISSING',
          message: `资源 ${basenameNormalized(plan.sourcePath)} 不在文档包内，产物中的引用将指向缺失文件。`,
        });
        continue;
      }
      throw error;
    }
  }
  return copied;
}

/** `content-converter.card-to-html` 原子操作。 */
export async function convertCardToHtml(
  bridge: IServiceBridge,
  input: unknown
): Promise<ICardToHtmlOutput> {
  const request = normalizeCardToHtmlInput(input);

  if (request.output.packageMode === 'zip') {
    throw createInputUnsupportedError(
      '压缩态导出依赖宿主压缩能力域，该域尚未在平台登记；当前只支持目录态（directory）导出。',
      'zip-package-mode-unavailable'
    );
  }

  const warnings: ICardToHtmlWarning[] = [];
  let outputPrepared = false;
  try {
    await ensureOutputReady(bridge, request.output.path, request.output.overwrite);
    outputPrepared = true;

    const model = await readCardDocumentModel(bridge, request.source);
    warnings.push(...model.nodeWarnings);

    const built = buildCardHtml(model, { includeAssets: request.options.includeAssets });
    if (!request.options.includeAssets && built.assetReferences.length > 0) {
      warnings.push({
        code: 'CONVERTER_ASSETS_SKIPPED',
        message: 'includeAssets=false：产物保留包内相对引用，未复制资源文件。',
      });
    }

    let assetCount = 0;
    if (request.options.includeAssets) {
      assetCount = await copyAssets(
        bridge,
        built.assetReferences,
        model.source,
        request.output.path,
        warnings
      );
    }

    const manifestBody = request.options.includeManifest
      ? JSON.stringify(
          buildConversionManifest({
            documentId: model.documentId,
            source: request.source,
            model,
            packageMode: 'directory',
            includeAssets: request.options.includeAssets,
            assetCount,
            warnings,
          }),
          null,
          2
        )
      : undefined;
    if (!request.options.includeManifest) {
      warnings.push({
        code: 'CONVERTER_MANIFEST_SKIPPED',
        message: 'includeManifest=false：产物未包含 conversion-manifest.json。',
      });
    }

    await bridge.request('file:write', {
      path: toNativePath(joinNormalized(request.output.path, ENTRY_FILE), request.output.path),
      data: built.html,
    });
    if (manifestBody !== undefined) {
      await bridge.request('file:write', {
        path: toNativePath(joinNormalized(request.output.path, MANIFEST_FILE), request.output.path),
        data: manifestBody,
      });
    }

    return {
      packageMode: 'directory',
      outputPath: request.output.path,
      entryFile: ENTRY_FILE,
      ...(manifestBody !== undefined ? { manifestFile: MANIFEST_FILE } : {}),
      documentId: model.documentId,
      digest: model.digest,
      assetCount,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } catch (error) {
    if (outputPrepared) {
      try {
        await bridge.request('file:delete', {
          path: toNativePath(request.output.path, request.output.path),
          recursive: true,
        });
      } catch {
        // 尽力清理：不掩盖原始错误。
      }
    }
    throw error;
  }
}
