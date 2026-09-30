import type { BaseCardView } from '@chips/sdk';
import { buildContent, validateConfig } from './config';
import type { IHyperlinkConfig } from './config';

/**
 * 主进程入口集合（08-基础卡片插件接口 §2.5 双入口职责）：
 * 只承载 `validateConfig` / `createInitialContent` / `collectResourcePaths` 三个纯函数，
 * 构建为完全自包含的 `dist/index.js`。
 */

export { validateConfig } from './config';

/**
 * 创建新节点时的初始内容（08 §2.4.4）：空配置，必须能通过 validateConfig 与 configSchema。
 */
export function createInitialContent(): Record<string, unknown> {
  const config: IHyperlinkConfig = {
    anchor_text: '',
    url: '',
    description: '',
    icon_url: '',
    display_density: 'comfortable',
    show_security_hint: true,
  };
  return buildContent(config);
}

/**
 * 收集节点内容引用的包内相对资源路径（08 §2.4.5）。
 *
 * 超链接卡片的 `url` / `icon_url` 均为 http(s) 外部引用（08 §2.4.5 规则 2：
 * http(s) 引用不进入资源清单），故恒返回空数组。
 */
export function collectResourcePaths(_basecard: BaseCardView): string[] {
  return [];
}

/** 主进程入口默认导出。 */
export const mainPlugin = {
  validateConfig,
  createInitialContent,
  collectResourcePaths,
};

export default mainPlugin;
