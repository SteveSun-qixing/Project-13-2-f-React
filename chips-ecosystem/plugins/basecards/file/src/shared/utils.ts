/* eslint-disable no-control-regex --
 * 导入文件名清洗按文件系统非法字符口径剥离控制字符（\u0000-\u001f），
 * 控制字符出现在正则中是本函数的清洗语义而非缺陷；本文件自旧族 file-BCP
 * 逐字迁移，保持该语义（music 判例同口径）。
 */

/**
 * 文件基础卡片共享纯函数（自旧族 file-BCP/src/shared/utils.ts 迁移）。
 *
 * 归一口径对齐新架构：《06-资源协议规范》§2.4 拒绝反斜杠、绝对路径与带 scheme 引用；
 * 《01-卡片文件格式》§6.9 补充校验拒绝查询串（`?`）与片段标识（`#`）。
 * 旧 Host 注入面辅助（cloneConfig、resolveResourceUrlWithRetry）随旧架构作废，不迁。
 */

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 归一包内相对资源路径（08-基础卡片插件接口 §2.4.5、《06-资源协议规范》§2.4）：
 * 剥除引导 `./`，拒绝空段、`.` 与 `..` 段；反斜杠分隔符、绝对路径、带 scheme 的引用
 * （`http(s):`、`file:`、`chips-resource:` 等）与查询串、片段标识一律拒绝并返回 `undefined`。
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
  if (working.includes('?') || working.includes('#')) {
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

export function deriveFileStem(resourcePath: string | undefined): string {
  const fileName = resolveFileName(resourcePath);
  if (!fileName) {
    return '';
  }

  return stripFileExtension(fileName);
}

/** 后缀徽标展示文本：去点、小写化后大写展示，截断到 4 字符。 */
export function formatExtensionBadge(fileExtension: string): string {
  const normalized = fileExtension.trim().toLowerCase().replace(/^\./u, '');
  if (!normalized) {
    return '';
  }

  return normalized.slice(0, 4).toUpperCase();
}

/**
 * 导入文件名清洗（编辑器资源导入通道就绪后消费）：剥除路径段、剔除文件系统非法字符、
 * 空白折叠为连字符；清洗结果为空时回退传入的兜底词干。
 */
export function sanitizeImportedFileName(fileName: string, fallbackStem: string): string {
  const sanitized = fileName
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim() ?? '';

  return sanitized || fallbackStem;
}
