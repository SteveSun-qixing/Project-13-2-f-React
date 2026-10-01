/**
 * 卡片根相对资源路径文法（《01-卡片文件格式》§8.2、§9.4）。
 *
 * 资源引用一律相对卡片根目录解析（不相对 `content/` 目录或当前 YAML 文件），
 * 路径分隔符统一正斜杠，禁止 `..` 路径逃逸；协议化引用（`file://`、`http(s)://`、
 * `chips-resource://`、`blob:`、`data:` 等）、绝对路径、查询串与片段均不是
 * 卡片内部资源路径的合法形态。
 */

/** 按 `/` 切分路径段，丢弃空段（连续分隔符与首尾分隔符归一）。 */
function splitPath(input: string): string[] {
  return input
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0);
}

/**
 * 归一卡片根相对资源路径。
 *
 * @param input - 原始路径值（允许 `null` / `undefined`，便于直读 YAML 字段）
 * @returns 合法时返回归一后的卡片根相对路径；不属于内部资源路径合法形态时返回 `null`
 */
export function normalizeRelativeResourcePath(input: string | null | undefined): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  const normalized = input.replace(/\\/g, '/').trim();
  if (!normalized) {
    return null;
  }

  if (
    /^[a-z][a-z0-9+.-]*:/i.test(normalized) ||
    normalized.startsWith('//') ||
    normalized.startsWith('/') ||
    normalized.includes('?') ||
    normalized.includes('#')
  ) {
    return null;
  }

  const withoutPrefix = normalized.replace(/^\.?\//, '');
  const segments = splitPath(withoutPrefix);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }

  return segments.join('/');
}
