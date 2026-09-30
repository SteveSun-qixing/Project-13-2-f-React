/**
 * 块级转换器：markdown-it 记号流 → 结构化块文档（`IMarkdownDocument`）。
 *
 * 转换为纯结构映射，不做任何文本改写；内联内容统一经同一安全引擎的
 * `renderInline` 出料（原始 HTML 已转义、协议白名单已生效），
 * 结构化块因此与 `renderHtml` 共享同一 XSS 口径，不构成第二渲染管线。
 */

import type { MarkdownIt, Token } from 'markdown-it';
import type {
  IMarkdownBlock,
  IMarkdownDocument,
  IMarkdownInline,
  IMarkdownListItem,
  IMarkdownListBlock,
  IMarkdownTableAlign,
} from './types.js';
import { getEngine, parseToTokens, type IEngineOptions } from './engine.js';

/** 块级转换器上下文：引擎实例承担内联出料（与解析同实例，保证口径一致）。 */
interface IConvertContext {
  readonly engine: MarkdownIt;
}

/** 解析 Markdown 源文为结构化块文档。 */
export function parseToDocument(markdown: string, options: IEngineOptions): IMarkdownDocument {
  const engine = getEngine(options);
  const tokens = parseToTokens(markdown, options);
  return { blocks: collectBlocks(tokens, { engine }) };
}

/** 递归收集块序列：遇到父容器（blockquote / list / li / table）的闭合记号即停。 */
function collectBlocks(tokens: readonly Token[], context: IConvertContext): IMarkdownBlock[] {
  const blocks: IMarkdownBlock[] = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === undefined) {
      index += 1;
      continue;
    }
    if (token.nesting === -1) {
      break;
    }
    const consumed = consumeBlock(tokens, index, blocks, context);
    if (consumed <= index) {
      // 防御：未知记号单步跳过，绝不死循环。
      index += 1;
      continue;
    }
    index = consumed;
  }
  return blocks;
}

/** 从 `start` 消费一个块并写入 `blocks`，返回下一个待处理下标。 */
function consumeBlock(
  tokens: readonly Token[],
  start: number,
  blocks: IMarkdownBlock[],
  context: IConvertContext
): number {
  const token = tokens[start];
  if (token === undefined) {
    return start;
  }
  switch (token.type) {
    case 'heading_open': {
      const inline = tokens[start + 1];
      const close = findClose(tokens, start, token.tag);
      if (inline === undefined || inline.type !== 'inline' || close === undefined) {
        return start + 1;
      }
      blocks.push({
        type: 'heading',
        level: parseHeadingLevel(token.tag),
        inline: renderInlineToken(inline, context),
      });
      return close + 1;
    }
    case 'paragraph_open': {
      const inline = tokens[start + 1];
      const close = findClose(tokens, start, 'p');
      if (inline === undefined || inline.type !== 'inline') {
        return start + 1;
      }
      blocks.push({ type: 'paragraph', inline: renderInlineToken(inline, context) });
      return close === undefined ? start + 2 : close + 1;
    }
    case 'inline': {
      // 无 paragraph 记号包裹的裸内联内容（紧凑列表项的段落记号带 hidden 标记、
      // 已由 paragraph_open 分支出料；此处兜底接住其余无包裹形态，统一落为段落块）。
      blocks.push({ type: 'paragraph', inline: renderInlineToken(token, context) });
      return start + 1;
    }
    case 'fence':
    case 'code_block': {
      const info = token.info.trim();
      const first = info.split(/\s+/u)[0];
      const language = info.length > 0 && first !== undefined && first.length > 0 ? first : null;
      blocks.push({ type: 'code', language, text: token.content });
      return start + 1;
    }
    case 'blockquote_open': {
      const close = findClose(tokens, start, 'blockquote');
      if (close === undefined) {
        return start + 1;
      }
      blocks.push({
        type: 'blockquote',
        blocks: collectBlocks(tokens.slice(start + 1, close), context),
      });
      return close + 1;
    }
    case 'bullet_list_open':
    case 'ordered_list_open': {
      return consumeList(tokens, start, blocks, context, token.type === 'ordered_list_open');
    }
    case 'table_open': {
      const close = findClose(tokens, start, 'table');
      if (close === undefined) {
        return start + 1;
      }
      blocks.push(convertTable(tokens.slice(start + 1, close), context));
      return close + 1;
    }
    case 'hr': {
      blocks.push({ type: 'rule' });
      return start + 1;
    }
    default: {
      // `html: false` 下不会出现 html_block（块级 HTML 规则不命中，原文落为转义段落）；
      // 其余未知记号返回原下标，由上层单步跳过。
      return start;
    }
  }
}

/** 消费一个列表块（含 `li` 项循环）。 */
function consumeList(
  tokens: readonly Token[],
  start: number,
  blocks: IMarkdownBlock[],
  context: IConvertContext,
  ordered: boolean
): number {
  const close = findClose(tokens, start, ordered ? 'ol' : 'ul');
  const bodyEnd = close === undefined ? tokens.length : close;
  const items: IMarkdownListItem[] = [];
  let index = start + 1;
  while (index < bodyEnd) {
    const token = tokens[index];
    if (token === undefined) {
      break;
    }
    if (token.type === 'list_item_open') {
      const itemClose = findCloseFrom(tokens, index, bodyEnd, 'li');
      if (itemClose === undefined) {
        index += 1;
        continue;
      }
      items.push({ blocks: collectBlocks(tokens.slice(index + 1, itemClose), context) });
      index = itemClose + 1;
      continue;
    }
    index += 1;
  }
  const list: IMarkdownListBlock = ordered
    ? buildOrderedList(tokens[start], items)
    : { type: 'list', ordered, items };
  blocks.push(list);
  return close === undefined ? bodyEnd : close + 1;
}

/** 有序列表：仅在起始编号 != 1 时携带 `start`。 */
function buildOrderedList(
  openToken: Token | undefined,
  items: IMarkdownListItem[]
): IMarkdownListBlock {
  const startText = openToken === undefined ? null : openToken.attrGet('start');
  if (startText !== null) {
    const start = Number.parseInt(String(startText), 10);
    if (Number.isInteger(start) && start !== 1) {
      return { type: 'list', ordered: true, start, items };
    }
  }
  return { type: 'list', ordered: true, items };
}

/** 消费表格体：对齐（表头逐列 style 属性，未指定列为 null）、表头行与数据行。 */
function convertTable(body: readonly Token[], context: IConvertContext): IMarkdownBlock {
  const align: (IMarkdownTableAlign | null)[] = [];
  const header: IMarkdownInline[] = [];
  const rows: IMarkdownInline[][] = [];
  let inHeader = false;
  let currentRow: IMarkdownInline[] | null = null;
  for (const token of body) {
    switch (token.type) {
      case 'thead_open': {
        inHeader = true;
        break;
      }
      case 'thead_close': {
        inHeader = false;
        break;
      }
      case 'tr_open': {
        currentRow = inHeader ? header : [];
        if (!inHeader) {
          rows.push(currentRow);
        }
        break;
      }
      case 'th_open': {
        align.push(parseAlign(token));
        break;
      }
      case 'inline': {
        if (currentRow !== null) {
          currentRow.push(renderInlineToken(token, context));
        }
        break;
      }
      case 'tr_close': {
        currentRow = null;
        break;
      }
      default:
        break;
    }
  }
  return { type: 'table', align, header, rows };
}

function parseAlign(token: Token): IMarkdownTableAlign | null {
  const style = token.attrGet('style');
  if (style === null) {
    return null;
  }
  const match = /text-align:\s*(left|center|right)/u.exec(String(style));
  return match === null ? null : (match[1] as IMarkdownTableAlign);
}

/** 内联记号出料：经同一安全引擎的 renderInline（转义与白名单口径同 renderHtml）。 */
function renderInlineToken(token: Token, context: IConvertContext): IMarkdownInline {
  const children = token.children ?? [token];
  return { html: context.engine.renderer.renderInline(children, context.engine.options, {}) };
}

function parseHeadingLevel(tag: string): 1 | 2 | 3 | 4 | 5 | 6 {
  const level = Number.parseInt(tag.slice(1), 10);
  if (level >= 1 && level <= 6) {
    return level as 1 | 2 | 3 | 4 | 5 | 6;
  }
  return 1;
}

/** 从 `start`（开记号）出发，按嵌套深度匹配同名标签的闭合记号。 */
function findClose(tokens: readonly Token[], start: number, tag: string): number | undefined {
  return findCloseFrom(tokens, start, tokens.length, tag);
}

function findCloseFrom(
  tokens: readonly Token[],
  start: number,
  end: number,
  tag: string
): number | undefined {
  let depth = 0;
  for (let index = start + 1; index < end; index += 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }
    if (token.nesting === 1) {
      depth += 1;
      continue;
    }
    if (token.nesting === -1) {
      if (depth === 0 && token.tag === tag) {
        return index;
      }
      depth -= 1;
    }
  }
  return undefined;
}
