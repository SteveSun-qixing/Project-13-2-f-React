/**
 * Markdown 资源引用纯逻辑（旧 `richtext-BCP/src/shared/{utils,resource-links}.ts` 迁移）。
 *
 * 迁移口径（旧功能覆盖矩阵-三插件仓库 :41，判定=迁移）：
 * - 相对资源路径判定与归一（`normalizeResourcePath`）逐字迁移；
 * - 旧 `rewriteRelativeResourceUrls` 的 `file://` Bridge 读臂与 `fetch` 臂**作废**：
 *   渲染帧内禁 `fetch` / `window.chips`（04-基础卡片插件开发指南 §8.4），包内相对引用
 *   经帧注入的 `<base href>` 直接生效（§8.1），无需运行时改写；
 * - 锚点安全属性（`target=_blank` + `rel="noopener noreferrer"`）与锚点分类保留为纯函数，
 *   供查看态挂载安全 HTML 后统一加固。
 */

/** 卡片类型正式 ID（与 manifest `capabilities.cardTypes[0].id`、09-官方插件与应用目录一致）。 */
export const RICHTEXT_CARD_TYPE = 'base.richtext';

/**
 * 归一一个包内相对资源路径；绝对路径、协议引用、查询与锚点、`.`/`..` 段一律拒绝。
 *
 * 纯函数；返回空串表示不是合法的包内相对路径。
 *
 * @param resourcePath - 任意输入
 * @returns 归一后的 `/` 分隔相对路径；非法时为空串
 */
export function normalizeResourcePath(resourcePath: unknown): string {
  if (typeof resourcePath !== 'string') {
    return '';
  }

  const normalized = resourcePath.replace(/\\/g, '/').trim();
  if (!normalized) {
    return '';
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized) || normalized.startsWith('//') || normalized.startsWith('/')) {
    return '';
  }

  const withoutPrefix = normalized.replace(/^\.?\//, '');
  if (
    withoutPrefix.startsWith('/') ||
    withoutPrefix.includes('?') ||
    withoutPrefix.includes('#')
  ) {
    return '';
  }

  const segments = withoutPrefix.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    return '';
  }

  return segments.join('/');
}

/** 是否为非空白字符串。 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 是否为合法的包内相对资源引用（归一后非空）。 */
export function isRelativeResourcePath(value: string | undefined): value is string {
  return isNonEmptyString(value) && normalizeResourcePath(value).length > 0;
}

/** 是否为外部 URL（协议引用、协议相对或页内锚点）。 */
export function isExternalUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//') || value.startsWith('#');
}

/** 是否为卡片根目录相对 `.md` 路径（file 来源正文文件形态）。 */
export function isMarkdownFilePath(value: string | undefined): value is string {
  if (!isRelativeResourcePath(value)) {
    return false;
  }
  const normalized = normalizeResourcePath(value);
  return normalized.toLowerCase().endsWith('.md');
}

/** 去重并按字典序稳定排序资源路径（08-基础卡片插件接口 §2.4.5 规则 3）。 */
export function dedupeResourcePaths(paths: readonly (string | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const path of paths) {
    const normalized = normalizeResourcePath(path);
    if (normalized) {
      seen.add(normalized);
    }
  }
  return Array.from(seen).sort((left, right) => left.localeCompare(right));
}

/** Markdown 内链接/图片/内联 HTML 资源引用的扫描形态（旧 utils.ts 迁移）。 */
const MARKDOWN_RESOURCE_PATTERN =
  /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)|<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>|<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;

/**
 * 收集 Markdown 源文引用的全部包内相对资源路径。
 *
 * 纯函数；`http(s)` 等协议引用与绝对路径不进入结果（08 §2.4.5 规则 2）。
 *
 * @param markdown - Markdown 源文
 * @returns 去重且稳定排序的资源路径
 */
export function collectMarkdownResourcePaths(markdown: string): string[] {
  const paths: string[] = [];
  for (const match of markdown.matchAll(MARKDOWN_RESOURCE_PATTERN)) {
    const rawPath = match[1] ?? match[2] ?? match[3] ?? '';
    const normalized = normalizeResourcePath(rawPath);
    if (normalized) {
      paths.push(normalized);
    }
  }
  return dedupeResourcePaths(paths);
}

/** 锚点目标分类（旧 `rewriteRelativeResourceUrls` 分支逻辑的纯函数化）。 */
export type MarkdownAnchorKind = 'empty' | 'external' | 'resource';

/**
 * 分类一个锚点 `href`：空值、外部 URL（含页内锚点）或包内相对资源引用。
 *
 * @param href - 锚点 `href` 原始值
 * @returns 锚点分类
 */
export function classifyMarkdownAnchor(href: string | undefined): MarkdownAnchorKind {
  if (!isNonEmptyString(href)) {
    return 'empty';
  }
  if (isRelativeResourcePath(href)) {
    return 'resource';
  }
  return 'external';
}

/**
 * 外链锚点的安全属性（旧实现逐字迁移）：新窗口打开并切断 opener 关系。
 *
 * 渲染帧沙箱对导航的最终裁决归平台；插件侧只保证声明语义正确。
 */
export const ANCHOR_SAFE_ATTRIBUTES: Readonly<{ target: string; rel: string }> = Object.freeze({
  target: '_blank',
  rel: 'noopener noreferrer',
});

/** 查看态锚点资源路径的数据属性名（平台打开通道接线后的读取面）。 */
export const ANCHOR_RESOURCE_PATH_ATTRIBUTE = 'data-chips-resource-path';
