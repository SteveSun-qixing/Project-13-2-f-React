import type { BaseCardView } from '@chips/sdk';
import type { IBaseCardPlugin } from '@chips/sdk';
import { CARD_TYPE_ID, DEFAULT_DISPLAY_CONFIG, DEFAULT_CAPABILITIES, buildContent, validateConfig } from './config';
import { DEFAULT_RICHTEXT_MARKDOWN } from './markdown/content';
import { collectMarkdownResourcePaths, isMarkdownFilePath, normalizeResourcePath } from './markdown/resource-links';

/**
 * 主进程入口集合（08-基础卡片插件接口 §2.5 双入口职责）：
 * 只承载 `validateConfig` / `createInitialContent` / `collectResourcePaths` 三个纯函数，
 * 构建为完全自包含的 `dist/index.js`。
 */

export { validateConfig } from './config';

/**
 * 创建新节点时的初始内容（08 §2.4.4）：inline 来源 + 默认正文 + 默认展示配置，
 * 必须能通过 validateConfig、内容校验与 configSchema。
 */
export function createInitialContent(): Record<string, unknown> {
  return buildContent(
    {
      card_type: CARD_TYPE_ID,
      content_format: 'markdown',
      content_source: 'inline',
      content_text: DEFAULT_RICHTEXT_MARKDOWN,
      locale: 'zh-CN',
      markdown_capabilities: { ...DEFAULT_CAPABILITIES },
    },
    { ...DEFAULT_DISPLAY_CONFIG }
  );
}

/**
 * 收集节点内容引用的包内相对资源路径（08 §2.4.5）：
 * - inline 来源：扫描正文中的链接 / 图片 / 内联 HTML 相对引用；
 * - file 来源：`content_file` 本身（卡片根目录相对 `.md`）。
 *
 * 返回去重且稳定排序；`http(s)` 等协议引用与绝对路径不进入清单。
 */
export function collectResourcePaths(basecard: BaseCardView): string[] {
  const resolved = basecard.content;
  const source = resolved['content_source'];
  if (source === 'file') {
    const contentFile = resolved['content_file'];
    return isMarkdownFilePath(typeof contentFile === 'string' ? contentFile : undefined)
      ? [normalizeResourcePath(contentFile)]
      : [];
  }
  const contentText = resolved['content_text'];
  return collectMarkdownResourcePaths(typeof contentText === 'string' ? contentText : '');
}

/** 主进程入口默认导出。 */
export const mainPlugin: Pick<
  IBaseCardPlugin,
  'validateConfig' | 'createInitialContent' | 'collectResourcePaths'
> = {
  validateConfig,
  createInitialContent,
  collectResourcePaths,
};

export default mainPlugin;
