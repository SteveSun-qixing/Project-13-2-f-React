import type { BaseCardView, IBaseCardPlugin } from '@chips/sdk';
import { DEFAULT_CONFIG, validateConfig } from './config';

const CARD_TYPE_ID = 'base.chain4';

/**
 * 创建新节点的初始内容；必须能通过 configSchema 与 validateConfig。
 *
 * @returns 初始内容对象
 */
export function createInitialContent(): Record<string, unknown> {
  return {
    card_type: CARD_TYPE_ID,
    content_format: 'markdown',
    content_source: 'inline',
    content_text: '',
    config: { ...DEFAULT_CONFIG },
  };
}

/**
 * 收集节点内容引用的包内相对路径；本模板不引用包内资源，返回空数组。
 *
 * @param basecard - 只读节点渲染视图
 * @returns 包内相对路径列表（去重且稳定排序）
 */
export function collectResourcePaths(basecard: BaseCardView): string[] {
  void basecard;
  return [];
}

/** 主进程入口集合：由受管模块加载器在 dist/index.js 中读取。 */
export const mainPlugin: Pick<
  IBaseCardPlugin,
  'validateConfig' | 'createInitialContent' | 'collectResourcePaths'
> = {
  validateConfig,
  createInitialContent,
  collectResourcePaths,
};

export default mainPlugin;
