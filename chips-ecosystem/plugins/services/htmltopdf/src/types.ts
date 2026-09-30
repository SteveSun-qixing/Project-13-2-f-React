/**
 * HTML 转 PDF 服务：类型定义。
 *
 * 能力归属：content-converter.html-to-pdf（04-能力契约规范 §8.4 登记项）。
 * 原子操作为纯处理：输入输出为结构化克隆兼容值，二进制用 Uint8Array，
 * 不读写路径、不接触权限系统（04-能力契约规范 §8.3）。
 */

/** 内容处理能力描述符（04-能力契约规范 §8.3）。 */
export interface IContentCapabilityDescriptor {
  /** 能力 ID：`<service>.<operation>`，登记处为 04-能力契约规范 §8.4。 */
  readonly id: string;
  /** Cordis 服务名（content- 前缀，内核服务文法）。 */
  readonly service: string;
  /** 官方服务插件 ID（chips.service.* 命名空间）。 */
  readonly provider: string;
  /** 服务方法名（原子操作）；每个能力 ID 恰好一个操作。 */
  readonly operations: readonly string[];
  /** 接受的规范化来源格式。 */
  readonly sourceFormats: readonly string[];
  /** 产出的规范化目标格式。 */
  readonly targetFormats: readonly string[];
  /** 流式能力。 */
  readonly streaming: { readonly input: boolean; readonly output: boolean };
  /** 一次性输入上限（字节）。 */
  readonly maxInlineInputBytes: number;
  /** 提供方契约包位置。 */
  readonly contractPackage: string;
}

/** 纸张规格（04-能力契约规范 §8.4）。 */
export type PdfPageSize = 'A4' | 'A3' | 'Letter' | 'Legal';

/** 页边距（毫米）。 */
export interface IPdfMargins {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** 页面尺寸（毫米）。 */
export interface IPageSizeMm {
  readonly width: number;
  readonly height: number;
}

/** 页眉页脚设置。 */
export interface IPdfHeaderFooter {
  readonly enabled: boolean;
  readonly headerTemplate?: string;
  readonly footerTemplate?: string;
  readonly headerHeightMm: number;
  readonly footerHeightMm: number;
}

/** 选项面（语义与缺省值见 contracts/html-to-pdf.options.schema.json）。 */
export interface IHtmlToPdfOptions {
  /** 纸张规格；缺省 A4。 */
  readonly pageSize?: PdfPageSize;
  /** 横向打印；缺省 false。 */
  readonly landscape?: boolean;
  /** 页边距（毫米），每边 [0, 50]；缺省每边 10mm。 */
  readonly margins?: Partial<IPdfMargins>;
  /** 打印背景；缺省 true。 */
  readonly printBackground?: boolean;
  /** 优先使用 HTML 内 @page 声明；缺省 false。 */
  readonly preferCSSPageSize?: boolean;
  /** 打印缩放系数 [0.1, 2]；缺省 1。 */
  readonly scale?: number;
  /** 页眉页脚；缺省关闭。 */
  readonly headerFooter?: IPdfHeaderFooterSettings;
}

/** 页眉页脚输入设置（高度可缺省，由归一层补全）。 */
export type IPdfHeaderFooterSettings = Partial<IPdfHeaderFooter>;

/** 排版度量块：分页预估器的输入单元。 */
export interface IPaginatedBlock {
  /** 块标识（在输入 HTML 语义内的稳定标识）。 */
  readonly id: string;
  /** 块高（CSS 像素），> 0。 */
  readonly heightPx: number;
  /** 禁止跨页拆分（break-inside: avoid 语义）；缺省 false。 */
  readonly keepTogether?: boolean;
}

/** 分页预估段：一个块在一页内的占据片段。 */
export interface IPaginationSegment {
  readonly id: string;
  /** 该段在本页内的高度（CSS 像素）。 */
  readonly heightPx: number;
  /** 该块是否被跨页拆分过（首段 false、续段 true）。 */
  readonly continuation: boolean;
}

/** 分页预估结果。 */
export interface IPaginationResult {
  readonly pages: readonly (readonly IPaginationSegment[])[];
  readonly pageCount: number;
  readonly warnings: readonly IConverterWarning[];
}

/** 警告（非错误）：随结果 warnings 面返回，码表随提供方契约发布。 */
export interface IConverterWarning {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

/** 输入：目录态 HTML 中间产物的纯值编码 + 可选排版度量块。 */
export interface IHtmlToPdfInput {
  /** 入口 HTML 文本（UTF-8），上限 8 MiB。 */
  readonly html: string;
  /** 资源表：相对路径 → 资源字节；与 html 合计不超过描述符 maxInlineInputBytes。 */
  readonly assets?: Readonly<Record<string, Uint8Array>>;
  /** 排版度量块（可选）：提供时做分页预估。 */
  readonly blocks?: readonly IPaginatedBlock[];
}

/** 归一后的输入。 */
export interface INormalizedHtmlToPdfInput {
  readonly html: string;
  readonly assets: Readonly<Record<string, Uint8Array>>;
  readonly blocks: readonly IPaginatedBlock[];
}

/** 归一后的选项。 */
export interface INormalizedHtmlToPdfOptions {
  readonly pageSize: PdfPageSize;
  readonly landscape: boolean;
  readonly margins: IPdfMargins;
  readonly printBackground: boolean;
  readonly preferCSSPageSize: boolean;
  readonly scale: number;
  readonly headerFooter: IPdfHeaderFooter;
}

/** 打印几何：页面尺寸、边距、可打印区与方向。 */
export interface IPrintGeometry {
  readonly pageSizeMm: IPageSizeMm;
  readonly marginMm: IPdfMargins;
  readonly printableAreaMm: { readonly width: number; readonly height: number };
  readonly landscape: boolean;
}

/** 调用面上下文：取消信号。 */
export interface IConverterCallContext {
  readonly signal?: AbortSignal;
}

/**
 * 打印承载端口：平台渲染链路对「HTML → PDF 打印」的受控接口。
 *
 * 实现归属宿主渲染承载（Electron 离屏窗口族 / webContents.printToPDF）；
 * 实现必须复用平台渲染链路，禁止自建离屏渲染栈、禁止直接依赖 Electron
 * （04-能力契约规范 §8.3 原子操作约束 3、渲染引擎设计）。
 */
export interface IPdfPrintEngine {
  /** 打印承载标识（写入 diagnostics.engineId）。 */
  readonly id: string;
  /** 打印一次。实现错误必须是 ChipsError；取消为 BRIDGE_CANCELLED，超时为 BRIDGE_TIMEOUT。 */
  print(request: IPrintRequest): Promise<IPrintResult>;
}

/** 打印请求（几何已由几何层解析完成）。 */
export interface IPrintRequest {
  readonly html: string;
  readonly assets: Readonly<Record<string, Uint8Array>>;
  readonly pageSizeMm: IPageSizeMm;
  readonly marginMm: IPdfMargins;
  readonly landscape: boolean;
  readonly printBackground: boolean;
  readonly preferCSSPageSize: boolean;
  readonly scale: number;
  readonly headerFooter: IPdfHeaderFooter;
  readonly signal?: AbortSignal;
}

/** 打印结果。 */
export interface IPrintResult {
  readonly bytes: Uint8Array;
  readonly pageCount: number;
}

/** 输出结果（形状见 contracts/html-to-pdf.output.schema.json）。 */
export interface IHtmlToPdfResult {
  readonly bytes: Uint8Array;
  readonly pageCount: number;
  readonly pageSizeMm: IPageSizeMm;
  readonly marginMm: IPdfMargins;
  readonly warnings: readonly IConverterWarning[];
  readonly diagnostics: {
    readonly engineId: string;
    readonly assetCount: number;
    readonly printableAreaMm: { readonly width: number; readonly height: number };
    readonly paginationHintPageCount: number | null;
  };
}

/** Cordis 服务面：content-html-to-pdf。 */
export interface IHtmlToPdfService {
  /** 内容处理能力 ID。 */
  readonly capabilityId: string;
  /** HTML 转 PDF（原子操作 htmlToPdf）。 */
  htmlToPdf(
    input: IHtmlToPdfInput,
    options?: IHtmlToPdfOptions,
    call?: IConverterCallContext
  ): Promise<IHtmlToPdfResult>;
}
