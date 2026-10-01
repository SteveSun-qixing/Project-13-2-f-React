/**
 * 可逆恢复清单（《16-卡片传输协议》§4.4 恢复清单线上 schema 的消费面模型）。
 *
 * 恢复清单由传输引擎生成并随 `complete` 提交、由服务器随卡片版本持久化、下载计划原样返回；
 * 本模块承载客户端侧的纯消费面：结构校验（§4.5 第 1 步「校验 schemaVersion 受支持、
 * 清单存在且结构合法」）与映射构建（§4.5 第 4 步「URL → 原始相对路径映射与富文本映射」）。
 * 清单不写入卡片包内、不包含预签名地址与服务器凭证（§4.4）。
 *
 * 结构非法时按 §八 错误码表如实上抛 `CARD_TRANSFER_MANIFEST_MISSING` / `CARD_TRANSFER_MANIFEST_INVALID`。
 */

import type { CardRelativePath } from './cardPaths';

/** 恢复清单结构版本（§4.4：当前 `1.0.0`）。 */
export const RESTORE_MANIFEST_SCHEMA_VERSION = '1.0.0' as const;

/** 恢复清单内一条资源对象记录（§4.4 `resources[]`）。 */
export interface RestoreManifestResource {
  readonly originalRelativePath: CardRelativePath;
  readonly networkUrl: string;
  readonly bucket: string;
  readonly objectKey: string;
  readonly sizeBytes: number;
  readonly mimeType: string;
  readonly sha256?: string;
}

/** 恢复清单内一条原始归档条目快照（§4.4 `zipEntries[]`）。 */
export interface RestoreManifestZipEntry {
  readonly order: number;
  readonly path: CardRelativePath;
  readonly size: number;
  readonly compressedSize: number;
  readonly crc32: number;
  readonly isDirectory: boolean;
  readonly compressionMethod: number;
  readonly modifiedTime?: number;
}

/** 富文本内联还原映射记录（§4.4 `richTextContentFiles[]`）。 */
export interface RestoreManifestRichTextContentFile {
  readonly configPath: CardRelativePath;
  readonly contentFile: CardRelativePath;
}

/** 可逆恢复清单（§4.4 线上 schema `1.0.0` 的类型化形态）。 */
export interface RestoreManifest {
  readonly schemaVersion: typeof RESTORE_MANIFEST_SCHEMA_VERSION;
  readonly originalFileName: string;
  readonly cardId: string;
  readonly versionId: string;
  readonly resources: readonly RestoreManifestResource[];
  readonly zipEntries: readonly RestoreManifestZipEntry[];
  readonly richTextContentFiles: readonly RestoreManifestRichTextContentFile[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readResources(value: unknown): RestoreManifestResource[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const resources: RestoreManifestResource[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    const originalRelativePath = readNonEmptyString(item['originalRelativePath']);
    const networkUrl = readNonEmptyString(item['networkUrl']);
    if (originalRelativePath === null || networkUrl === null) {
      return null;
    }
    resources.push({
      originalRelativePath,
      networkUrl,
      bucket: readNonEmptyString(item['bucket']) ?? '',
      objectKey: readNonEmptyString(item['objectKey']) ?? '',
      sizeBytes: readFiniteNumber(item['sizeBytes']) ?? 0,
      mimeType: readNonEmptyString(item['mimeType']) ?? 'application/octet-stream',
      ...(readNonEmptyString(item['sha256']) === null ? {} : { sha256: readNonEmptyString(item['sha256']) as string }),
    });
  }
  return resources;
}

function readZipEntries(value: unknown): RestoreManifestZipEntry[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const entries: RestoreManifestZipEntry[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    const order = readFiniteNumber(item['order']);
    const path = readNonEmptyString(item['path']);
    if (order === null || path === null) {
      return null;
    }
    const modifiedTime = readFiniteNumber(item['modifiedTime']);
    entries.push({
      order,
      path,
      size: readFiniteNumber(item['size']) ?? 0,
      compressedSize: readFiniteNumber(item['compressedSize']) ?? 0,
      crc32: readFiniteNumber(item['crc32']) ?? 0,
      isDirectory: readBoolean(item['isDirectory']) ?? false,
      compressionMethod: readFiniteNumber(item['compressionMethod']) ?? 0,
      ...(modifiedTime === null ? {} : { modifiedTime }),
    });
  }
  entries.sort((left, right) => left.order - right.order);
  return entries;
}

function readRichTextContentFiles(value: unknown): RestoreManifestRichTextContentFile[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const files: RestoreManifestRichTextContentFile[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    const configPath = readNonEmptyString(item['configPath']);
    const contentFile = readNonEmptyString(item['contentFile']);
    if (configPath === null || contentFile === null) {
      return null;
    }
    files.push({ configPath, contentFile });
  }
  return files;
}

/**
 * 校验并装载恢复清单（§4.5 第 1 步）：
 * - 非对象或 `schemaVersion` 缺失 → `null`（下载计划缺少清单，上层归 `CARD_TRANSFER_MANIFEST_MISSING`）；
 * - `schemaVersion` 不受支持或必填结构非法 → `CARD_TRANSFER_MANIFEST_INVALID` 错误。
 */
export function loadRestoreManifest(value: unknown): RestoreManifest | null {
  if (!isRecord(value)) {
    return null;
  }
  const schemaVersion = readNonEmptyString(value['schemaVersion']);
  if (schemaVersion === null) {
    return null;
  }
  if (schemaVersion !== RESTORE_MANIFEST_SCHEMA_VERSION) {
    throw Object.assign(
      new Error(`恢复清单结构版本不受支持：${schemaVersion}`),
      { code: 'CARD_TRANSFER_MANIFEST_INVALID' },
    );
  }

  const originalFileName = readNonEmptyString(value['originalFileName']);
  const cardId = readNonEmptyString(value['cardId']);
  const versionId = readNonEmptyString(value['versionId']);
  const resources = readResources(value['resources']);
  const zipEntries = readZipEntries(value['zipEntries']);
  const richTextContentFiles = readRichTextContentFiles(value['richTextContentFiles']);
  if (
    originalFileName === null ||
    cardId === null ||
    versionId === null ||
    resources === null ||
    zipEntries === null ||
    richTextContentFiles === null
  ) {
    throw Object.assign(new Error('恢复清单结构非法或字段缺失'), {
      code: 'CARD_TRANSFER_MANIFEST_INVALID',
    });
  }

  return {
    schemaVersion: RESTORE_MANIFEST_SCHEMA_VERSION,
    originalFileName,
    cardId,
    versionId,
    resources,
    zipEntries,
    richTextContentFiles,
  };
}

/** URL → 原始资源相对路径还原映射（§4.5 第 4 步：`resources[].networkUrl → originalRelativePath`）。 */
export function buildNetworkPathMap(manifest: RestoreManifest): ReadonlyMap<string, CardRelativePath> {
  const pathMap = new Map<string, CardRelativePath>();
  for (const resource of manifest.resources) {
    pathMap.set(resource.networkUrl, resource.originalRelativePath);
  }
  return pathMap;
}

/** 富文本内联还原映射（§4.5 第 5 步：`richTextContentFiles` 的 configPath → contentFile）。 */
export function buildRichTextContentFileMap(
  manifest: RestoreManifest,
): ReadonlyMap<CardRelativePath, CardRelativePath> {
  const contentFileMap = new Map<CardRelativePath, CardRelativePath>();
  for (const item of manifest.richTextContentFiles) {
    contentFileMap.set(item.configPath, item.contentFile);
  }
  return contentFileMap;
}

/** 建议下载输出文件名（§4.4 `originalFileName`：上传前源文件名含扩展名）。 */
export function suggestDownloadFileName(manifest: RestoreManifest): string {
  return manifest.originalFileName;
}
