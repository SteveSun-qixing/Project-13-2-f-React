/**
 * 纯路径工具：包内相对路径安全校验、平台路径归一与相对 URL 编码。
 *
 * 不访问任何系统 API；仅对宿主能力入参/出参中的路径字符串做确定性处理
 * （Win32/POSIX 双形态兼容口径与旧导出链一致）。
 */

const WINDOWS_ABSOLUTE_PATTERN = /^[A-Za-z]:\//;

/** 归一为 `/` 分隔形态；折叠重复分隔符并去除尾部分隔符。 */
export function normalizePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (
    normalized.length > 1 &&
    normalized.endsWith('/') &&
    normalized !== '/' &&
    !WINDOWS_ABSOLUTE_PATTERN.test(normalized)
  ) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

/** 依据参照路径判定分隔符形态（参照含 `\` 或盘符前缀时输出 Win32 形态）。 */
export function toNativePath(normalizedPath: string, referencePath: string): string {
  const reference = detectSeparator(referencePath);
  return reference === '\\' ? normalizedPath.replace(/\//g, '\\') : normalizedPath;
}

function detectSeparator(filePath: string): '/' | '\\' {
  return filePath.includes('\\') || /^[A-Za-z]:[\\/]/.test(filePath) ? '\\' : '/';
}

function getRoot(normalizedPath: string): string {
  if (normalizedPath.startsWith('/')) {
    return '/';
  }
  const driveMatch = normalizedPath.match(/^[A-Za-z]:\//);
  return driveMatch ? driveMatch[0] : '';
}

function splitSegments(normalizedPath: string): string[] {
  return normalizedPath.split('/').filter((segment) => segment.length > 0);
}

/** 去除路径根（`/` 或盘符前缀）后的剩余形态，供分段与再拼接复用。 */
function stripRoot(normalizedPath: string, root: string): string {
  if (root === '/') {
    return normalizedPath.slice(1);
  }
  return root ? normalizedPath.slice(root.length) : normalizedPath;
}

/** 以 `/` 形态拼接（保留基准路径根）。 */
export function joinNormalized(basePath: string, ...segments: string[]): string {
  const normalizedBase = normalizePath(basePath);
  const root = getRoot(normalizedBase);
  const joined = [
    ...splitSegments(stripRoot(normalizedBase, root)),
    ...segments.flatMap((segment) => splitSegments(normalizePath(segment))),
  ].join('/');
  if (!root) {
    return joined;
  }
  return root === '/' ? `/${joined}` : `${root}${joined}`;
}

/** 父目录（`/` 形态）；无父段时返回根或 `.`。 */
export function dirnameNormalized(filePath: string): string {
  const normalizedPath = normalizePath(filePath);
  const root = getRoot(normalizedPath);
  const segments = splitSegments(stripRoot(normalizedPath, root));
  if (segments.length === 0) {
    return root || '.';
  }
  const parent = segments.slice(0, -1).join('/');
  if (!root) {
    return parent || '.';
  }
  return root === '/' ? `/${parent}` : `${root}${parent}`;
}

/** 末段文件名/目录名。 */
export function basenameNormalized(filePath: string): string {
  return splitSegments(normalizePath(filePath)).at(-1) ?? '';
}

/**
 * 包内相对资源路径安全校验（01-卡片文件格式资源引用口径）：
 * 必须为相对路径，禁止根前缀、`..` 段、反斜杠与空段。
 */
export function isSafePackageRelativePath(value: string): boolean {
  if (value.length === 0 || value.includes('\\')) {
    return false;
  }
  if (value.startsWith('/') || WINDOWS_ABSOLUTE_PATTERN.test(value)) {
    return false;
  }
  const segments = value.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

/** 相对 URL 编码：逐段 `encodeURIComponent`，保留 `/` 分层。 */
export function encodeRelativeUrlPath(relativePath: string): string {
  return relativePath
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/** 稳定文件名净化（导出诊断用；保留字母数字与 `_.-`，含扩展名点号）。 */
export function toSafeFileStem(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : fallback;
}
