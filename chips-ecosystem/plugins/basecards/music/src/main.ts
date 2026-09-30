import type { BaseCardView } from '@chips/sdk';
import { buildContent, readConfig, validateConfig } from './config';

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
  return buildContent(readConfig(undefined));
}

/**
 * 收集节点内容引用的包内相对资源路径（08 §2.4.5）：音频、封面与歌词三类资源，
 * 归一后去重并稳定排序；非法引用（含 `http(s)` 外部地址）不进入资源清单。
 */
export function collectResourcePaths(basecard: BaseCardView): string[] {
  const config = readConfig(basecard.content['config']);
  const paths = [config.audio_file, config.album_cover, config.lyrics_file].filter(
    (path) => path.length > 0
  );
  return Array.from(new Set(paths)).sort();
}

/** 主进程入口默认导出。 */
export const mainPlugin = {
  validateConfig,
  createInitialContent,
  collectResourcePaths,
};

export default mainPlugin;
