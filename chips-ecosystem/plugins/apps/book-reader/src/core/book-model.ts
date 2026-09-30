import { BRIGHTNESS_DEFAULT, clampBrightness } from './reader-palette';

export interface LaunchBookTarget {
  sourceId: string;
  filePath?: string | undefined;
  fileName?: string | undefined;
  mimeType?: string | undefined;
  title?: string | undefined;
  author?: string | undefined;
  relativePath?: string | undefined;
}

export interface BookSourceDescriptor {
  sourceId: string;
  filePath?: string | undefined;
  fileName: string;
  title: string;
  author?: string | undefined;
  mimeType?: string | undefined;
  format?: string | undefined;
  resourceUri?: string | undefined;
  isRemote: boolean;
}

export interface ReaderFeedback {
  tone: 'info' | 'success' | 'error';
  message: string;
}

export type ReaderReadingMode = 'paginated' | 'scroll';
export type ReaderBackgroundTone = 'theme' | 'warm' | 'mist' | 'night' | 'system';
export type ReaderMoveDirection = 'previous' | 'next';
export type ReaderFontFamily = 'serif' | 'sans' | 'round' | 'system';
export type ReaderTextAlign = 'justify' | 'left';
export type ReaderWritingMode = 'horizontal' | 'vertical';

export interface ReaderPreferences {
  fontScale: number;
  contentWidth: number;
  fontFamily: ReaderFontFamily;
  readingMode: ReaderReadingMode;
  backgroundTone: ReaderBackgroundTone;
  /** 行高倍数（1.4–2.0，默认 1.65）；旧存储缺失时回退默认值。 */
  lineHeight?: number | undefined;
  /** 字距（em，0–0.06，默认 0.01）；旧存储缺失时回退默认值。 */
  letterSpacing?: number | undefined;
  /** 正文对齐方式（两端对齐/左对齐，默认两端对齐）；旧存储缺失时回退默认值。 */
  textAlign?: ReaderTextAlign | undefined;
  /** 排版方向（横排/竖排，默认横排）；旧存储缺失时回退默认值。 */
  writingMode?: ReaderWritingMode | undefined;
  /** 亮度（0.6–1.0，默认 1）；旧存储缺失时回退默认值。 */
  brightness?: number | undefined;
}

export const MIN_LINE_HEIGHT = 1.4;
export const MAX_LINE_HEIGHT = 2;
export const DEFAULT_LINE_HEIGHT = 1.65;
export const MAX_LETTER_SPACING = 0.06;
export const DEFAULT_LETTER_SPACING = 0.01;

/** 阅读偏好默认值：与 normalizeReaderPreferences 的归一收敛点一致。 */
export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  fontScale: 1,
  contentWidth: 760,
  fontFamily: 'serif',
  readingMode: 'paginated',
  backgroundTone: 'system',
  lineHeight: DEFAULT_LINE_HEIGHT,
  letterSpacing: DEFAULT_LETTER_SPACING,
  textAlign: 'justify',
  writingMode: 'horizontal',
  brightness: BRIGHTNESS_DEFAULT,
};

export const READER_FONT_FAMILY_STACKS: Record<ReaderFontFamily, string> = {
  serif: `Georgia, "Iowan Old Style", "Songti SC", "SimSun", serif`,
  sans: `-apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`,
  round: `"Yuanti SC", "Hiragino Maru Gothic ProN", "YouYuan", "幼圆", "Microsoft YaHei", sans-serif`,
  system: `system-ui, -apple-system, sans-serif`,
};

export const SUPPORTED_BOOK_EXTENSIONS = [
  '.epub',
  '.epub3',
  '.pdf',
  '.txt',
  '.md',
  '.markdown',
  '.fb2',
  '.rtf',
  '.mobi',
  '.azw',
  '.azw3',
  '.djvu',
  '.djv',
  '.doc',
  '.docx',
];
export const SUPPORTED_BOOK_EXTENSION_LABEL = SUPPORTED_BOOK_EXTENSIONS.join(' ');
export const SUPPORTED_BOOK_MIME_TYPES = [
  'application/epub+zip',
  'application/oebps-package+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/markdown',
  'application/x-fictionbook+xml',
  'application/rtf',
  'text/rtf',
  'application/x-mobipocket-ebook',
  'application/vnd.amazon.ebook',
  'image/vnd.djvu',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
export const READER_RENDERABLE_FORMATS = [
  'epub',
  'epub3',
  'pdf',
  'txt',
  'md',
  'markdown',
  'fb2',
  'rtf',
] as const;
export const READER_READING_MODES = [
  'paginated',
  'scroll',
] as const satisfies readonly ReaderReadingMode[];
export const READER_BACKGROUND_TONES = [
  'system',
  'theme',
  'warm',
  'mist',
  'night',
] as const satisfies readonly ReaderBackgroundTone[];

const FORMAT_BY_MIME_TYPE: Record<string, string> = {
  'application/epub+zip': 'epub',
  'application/oebps-package+xml': 'epub',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/x-markdown': 'md',
  'application/markdown': 'md',
  'application/x-fictionbook+xml': 'fb2',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'application/x-mobipocket-ebook': 'mobi',
  'application/vnd.amazon.ebook': 'azw',
  'image/vnd.djvu': 'djvu',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export function resolveWheelNavigationThreshold(input: {
  readingMode: ReaderReadingMode;
  deltaMode: number;
}): number {
  if (input.deltaMode === 2) {
    return 1;
  }

  if (input.readingMode === 'paginated') {
    return input.deltaMode === 1 ? 8 : 14;
  }

  return input.deltaMode === 1 ? 6 : 10;
}

export function resolveExtension(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.trim().toLowerCase();
    const dotIndex = pathname.lastIndexOf('.');
    return dotIndex >= 0 ? pathname.slice(dotIndex) : '';
  } catch {
    const lowered = normalized.toLowerCase();
    const slashIndex = Math.max(lowered.lastIndexOf('/'), lowered.lastIndexOf('\\'));
    const dotIndex = lowered.lastIndexOf('.');
    if (dotIndex <= slashIndex) {
      return '';
    }
    return lowered.slice(dotIndex);
  }
}

export function normalizeBookFormat(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase().replace(/^\./, '') ?? '';
  return normalized === 'markdown' ? 'md' : normalized;
}

export function resolveBookFormat(target: LaunchBookTarget): string {
  const mimeType = target.mimeType?.trim().toLowerCase();
  if (mimeType && FORMAT_BY_MIME_TYPE[mimeType]) {
    return FORMAT_BY_MIME_TYPE[mimeType];
  }

  const extension = resolveExtension(target.fileName ?? target.filePath ?? target.sourceId);
  return normalizeBookFormat(extension);
}

export function isRenderableBookFormat(format: string): boolean {
  return READER_RENDERABLE_FORMATS.includes(
    normalizeBookFormat(format) as (typeof READER_RENDERABLE_FORMATS)[number]
  );
}

export function resolveFileName(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.trim();
    if (pathname) {
      const segments = pathname.split('/').filter(Boolean);
      return segments[segments.length - 1] ?? pathname;
    }
  } catch {
    // ignore and continue with plain path parsing
  }

  const segments = normalized.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? normalized;
}

export function resolveBookTitle(target: LaunchBookTarget): string {
  return (
    target.title?.trim() ||
    target.fileName?.trim() ||
    resolveFileName(target.filePath ?? target.sourceId) ||
    target.sourceId
  );
}

export function isProbablyRemoteBookSource(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isLikelyLocalPath(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'file:';
  } catch {
    return true;
  }
}

export function isSupportedBookResource(target: LaunchBookTarget): boolean {
  const mimeType = target.mimeType?.trim().toLowerCase();
  if (mimeType && SUPPORTED_BOOK_MIME_TYPES.includes(mimeType)) {
    return true;
  }

  const extension = resolveExtension(target.filePath ?? target.sourceId);
  return SUPPORTED_BOOK_EXTENSIONS.includes(extension);
}

export function createBookSourceDescriptor(target: LaunchBookTarget): BookSourceDescriptor {
  const filePath = target.filePath?.trim() || undefined;
  const sourceId = target.sourceId.trim();
  const fileName = target.fileName?.trim() || resolveFileName(filePath ?? sourceId) || 'book';

  return {
    sourceId,
    filePath,
    fileName,
    title: resolveBookTitle(target),
    author: target.author?.trim() || undefined,
    mimeType: target.mimeType?.trim() || undefined,
    format: resolveBookFormat(target),
    isRemote: !filePath && isProbablyRemoteBookSource(sourceId),
  };
}

export function clampFontScale(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(1.4, Math.max(0.85, Number(value.toFixed(2))));
}

export function clampLineHeight(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_LINE_HEIGHT;
  }
  return Math.min(MAX_LINE_HEIGHT, Math.max(MIN_LINE_HEIGHT, Number(value.toFixed(2))));
}

export function clampLetterSpacing(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_LETTER_SPACING;
  }
  return Math.min(MAX_LETTER_SPACING, Math.max(0, Number(value.toFixed(3))));
}

export function clampContentWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return 760;
  }
  return Math.min(980, Math.max(560, Math.round(value)));
}

export function normalizeReadingMode(value: string | null | undefined): ReaderReadingMode {
  return value === 'scroll' ? 'scroll' : 'paginated';
}

export function normalizeBackgroundTone(value: string | null | undefined): ReaderBackgroundTone {
  if (
    value === 'theme' ||
    value === 'warm' ||
    value === 'mist' ||
    value === 'night' ||
    value === 'system'
  ) {
    return value;
  }

  return 'system';
}

export function normalizeFontFamily(value: string | null | undefined): ReaderFontFamily {
  if (value === 'sans' || value === 'round' || value === 'system') {
    return value;
  }

  return 'serif';
}

export function normalizeTextAlign(value: string | null | undefined): ReaderTextAlign {
  return value === 'left' ? 'left' : 'justify';
}

export function normalizeWritingMode(value: string | null | undefined): ReaderWritingMode {
  return value === 'vertical' ? 'vertical' : 'horizontal';
}

export function normalizeReaderPreferences(preferences: ReaderPreferences): ReaderPreferences {
  return {
    fontScale: clampFontScale(preferences.fontScale),
    contentWidth: clampContentWidth(preferences.contentWidth),
    fontFamily: normalizeFontFamily(preferences.fontFamily),
    readingMode: normalizeReadingMode(preferences.readingMode),
    backgroundTone: normalizeBackgroundTone(preferences.backgroundTone),
    lineHeight: clampLineHeight(preferences.lineHeight),
    letterSpacing: clampLetterSpacing(preferences.letterSpacing),
    textAlign: normalizeTextAlign(preferences.textAlign),
    writingMode: normalizeWritingMode(preferences.writingMode),
    brightness: clampBrightness(preferences.brightness ?? BRIGHTNESS_DEFAULT),
  };
}
