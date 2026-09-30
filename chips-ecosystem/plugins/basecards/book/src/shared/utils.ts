const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 受支持电子书格式（《09-官方插件与应用目录》§4.2 book 行；格式表随旧族迁移）。 */
export const SUPPORTED_EBOOK_FORMATS = [
  'epub',
  'epub3',
  'pdf',
  'txt',
  'md',
  'markdown',
  'mobi',
  'azw',
  'azw3',
  'fb2',
  'djvu',
  'djv',
  'rtf',
  'doc',
  'docx',
] as const;

/** 受支持图片包格式（ZIP 解包漫画序列）。 */
export const ARCHIVE_FORMATS = ['zip', 'cbz'] as const;

const EBOOK_MIME_BY_FORMAT: Record<string, string> = {
  epub: 'application/epub+zip',
  epub3: 'application/epub+zip',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  mobi: 'application/x-mobipocket-ebook',
  azw: 'application/vnd.amazon.ebook',
  azw3: 'application/vnd.amazon.ebook',
  fb2: 'application/x-fictionbook+xml',
  djvu: 'image/vnd.djvu',
  djv: 'image/vnd.djvu',
  rtf: 'application/rtf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  tiff: 'image/tiff',
  tif: 'image/tiff',
};

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function generateStableId(prefix: string, length = 10): string {
  let id = '';

  for (let index = 0; index < length; index += 1) {
    id += BASE62_ALPHABET[Math.floor(Math.random() * BASE62_ALPHABET.length)];
  }

  return `${prefix}-${id}`;
}

/**
 * 归一包内相对资源路径（08-基础卡片插件接口 §2.4.5、《06-资源协议规范》§2.4）：
 * 剥除引导 `./`，拒绝空段、`.` 与 `..` 段；反斜杠分隔符、绝对路径与带 scheme 的引用
 * （`http(s):`、`file:`、`chips-resource:` 等）一律拒绝并返回 `undefined`。
 */
export function normalizeRelativeCardResourcePath(value: unknown): string | undefined {
  if (!isNonEmptyString(value)) {
    return undefined;
  }

  const working = value.trim();
  if (!working || working.includes('\\') || working.startsWith('/')) {
    return undefined;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(working)) {
    return undefined;
  }

  const normalized = working.replace(/^\.\//, '');
  if (!normalized) {
    return undefined;
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    return undefined;
  }

  return segments.join('/');
}

export function resolveFileName(resourcePath: string | undefined): string {
  const normalized = normalizeRelativeCardResourcePath(resourcePath);
  if (!normalized) {
    return '';
  }

  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? '';
}

export function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/u, '');
}

export function resolveFileExtension(fileName: string): string {
  const match = /\.([^.]+)$/u.exec(resolveFileName(fileName));
  return match?.[1]?.toLowerCase() ?? '';
}

/** 归一书籍格式：小写、剥引导点、折叠别名（epub3 保留、markdown 折叠为 md）。 */
export function normalizeBookFormat(value: unknown): string {
  const format = typeof value === 'string' ? value.trim().toLowerCase().replace(/^\./, '') : '';
  if (format === 'epub3') {
    return 'epub3';
  }

  if (format === 'markdown') {
    return 'md';
  }

  return format;
}

export function inferBookFormatFromFileName(fileName: string): string {
  return normalizeBookFormat(resolveFileExtension(fileName));
}

export function isSupportedEbookFormat(format: string): boolean {
  return SUPPORTED_EBOOK_FORMATS.includes(
    normalizeBookFormat(format) as (typeof SUPPORTED_EBOOK_FORMATS)[number]
  );
}

export function isArchiveFormat(format: string): boolean {
  return ARCHIVE_FORMATS.includes(normalizeBookFormat(format) as (typeof ARCHIVE_FORMATS)[number]);
}

/** 推断书籍 MIME：输入为格式标识或文件名/路径。 */
export function inferBookMimeType(formatOrPath: string): string | undefined {
  const normalized = normalizeBookFormat(
    formatOrPath.includes('.') ? inferBookFormatFromFileName(formatOrPath) : formatOrPath
  );

  return EBOOK_MIME_BY_FORMAT[normalized];
}

export function inferImageMimeTypeFromPath(fileName: string): string | undefined {
  return IMAGE_MIME_BY_EXTENSION[resolveFileExtension(fileName)];
}

/** 字节级图片 MIME 嗅探（随旧族迁移：魔数优先，扩展名兜底，SVG 需内容佐证）。 */
export function detectImageMimeType(bytes: Uint8Array, fileName?: string): string | undefined {
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

  const extensionMime = fileName ? inferImageMimeTypeFromPath(fileName) : undefined;
  if (extensionMime === 'image/svg+xml') {
    const snippet = new TextDecoder()
      .decode(bytes.slice(0, Math.min(bytes.length, 512)))
      .toLowerCase();
    return snippet.includes('<svg') ? 'image/svg+xml' : undefined;
  }

  return extensionMime;
}

export function isImageFileName(fileName: string): boolean {
  return Boolean(inferImageMimeTypeFromPath(fileName));
}

/** 清洗导入文件名为单段安全名（随旧族迁移，导入臂回填建议名用）。 */
export function sanitizeImportedFileName(fileName: string, fallback = 'book-resource'): string {
  const trimmed = fileName.trim();
  const sanitized =
    trimmed
      .replace(/\\/g, '/')
      .split('/')
      .pop()
      // 控制字符段（NUL–US）是文件名清洗的剥离目标，非输入校验，属规则误报，定向豁免。
      // eslint-disable-next-line no-control-regex
      ?.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim() ?? '';

  return sanitized.length > 0 ? sanitized : fallback;
}

/** 文件名自然序比较（数字段按数值，大小写不敏感；随旧族迁移）。 */
export function compareFileNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/** 可排序图片条目的最小形状（配置图片条目与打开载荷引用共用）。 */
export interface ISortableImageItem {
  file_path: string;
  file_name: string;
  source_entry_path?: string | undefined;
  entry_time?: number | undefined;
}

export type ImageSortBasis = 'filename' | 'entry-time';

/**
 * 图片序列排序（随旧族迁移）：entry-time 依据仅在存在可分辨条目时间时生效，
 * 缺时间条目排后；filename 依据按来源条目路径（缺省文件名）自然序，稳定保序。
 */
export function sortImageItems<T extends ISortableImageItem>(images: readonly T[], basis: ImageSortBasis): T[] {
  const copied = images.map((image, index) => ({ image, index }));
  const hasDistinctEntryTime =
    new Set(
      copied
        .map(({ image }) => image.entry_time)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    ).size > 1;

  copied.sort((left, right) => {
    if (basis === 'entry-time' && hasDistinctEntryTime) {
      const leftTime = left.image.entry_time;
      const rightTime = right.image.entry_time;
      if (typeof leftTime === 'number' && typeof rightTime === 'number' && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      if (typeof leftTime === 'number' && typeof rightTime !== 'number') {
        return -1;
      }
      if (typeof leftTime !== 'number' && typeof rightTime === 'number') {
        return 1;
      }
    }

    const byName = compareFileNames(
      left.image.source_entry_path || left.image.file_name,
      right.image.source_entry_path || right.image.file_name
    );
    return byName === 0 ? left.index - right.index : byName;
  });

  return copied.map(({ image }) => image);
}

/** 带重试的资源解析（随旧族迁移）：瞬时失败重试，耗尽后抛最后一次错误。 */
export async function resolveResourceUrlWithRetry(
  resolveResourceUrl: (resourcePath: string) => Promise<string>,
  resourcePath: string,
  retryCount = 3,
  retryDelayMs = 80
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < retryCount; attempt += 1) {
    try {
      return await resolveResourceUrl(resourcePath);
    } catch (error) {
      lastError = error;
      if (attempt < retryCount - 1) {
        await new Promise((resolve) => {
          setTimeout(resolve, retryDelayMs);
        });
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('资源解析失败');
}
