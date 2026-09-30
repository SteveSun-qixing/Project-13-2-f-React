const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

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

export function inferAudioMimeType(resourcePath: string): string | undefined {
  const lower = resolveFileName(resourcePath).toLowerCase();

  if (lower.endsWith('.mp3')) {
    return 'audio/mpeg';
  }
  if (lower.endsWith('.flac')) {
    return 'audio/flac';
  }
  if (lower.endsWith('.wav')) {
    return 'audio/wav';
  }
  if (lower.endsWith('.ogg') || lower.endsWith('.oga')) {
    return 'audio/ogg';
  }
  if (lower.endsWith('.m4a')) {
    return 'audio/mp4';
  }
  if (lower.endsWith('.aac')) {
    return 'audio/aac';
  }
  if (lower.endsWith('.opus')) {
    return 'audio/opus';
  }
  if (lower.endsWith('.webm')) {
    return 'audio/webm';
  }

  return undefined;
}

export function splitArtists(value: string): string[] {
  return value
    .split(/(?:\s*\/\s*|\s*&\s*|\s*,\s*|\s*;\s*|\s+feat\.?\s+|\s+ft\.?\s+|、|，)/iu)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
