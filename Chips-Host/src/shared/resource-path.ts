/**
 * 资源路径公共工具（主进程侧实现）
 *
 * 与 `chips-sdk` 侧同语义实现保持一致的纯函数集合（生态共用工具，见工单154）。
 * 渲染进程侧消费方统一从 chips-sdk 导入；主进程侧消费方从本模块导入。
 * 两侧实现必须保持逻辑一致，任何一侧变更须同步另一侧并更新对应契约测试。
 */

/** 将资源路径规范化为相对路径；非法输入（空、`..` 逃逸等）返回 null。 */
export const normalizeRelativeResourcePath = (resourcePath: unknown): string | null => {
  if (typeof resourcePath !== 'string') {
    return null;
  }

  const normalized = resourcePath.replace(/\\/g, '/').trim();
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
};

/** 拼接路径片段并统一分隔符（不校验绝对/相对语义）。 */
export const joinResourcePath = (...parts: string[]): string => {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
};

/** 将本地文件路径编码为 file:// URL。 */
export const createFileUrl = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`);
  }

  const absolutePath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return encodeURI(`file://${absolutePath}`);
};
