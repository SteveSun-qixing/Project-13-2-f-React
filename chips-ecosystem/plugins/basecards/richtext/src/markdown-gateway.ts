/**
 * Markdown 服务契约消费缝（`chips.service.markdown` 的消费方唯一入口）。
 *
 * 契约口径：方法面与输入/输出形状与 `chips.service.markdown` 公开契约
 * （`render-html.input/output.schema.json`）逐字段同型；本包**不 import 服务包内部**，
 * 契约类型在本模块单点重述（04-能力契约规范 §八：内容处理服务不注册 Bridge 能力，
 * 消费方按提供方契约的类型化接口调用）。
 *
 * 注入缝形制：沿用母型 grid `attachRuntime` 的渲染面注入形制——渲染帧运行时的
 * basecard 插件执行通道交付后（工单025 剩余 / #85），由平台在首次 `renderView` 前
 * 调用 `attachMarkdownRendering` 注入契约实现；未注入时 `renderMarkdown` fail-closed
 * 拒绝，查看态呈现简体中文状态行，不伪造渲染成功（#257 交付判定公式：未通能力域
 * 如实登记缺位、禁假接线）。
 */

/** 渲染选项（与 markdown 服务契约 render-html 输入 options 同型；全部缺省 false）。 */
export interface IMarkdownRenderOptions {
  breaks?: boolean;
  linkify?: boolean;
  typographer?: boolean;
}

/** `renderHtml` 输入（与 markdown 服务契约 render-html 输入同型）。 */
export interface IMarkdownRenderInput {
  markdown: string;
  options?: IMarkdownRenderOptions;
}

/** `renderHtml` 输出（与 markdown 服务契约 render-html 输出同型：安全 HTML 片段）。 */
export interface IMarkdownRenderOutput {
  html: string;
}

/**
 * Markdown 渲染源：markdown 服务契约方法面的消费方视图（`this: void`，可解构调用）。
 *
 * 与 `chips.service.markdown` 的 `IMarkdownService['renderHtml']` 方法面同型；
 * 本包只消费 `renderHtml`（查看态安全 HTML 产物），结构化块面非查看态所需。
 */
export interface IMarkdownRenderingSource {
  renderHtml(this: void, input: IMarkdownRenderInput): Promise<IMarkdownRenderOutput>;
}

let renderingSource: IMarkdownRenderingSource | null = null;

/**
 * 注入 Markdown 渲染源（平台插件执行通道的接线点）；传 `null` 解除注入（测试隔离用）。
 *
 * 同一渲染帧内至多一个渲染源；重复注入以最近一次为准。
 */
export function attachMarkdownRendering(source: IMarkdownRenderingSource | null): void {
  renderingSource = source;
}

/** 查看态渲染缝未接线的失败形态：调用方按状态行呈现，不伪造成功。 */
export class MarkdownRenderingUnavailableError extends Error {
  public constructor() {
    super('富文本渲染通道未接入：等待平台插件执行通道交付');
    this.name = 'MarkdownRenderingUnavailableError';
  }
}

/**
 * 经契约消费 Markdown → 安全 HTML。
 *
 * @param markdown - Markdown 源文
 * @returns 安全 HTML 片段（服务安全不变量：原始 HTML 已转义、协议白名单已生效）
 * @throws {MarkdownRenderingUnavailableError} 渲染源未注入（在册缺位，禁假接线）
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  const source = renderingSource;
  if (source === null) {
    throw new MarkdownRenderingUnavailableError();
  }
  const output = await source.renderHtml({ markdown });
  return output.html;
}
