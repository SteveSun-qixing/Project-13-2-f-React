const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 是否为非空白字符串。 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 生成图片项稳定 ID：`image-<base62>`（编辑器新增图片项使用）。 */
export function generateImageId(length = 10): string {
  let id = '';
  for (let index = 0; index < length; index += 1) {
    id += BASE62_ALPHABET[Math.floor(Math.random() * BASE62_ALPHABET.length)];
  }
  return `image-${id}`;
}

/**
 * 归一包内相对资源路径（《06-资源协议规范》§2.4、《08-基础卡片插件接口》§2.4.5）：
 * 剥除引导 `./`，拒绝空段、`.` 与 `..` 段；反斜杠分隔符、绝对路径与带 scheme 的引用
 * （`http(s):`、`webdav:`、`file:`、`chips-resource:` 等）一律拒绝并返回 `undefined`。
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

/** 取路径最后一段作为文件名；非法路径返回空串。 */
export function resolveFileName(resourcePath: string | undefined): string {
  const normalized = normalizeRelativeCardResourcePath(resourcePath);
  if (!normalized) {
    return '';
  }

  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? '';
}

/** 从远程地址取展示用文件名（最后一段）；解析失败返回空串。 */
export function resolveUrlFileName(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? '';
  } catch {
    return '';
  }
}

/**
 * 按扩展名推断图片 MIME（与《09》§5.2 图片查看器 primary 声明同口径，另含 TIFF）。
 */
export function inferImageMimeType(reference: string): string | undefined {
  const lower = reference.toLowerCase();

  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.gif')) {
    return 'image/gif';
  }
  if (lower.endsWith('.bmp')) {
    return 'image/bmp';
  }
  if (lower.endsWith('.svg')) {
    return 'image/svg+xml';
  }
  if (lower.endsWith('.avif')) {
    return 'image/avif';
  }
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) {
    return 'image/tiff';
  }

  return undefined;
}

/**
 * 数组内移动一个元素（拖拽排序的纯操作）。
 */
export function arrayMove<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const next = items.slice();
  const moved = next[fromIndex];
  if (moved === undefined) {
    return next;
  }
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * 拖拽落点纯函数：在与拖拽图块中心欧氏距离最近的槽位插入。
 *
 * `rects` 为除拖拽项外的可见图块矩形（顺序即呈现顺序）；无图块时回落到末尾槽位。
 */
export function resolveInsertionIndex(
  clientX: number,
  clientY: number,
  rects: ReadonlyArray<{ left: number; top: number; width: number; height: number }>,
  fallbackCount: number
): number {
  if (rects.length === 0) {
    return Math.max(0, fallbackCount);
  }

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
    if (!rect) {
      continue;
    }
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(clientX - centerX, clientY - centerY);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }

  return Math.max(0, Math.min(nearestIndex, fallbackCount));
}
