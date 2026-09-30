/**
 * 图像内容处理服务（canonical 包 `chips.service.content-image`）契约类型面。
 *
 * 本包已实现的能力：`content-image.pick-colors`（04-能力契约规范 §8.4 登记项，
 * 原子操作 `pickColors`，错误码族 `IMAGE_*`）。同族的 `content-image.normalize` /
 * `content-image.transcode` 两能力只有契约（`assets/schemas/`）没有实现，
 * 故本文件不声明它们的操作类型（W4 §9.1 并行闸 3「禁假接线」）。
 *
 * 与旧模块仓（`Chips-ModulePlugin/Chips-ColorPicker`，旧 ID
 * `chips.module.chips.colorpicker`）的类型差异全部由契约决定：
 * - §8.3 原子操作约束 1「不获取资源句柄、不读写路径」⇒ 输入不再有 `imagePath`，
 *   输出不再有 `metadata.source`（旧字段承载的是宿主文件路径与 stat 事实）；
 * - §8.3 约束 5「不得以内联 base64 兜底二进制」⇒ 图像输入一律为 `Uint8Array`；
 * - §8.3 约束 2「实现必须响应调用方 AbortSignal」⇒ 取消面改为调用上下文传入的
 *   `AbortSignal`（旧 `ctx.job` 由模块作业通道提供，服务契约面无该面）。
 */

/** 调色板条目角色：背景色、强调色、代表色。 */
export type ColorPaletteRole = 'background' | 'accent' | 'representative';

/** 调色板条目：颜色与它在样本中的统计特征。 */
export interface IColorPaletteEntry {
  /** 十六进制颜色（`#rrggbb`，小写）。 */
  color: string;
  /** 条目角色。 */
  role: ColorPaletteRole;
  /** 群体占比（0–1，千分位取整）。 */
  population: number;
  /** OKLCH 明度（0–1，千分位取整）。 */
  lightness: number;
  /** OKLCH 彩度（千分位取整）。 */
  chroma: number;
}

/** 解码后图像的来源信息（由解码端口回填）。 */
export interface IDecodedImageInfo {
  /** 原图宽度（像素）。 */
  width: number;
  /** 原图高度（像素）。 */
  height: number;
  /** 规范化格式名（如 `png`、`jpeg`）。 */
  format?: string;
  /** 是否动图（多帧）。 */
  animated: boolean;
  /** 帧数或页数。 */
  pageCount: number;
  /** 是否含 Alpha 通道。 */
  hasAlpha: boolean;
  /** EXIF 方向（1–8，未知时缺省）。 */
  orientation?: number;
}

/** RGBA 像素样本：解码端口产出的取色输入。 */
export interface IRgbaPixelSample {
  /** 样本宽度（像素）。 */
  width: number;
  /** 样本高度（像素）。 */
  height: number;
  /** 逐像素 RGBA 字节（长度必须为 width × height × 4）。 */
  pixels: Uint8Array;
}

/** 取色结果的采样元数据。 */
export interface IPickColorsSampleInfo {
  width: number;
  height: number;
  sampleSize: number;
  visiblePixelRatio: number;
  transparentPixelRatio: number;
  clusterCount: number;
}

/** 取色结果的完整元数据。 */
export interface IPickColorsMetadata {
  /** 算法标识：OKLab 加权 k-means 第一代。 */
  algorithm: 'oklab-kmeans-v1';
  image: IDecodedImageInfo;
  sample: IPickColorsSampleInfo;
}

/** 取色结果。 */
export interface IPickColorsResult {
  backgroundColor: string;
  accentColor: string;
  /** 调色板：首项背景、次项强调，其后代表色，至多 8 项。 */
  palette: IColorPaletteEntry[];
  metadata: IPickColorsMetadata;
}

/** 取色输入（`assets/schemas/pick-colors.input.schema.json` 同源）。 */
export interface IPickColorsInput {
  /** 图像字节（PNG / JPEG / WebP / GIF 等，按解码端口支持矩阵）。 */
  image: Uint8Array;
  /** 采样边长（像素），48–160，缺省 96。 */
  sampleSize?: number;
  /** 来源格式提示（规范化名）；缺省由解码端口嗅探。 */
  format?: string;
  /**
   * 来源标识提示（由消费方给出的稳定字符串，例如资源 URI 与修订号）：
   * 服务据此做结果与解码样本的 LRU 缓存；缺省时不缓存。
   * 本字段只作缓存键使用，不写日志、不出现在输出与错误诊断中。
   */
  sourceKey?: string;
}

/** 调用上下文：只承载取消信号。 */
export interface IPickColorsCallContext {
  /** 取消信号：实现必须在安全点检查并抛 `BRIDGE_CANCELLED`。 */
  signal?: AbortSignal;
}

/** 解码端口产出：RGBA 样本与来源信息。 */
export interface IImageDecodeResult extends IRgbaPixelSample {
  info: IDecodedImageInfo;
}

/** 解码端口选项。 */
export interface IImageDecodeOptions {
  /** 目标采样边长（已归一到 48–160）。 */
  targetSize: number;
  /** 来源格式提示。 */
  format?: string;
}

/**
 * 图像解码端口：把图像字节解码为 RGBA 像素样本。
 *
 * 实现归属宿主图像供给（`content-image` 族 `normalize` / `transcode` 提供方）；
 * 本包只声明端口形状与未绑定实现（见 `pixel-source.ts`）。
 */
export interface IImageDecodeEngine {
  /** 端口实现标识。 */
  readonly id: string;
  /** 解码图像字节为 RGBA 像素样本。 */
  decode(bytes: Uint8Array, options: IImageDecodeOptions): Promise<IImageDecodeResult>;
}

/** 服务装配依赖。 */
export interface IPickColorsServiceDependencies {
  /** 图像解码端口。 */
  readonly engine: IImageDecodeEngine;
}

/** Cordis 服务面：`content-image`。 */
export interface IPickColorsService {
  /** 能力 ID（04-能力契约规范 §8.4）。 */
  readonly capabilityId: string;
  /** 原子操作：图像字节 → 背景色、强调色、调色板与采样元数据。 */
  pickColors(input: IPickColorsInput, call?: IPickColorsCallContext): Promise<IPickColorsResult>;
}

/** 内容处理能力描述符（04-能力契约规范 §8.3）。 */
export interface IContentCapabilityDescriptor {
  id: string;
  service: string;
  provider: string;
  operations: readonly string[];
  sourceFormats: readonly string[];
  targetFormats: readonly string[];
  streaming: { readonly input: boolean; readonly output: boolean };
  maxInlineInputBytes: number;
  contractPackage: string;
}
