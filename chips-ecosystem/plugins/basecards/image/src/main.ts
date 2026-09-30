import type { BaseCardView } from '@chips/sdk';
import { buildContent, readConfig, validateConfig } from './config';

/**
 * 主进程入口集合（08-基础卡片插件接口 §2.5 双入口职责）：
 * 只承载 `validateConfig` / `createInitialContent` / `collectResourcePaths` 三个纯函数，
 * 构建为完全自包含的 `dist/index.js`。
 */

export { validateConfig } from './config';

/**
 * 创建新节点时的初始内容（08 §2.4.4）：空图片列表的合法空配置，
 * 必须能通过 validateConfig 与 configSchema。
 */
export function createInitialContent(): Record<string, unknown> {
  return buildContent(readConfig(undefined));
}

/**
 * 收集节点内容引用的包内相对资源路径（08 §2.4.5）：只收 `file` 来源图片的
 * `file_path`，归一后去重并稳定排序；`http(s)` / `webdav` 远程引用不进入资源清单。
 */
export function collectResourcePaths(basecard: BaseCardView): string[] {
  const config = readConfig(basecard.content['config']);
  const paths = config.images
    .filter((image) => image.source === 'file')
    .map((image) => image.file_path)
    .filter((path) => path.length > 0);
  return Array.from(new Set(paths)).sort();
}

/** 主进程入口默认导出。 */
export const mainPlugin = {
  validateConfig,
  createInitialContent,
  collectResourcePaths,
};

export default mainPlugin;
