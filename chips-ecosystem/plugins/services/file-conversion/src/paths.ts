/**
 * 路径解析纯函数：旧 planner 路径算法语义逐字迁移
 * （分隔符按基路径探测、Windows 卷前缀、尾部分隔符归一；零平台依赖）。
 */

const WINDOWS_ROOT_PATTERN = /^[A-Za-z]:[\\/]/;

/** 分隔符探测：含反斜杠或 Windows 卷前缀即按反斜杠归一。 */
const detectSeparator = (filePath: string): '/' | '\\' => {
  return filePath.includes('\\') || WINDOWS_ROOT_PATTERN.test(filePath) ? '\\' : '/';
};

/** 按正反分隔符切分并丢弃空段。 */
export const splitSegments = (filePath: string): string[] => {
  return filePath.split(/[\\/]+/).filter((segment) => segment.length > 0);
};

/** 目录部分：根返回分隔符本身、盘根返回带分隔符卷前缀、无分隔符返回点。 */
export const dirname = (filePath: string): string => {
  const separator = detectSeparator(filePath);
  const normalized = filePath.replace(/[\\/]+$/, '');
  const lastSeparatorIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (lastSeparatorIndex < 0) {
    return '.';
  }

  const rootMatch = normalized.match(/^[A-Za-z]:/);
  if (lastSeparatorIndex === 0) {
    return normalized.startsWith('/') || normalized.startsWith('\\') ? separator : '.';
  }

  if (rootMatch && lastSeparatorIndex === rootMatch[0].length) {
    return `${rootMatch[0]}${separator}`;
  }

  return normalized.slice(0, lastSeparatorIndex);
};

/** 末段；无段时回退原串。 */
export const basename = (filePath: string): string => {
  const segments = splitSegments(filePath);
  return segments.at(-1) ?? filePath;
};

/** 以基路径分隔符拼接；保留前导分隔符与 Windows 卷前缀并归并重复分隔符。 */
export const joinPath = (basePath: string, ...segments: string[]): string => {
  const separator = detectSeparator(basePath);
  const rootPrefix = basePath.match(/^[A-Za-z]:[\\/]/)?.[0] ?? '';
  const startsWithSeparator = basePath.startsWith('/') || basePath.startsWith('\\');

  const normalizedBase = splitSegments(basePath);
  const normalizedSegments = segments.flatMap((segment) => splitSegments(segment));
  const joined = [...normalizedBase, ...normalizedSegments].join(separator);

  if (rootPrefix) {
    return `${rootPrefix}${joined.slice(rootPrefix.length)}`.replace(/[\\/]+/g, separator);
  }

  if (startsWithSeparator) {
    return `${separator}${joined}`;
  }

  return joined;
};
