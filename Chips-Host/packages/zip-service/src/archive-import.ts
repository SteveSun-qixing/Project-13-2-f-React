/**
 * ZIP 目录导入（生态通用资源导入能力）
 *
 * 逻辑来源：Chips-EditingEngine `src/editor-runtime/archive-import.ts`（task034 M4 上移）。
 * 语义冻结：`zip.extract` 是原语（解到指定目录），`resource.importArchive` 是业务语义
 * （payload 根探测 / 过滤 / 系统垃圾清理 / 暂存回滚）。
 * 输入输出契约与 SDK `CardEditorArchiveImportRequest/Result` 对齐。
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { normalizeRelativeResourcePath } from '../../../src/shared/resource-path';
import type { StoreZipService } from './zip-store';

export type ArchiveImportFilter = {
  mimeTypes?: string[];
  extensions?: string[];
};

export type ArchiveDiscardedReason = 'directory' | 'system-artifact' | 'filter-mismatch' | 'unsafe-path';

export interface ArchiveImportedEntry {
  sourcePath: string;
  resourcePath: string;
  fileName: string;
  mimeType?: string;
  size: number;
  compressedSize: number;
  crc32: number;
  offset: number;
  isDirectory: boolean;
  compressionMethod: number;
  modifiedTime?: number;
}

export interface ArchiveDiscardedEntry {
  sourcePath: string;
  reason: ArchiveDiscardedReason;
  fileName?: string;
  mimeType?: string;
}

export interface ArchiveImportRequest {
  /** ZIP 文件路径（Host 可访问） */
  zipFile: string;
  /** 目标根目录（导入完成后资源位于 targetRoot/<rootDir>/ 下） */
  targetRoot: string;
  preferredRootDir?: string;
  entryFile?: string;
  include?: ArchiveImportFilter;
  stripSingleRootDir?: boolean;
  excludeSystemArtifacts?: boolean;
}

export interface ArchiveImportResult {
  rootDir: string;
  entryFile?: string;
  resourcePaths: string[];
  entries: ArchiveImportedEntry[];
  discardedEntries: ArchiveDiscardedEntry[];
}

const EXTENSION_MIME_TABLE: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  json: 'application/json',
  webmanifest: 'application/manifest+json',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  wasm: 'application/wasm',
  pdf: 'application/pdf',
  map: 'application/json',
};

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  webp: 'image/webp',
};

const normalizeRelativePath = normalizeRelativeResourcePath;

const joinPath = (...parts: string[]): string => {
  return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
};

const fileNameFromPath = (resourcePath: string): string => {
  return resourcePath.split('/').filter(Boolean).pop() ?? resourcePath;
};

const getExtension = (filePath: string): string => {
  const fileName = fileNameFromPath(filePath).toLowerCase();
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 && dotIndex < fileName.length - 1 ? fileName.slice(dotIndex + 1) : '';
};

const getExtensionMimeType = (filePath: string): string | undefined => {
  return EXTENSION_MIME_TABLE[getExtension(filePath)];
};

const isImageMimeType = (mimeType: string | undefined): boolean => {
  return typeof mimeType === 'string' && mimeType.startsWith('image/');
};

const stripPayloadRoot = (entryPath: string, payloadRoot: string): string | null => {
  const normalizedEntry = normalizeRelativePath(entryPath);
  if (!normalizedEntry) {
    return null;
  }
  if (!payloadRoot) {
    return normalizedEntry;
  }
  return normalizedEntry === payloadRoot
    ? ''
    : normalizedEntry.startsWith(`${payloadRoot}/`)
      ? normalizedEntry.slice(payloadRoot.length + 1)
      : null;
};

const sanitizeRootDirName = (value: string): string => {
  const withoutExtension = value.replace(/\.(zip|cbz)$/i, '').trim();
  const normalized = withoutExtension
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .toLowerCase();
  return normalized.length > 0 ? normalized : 'archive-bundle';
};

const isIgnoredArchiveArtifact = (relativePath: string): boolean => {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) {
    return false;
  }
  const segments = normalized.split('/');
  const fileName = segments[segments.length - 1] ?? '';
  return segments.includes('__MACOSX') || fileName === '.DS_Store' || fileName.startsWith('._');
};

const toRelativeChildPath = (rootDir: string, absolutePath: string): string | null => {
  const normalizedRoot = rootDir.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedPath = absolutePath.replace(/\\/g, '/');
  if (normalizedPath === normalizedRoot) {
    return '';
  }
  if (!normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return null;
  }
  return normalizedPath.slice(normalizedRoot.length + 1);
};

/** 入口文件定位：返回 payloadRoot 与 entryFile。 */
export function resolveArchivePayloadRoot(
  entries: Array<{ path: string; isDirectory: boolean }>,
  entryFileInput?: string,
): { payloadRoot: string; entryFile: string } {
  const entryFile = normalizeRelativePath(entryFileInput ?? 'index.html') ?? 'index.html';
  const filePaths = entries
    .filter((entry) => !entry.isDirectory && !entry.path.endsWith('/'))
    .map((entry) => normalizeRelativePath(entry.path))
    .filter((entryPath): entryPath is string => Boolean(entryPath));

  const candidates = [
    entryFile,
    `index.html`,
    `index.htm`,
    `index.xhtml`,
  ];
  const matched = filePaths.find((filePath) => candidates.some((candidate) => filePath === candidate));
  if (!matched) {
    return { payloadRoot: '', entryFile };
  }

  const topLevelDirs = Array.from(
    new Set(
      filePaths
        .filter((filePath) => filePath !== matched)
        .map((filePath) => filePath.split('/')[0])
        .filter(Boolean),
    ),
  );
  const entryTopLevel = matched.split('/')[0];
  if (entryTopLevel && topLevelDirs.length === 1 && topLevelDirs[0] === entryTopLevel) {
    return { payloadRoot: entryTopLevel, entryFile: matched };
  }

  const directRootCandidates = topLevelDirs.filter((dir) => dir === entryTopLevel);
  const directRoot = directRootCandidates[0];
  if (directRootCandidates.length === 1 && directRoot && matched.startsWith(`${directRoot}/`)) {
    return { payloadRoot: directRoot, entryFile: matched };
  }

  return { payloadRoot: '', entryFile: matched };
}

/** 通用 payload 根探测：单一顶层目录时剥离。 */
export function resolveGenericPayloadRoot(
  entries: Array<{ path: string; isDirectory: boolean }>,
  excludeSystemArtifacts: boolean,
): string {
  const filePaths = entries
    .filter((entry) => !entry.isDirectory && !entry.path.endsWith('/'))
    .map((entry) => normalizeRelativePath(entry.path))
    .filter((entryPath): entryPath is string => Boolean(entryPath))
    .filter((filePath) => !excludeSystemArtifacts || !isIgnoredArchiveArtifact(filePath));

  const topLevelDirs = Array.from(
    new Set(
      filePaths
        .map((filePath) => filePath.split('/')[0])
        .filter(Boolean),
    ),
  );

  if (topLevelDirs.length === 1) {
    return topLevelDirs[0] ?? '';
  }
  return '';
}

const createDiscardedEntry = (
  sourcePath: string,
  reason: ArchiveDiscardedReason,
  mimeType?: string,
): ArchiveDiscardedEntry => ({
  sourcePath,
  reason,
  fileName: fileNameFromPath(sourcePath),
  mimeType,
});

/** 执行 ZIP 目录导入（解压 → 探测 → 过滤 → 暂存移动 → 失败回滚）。 */
export async function importArchiveBundle(input: ArchiveImportRequest, zip: StoreZipService): Promise<ArchiveImportResult> {
  const { zipFile, targetRoot, preferredRootDir, entryFile: entryFileInput, include, stripSingleRootDir, excludeSystemArtifacts } = input;

  const excludeSystem = excludeSystemArtifacts !== false;
  const stageRootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-archive-import-'));
  const stageExtractDir = path.join(stageRootDir, 'payload');
  let finalBundleDir = '';
  let shouldCleanupFinalDir = true;

  try {
    const zipEntries = await zip.list(zipFile);
    const requestedEntryFile = normalizeRelativePath(entryFileInput ?? '') ?? '';
    const requiredEntry = requestedEntryFile
      ? resolveArchivePayloadRoot(zipEntries, requestedEntryFile)
      : null;
    const payloadRoot = requiredEntry
      ? requiredEntry.payloadRoot
      : stripSingleRootDir === false
        ? ''
        : resolveGenericPayloadRoot(zipEntries, excludeSystem);
    const entryFile = requiredEntry?.entryFile;

    const zipBaseName = path.basename(zipFile);
    const bundleDirName = sanitizeRootDirName(preferredRootDir ?? zipBaseName);
    let candidateDir = path.join(targetRoot, bundleDirName);
    let counter = 1;
    while (await fs.stat(candidateDir).then(() => true).catch(() => false)) {
      counter += 1;
      candidateDir = path.join(targetRoot, `${bundleDirName}-${counter}`);
    }
    finalBundleDir = candidateDir;

    const keepRelativePaths = new Set<string>();
    const importedEntries: ArchiveImportedEntry[] = [];
    const discardedEntries: ArchiveDiscardedEntry[] = [];

    await zip.extract(zipFile, stageExtractDir);

    if (excludeSystem) {
      await cleanupIgnoredArchiveArtifacts(stageExtractDir);
    }

    const payloadSourceDir = payloadRoot ? path.join(stageExtractDir, payloadRoot) : stageExtractDir;

    if (entryFile && !(await fs.stat(path.join(payloadSourceDir, entryFile)).then(() => true).catch(() => false))) {
      throw new Error(`压缩包中缺少入口文件 ${entryFile}。`);
    }

    for (const entry of zipEntries) {
      const sourcePath = entry.path;
      const relativePath = stripPayloadRoot(sourcePath, payloadRoot);
      if (!relativePath) {
        discardedEntries.push(createDiscardedEntry(sourcePath, 'unsafe-path'));
        continue;
      }
      if (entry.isDirectory || sourcePath.endsWith('/')) {
        discardedEntries.push(createDiscardedEntry(sourcePath, 'directory'));
        continue;
      }
      if (excludeSystem && isIgnoredArchiveArtifact(sourcePath)) {
        discardedEntries.push(createDiscardedEntry(sourcePath, 'system-artifact'));
        continue;
      }

      const sourceAbsolutePath = path.join(stageExtractDir, sourcePath);
      if (!(await fs.stat(sourceAbsolutePath).then(() => true).catch(() => false))) {
        discardedEntries.push(createDiscardedEntry(sourcePath, 'unsafe-path'));
        continue;
      }

      const mimeType = getExtensionMimeType(sourcePath);
      if (include?.mimeTypes?.length || include?.extensions?.length) {
        const extension = getExtension(sourcePath);
        const mimeMatch = !include.mimeTypes?.length || (mimeType ? include.mimeTypes.includes(mimeType) : false);
        const extensionMatch = !include.extensions?.length || include.extensions.includes(extension);
        if (!mimeMatch || !extensionMatch) {
          discardedEntries.push(createDiscardedEntry(sourcePath, 'filter-mismatch', mimeType));
          continue;
        }
      }

      let actualMimeType = mimeType;
      if (isImageMimeType(mimeType) && IMAGE_MIME_BY_EXTENSION[getExtension(sourcePath)]) {
        actualMimeType = detectImageMimeType(await fs.readFile(sourceAbsolutePath)) ?? mimeType;
      }

      const targetAbsolutePath = path.join(finalBundleDir, relativePath);
      await fs.mkdir(path.dirname(targetAbsolutePath), { recursive: true });
      await fs.rename(sourceAbsolutePath, targetAbsolutePath);

      keepRelativePaths.add(relativePath);
      importedEntries.push({
        sourcePath,
        resourcePath: relativePath,
        fileName: fileNameFromPath(sourcePath),
        mimeType: actualMimeType,
        size: entry.size,
        compressedSize: entry.compressedSize,
        crc32: entry.crc32,
        offset: entry.offset,
        isDirectory: entry.isDirectory,
        compressionMethod: entry.compressionMethod,
        modifiedTime: entry.modifiedTime,
      });
    }

    await cleanupEmptyDirectories(finalBundleDir);
    const resourcePaths = [...keepRelativePaths].sort();
    shouldCleanupFinalDir = false;

    return {
      rootDir: bundleDirName,
      ...(entryFile ? { entryFile } : {}),
      resourcePaths,
      entries: importedEntries,
      discardedEntries,
    };
  } finally {
    await fs.rm(stageRootDir, { recursive: true, force: true });
    if (shouldCleanupFinalDir && finalBundleDir) {
      await fs.rm(finalBundleDir, { recursive: true, force: true });
    }
  }
}

/** 魔数嗅探图片真实类型（不信任扩展名）。 */
export function detectImageMimeType(data: Uint8Array): string | null {
  if (data.length < 12) {
    return null;
  }
  const bytes = data;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif';
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  ) {
    return 'image/tiff';
  }
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  ) {
    return 'image/avif';
  }
  if (bytes[0] === 0x3c && bytes[1] === 0x73 && bytes[2] === 0x76 && bytes[3] === 0x67) {
    return 'image/svg+xml';
  }
  return null;
}

async function cleanupIgnoredArchiveArtifacts(rootDir: string): Promise<void> {
  const directoriesToDelete = new Set<string>();

  const walk = async (dir: string): Promise<void> => {
    let children;
    try {
      children = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const child of children) {
      const absolutePath = path.join(dir, child.name);
      const relativePath = toRelativeChildPath(rootDir, absolutePath);
      if (child.isDirectory()) {
        if (child.name === '__MACOSX') {
          directoriesToDelete.add(absolutePath);
          continue;
        }
        await walk(absolutePath);
        continue;
      }
      if (!child.isFile()) {
        continue;
      }
      if (relativePath && (child.name === '.DS_Store' || child.name.startsWith('._'))) {
        await fs.rm(absolutePath, { force: true });
      }
    }
  };

  await walk(rootDir);
  for (const directoryPath of Array.from(directoriesToDelete).sort((left, right) => right.length - left.length)) {
    await fs.rm(directoryPath, { recursive: true, force: true });
  }
}

async function cleanupEmptyDirectories(rootDir: string): Promise<void> {
  const walk = async (dir: string): Promise<void> => {
    let children;
    try {
      children = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const child of children) {
      if (child.isDirectory()) {
        await walk(path.join(dir, child.name));
      }
    }
    try {
      const remaining = await fs.readdir(dir);
      if (remaining.length === 0 && dir !== rootDir) {
        await fs.rmdir(dir);
      }
    } catch {
      // 目录清理失败不阻断
    }
  };
  await walk(rootDir);
}
