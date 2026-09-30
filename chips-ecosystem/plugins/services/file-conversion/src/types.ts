/**
 * 文件转换编排服务的契约类型。
 *
 * 输入/输出形状权威：`contracts/file-convert.input.schema.json` 与
 * `contracts/file-convert.output.schema.json`；链路腿能力归属权威：
 * 04-能力契约规范 §8.4（content-converter 三登记项；编排角色本身无在册 ID，
 * 见 descriptor.ts 头注）。兄弟服务以消费方自有端口视图声明（结构化类型对接
 * 提供方契约），本包不 import 兄弟插件任何内部模块——服务互调经 ctx.inject
 * 正式面注入运行时对象（06-服务插件开发指南 §4.1）。
 */

import type { IServiceLogger } from '@chips/sdk';

/** 来源类型（与输入 schema `source.type` 枚举一致）。 */
export type FileSourceType = 'card' | 'html';
/** 目标类型（与输入 schema `target.type` 枚举一致）。 */
export type FileTargetType = 'html' | 'pdf' | 'image';
/** HTML 产物形态。 */
export type HtmlPackageMode = 'zip' | 'directory';
/** 图片输出格式。 */
export type ImageFormat = 'png' | 'jpeg' | 'webp';
/** 纸张规格。 */
export type PdfPageSize = 'A4' | 'A3' | 'Letter' | 'Legal';

/** 页边距（毫米）。 */
export interface IFileConvertMargins {
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
  readonly left?: number;
}

/** `convert` 操作请求（旧 converter.file.convert 请求形状逐字迁移）。 */
export interface IFileConvertRequest {
  readonly source: {
    readonly type: FileSourceType;
    readonly path: string;
  };
  readonly target: {
    readonly type: FileTargetType;
  };
  readonly output: {
    readonly path: string;
    readonly overwrite?: boolean;
  };
  readonly options?: {
    readonly html?: {
      readonly packageMode?: HtmlPackageMode;
      readonly includeAssets?: boolean;
      readonly includeManifest?: boolean;
    };
    readonly pdf?: {
      readonly pageSize?: PdfPageSize;
      readonly landscape?: boolean;
      readonly printBackground?: boolean;
      /** 旧契约字段 marginMm；规划时按提供方契约改名为 margins。 */
      readonly marginMm?: IFileConvertMargins;
    };
    readonly image?: {
      readonly format?: ImageFormat;
      readonly width?: number;
      readonly height?: number;
      readonly scaleFactor?: number;
      readonly background?: 'transparent' | 'white' | 'theme';
    };
  };
}

/** 一条结果警告（原样透传提供方警告；码表随提供方契约发布）。 */
export interface IFileConvertWarning {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

/** 产物形态。 */
export type FileConvertArtifactType = 'html-zip' | 'html-directory' | 'pdf' | 'image';

/** 单个产物。 */
export interface IFileConvertArtifact {
  readonly type: FileConvertArtifactType;
  readonly path: string;
  readonly entryFile?: string;
  readonly mimeType?: string;
}

/** 链路回执单腿：能力 ID / 提供方服务名 / 原子操作名。 */
export interface IFileConvertPipelineLeg {
  readonly capability: string;
  readonly service: string;
  readonly operation: string;
}

/** `convert` 操作结果回执。 */
export interface IFileConvertResult {
  readonly sourceType: FileSourceType;
  readonly targetType: FileTargetType;
  readonly outputPath: string;
  readonly artifacts: readonly IFileConvertArtifact[];
  readonly pipeline: readonly IFileConvertPipelineLeg[];
  readonly warnings?: readonly IFileConvertWarning[];
}

/** 归一化请求（运行时收窄结果；缺省值已落定）。 */
export interface INormalizedConvertRequest {
  readonly source: {
    readonly type: FileSourceType;
    readonly path: string;
  };
  readonly target: {
    readonly type: FileTargetType;
  };
  readonly output: {
    readonly path: string;
    readonly overwrite: boolean;
  };
  readonly options: {
    readonly html: {
      readonly packageMode: HtmlPackageMode;
      readonly includeAssets?: boolean;
      readonly includeManifest?: boolean;
    };
    readonly pdf?: {
      readonly pageSize?: PdfPageSize;
      readonly landscape?: boolean;
      readonly printBackground?: boolean;
      readonly marginMm?: IFileConvertMargins;
    };
    readonly image?: {
      readonly format?: ImageFormat;
      readonly width?: number;
      readonly height?: number;
      readonly scaleFactor?: number;
      readonly background?: 'transparent' | 'white' | 'theme';
    };
  };
}

/** 归一化 HTML 来源（目录形态无入口覆写；文件形态目录取父级、入口取末段）。 */
export interface INormalizedHtmlSource {
  readonly htmlDir: string;
  readonly entryFile?: string;
}

/** HTML 渲染腿的 PDF 选项（字段名与 content-converter.html-to-pdf 提供方契约一致）。 */
export interface IPdfRenderOptions {
  readonly pageSize?: PdfPageSize;
  readonly landscape?: boolean;
  readonly printBackground?: boolean;
  readonly margins?: IFileConvertMargins;
}

/** HTML 渲染腿的图片选项（字段名与 content-converter.html-to-image 提供方契约一致）。 */
export interface IImageRenderOptions {
  readonly format?: ImageFormat;
  readonly width?: number;
  readonly height?: number;
  readonly scaleFactor?: number;
  readonly background?: 'transparent' | 'white' | 'theme';
}

/** 链路腿一：卡片 → 目录态 HTML（路径世界；由提供方读取文档链路并落盘产物）。 */
export interface IPlannedCardToHtmlStep {
  readonly kind: 'card-to-html';
  /** 与 descriptor.ts CARD_TO_HTML_CAPABILITY_ID 同源（契约测试锁定一致）。 */
  readonly capability: 'content-converter.card-to-html';
  readonly service: string;
  readonly operation: 'cardToHtml';
  readonly stage: 'render-html';
  readonly outputKind: 'html-zip' | 'html-directory';
  readonly publishArtifact: boolean;
  /** 产物回执终路径（暂存物理路径见 input.output.path）。 */
  readonly finalOutputPath: string;
  readonly input: {
    readonly source: string;
    readonly output: {
      readonly path: string;
      readonly packageMode: HtmlPackageMode;
      readonly overwrite: boolean;
    };
    readonly options?: {
      readonly includeAssets?: boolean;
      readonly includeManifest?: boolean;
    };
  };
}

/** 链路腿二/三：目录态 HTML → PDF / 图片（字节世界；执行器读包装配、产物落暂存）。 */
interface IPlannedHtmlRenderStepBase {
  readonly stage: 'render-pdf' | 'render-image';
  readonly outputKind: 'pdf' | 'image';
  readonly publishArtifact: boolean;
  /** 待读取的 HTML 包位置（中间产物目录或来源目录/父目录）。 */
  readonly htmlPackage: INormalizedHtmlSource;
  /** 渲染字节写入的暂存物理路径。 */
  readonly outputPath: string;
  /** 产物回执终路径。 */
  readonly finalOutputPath: string;
}

/** 链路腿：目录态 HTML → PDF。 */
export interface IPlannedHtmlToPdfStep extends IPlannedHtmlRenderStepBase {
  readonly kind: 'html-to-pdf';
  /** 与 descriptor.ts HTML_TO_PDF_CAPABILITY_ID 同源（契约测试锁定一致）。 */
  readonly capability: 'content-converter.html-to-pdf';
  readonly service: string;
  readonly operation: 'htmlToPdf';
  readonly stage: 'render-pdf';
  readonly outputKind: 'pdf';
  readonly options?: IPdfRenderOptions;
}

/** 链路腿：目录态 HTML → 图片。 */
export interface IPlannedHtmlToImageStep extends IPlannedHtmlRenderStepBase {
  readonly kind: 'html-to-image';
  /** 与 descriptor.ts HTML_TO_IMAGE_CAPABILITY_ID 同源（契约测试锁定一致）。 */
  readonly capability: 'content-converter.html-to-image';
  readonly service: string;
  readonly operation: 'htmlToImage';
  readonly stage: 'render-image';
  readonly outputKind: 'image';
  readonly options?: IImageRenderOptions;
}

/** 计划步骤（判别联合）。 */
export type IPlannedStep = IPlannedCardToHtmlStep | IPlannedHtmlToPdfStep | IPlannedHtmlToImageStep;

/** 转换计划回执（旧 ConversionPlan 字段名逐字迁移；暂存路径族语义一致）。 */
export interface IConversionPlan {
  readonly request: INormalizedConvertRequest;
  readonly steps: readonly IPlannedStep[];
  readonly temporaryHtmlDir?: string;
  readonly temporaryHtmlRoot?: string;
  readonly stagedBackupOutputDir?: string;
  readonly stagedBackupOutputPath?: string;
  readonly stagedFinalOutputDir?: string;
  readonly stagedFinalOutputPath?: string;
}

/** 调用面上下文：取消信号（同族提供方契约统一形状）。 */
export interface IConverterCallContext {
  readonly signal?: AbortSignal;
}

/** 宿主文件端口：`file:*` 内置能力（04-能力契约规范 7.1）的编排侧收窄投影。 */
export interface IFilePort {
  /** 递归列举目录相对条目（`/` 分隔）。 */
  listDirectory(directory: string, recursive?: boolean): Promise<readonly string[]>;
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
  writeText(path: string, data: string): Promise<void>;
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  makeDirectory(path: string): Promise<void>;
  movePath(source: string, target: string, overwrite?: boolean): Promise<void>;
  deletePath(path: string, recursive?: boolean): Promise<void>;
}

/** content-converter 服务消费视图（cardToHtml 原子操作）。 */
export interface ICardToHtmlPort {
  cardToHtml(input: {
    readonly source: string;
    readonly output: {
      readonly path: string;
      readonly packageMode: HtmlPackageMode;
      readonly overwrite: boolean;
    };
    readonly options?: {
      readonly includeAssets?: boolean;
      readonly includeManifest?: boolean;
    };
  }): Promise<{
    readonly outputPath: string;
    readonly entryFile?: string;
    readonly warnings?: readonly IFileConvertWarning[];
  }>;
}

/** content-html-to-pdf 服务消费视图（htmlToPdf 原子操作）。 */
export interface IHtmlToPdfPort {
  htmlToPdf(
    input: { readonly html: string; readonly assets?: Readonly<Record<string, Uint8Array>> },
    options?: IPdfRenderOptions,
    call?: IConverterCallContext
  ): Promise<{
    readonly bytes: Uint8Array;
    readonly warnings?: readonly IFileConvertWarning[];
  }>;
}

/** content-html-to-image 服务消费视图（htmlToImage 原子操作）。 */
export interface IHtmlToImagePort {
  htmlToImage(
    input: { readonly html: string; readonly assets?: Readonly<Record<string, Uint8Array>> },
    options?: IImageRenderOptions,
    call?: IConverterCallContext
  ): Promise<{
    readonly bytes: Uint8Array;
    readonly format?: ImageFormat;
    readonly warnings?: readonly IFileConvertWarning[];
  }>;
}

/** 兄弟服务端口族（运行时由 ctx.inject 注入，见 plugin.ts）。 */
export interface ISiblingPorts {
  readonly cardConverter: ICardToHtmlPort;
  readonly htmlToPdf: IHtmlToPdfPort;
  readonly htmlToImage: IHtmlToImagePort;
}

/** 编排服务装配依赖。 */
export interface IFileConversionDependencies {
  readonly siblings: ISiblingPorts;
  readonly file: IFilePort;
  readonly logger: IServiceLogger;
}

/** content-file-conversion Cordis 服务契约（编排角色无在册 capabilityId，见 descriptor.ts）。 */
export interface IFileConversionService {
  convert(request: unknown, call?: IConverterCallContext): Promise<IFileConvertResult>;
}
