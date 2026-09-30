/**
 * HTML 转图片服务：类型定义。
 *
 * 能力归属：content-converter.html-to-image（04-能力契约规范 §8.4 登记项）。
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

/** 图片输出格式（04-能力契约规范 §8.4：PNG / JPEG / WebP）。 */
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';

/** 背景模式：透明、纯白或随上游转换主题底色。 */
export type ImageBackgroundMode = 'transparent' | 'white' | 'theme';

/** 警告（非错误）：随结果 warnings 面返回，码表随提供方契约发布。 */
export interface IConverterWarning {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
}

/** 选项面（语义与缺省值见 contracts/html-to-image.options.schema.json）。 */
export interface IHtmlToImageOptions {
  /** 输出格式；缺省 png。 */
  readonly format?: ImageOutputFormat;
  /** 视口宽（CSS 像素），[16, 20000]；缺省 794（A4 纵向 @96dpi）。 */
  readonly width?: number;
  /** 视口高（CSS 像素），[16, 20000] 或 null；null 表示按内容自适应，缺省 null。 */
  readonly height?: number | null;
  /** 设备像素比缩放系数，[1, 4]；缺省 1。 */
  readonly scaleFactor?: number;
  /** 背景模式；缺省 jpeg 为 white、其余为 transparent。 */
  readonly background?: ImageBackgroundMode;
  /** 主题底色（CSS 十六进制颜色）；background 为 theme 时使用。 */
  readonly themeBackground?: string;
}

/** 输入：目录态 HTML 中间产物的纯值编码。 */
export interface IHtmlToImageInput {
  /** 入口 HTML 文本（UTF-8），上限 8 MiB。 */
  readonly html: string;
  /** 资源表：相对路径 → 资源字节；与 html 合计不超过描述符 maxInlineInputBytes。 */
  readonly assets?: Readonly<Record<string, Uint8Array>>;
}

/** 归一后的输入。 */
export interface INormalizedHtmlToImageInput {
  readonly html: string;
  readonly assets: Readonly<Record<string, Uint8Array>>;
  /** 上游转换清单随输入携带的主题底色（十六进制 CSS 颜色）。 */
  readonly themeBackground?: string;
}

/** 归一后的选项。 */
export interface INormalizedHtmlToImageOptions {
  readonly format: ImageOutputFormat;
  readonly width: number;
  readonly height: number | null;
  readonly scaleFactor: number;
  readonly background: ImageBackgroundMode;
  readonly themeBackground?: string;
}

/** 光栅化几何：视口、缩放系数与已解析背景。 */
export interface IRasterGeometry {
  readonly viewport: { readonly width: number; readonly height: number | null };
  readonly scaleFactor: number;
  /** 已解析背景：'transparent' 或解析后的 CSS 颜色。 */
  readonly background: string;
}

/** 调用面上下文：取消信号。 */
export interface IConverterCallContext {
  readonly signal?: AbortSignal;
}

/**
 * 渲染承载端口：平台渲染链路对「HTML → 图片光栅化」的受控接口。
 *
 * 实现归属宿主渲染承载（Electron 离屏窗口族 / webContents.capturePage）；
 * 实现必须复用平台渲染链路，禁止自建离屏渲染栈（04-能力契约规范 §8.3 原子操作约束 3）。
 */
export interface IHtmlRasterEngine {
  /** 渲染承载标识（写入 diagnostics.engineId）。 */
  readonly id: string;
  /** 光栅化一次。实现错误必须是 ChipsError；取消为 BRIDGE_CANCELLED，超时为 BRIDGE_TIMEOUT。 */
  rasterize(request: IRasterizeRequest): Promise<IRasterizeResult>;
}

/** 光栅化请求（background 已由几何层解析完成）。 */
export interface IRasterizeRequest {
  readonly html: string;
  readonly assets: Readonly<Record<string, Uint8Array>>;
  readonly viewport: { readonly width: number; readonly height: number | null };
  readonly scaleFactor: number;
  readonly background: string;
  readonly format: ImageOutputFormat;
  readonly signal?: AbortSignal;
}

/** 光栅化结果。 */
export interface IRasterizeResult {
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** 输出结果（形状见 contracts/html-to-image.output.schema.json）。 */
export interface IHtmlToImageResult {
  readonly format: ImageOutputFormat;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly scaleFactor: number;
  readonly background: string;
  readonly warnings: readonly IConverterWarning[];
  readonly diagnostics: {
    readonly engineId: string;
    readonly assetCount: number;
    readonly viewportWidthPx: number;
    readonly viewportHeightPx: number | null;
  };
}

/** Cordis 服务面：content-html-to-image。 */
export interface IHtmlToImageService {
  /** 内容处理能力 ID。 */
  readonly capabilityId: string;
  /** HTML 转图片（原子操作 htmlToImage）。 */
  htmlToImage(
    input: IHtmlToImageInput,
    options?: IHtmlToImageOptions,
    call?: IConverterCallContext
  ): Promise<IHtmlToImageResult>;
}
