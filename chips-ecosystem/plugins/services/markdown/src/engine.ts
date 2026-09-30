/**
 * 解析引擎封装：markdown-it 的受控实例面。
 *
 * 安全不变量（工单057 安全红线，本模块是唯一落点）：
 * 1. `html: false` 强制写死——原始 HTML 一律降级为文本出料，不存在放行裸 HTML 的实例形态；
 * 2. 协议白名单在渲染期统一收口：解析期 `validateLink` 恒放行以保留链接记号与锚文本，
 *    渲染期按 markdown-it 缺省 `validateLink` 同词表校验链接 `href` 与图片 `src`，
 *    白名单外的目标一律清空为空串（保留锚文本，不把被拒目标原文泄入正文）；
 * 3. 链接与图片的 `title` 属性一律不出料（标题值可携带事件属性文本形态，契约无 title 出料面）；
 * 4. 文本出料前剥除标签形态片段内的事件处理属性，被转义的原始 HTML 不携带属性注入向量；
 *    代码面（fence / code_block / code_inline）按「代码原文」契约出料，不在清洗范围；
 * 5. 表格数据单元格不出料对齐 style：列对齐语义归属表头单元格与结构化块 `align` 字段；
 * 6. 渲染产物全部由记号序列化器生成，无任何「输入原文直通输出」通道；
 *    `parseBlocks` 内联面复用同一实例同一规则表，与 `renderHtml` 共享同一 XSS 口径。
 *
 * 实例按选项三元组缓存：引擎无跨调用状态，同选项复用同一实例保证行为确定性。
 */

import MarkdownIt from 'markdown-it';
import type { MarkdownIt as MarkdownItEngine, Token } from 'markdown-it';

/** 引擎级选项（经服务入口校验归一后的形态，无缺省歧义）。 */
export interface IEngineOptions {
  readonly breaks: boolean;
  readonly linkify: boolean;
  readonly typographer: boolean;
}

/** 全部允许的选项键；入口校验按此拒绝未知键，防止选项面无限扩张。 */
export const ENGINE_OPTION_KEYS: readonly string[] = ['breaks', 'linkify', 'typographer'];

/** 缺省选项（全部关闭）。 */
export const DEFAULT_ENGINE_OPTIONS: IEngineOptions = {
  breaks: false,
  linkify: false,
  typographer: false,
};

/** 危险协议词表：与 markdown-it 缺省 `validateLink` 同词表（vbscript / javascript / file / data）。 */
const UNSAFE_PROTOCOL_RE = /^(?:vbscript|javascript|file|data):/u;

/** `data:` 目标中仅放行位图图片形态（同 markdown-it 缺省白名单）。 */
const SAFE_DATA_IMAGE_RE = /^data:image\/(?:gif|png|jpeg|webp);/u;

/** 标签形态片段（`<tag …>`）；闭合记号与注释不在此形态内，不受清洗影响。 */
const HTML_TAG_SHAPE_RE = /<[a-zA-Z][^\s>]*(?:\s[^>]*)?>/gu;

/** 事件处理属性形态：`on<name>=value`（值允许双引号、单引号与无引号三种形态）。 */
const EVENT_HANDLER_ATTR_RE = /\son[a-zA-Z][a-zA-Z0-9-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/giu;

/** 实例缓存：选项串 → 引擎实例。 */
const engineCache = new Map<string, MarkdownItEngine>();

function optionsKey(options: IEngineOptions): string {
  return `${options.breaks ? 1 : 0}|${options.linkify ? 1 : 0}|${options.typographer ? 1 : 0}`;
}

/** 链接与图片目标白名单：命中危险协议且非安全图片 `data:` 形态的一律拒绝。 */
function isAllowedTargetUrl(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  return !UNSAFE_PROTOCOL_RE.test(normalized) || SAFE_DATA_IMAGE_RE.test(normalized);
}

/** 转义（与 markdown-it 缺省 text 规则同口径：`&` `<` `>` `"` 四字符）。 */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

/** 剥除标签形态片段内的事件处理属性；标签形态之外的普通文本不受影响。 */
function stripEventHandlerAttributes(raw: string): string {
  return raw.replace(HTML_TAG_SHAPE_RE, (tag) => tag.replace(EVENT_HANDLER_ATTR_RE, ''));
}

/** 删除记号属性（markdown-it Token 无属性删除面，按属性表原位移除）。 */
function dropTokenAttribute(token: Token, name: string): void {
  const index = token.attrIndex(name);
  if (index >= 0) {
    token.attrs?.splice(index, 1);
  }
}

/** 白名单收口链接 / 图片目标属性，并剥除 `title`。 */
function sanitizeTargetToken(token: Token, attributeName: 'href' | 'src'): void {
  const target = token.attrGet(attributeName);
  if (target !== null && !isAllowedTargetUrl(String(target))) {
    token.attrSet(attributeName, '');
  }
  dropTokenAttribute(token, 'title');
}

/**
 * 安装渲染期安全规则表：目标白名单、`title` 剥除、文本事件属性清洗、表格数据格对齐收口。
 * 规则表为渲染产物唯一出口，`renderHtml` 与 `parseBlocks` 内联面共用同一份。
 */
function installSafetyRendererRules(engine: MarkdownItEngine): void {
  const rules = engine.renderer.rules;

  const previousLinkOpen = rules.link_open;
  rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token !== undefined) {
      sanitizeTargetToken(token, 'href');
    }
    return previousLinkOpen !== undefined
      ? previousLinkOpen(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };

  const previousImage = rules.image;
  rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token !== undefined) {
      sanitizeTargetToken(token, 'src');
    }
    return previousImage !== undefined
      ? previousImage(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };

  // 缺省 text 规则即 `escapeHtml(content)`；此处等价替换为「清洗后转义」。
  rules.text = (tokens, idx) => {
    const content = tokens[idx]?.content ?? '';
    return escapeHtml(stripEventHandlerAttributes(content));
  };

  const previousTdOpen = rules.td_open;
  rules.td_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (token !== undefined) {
      dropTokenAttribute(token, 'style');
    }
    return previousTdOpen !== undefined
      ? previousTdOpen(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
  };
}

/** 取得（或创建并缓存）指定选项组合的引擎实例。 */
export function getEngine(options: IEngineOptions): MarkdownItEngine {
  const key = optionsKey(options);
  const cached = engineCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const engine = new MarkdownIt({
    // 安全红线：原始 HTML 一律转义，本开关不存在任何开启路径。
    html: false,
    xhtmlOut: false,
    breaks: options.breaks,
    langPrefix: 'language-',
    linkify: options.linkify,
    typographer: options.typographer,
  });
  // 解析期恒放行以保留链接记号与锚文本；协议白名单统一在渲染期收口（见上方规则表）。
  engine.validateLink = () => true;
  installSafetyRendererRules(engine);
  engineCache.set(key, engine);
  return engine;
}

/** 把 Markdown 源文渲染为安全 HTML 片段（不含 `<html>` / `<body>` 外壳）。 */
export function renderHtmlToSafeHtml(markdown: string, options: IEngineOptions): string {
  return getEngine(options).render(markdown);
}

/** 把 Markdown 源文解析为记号序列（块级转换器的输入形态）。 */
export function parseToTokens(
  markdown: string,
  options: IEngineOptions
): ReturnType<MarkdownItEngine['parse']> {
  return getEngine(options).parse(markdown, {});
}
