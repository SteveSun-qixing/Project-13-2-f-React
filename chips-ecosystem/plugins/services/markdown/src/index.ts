/**
 * `chips.service.markdown` 入口模块：默认导出实现 `IServicePlugin` 的对象
 * （《10-服务插件接口》§2.3）；模块顶层只声明、不产生副作用。
 */

import { createMarkdownPlugin } from './plugin.js';

/** 服务插件入口对象（平台激活时对同一对象调用 `start`）。 */
const markdownServicePlugin = createMarkdownPlugin();

export default markdownServicePlugin;

export { MARKDOWN_SERVICE_NAME } from './plugin.js';
export { DEFAULT_ENGINE_OPTIONS, ENGINE_OPTION_KEYS } from './engine.js';
export { MAX_MARKDOWN_INPUT_LENGTH } from './limits.js';
export {
  MARKDOWN_CANCELLED_ERROR_CODE,
  MARKDOWN_INPUT_ERROR_CODE,
} from './errors.js';
export type { IEngineOptions } from './engine.js';
export type {
  IMarkdownBlock,
  IMarkdownBlockquoteBlock,
  IMarkdownCallContext,
  IMarkdownCodeBlock,
  IMarkdownDocument,
  IMarkdownHeadingBlock,
  IMarkdownInline,
  IMarkdownListBlock,
  IMarkdownListItem,
  IMarkdownParagraphBlock,
  IMarkdownParseInput,
  IMarkdownParseOutput,
  IMarkdownRenderInput,
  IMarkdownRenderOptions,
  IMarkdownRenderOutput,
  IMarkdownRuleBlock,
  IMarkdownService,
  IMarkdownTableAlign,
  IMarkdownTableBlock,
} from './types.js';
