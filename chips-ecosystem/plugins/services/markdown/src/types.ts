/**
 * 服务公开类型面（契约形状的 TypeScript 单点定义）。
 *
 * JSON Schema 权威在 `contracts/`（照《04-能力契约规范》离线可编译约束：
 * 仅本地 `$ref`、无远程加载、无自定义脚本）；本模块与之同批维护、逐字段对应。
 *
 * 安全不变量（工单057 安全红线）：
 * - 原始 HTML 一律转义，服务不提供任何「放行裸 HTML」的选项面；
 * - 链接与图片目标经渲染期协议白名单校验（词表同 markdown-it `validateLink` 缺省，
 *   白名单外目标清空为空串、锚文本保留）；
 * - 结构化块的内联面只承载经同一安全引擎渲染的 HTML 片段，不携带原始 HTML。
 */

/** 渲染选项（全部缺省 false；不存在开启裸 HTML 的开关）。 */
export interface IMarkdownRenderOptions {
  /** 把段内单换行渲染为 `<br>`（GFM breaks）。缺省 `false`。 */
  breaks?: boolean;
  /** 把类链接文本自动识别为链接（仅匹配合法 URL）。缺省 `false`。 */
  linkify?: boolean;
  /** 排版替换（弯引号、省略号等）。缺省 `false`。 */
  typographer?: boolean;
}

/** 服务方法调用上下文。 */
export interface IMarkdownCallContext {
  /** 取消信号；实现必须在安全点检查并在取消时按 `BRIDGE_CANCELLED` 收口。 */
  signal?: AbortSignal;
}

/** `renderHtml` 输入。 */
export interface IMarkdownRenderInput {
  /** Markdown 源文；长度不得超过 `MAX_MARKDOWN_INPUT_LENGTH`。 */
  markdown: string;
  /** 渲染选项；显式 `undefined` 与缺省同义（入口归一按缺省选项处理）。 */
  options?: IMarkdownRenderOptions | undefined;
}

/** `renderHtml` 输出。 */
export interface IMarkdownRenderOutput {
  /**
   * 安全 HTML 片段：不含 `<html>` / `<body>` 外壳；
   * 原始 HTML 已转义，链接与图片协议经白名单校验，可直接进入受控渲染面。
   */
  html: string;
}

/** `parseBlocks` 输入（与 `renderHtml` 输入同形）。 */
export type IMarkdownParseInput = IMarkdownRenderInput;

/** `parseBlocks` 输出。 */
export interface IMarkdownParseOutput {
  /** 解析后的结构化块文档。 */
  document: IMarkdownDocument;
}

/** 结构化块文档：Markdown 源文的只读块级视图模型。 */
export interface IMarkdownDocument {
  /** 顶层块序列。 */
  blocks: readonly IMarkdownBlock[];
}

/** 块级元素联合。 */
export type IMarkdownBlock =
  | IMarkdownHeadingBlock
  | IMarkdownParagraphBlock
  | IMarkdownCodeBlock
  | IMarkdownBlockquoteBlock
  | IMarkdownListBlock
  | IMarkdownTableBlock
  | IMarkdownRuleBlock;

/** 标题块。 */
export interface IMarkdownHeadingBlock {
  type: 'heading';
  /** 标题层级 1–6。 */
  level: 1 | 2 | 3 | 4 | 5 | 6;
  /** 标题内联内容（安全 HTML 片段）。 */
  inline: IMarkdownInline;
}

/** 段落块。 */
export interface IMarkdownParagraphBlock {
  type: 'paragraph';
  /** 段落内联内容（安全 HTML 片段）。 */
  inline: IMarkdownInline;
}

/** 代码块（围栏或缩进）。 */
export interface IMarkdownCodeBlock {
  type: 'code';
  /** 信息串标注的语言；缩进代码块为 `null`。 */
  language: string | null;
  /** 代码原文（纯文本，消费侧按需自行转义呈现）。 */
  text: string;
}

/** 引用块。 */
export interface IMarkdownBlockquoteBlock {
  type: 'blockquote';
  /** 引用内部的块序列（可继续嵌套）。 */
  blocks: readonly IMarkdownBlock[];
}

/** 列表块。 */
export interface IMarkdownListBlock {
  type: 'list';
  /** 是否有序列表。 */
  ordered: boolean;
  /** 有序列表起始编号；仅在 `start != 1` 时出现。 */
  start?: number;
  /** 列表项序列。 */
  items: readonly IMarkdownListItem[];
}

/** 列表项。 */
export interface IMarkdownListItem {
  /** 列表项内部的块序列（段落、嵌套列表、代码块等）。 */
  blocks: readonly IMarkdownBlock[];
}

/** 表格块。 */
export interface IMarkdownTableBlock {
  type: 'table';
  /** 逐列对齐；`null` 表示未指定。 */
  align: readonly (IMarkdownTableAlign | null)[];
  /** 表头行（逐格内联内容）。 */
  header: readonly IMarkdownInline[];
  /** 数据行序列（逐行逐格内联内容）。 */
  rows: readonly (readonly IMarkdownInline[])[];
}

/** 表格列对齐。 */
export type IMarkdownTableAlign = 'left' | 'center' | 'right';

/** 水平分隔线块。 */
export interface IMarkdownRuleBlock {
  type: 'rule';
}

/** 块内内联内容：经同一安全引擎渲染的 HTML 片段。 */
export interface IMarkdownInline {
  /** 内联 HTML 片段（原始 HTML 已转义、协议白名单已生效）。 */
  html: string;
}

/**
 * 服务方法面：经 `ctx.provide('markdown', service)` 以 Cordis 服务提供，
 * 不注册 Bridge 能力（《09-官方插件与应用目录》`chips.service.markdown` 登记口径）。
 *
 * 方法均声明 `this: void`：实现不依赖 this，方法可从服务对象上解构后直接调用（契约化，
 * 与 `service-plugin.test.ts`「无 this 绑定要求」用例一致）。
 */
export interface IMarkdownService {
  /** 把 Markdown 源文渲染为安全 HTML 片段。 */
  renderHtml(
    this: void,
    input: IMarkdownRenderInput,
    context?: IMarkdownCallContext
  ): Promise<IMarkdownRenderOutput>;
  /** 把 Markdown 源文解析为结构化块文档。 */
  parseBlocks(
    this: void,
    input: IMarkdownParseInput,
    context?: IMarkdownCallContext
  ): Promise<IMarkdownParseOutput>;
}
