import type { FileEntry, ZipEntryMeta } from 'chips-sdk';
import type {
    BasecardArchiveDiscardedEntry,
    BasecardArchiveImportedEntry,
    BasecardArchiveImportFilter,
    BasecardArchiveImportRequest,
    BasecardArchiveImportResult,
} from '../basecard-runtime/contracts';
import { generateId62 } from '../utils/id';

interface ArchiveImportServices {
    getPathForFile(file: unknown): string;
    listZipEntries(zipPath: string): Promise<ZipEntryMeta[]>;
    extractZip(zipPath: string, outputDir: string): Promise<string>;
    listFiles(dir: string, options?: { recursive?: boolean }): Promise<FileEntry[]>;
    readBinary(path: string): Promise<Uint8Array>;
    writeBinary(path: string, content: Uint8Array): Promise<void>;
    move(sourcePath: string, destPath: string): Promise<void>;
    delete(path: string, options?: { recursive?: boolean }): Promise<void>;
    exists(path: string): Promise<boolean>;
}

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

function isImageMimeType(mimeType: string | undefined): boolean {
    return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

function getExtensionMimeType(filePath: string): string | undefined {
    return EXTENSION_MIME_TABLE[getExtension(filePath)];
}

function joinPath(...parts: string[]): string {
    return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

function normalizeRelativePath(value: string): string | null {
    const normalized = value.replace(/\\/g, '/').trim();
    if (!normalized) {
        return null;
    }

    const segments = normalized
        .replace(/^\.?\//, '')
        .split('/')
        .filter((segment) => segment.length > 0 && segment !== '.');
    if (segments.length === 0 || segments.some((segment) => segment === '..')) {
        return null;
    }

    return segments.join('/');
}

function stripPayloadRoot(entryPath: string, payloadRoot: string): string | null {
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
}

function sanitizeRootDirName(value: string): string {
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
}

function fileNameFromPath(resourcePath: string): string {
    return resourcePath.split('/').filter(Boolean).pop() ?? resourcePath;
}

function getExtension(filePath: string): string {
    const fileName = fileNameFromPath(filePath).toLowerCase();
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex >= 0 && dotIndex < fileName.length - 1 ? fileName.slice(dotIndex + 1) : '';
}

async function readBinaryFromFileLike(file: unknown): Promise<Uint8Array | null> {
    if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
        return null;
    }

    const arrayBufferFn = (file as { arrayBuffer?: unknown }).arrayBuffer;
    if (typeof arrayBufferFn !== 'function') {
        return null;
    }

    const arrayBuffer = await arrayBufferFn.call(file) as ArrayBuffer;
    return new Uint8Array(arrayBuffer);
}

function toRelativeChildPath(rootDir: string, absolutePath: string): string | null {
    const normalizedRoot = rootDir.replace(/\\/g, '/').replace(/\/+$/, '');
    const normalizedPath = absolutePath.replace(/\\/g, '/');
    if (normalizedPath === normalizedRoot) {
        return '';
    }
    if (!normalizedPath.startsWith(`${normalizedRoot}/`)) {
        return null;
    }
    return normalizedPath.slice(normalizedRoot.length + 1);
}

function isIgnoredArchiveArtifact(relativePath: string): boolean {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized) {
        return false;
    }

    const segments = normalized.split('/');
    const fileName = segments[segments.length - 1] ?? '';
    return segments.includes('__MACOSX') || fileName === '.DS_Store' || fileName.startsWith('._');
}

function zipEntryToImportedEntry(input: {
    entry: ZipEntryMeta;
    sourcePath: string;
    resourcePath: string;
    mimeType?: string;
}): BasecardArchiveImportedEntry {
    return {
        sourcePath: input.sourcePath,
        resourcePath: input.resourcePath,
        fileName: fileNameFromPath(input.sourcePath),
        mimeType: input.mimeType,
        size: input.entry.size,
        compressedSize: input.entry.compressedSize,
        crc32: input.entry.crc32,
        offset: input.entry.offset,
        isDirectory: input.entry.isDirectory,
        compressionMethod: input.entry.compressionMethod,
        modifiedTime: input.entry.modifiedTime,
    };
}

function createDiscardedEntry(
    sourcePath: string,
    reason: BasecardArchiveDiscardedEntry['reason'],
    mimeType?: string,
): BasecardArchiveDiscardedEntry {
    return {
        sourcePath,
        reason,
        fileName: fileNameFromPath(sourcePath),
        mimeType,
    };
}

export function resolveArchivePayloadRoot(
    entries: readonly (Pick<ZipEntryMeta, 'path'> & Partial<Pick<ZipEntryMeta, 'isDirectory'>>)[],
    entryFileInput?: string,
): { payloadRoot: string; entryFile: string } {
    const entryFile = normalizeRelativePath(entryFileInput ?? 'index.html');
    if (!entryFile) {
        throw new Error('压缩包入口文件路径无效。');
    }

    const filePaths = entries
        .filter((entry) => !entry.isDirectory && !entry.path.endsWith('/'))
        .map((entry) => entry.path)
        .filter((entryPath) => !isIgnoredArchiveArtifact(entryPath));

    if (filePaths.includes(entryFile)) {
        return {
            payloadRoot: '',
            entryFile,
        };
    }

    const topLevelDirs = Array.from(
        new Set(
            filePaths
                .map((entryPath) => entryPath.split('/')[0] ?? '')
                .filter((segment) => segment.length > 0),
        ),
    );

    if (topLevelDirs.length === 1) {
        const [topLevelDir] = topLevelDirs;
        if (topLevelDir && filePaths.includes(`${topLevelDir}/${entryFile}`)) {
            return {
                payloadRoot: topLevelDir,
                entryFile,
            };
        }
    }

    throw new Error(`压缩包根目录必须包含入口文件 ${entryFile}，或仅包含一个顶层目录且其下存在该入口文件。`);
}

function resolveGenericPayloadRoot(entries: readonly ZipEntryMeta[], excludeSystemArtifacts: boolean): string {
    const filePaths = entries
        .filter((entry) => !entry.isDirectory && !entry.path.endsWith('/'))
        .map((entry) => entry.path)
        .filter((entryPath) => !excludeSystemArtifacts || !isIgnoredArchiveArtifact(entryPath));

    const topLevelDirs = Array.from(
        new Set(
            filePaths
                .map((entryPath) => entryPath.split('/')[0] ?? '')
                .filter((segment) => segment.length > 0),
        ),
    );

    return topLevelDirs.length === 1 ? topLevelDirs[0] ?? '' : '';
}

async function cleanupIgnoredArchiveArtifacts(
    rootDir: string,
    services: Pick<ArchiveImportServices, 'listFiles' | 'delete'>,
): Promise<void> {
    const entries = await services.listFiles(rootDir, { recursive: true });
    const directoriesToDelete = new Set<string>();

    for (const entry of entries) {
        const relativePath = toRelativeChildPath(rootDir, entry.path);
        if (relativePath === null || relativePath.length === 0) {
            continue;
        }

        if (entry.isDirectory && relativePath.split('/').includes('__MACOSX')) {
            directoriesToDelete.add(entry.path);
            continue;
        }

        if (entry.isFile && isIgnoredArchiveArtifact(relativePath)) {
            await services.delete(entry.path);
        }
    }

    for (const directoryPath of Array.from(directoriesToDelete).sort((left, right) => right.length - left.length)) {
        await services.delete(directoryPath, { recursive: true });
    }
}

async function cleanupEmptyDirectories(
    rootDir: string,
    services: Pick<ArchiveImportServices, 'listFiles' | 'delete'>,
): Promise<void> {
    const entries = await services.listFiles(rootDir, { recursive: true });
    const directories = entries
        .filter((entry) => entry.isDirectory)
        .map((entry) => entry.path)
        .sort((left, right) => right.length - left.length);

    for (const directoryPath of directories) {
        const children = await services.listFiles(directoryPath);
        if (children.length === 0) {
            await services.delete(directoryPath, { recursive: true });
        }
    }
}

async function chooseBundleRootDir(
    cardRootDir: string,
    preferredRootDir: string | undefined,
    services: Pick<ArchiveImportServices, 'exists'>,
): Promise<string> {
    const normalizedPreferred = preferredRootDir ? sanitizeRootDirName(preferredRootDir) : 'archive-bundle';

    while (true) {
        const candidate = `${normalizedPreferred}-${generateId62(6).toLowerCase()}`;
        if (!(await services.exists(joinPath(cardRootDir, candidate)))) {
            return candidate;
        }
    }
}

function detectImageMimeType(bytes: Uint8Array, fileName: string): string | undefined {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'image/jpeg';
    }

    if (
        bytes.length >= 8 &&
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

    if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        return 'image/gif';
    }

    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {
        return 'image/webp';
    }

    if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
        return 'image/bmp';
    }

    if (
        bytes.length >= 12 &&
        bytes[4] === 0x66 &&
        bytes[5] === 0x74 &&
        bytes[6] === 0x79 &&
        bytes[7] === 0x70 &&
        bytes[8] === 0x61 &&
        bytes[9] === 0x76 &&
        bytes[10] === 0x69 &&
        bytes[11] === 0x66
    ) {
        return 'image/avif';
    }

    if (
        bytes.length >= 4 &&
        ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
            (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
    ) {
        return 'image/tiff';
    }

    const extensionMime = IMAGE_MIME_BY_EXTENSION[getExtension(fileName)];
    if (extensionMime === 'image/svg+xml') {
        const snippet = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 512))).toLowerCase();
        return snippet.includes('<svg') ? 'image/svg+xml' : undefined;
    }

    return extensionMime;
}

function shouldReadBytesForFilter(filePath: string): boolean {
    const extensionMime = getExtensionMimeType(filePath);
    return isImageMimeType(extensionMime) || extensionMime === undefined;
}

async function resolveImportedMimeType(
    sourcePath: string,
    sourceAbsolutePath: string,
    filter: BasecardArchiveImportFilter | undefined,
    services: Pick<ArchiveImportServices, 'readBinary'>,
): Promise<string | undefined> {
    const extensionMime = getExtensionMimeType(sourcePath);

    if (extensionMime === 'image/svg+xml') {
        const bytes = await services.readBinary(sourceAbsolutePath);
        if (bytes) {
            const snippet = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 512))).toLowerCase();
            if (snippet.includes('<svg')) {
                return 'image/svg+xml';
            }
        }
        return extensionMime;
    }

    if (!shouldReadBytesForFilter(sourcePath)) {
        return extensionMime;
    }

    const bytes = await services.readBinary(sourceAbsolutePath);
    return detectImageMimeType(bytes, sourcePath) ?? extensionMime;
}

function matchesMimePattern(mimeType: string | undefined, patterns: readonly string[] | undefined): boolean {
    if (!patterns || patterns.length === 0) {
        return true;
    }
    if (!mimeType) {
        return false;
    }

    return patterns.some((pattern) => {
        const normalizedPattern = pattern.trim().toLowerCase();
        if (normalizedPattern.endsWith('/*')) {
            return mimeType.toLowerCase().startsWith(normalizedPattern.slice(0, -1));
        }
        return mimeType.toLowerCase() === normalizedPattern;
    });
}

function matchesExtension(filePath: string, extensions: readonly string[] | undefined): boolean {
    if (!extensions || extensions.length === 0) {
        return true;
    }

    const extension = getExtension(filePath);
    return extensions.some((item) => item.trim().toLowerCase().replace(/^\./, '') === extension);
}

function matchesArchiveFilter(filePath: string, mimeType: string | undefined, filter: BasecardArchiveImportFilter | undefined): boolean {
    return matchesMimePattern(mimeType, filter?.mimeTypes) && matchesExtension(filePath, filter?.extensions);
}

export async function importArchiveBundleIntoCardRoot(input: {
    cardRootDir: string;
    request: BasecardArchiveImportRequest;
    services: ArchiveImportServices;
}): Promise<BasecardArchiveImportResult> {
    const { cardRootDir, request, services } = input;
    const stageRootDir = joinPath(cardRootDir, '.card', '__archive_import__', generateId62(8).toLowerCase());
    const stageExtractDir = joinPath(stageRootDir, 'payload');
    const stageZipPath = joinPath(stageRootDir, 'source.zip');
    let zipPath = services.getPathForFile(request.file);
    if (!zipPath) {
        const stagedZipData = await readBinaryFromFileLike(request.file);
        if (!stagedZipData) {
            throw new Error('当前宿主无法读取所选压缩包文件。');
        }
        await services.writeBinary(stageZipPath, stagedZipData);
        zipPath = stageZipPath;
    }

    let finalBundleDir = '';
    let shouldCleanupFinalDir = true;

    try {
        const zipEntries = await services.listZipEntries(zipPath);
        const requestedEntryFile = normalizeRelativePath(request.entryFile ?? '');
        const excludeSystemArtifacts = request.excludeSystemArtifacts !== false;

        const requiredEntry = requestedEntryFile
            ? resolveArchivePayloadRoot(zipEntries, requestedEntryFile)
            : null;
        const payloadRoot = requiredEntry
            ? requiredEntry.payloadRoot
            : request.stripSingleRootDir === false
                ? ''
                : resolveGenericPayloadRoot(zipEntries, excludeSystemArtifacts);
        const entryFile = requiredEntry?.entryFile;
        const payloadSourceDir = payloadRoot ? joinPath(stageExtractDir, payloadRoot) : stageExtractDir;
        const bundleRootDir = await chooseBundleRootDir(cardRootDir, request.preferredRootDir ?? request.file.name, services);
        finalBundleDir = joinPath(cardRootDir, bundleRootDir);
        const keepRelativePaths = new Set<string>();
        const importedEntries: BasecardArchiveImportedEntry[] = [];
        const discardedEntries: BasecardArchiveDiscardedEntry[] = [];

        await services.extractZip(zipPath, stageExtractDir);
        if (excludeSystemArtifacts) {
            await cleanupIgnoredArchiveArtifacts(stageExtractDir, services);
        }

        if (entryFile && !(await services.exists(joinPath(payloadSourceDir, entryFile)))) {
            throw new Error(`压缩包中缺少入口文件 ${entryFile}。`);
        }

        for (const entry of zipEntries) {
            const sourcePath = entry.path;
            const relativePath = stripPayloadRoot(sourcePath, payloadRoot);
            if (!relativePath) {
                discardedEntries.push(createDiscardedEntry(sourcePath, entry.isDirectory ? 'directory' : 'unsafe-path'));
                continue;
            }

            if (entry.isDirectory || sourcePath.endsWith('/')) {
                discardedEntries.push(createDiscardedEntry(sourcePath, 'directory'));
                continue;
            }

            if (excludeSystemArtifacts && isIgnoredArchiveArtifact(sourcePath)) {
                discardedEntries.push(createDiscardedEntry(sourcePath, 'system-artifact'));
                continue;
            }

            const sourceAbsolutePath = joinPath(stageExtractDir, sourcePath);
            if (!(await services.exists(sourceAbsolutePath))) {
                discardedEntries.push(createDiscardedEntry(sourcePath, 'unsafe-path'));
                continue;
            }

            const mimeType = await resolveImportedMimeType(sourcePath, sourceAbsolutePath, request.include, services);
            if (!matchesArchiveFilter(relativePath, mimeType, request.include)) {
                discardedEntries.push(createDiscardedEntry(sourcePath, 'filter-mismatch', mimeType));
                continue;
            }

            keepRelativePaths.add(relativePath);
            importedEntries.push(zipEntryToImportedEntry({
                entry,
                sourcePath,
                resourcePath: joinPath(bundleRootDir, relativePath),
                mimeType,
            }));
        }

        if (importedEntries.length === 0) {
            throw new Error('压缩包中没有符合导入规则的资源。');
        }

        const stageFiles = await services.listFiles(payloadSourceDir, { recursive: true });
        for (const file of stageFiles.filter((entry) => entry.isFile)) {
            const relativePath = toRelativeChildPath(payloadSourceDir, file.path);
            if (!relativePath || !keepRelativePaths.has(relativePath)) {
                await services.delete(file.path);
            }
        }
        await cleanupEmptyDirectories(payloadSourceDir, services);
        await services.move(payloadSourceDir, finalBundleDir);

        shouldCleanupFinalDir = false;
        const sortedEntries = importedEntries.sort((left, right) => left.resourcePath.localeCompare(right.resourcePath));
        return {
            rootDir: bundleRootDir,
            entryFile,
            resourcePaths: sortedEntries.map((entry) => entry.resourcePath),
            entries: sortedEntries,
            discardedEntries,
        };
    } catch (error) {
        if (shouldCleanupFinalDir && finalBundleDir && (await services.exists(finalBundleDir))) {
            await services.delete(finalBundleDir, { recursive: true });
        }
        throw error;
    } finally {
        if (await services.exists(stageRootDir)) {
            await services.delete(stageRootDir, { recursive: true });
        }
    }
}
