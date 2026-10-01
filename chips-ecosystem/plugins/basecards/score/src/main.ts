import type { BaseCardView } from '@chips/sdk';
import { buildContent, DEFAULT_CONFIG, validateConfig } from './config';
import type { IScoreConfig } from './config';

/**
 * 主进程入口集合（08-基础卡片插件接口 §2.5 双入口职责）：
 * 只承载 `validateConfig` / `createInitialContent` / `collectResourcePaths` 三个纯函数，
 * 构建为完全自包含的 `dist/index.js`。
 */

export { validateConfig } from './config';

/** 创建新节点时的初始内容（08 §2.4.4）：默认五分制星星样式，必须能通过 validateConfig 与 configSchema。 */
export function createInitialContent(): Record<string, unknown> {
  const config: IScoreConfig = { ...DEFAULT_CONFIG };
  return buildContent(config);
}

/**
 * 收集节点内容引用的包内相对资源路径（08 §2.4.5）。
 *
 * 评分卡片的展示（星星/爱心/分数/进度条）不引用任何包内或外部资源，恒返回空数组。
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

/** 卡片类型正式 ID 再导出，供渲染面组装节点内容使用（避免字面量重复）。 */
export { CARD_TYPE_ID } from './config';
