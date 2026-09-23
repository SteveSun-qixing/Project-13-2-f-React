/** 条目排序方式：手动顺序、按名称升序、按名称降序。 */
export type SortMode = 'manual' | 'name-asc' | 'name-desc';

/** 区域呈现模式：不显示、箱子图片、内联 HTML 代码。 */
export type FrameRegionMode = 'none' | 'image' | 'html';

/** 布局区域配置（背景区 / 顶部内容区共用形状）。 */
export interface IFrameRegion {
  mode: FrameRegionMode;
  /** 图片模式的箱子自有资源路径：以 `assets/` 开头的包内相对 POSIX 路径。 */
  assetPath?: string;
  /** 代码模式的内联 HTML 文档。 */
  html?: string;
}

/** 布局配置。 */
export interface IGridConfig {
  gap: number;
  show_tags: boolean;
  information_density: 'compact' | 'comfortable';
  sort_mode: SortMode;
  background: IFrameRegion;
  top_region: IFrameRegion;
}

/** 默认值；必须与 assets/schemas 下配置 schema 的约束保持一致。 */
export const DEFAULT_CONFIG: IGridConfig = {
  gap: 16,
  show_tags: true,
  information_density: 'comfortable',
  sort_mode: 'manual',
  background: { mode: 'none' },
  top_region: { mode: 'none' },
};

/** 编辑器产出配置所遵循的 schema 版本，必须落在 manifest 的 schemaVersions 范围内。 */
export const CONFIG_SCHEMA_VERSION = '1.0.0';

export const GAP_MIN = 0;
export const GAP_MAX = 64;

export const DENSITY_OPTIONS = ['comfortable', 'compact'] as const;

export const DENSITY_LABELS: Readonly<Record<IGridConfig['information_density'], string>> = {
  comfortable: '舒适',
  compact: '紧凑',
};

export const SORT_OPTIONS: readonly SortMode[] = ['manual', 'name-asc', 'name-desc'];

export const SORT_LABELS: Readonly<Record<SortMode, string>> = {
  manual: '手动顺序',
  'name-asc': '按名称升序',
  'name-desc': '按名称降序',
};

export const FRAME_REGION_MODE_OPTIONS: readonly FrameRegionMode[] = ['none', 'image', 'html'];

export const FRAME_REGION_MODE_LABELS: Readonly<Record<FrameRegionMode, string>> = {
  none: '不显示',
  image: '图片',
  html: '代码',
};

/** 区域无障碍/帧标题文案。 */
export const BACKGROUND_TITLE = '背景区域';
export const TOP_REGION_TITLE = '顶部区域';

/** 响应式列数：容器不超过 600px 时固定两列，否则按最小格子宽度计算并封顶八列。 */
export const MOBILE_MAX_WIDTH = 600;
export const MIN_TILE_WIDTH = 200;
export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 8;

/** 箱子自有资源安全路径：以 `assets/` 开头、不含绝对路径、scheme、`.` 与 `..` 段。 */
const BOX_ASSET_PATH_PATTERN = /^assets\/[^\\:?#/]+(?:\/[^\\:?#/]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDensity(value: unknown): value is IGridConfig['information_density'] {
  return value === 'compact' || value === 'comfortable';
}

function isSortMode(value: unknown): value is SortMode {
  return value === 'manual' || value === 'name-asc' || value === 'name-desc';
}

function isFrameRegionMode(value: unknown): value is FrameRegionMode {
  return value === 'none' || value === 'image' || value === 'html';
}

/**
 * 判定字符串是否为安全的箱子资源路径。
 *
 * @param value - 待判定路径
 * @returns 合法返回 true，否则 false
 */
export function isSafeBoxAssetPath(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed !== value || !BOX_ASSET_PATH_PATTERN.test(trimmed)) {
    return false;
  }
  if (trimmed.startsWith('/') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return false;
  }
  return trimmed.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..');
}

function normalizeFrameRegion(value: unknown): IFrameRegion {
  const raw = isRecord(value) ? value : {};
  const mode = isFrameRegionMode(raw.mode) ? raw.mode : 'none';
  const rawAssetPath = typeof raw.assetPath === 'string' ? raw.assetPath : '';
  const assetPath =
    rawAssetPath.length > 0 && isSafeBoxAssetPath(rawAssetPath) ? rawAssetPath : undefined;
  const html = typeof raw.html === 'string' && raw.html.trim().length > 0 ? raw.html : undefined;

  if (mode === 'image') {
    return assetPath === undefined ? { mode: 'image' } : { mode: 'image', assetPath };
  }
  if (mode === 'html') {
    return html === undefined
      ? { mode: 'html', html: typeof raw.html === 'string' ? raw.html : '' }
      : { mode: 'html', html };
  }
  return { mode: 'none' };
}

/**
 * 判定区域是否有可呈现内容。
 *
 * @param region - 区域配置
 * @returns 有内容返回 true，否则 false
 */
export function hasFrameRegionContent(region: IFrameRegion): boolean {
  if (region.mode === 'image') {
    return typeof region.assetPath === 'string' && region.assetPath.trim().length > 0;
  }
  if (region.mode === 'html') {
    return typeof region.html === 'string' && region.html.trim().length > 0;
  }
  return false;
}

/**
 * 归一布局配置：字段缺失或非法时回退默认值，保证渲染不因坏配置失败。
 *
 * @param input - 布局配置原始值
 * @returns 归一后的配置
 */
export function readConfig(input: unknown): IGridConfig {
  const record = isRecord(input) ? input : {};
  const gap = record.gap;
  const showTags = record.show_tags;
  const density = record.information_density;
  return {
    gap:
      typeof gap === 'number' && Number.isFinite(gap)
        ? Math.min(Math.max(Math.round(gap), GAP_MIN), GAP_MAX)
        : DEFAULT_CONFIG.gap,
    show_tags: typeof showTags === 'boolean' ? showTags : DEFAULT_CONFIG.show_tags,
    information_density: isDensity(density) ? density : DEFAULT_CONFIG.information_density,
    sort_mode: isSortMode(record.sort_mode) ? record.sort_mode : DEFAULT_CONFIG.sort_mode,
    background: normalizeFrameRegion(record.background),
    top_region: normalizeFrameRegion(record.top_region),
  };
}

/**
 * 派生当前配置引用的箱子资源列表（`asset_refs` 口径）：图片模式区域的合法路径去重集合。
 *
 * @param config - 归一后的布局配置
 * @returns 以 `assets/` 开头的资源路径数组
 */
export function deriveAssetRefs(config: IGridConfig): string[] {
  return [
    ...new Set(
      [
        config.background.mode === 'image' ? config.background.assetPath : undefined,
        config.top_region.mode === 'image' ? config.top_region.assetPath : undefined,
      ].filter((value): value is string => typeof value === 'string' && value.length > 0)
    ),
  ];
}

function isFrameRegionShapeValid(region: unknown): boolean {
  if (!isRecord(region)) {
    return false;
  }
  if (!isFrameRegionMode(region.mode)) {
    return false;
  }
  if (region.mode === 'image') {
    return (
      typeof region.assetPath === 'string' &&
      region.assetPath.length > 0 &&
      isSafeBoxAssetPath(region.assetPath)
    );
  }
  if (region.mode === 'html') {
    return typeof region.html === 'string' && region.html.trim().length > 0;
  }
  return true;
}

/**
 * 校验布局配置是否可用于渲染；纯函数、同步、不得抛出。
 *
 * @param config - 布局配置原始值
 * @returns 合法返回 true，否则 false
 */
export function validateConfig(config: unknown): boolean {
  if (config === undefined || config === null) {
    return true;
  }
  if (!isRecord(config)) {
    return false;
  }
  const gap = config.gap;
  const showTags = config.show_tags;
  const density = config.information_density;
  if (gap !== undefined) {
    if (typeof gap !== 'number' || !Number.isInteger(gap) || gap < GAP_MIN || gap > GAP_MAX) {
      return false;
    }
  }
  if (showTags !== undefined && typeof showTags !== 'boolean') {
    return false;
  }
  if (density !== undefined && !isDensity(density)) {
    return false;
  }
  if (config.sort_mode !== undefined && !isSortMode(config.sort_mode)) {
    return false;
  }
  if (config.background !== undefined && !isFrameRegionShapeValid(config.background)) {
    return false;
  }
  if (config.top_region !== undefined && !isFrameRegionShapeValid(config.top_region)) {
    return false;
  }
  return true;
}

/**
 * 计算列数。
 *
 * @param containerWidth - 容器内容宽度（px）
 * @returns 列数，介于 MIN_COLUMNS 与 MAX_COLUMNS 之间
 */
export function computeColumnCount(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= MOBILE_MAX_WIDTH) {
    return MIN_COLUMNS;
  }
  const byWidth = Math.floor(containerWidth / MIN_TILE_WIDTH);
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, byWidth));
}
