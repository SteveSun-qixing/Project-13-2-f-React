import type { BaseCardView } from '@chips/sdk';
import {
  buildContent,
  dedupeResourcePaths,
  DEFAULT_CONTENT,
  readContent,
  validateConfig,
} from './config';

/**
 * 主进程入口集合（08-基础卡片插件接口 §2.5 双入口职责）：
 * 只承载 `validateConfig` / `createInitialContent` / `collectResourcePaths` 三个纯函数，
 * 构建为完全自包含的 `dist/index.js`。
 */

export { validateConfig } from './config';

/**
 * 创建新节点时的初始内容（08 §2.4.4）：《01-卡片文件格式》§6.5 示例 1 的空 url 来源初稿，
 * 必须能通过 validateConfig 与 configSchema。
 */
export function createInitialContent(): Record<string, unknown> {
  return buildContent(DEFAULT_CONTENT);
}

/**
 * 收集节点内容引用的包内相对资源路径（08 §2.4.5）。
 *
 * 网页目录的资源清单（`resource_paths`，相对卡片包根）进入资源清单；
 * `source_url` 为 http(s) 远程引用（08 §2.4.5 规则 2：http(s) 引用不进入资源清单）。
 * 返回值去重且稳定排序。
 */
export function collectResourcePaths(basecard: BaseCardView): string[] {
  const content = readContent(basecard.content);
  return dedupeResourcePaths(content.resource_paths).sort((left, right) =>
    left.localeCompare(right, 'zh-CN'),
  );
}

/** 主进程入口默认导出。 */
export const mainPlugin = {
  validateConfig,
  createInitialContent,
  collectResourcePaths,
};

export default mainPlugin;
