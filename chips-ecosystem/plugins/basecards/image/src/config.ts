/**
 * 图片基础卡片配置模型（《01-卡片文件格式》§6.3、《08-基础卡片插件接口》§7）。
 *
 * 配置位于节点内容 `config` 字段；本模块提供归一（readConfig）、校验（validateConfig）、
 * 有效布局派生（deriveEffectiveLayoutType）、智能默认（applySmartDefaults）与资源打开请求
 * 组装（buildImageOpenRequest，《14-资源打开与默认处理器契约》§2.2 输入模型；图片类型未登记
 * 业务载荷，不构造 payload），与 `assets/schemas/image-card-config.schema.json` 保持同一口径
 * （08 §7.3：validateConfig 不得比 schema 宽松）。
 */

import {
  generateImageId,
  inferImageMimeType,
  isNonEmptyString,
  normalizeRelativeCardResourcePath,
  resolveFileName,
  resolveUrlFileName,
} from './shared/utils';

/** 按扩展名推断图片 MIME（供打开臂与测试消费的唯一口径）。 */
export { inferImageMimeType };

/** 卡片类型正式 ID（与 manifest capabilities.cardTypes[0].id 一致；历史别名 ImageCard 由平台归一）。 */
export const CARD_TYPE_ID = 'base.image';

/** 图片来源：包内文件或远程地址。 */
export type ImageSourceType = 'file' | 'url';

/** 布局类型：单图、规则网格、纵向长图、横向滚动（《01》§6.3）。 */
export type ImageLayoutType = 'single' | 'grid' | 'long-scroll' | 'horizontal-scroll';

/** 网格模式（《01》§6.3：2x2 / 3x3 / 3 列无限）。 */
export type ImageGridMode = '2x2' | '3x3' | '3-column-infinite';

/** 单图对齐。 */
export type ImageSingleAlignment = 'left' | 'center' | 'right';

/** 间距模式：零间距（无圆角）或舒适间距。 */
export type ImageSpacingMode = 'none' | 'comfortable';

/** 图片项。 */
export interface IImageItem {
  id: string;
  source: ImageSourceType;
  /** source=file 时的包内相对路径；其余形态为空串。 */
  file_path: string;
  /** source=url 时的 http(s)/webdav 地址；其余形态为空串。 */
  url: string;
  alt: string;
  title: string;
}

/** 布局选项。 */
export interface IImageLayoutOptions {
  grid_mode: ImageGridMode;
  single_width_percent: number;
  single_alignment: ImageSingleAlignment;
  spacing_mode: ImageSpacingMode;
}

/** 图片卡片配置。 */
export interface IImageConfig {
  images: IImageItem[];
  layout_type: ImageLayoutType;
  layout_options: IImageLayoutOptions;
}

export const DEFAULT_LAYOUT_OPTIONS: IImageLayoutOptions = {
  grid_mode: '2x2',
  single_width_percent: 100,
  single_alignment: 'center',
  spacing_mode: 'comfortable',
};

export const DEFAULT_CONFIG: IImageConfig = {
  images: [],
  layout_type: 'single',
  layout_options: { ...DEFAULT_LAYOUT_OPTIONS },
};

const LAYOUT_TYPES: readonly ImageLayoutType[] = [
  'single',
  'grid',
  'long-scroll',
  'horizontal-scroll',
];
const GRID_MODES: readonly ImageGridMode[] = ['2x2', '3x3', '3-column-infinite'];
const ALIGNMENTS: readonly ImageSingleAlignment[] = ['left', 'center', 'right'];
const SPACING_MODES: readonly ImageSpacingMode[] = ['none', 'comfortable'];

// ---------- URL 分析（编辑校验与打开判定的唯一口径；《01》§6.3：http(s)/webdav，data: 禁止持久化） ----------

export interface IImageUrlAnalysis {
  readonly input: string;
  readonly normalizedUrl: string;
  readonly protocol: string;
  readonly valid: boolean;
}

/**
 * 分析一个图片远程地址：只接受 `http:` / `https:` / `webdav:`。
 *
 * `data:`（含 `data:image/*`）仅运行时内存形态、禁止写入配置（《01》§6.3 补充说明 3），判不合法。
 */
export function analyzeImageUrl(value: unknown): IImageUrlAnalysis {
  const input = typeof value === 'string' ? value.trim() : '';
  if (input.length === 0) {
    return { input, normalizedUrl: '', protocol: '', valid: false };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { input, normalizedUrl: '', protocol: '', valid: false };
  }

  const protocol = url.protocol.toLowerCase();
  const valid = protocol === 'http:' || protocol === 'https:' || protocol === 'webdav:';
  return {
    input,
    normalizedUrl: valid ? url.toString() : '',
    protocol,
    valid,
  };
}

// ---------- 归一 ----------

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeImageItem(input: unknown, index: number): IImageItem {
  const record = input !== null && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const source: ImageSourceType = record['source'] === 'url' ? 'url' : 'file';
  const id = asTrimmedString(record['id']);

  return {
    id: id.length > 0 ? id : `image-${index + 1}`,
    source,
    file_path:
      source === 'file' ? (normalizeRelativeCardResourcePath(record['file_path']) ?? '') : '',
    url: source === 'url' ? asTrimmedString(record['url']) : '',
    alt: asTrimmedString(record['alt']),
    title: asTrimmedString(record['title']),
  };
}

function normalizeLayoutOptions(input: unknown): IImageLayoutOptions {
  const record = input !== null && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const width = record['single_width_percent'];

  return {
    grid_mode: GRID_MODES.includes(record['grid_mode'] as ImageGridMode)
      ? (record['grid_mode'] as ImageGridMode)
      : DEFAULT_LAYOUT_OPTIONS.grid_mode,
    single_width_percent:
      typeof width === 'number' && Number.isFinite(width) && width > 0
        ? width
        : DEFAULT_LAYOUT_OPTIONS.single_width_percent,
    single_alignment: ALIGNMENTS.includes(record['single_alignment'] as ImageSingleAlignment)
      ? (record['single_alignment'] as ImageSingleAlignment)
      : DEFAULT_LAYOUT_OPTIONS.single_alignment,
    spacing_mode: SPACING_MODES.includes(record['spacing_mode'] as ImageSpacingMode)
      ? (record['spacing_mode'] as ImageSpacingMode)
      : DEFAULT_LAYOUT_OPTIONS.spacing_mode,
  };
}

/**
 * 归一任意输入为完整配置：缺失或非法字段回退默认值（08 §7.1 规则 2）。
 *
 * 《01》§6.3 补充说明 10：多于一张图且传入 `single` 时归一结果必须改写为 `grid`。
 */
export function readConfig(input: unknown): IImageConfig {
  const record = input !== null && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const images = Array.isArray(record['images'])
    ? record['images'].map((item, index) => normalizeImageItem(item, index))
    : [];

  const declaredType = LAYOUT_TYPES.includes(record['layout_type'] as ImageLayoutType)
    ? (record['layout_type'] as ImageLayoutType)
    : DEFAULT_CONFIG.layout_type;
  const layoutType =
    images.length > 1 && declaredType === 'single' ? 'grid' : declaredType;

  return {
    images,
    layout_type: layoutType,
    layout_options: normalizeLayoutOptions(record['layout_options']),
  };
}

// ---------- 校验（与 schema 同口径：出现即校验，缺席不阻断） ----------

/**
 * 校验节点内容中的 config（08 §2.4.3）：纯函数；`undefined` / `null` 视为未提供配置，
 * 必须返回 `true`。
 *
 * 口径（《01》§6.3 补充说明 2~4 的业务补充校验，08 §7.3 允许）：
 * - `source=file` 的条目必须提供合法包内相对路径 `file_path`；
 * - `source=url` 的条目必须提供合法 `http(s)` / `webdav` 地址；`data:` 禁止持久化，拒绝；
 * - `single_width_percent` 必须在 10~100 之间。
 */
export function validateConfig(config: unknown): boolean {
  if (config === undefined || config === null) {
    return true;
  }
  if (typeof config !== 'object' || Array.isArray(config)) {
    return false;
  }
  const record = config as Record<string, unknown>;

  const images = record['images'];
  if (images !== undefined) {
    if (!Array.isArray(images)) {
      return false;
    }
    for (const item of images) {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        return false;
      }
      const entry = item as Record<string, unknown>;
      if (entry['id'] !== undefined && !isNonEmptyString(entry['id'])) {
        return false;
      }
      if (entry['alt'] !== undefined && typeof entry['alt'] !== 'string') {
        return false;
      }
      if (entry['title'] !== undefined && typeof entry['title'] !== 'string') {
        return false;
      }

      const source = entry['source'];
      if (source !== undefined && source !== 'file' && source !== 'url') {
        return false;
      }

      if (source === 'file') {
        if (normalizeRelativeCardResourcePath(entry['file_path']) === undefined) {
          return false;
        }
      } else if (source === 'url') {
        if (!analyzeImageUrl(entry['url']).valid) {
          return false;
        }
      } else {
        // source 缺席：出现即校验既有字段，不做来源补全判定（渲染按占位呈现）。
        const filePath = entry['file_path'];
        if (
          typeof filePath === 'string' &&
          filePath.trim().length > 0 &&
          normalizeRelativeCardResourcePath(filePath) === undefined
        ) {
          return false;
        }
        const url = entry['url'];
        if (
          typeof url === 'string' &&
          url.trim().length > 0 &&
          !analyzeImageUrl(url).valid
        ) {
          return false;
        }
      }
    }
  }

  if (
    record['layout_type'] !== undefined &&
    !LAYOUT_TYPES.includes(record['layout_type'] as ImageLayoutType)
  ) {
    return false;
  }

  const options = record['layout_options'];
  if (options !== undefined) {
    if (options === null || typeof options !== 'object' || Array.isArray(options)) {
      return false;
    }
    const optionRecord = options as Record<string, unknown>;
    if (
      optionRecord['grid_mode'] !== undefined &&
      !GRID_MODES.includes(optionRecord['grid_mode'] as ImageGridMode)
    ) {
      return false;
    }
    if (
      optionRecord['single_alignment'] !== undefined &&
      !ALIGNMENTS.includes(optionRecord['single_alignment'] as ImageSingleAlignment)
    ) {
      return false;
    }
    if (
      optionRecord['spacing_mode'] !== undefined &&
      !SPACING_MODES.includes(optionRecord['spacing_mode'] as ImageSpacingMode)
    ) {
      return false;
    }
    const width = optionRecord['single_width_percent'];
    if (
      width !== undefined &&
      (typeof width !== 'number' ||
        !Number.isFinite(width) ||
        width < 10 ||
        width > 100)
    ) {
      return false;
    }
  }

  return true;
}

// ---------- 内容组装 ----------

/**
 * 由配置组装节点内容（与 `createInitialContent` / 编辑器 replace 变更共用）。
 */
export function buildContent(config: IImageConfig): Record<string, unknown> {
  return {
    card_type: CARD_TYPE_ID,
    config: {
      images: config.images.map((image) => ({ ...image })),
      layout_type: config.layout_type,
      layout_options: { ...config.layout_options },
    },
  };
}

// ---------- 布局派生 ----------

/**
 * 运行时有效布局（《01》§6.3 补充说明 9~10）：至多一张图强制 `single`；
 * 多图声明 `single` 视为 `grid`。
 */
export function deriveEffectiveLayoutType(config: IImageConfig): ImageLayoutType {
  if (config.images.length <= 1) {
    return 'single';
  }
  return config.layout_type === 'single' ? 'grid' : config.layout_type;
}

/** 网格列数。 */
export function getGridColumns(gridMode: ImageGridMode): number {
  return gridMode === '2x2' ? 2 : 3;
}

/** 网格展示上限：2x2 取 4、3x3 取 9，3 列无限不裁剪。 */
export function getGridDisplayLimit(gridMode: ImageGridMode): number {
  if (gridMode === '2x2') {
    return 4;
  }
  if (gridMode === '3x3') {
    return 9;
  }
  return Number.POSITIVE_INFINITY;
}

/** 间距度量：结构常量（非视觉令牌）；颜色与阴影一律走主题 token。 */
export function getSpacingMetrics(spacingMode: ImageSpacingMode): { gap: number; radius: number } {
  return spacingMode === 'none' ? { gap: 0, radius: 0 } : { gap: 10, radius: 12 };
}

/**
 * 智能默认（旧族编辑面板行为迁移）：首个图片入列时单图 70% 居中；
 * 由一张跨到多张且仍为单图声明时切换 grid 3x3。
 */
export function applySmartDefaults(config: IImageConfig, previousImageCount: number): IImageConfig {
  if (config.images.length <= 1) {
    if (previousImageCount !== 0) {
      return config;
    }
    return {
      ...config,
      layout_type: 'single',
      layout_options: {
        ...config.layout_options,
        single_width_percent: 70,
        single_alignment: 'center',
      },
    };
  }

  if (previousImageCount > 1 || config.layout_type !== 'single') {
    return config;
  }

  return {
    ...config,
    layout_type: 'grid',
    layout_options: {
      ...config.layout_options,
      grid_mode: '3x3',
      spacing_mode: 'comfortable',
    },
  };
}

// ---------- 资源打开请求（《14》§2.2 输入模型） ----------

/** `resource:open` 能力输入（《14》§2.2）。 */
export interface IImageOpenRequest {
  readonly intent: 'view';
  readonly resource: {
    readonly uri: string;
    readonly mimeType?: string;
    readonly fileName?: string;
    readonly title?: string;
  };
}

function deriveOpenTitle(item: IImageItem): string {
  return [item.title, item.alt].find((value) => value.trim().length > 0)?.trim() ?? '';
}

/**
 * 组装单张图片的打开请求：`uri` 一律取内容中的引用原样透传（解析器在进入渲染前已把包内相对
 * 引用归一为受管作用域 URI，渲染层只消费归一结果，不重复归一、不构造作用域——《06》§2.3、§2.6）。
 *
 * 引用为空时返回 `null`（不可打开臂）。图片类型未在《14》登记业务载荷，不构造 payload。
 */
export function buildImageOpenRequest(item: IImageItem): IImageOpenRequest | null {
  if (item.source === 'url') {
    const url = item.url.trim();
    if (url.length === 0) {
      return null;
    }
    const mimeType = inferImageMimeType(resolveUrlFileName(url) || url);
    const title = deriveOpenTitle(item);
    const fileName = resolveUrlFileName(url);
    return {
      intent: 'view',
      resource: {
        uri: url,
        ...(mimeType === undefined ? {} : { mimeType }),
        ...(fileName.length > 0 ? { fileName } : {}),
        ...(title.length > 0 ? { title } : {}),
      },
    };
  }

  const filePath = normalizeRelativeCardResourcePath(item.file_path);
  if (!filePath) {
    return null;
  }
  const mimeType = inferImageMimeType(filePath);
  const fileName = resolveFileName(filePath);
  const title = deriveOpenTitle(item) || fileName;
  return {
    intent: 'view',
    resource: {
      uri: filePath,
      ...(mimeType === undefined ? {} : { mimeType }),
      ...(fileName.length > 0 ? { fileName } : {}),
      ...(title.length > 0 ? { title } : {}),
    },
  };
}

/** 新增图片项工厂：来源互斥、说明字段兜底空串。 */
export function createUrlImageItem(url: string): IImageItem {
  return {
    id: generateImageId(),
    source: 'url',
    file_path: '',
    url,
    alt: '',
    title: '',
  };
}
