/** 底图来源模式：静态图片（箱子自有资源）或 Host 地图（宿主能力预留）。 */
export type MapSourceMode = 'image' | 'host-map';

/** 投影方式：线性边界插值（静态图片）；web-mercator 为 Host 地图预留。 */
export type MapProjection = 'linear-bounds' | 'web-mercator';

/** 点位标记样式：圆点和标题、图钉和标题。 */
export type MarkerStyle = 'dot-title' | 'pin-title';

/** 区域呈现模式：不显示、箱子图片、内联 HTML 代码。 */
export type FrameRegionMode = 'none' | 'image' | 'html';

/** 经纬度边界（西/南/东/北）。 */
export interface GeoBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** 经纬度坐标点。 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** 条目定位：经纬度与可选的显示名称覆盖。 */
export interface MapEntryLocation {
  latitude: number;
  longitude: number;
  labelOverride?: string;
}

/** 地图底图配置。 */
export interface IMapSource {
  mode: MapSourceMode;
  projection: MapProjection;
  /** 图片模式的底图箱子资源路径：以 `assets/` 开头的包内相对 POSIX 路径；缺省用内置静态底图。 */
  assetPath?: string;
  bounds: GeoBounds;
}

/** 布局区域配置（顶部内容区）。 */
export interface IFrameRegion {
  mode: FrameRegionMode;
  assetPath?: string;
  html?: string;
}

/** 地图布局配置（`layout_config.props`）。 */
export interface IMapConfig {
  map_source: IMapSource;
  default_view: GeoPoint & { zoom: number };
  marker_style: MarkerStyle;
  show_cover_on_select: boolean;
  entries: Record<string, MapEntryLocation>;
  top_region: IFrameRegion;
}

/** 编辑器产出配置所遵循的 schema 版本，必须落在 manifest 的 schemaVersions 范围内。 */
export const CONFIG_SCHEMA_VERSION = '1.0.0';

/** 内置静态底图的默认经纬度边界。 */
export const DEFAULT_BOUNDS: GeoBounds = { west: -180, south: -85, east: 180, north: 85 };

/** 缩放倍率范围与控制步进。 */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 8;
export const ZOOM_STEP = 0.25;

/** 平移步进（度）。 */
export const PAN_STEP_DEGREES = 5;

/** 显示名称覆盖最大长度。 */
export const LABEL_OVERRIDE_MAX_LENGTH = 120;

/** 条目标识文法：与箱子条目 `entry_id` 同构。 */
const ENTRY_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

/** 箱子自有资源安全路径：以 `assets/` 开头、不含绝对路径、scheme、`.` 与 `..` 段。 */
const BOX_ASSET_PATH_PATTERN = /^assets\/[^\\:?#/]+(?:\/[^\\:?#/]+)*$/;

/** 默认值；必须与 assets/schemas 下配置 schema 的约束保持一致。 */
export const DEFAULT_CONFIG: IMapConfig = {
  map_source: {
    mode: 'image',
    projection: 'linear-bounds',
    bounds: { ...DEFAULT_BOUNDS },
  },
  default_view: { latitude: 0, longitude: 0, zoom: 1 },
  marker_style: 'dot-title',
  show_cover_on_select: true,
  entries: {},
  top_region: { mode: 'none' },
};

export const MARKER_STYLE_OPTIONS: readonly MarkerStyle[] = ['dot-title', 'pin-title'];

export const MARKER_STYLE_LABELS: Readonly<Record<MarkerStyle, string>> = {
  'dot-title': '圆点和标题',
  'pin-title': '图钉和标题',
};

export const MAP_SOURCE_IMAGE_LABEL = '静态图片';
export const MAP_SOURCE_HOST_LABEL = 'Host 地图';

/** Host 地图能力缺位的诚实降级提示（按图片底图降级实现，不联网加载地图）。 */
export const HOST_MAP_UNAVAILABLE_TEXT =
  'Host 地图能力尚未提供，当前布局按内置静态底图显示，不会联网加载地图。';
export const HOST_MAP_RESERVED_HINT = 'Host 地图是预留模式；当前宿主未提供地图能力，请使用静态图片底图。';
export const IMAGE_MODE_HINT = '静态图片经箱子自有资源引用，布局不联网获取瓦片。';

export const MAP_BASEMAP_TITLE = '地图底图';
export const MAP_VIEW_TITLE = '默认视图';
export const MAP_ENTRIES_TITLE = '条目定位';
export const TOP_REGION_TITLE = '顶部内容区';

export const BOUNDS_FIELD_LABELS: Readonly<Record<keyof GeoBounds, string>> = {
  west: '西边界经度',
  south: '南边界纬度',
  east: '东边界经度',
  north: '北边界纬度',
};

export const EMPTY_TITLE = '这里还没有内容';
export const EMPTY_HINT_TEXT = '在编辑器中添加卡片或箱子，开始填充这个箱子';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function isMapSourceMode(value: unknown): value is MapSourceMode {
  return value === 'image' || value === 'host-map';
}

function isMapProjection(value: unknown): value is MapProjection {
  return value === 'linear-bounds' || value === 'web-mercator';
}

function isMarkerStyle(value: unknown): value is MarkerStyle {
  return value === 'dot-title' || value === 'pin-title';
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

/**
 * 判定纬度是否处于 [-90, 90] 且为有限数。
 *
 * @param value - 纬度
 * @returns 合法返回 true，否则 false
 */
export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

/**
 * 判定经度是否处于 [-180, 180] 且为有限数。
 *
 * @param value - 经度
 * @returns 合法返回 true，否则 false
 */
export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

/**
 * 判定经纬度边界是否合法：四至有限且 west < east、south < north。
 *
 * @param bounds - 经纬度边界
 * @returns 合法返回 true，否则 false
 */
export function isValidBounds(bounds: GeoBounds): boolean {
  return (
    isValidLongitude(bounds.west) &&
    isValidLongitude(bounds.east) &&
    isValidLatitude(bounds.south) &&
    isValidLatitude(bounds.north) &&
    bounds.west < bounds.east &&
    bounds.south < bounds.north
  );
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
 * 判定底图是否配置了自定义图片资产（图片模式且携带安全路径）。
 *
 * @param source - 底图配置
 * @returns 有自定义底图返回 true，否则 false
 */
export function hasCustomMapImage(source: IMapSource): boolean {
  return source.mode === 'image' && typeof source.assetPath === 'string' && source.assetPath.length > 0;
}

function normalizeMapSource(value: unknown): IMapSource {
  const raw = isRecord(value) ? value : {};
  const mode = isMapSourceMode(raw.mode) ? raw.mode : DEFAULT_CONFIG.map_source.mode;
  const rawProjection = isMapProjection(raw.projection)
    ? raw.projection
    : DEFAULT_CONFIG.map_source.projection;
  // web-mercator 为 Host 地图预留；静态图片一律线性边界投影。
  const projection: MapProjection =
    mode === 'host-map' ? rawProjection : 'linear-bounds';
  const rawAssetPath = typeof raw.assetPath === 'string' ? raw.assetPath : '';
  const assetPath =
    mode === 'image' && rawAssetPath.length > 0 && isSafeBoxAssetPath(rawAssetPath)
      ? rawAssetPath
      : undefined;
  const rawBounds = isRecord(raw.bounds) ? raw.bounds : {};
  const bounds: GeoBounds = {
    west: toFiniteNumber(rawBounds.west, DEFAULT_BOUNDS.west),
    south: toFiniteNumber(rawBounds.south, DEFAULT_BOUNDS.south),
    east: toFiniteNumber(rawBounds.east, DEFAULT_BOUNDS.east),
    north: toFiniteNumber(rawBounds.north, DEFAULT_BOUNDS.north),
  };
  return assetPath === undefined
    ? { mode, projection, bounds }
    : { mode, projection, assetPath, bounds };
}

function normalizeDefaultView(value: unknown): IMapConfig['default_view'] {
  const raw = isRecord(value) ? value : {};
  const zoom = toFiniteNumber(raw.zoom, DEFAULT_CONFIG.default_view.zoom);
  return {
    latitude: toFiniteNumber(raw.latitude, DEFAULT_CONFIG.default_view.latitude),
    longitude: toFiniteNumber(raw.longitude, DEFAULT_CONFIG.default_view.longitude),
    zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)),
  };
}

function normalizeEntryLocations(value: unknown): Record<string, MapEntryLocation> {
  const raw = isRecord(value) ? value : {};
  const entries: Record<string, MapEntryLocation> = {};
  for (const [entryId, rawLocation] of Object.entries(raw)) {
    if (!ENTRY_ID_PATTERN.test(entryId)) {
      continue;
    }
    const location = isRecord(rawLocation) ? rawLocation : {};
    const latitude = toFiniteNumber(location.latitude, Number.NaN);
    const longitude = toFiniteNumber(location.longitude, Number.NaN);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }
    const labelOverride =
      typeof location.labelOverride === 'string' ? location.labelOverride.trim() : '';
    entries[entryId] = {
      latitude,
      longitude,
      ...(labelOverride.length > 0
        ? { labelOverride: labelOverride.slice(0, LABEL_OVERRIDE_MAX_LENGTH) }
        : {}),
    };
  }
  return entries;
}

/**
 * 归一布局配置：字段缺失或非法时回退默认值，保证渲染不因坏配置失败。
 *
 * @param input - 布局配置原始值
 * @returns 归一后的配置
 */
export function readConfig(input: unknown): IMapConfig {
  const record = isRecord(input) ? input : {};
  return {
    map_source: normalizeMapSource(record.map_source),
    default_view: normalizeDefaultView(record.default_view),
    marker_style: isMarkerStyle(record.marker_style)
      ? record.marker_style
      : DEFAULT_CONFIG.marker_style,
    show_cover_on_select:
      typeof record.show_cover_on_select === 'boolean'
        ? record.show_cover_on_select
        : DEFAULT_CONFIG.show_cover_on_select,
    entries: normalizeEntryLocations(record.entries),
    top_region: normalizeFrameRegion(record.top_region),
  };
}

/**
 * 派生当前配置引用的箱子资源列表（`asset_refs` 口径）：图片模式底图与顶部区域的合法路径去重集合。
 *
 * @param config - 归一后的布局配置
 * @returns 以 `assets/` 开头的资源路径数组
 */
export function deriveAssetRefs(config: IMapConfig): string[] {
  return [
    ...new Set(
      [
        hasCustomMapImage(config.map_source) ? config.map_source.assetPath : undefined,
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

function isEntryLocationValid(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.latitude !== 'number' || !isValidLatitude(value.latitude)) {
    return false;
  }
  if (typeof value.longitude !== 'number' || !isValidLongitude(value.longitude)) {
    return false;
  }
  if (
    value.labelOverride !== undefined &&
    (typeof value.labelOverride !== 'string' ||
      value.labelOverride.length > LABEL_OVERRIDE_MAX_LENGTH)
  ) {
    return false;
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

  if (config.map_source !== undefined) {
    const source = config.map_source;
    if (!isRecord(source)) {
      return false;
    }
    if (source.mode !== undefined && !isMapSourceMode(source.mode)) {
      return false;
    }
    if (source.projection !== undefined) {
      if (!isMapProjection(source.projection)) {
        return false;
      }
      if (source.mode === 'image' && source.projection !== 'linear-bounds') {
        return false;
      }
    }
    if (source.assetPath !== undefined) {
      if (
        typeof source.assetPath !== 'string' ||
        source.assetPath.length === 0 ||
        !isSafeBoxAssetPath(source.assetPath)
      ) {
        return false;
      }
    }
    if (source.bounds !== undefined) {
      const bounds = source.bounds;
      if (!isRecord(bounds)) {
        return false;
      }
      const { west, south, east, north } = bounds;
      if (
        typeof west !== 'number' ||
        typeof south !== 'number' ||
        typeof east !== 'number' ||
        typeof north !== 'number' ||
        !isValidBounds({ west, south, east, north })
      ) {
        return false;
      }
    }
  }

  if (config.default_view !== undefined) {
    const view = config.default_view;
    if (!isRecord(view)) {
      return false;
    }
    if (
      view.latitude !== undefined &&
      (typeof view.latitude !== 'number' || !isValidLatitude(view.latitude))
    ) {
      return false;
    }
    if (
      view.longitude !== undefined &&
      (typeof view.longitude !== 'number' || !isValidLongitude(view.longitude))
    ) {
      return false;
    }
    if (
      view.zoom !== undefined &&
      (typeof view.zoom !== 'number' || !Number.isFinite(view.zoom) ||
        view.zoom < ZOOM_MIN ||
        view.zoom > ZOOM_MAX)
    ) {
      return false;
    }
  }

  if (config.marker_style !== undefined && !isMarkerStyle(config.marker_style)) {
    return false;
  }
  if (
    config.show_cover_on_select !== undefined &&
    typeof config.show_cover_on_select !== 'boolean'
  ) {
    return false;
  }

  if (config.entries !== undefined) {
    const entries = config.entries;
    if (!isRecord(entries)) {
      return false;
    }
    for (const [entryId, location] of Object.entries(entries)) {
      if (!ENTRY_ID_PATTERN.test(entryId) || !isEntryLocationValid(location)) {
        return false;
      }
    }
  }

  if (config.top_region !== undefined && !isFrameRegionShapeValid(config.top_region)) {
    return false;
  }

  return true;
}

/**
 * 线性边界投影：把经纬度按底图边界插值为世界层百分比坐标（对照旧源码 `projectPoint` 算法）。
 *
 * @param point - 经纬度坐标点
 * @param bounds - 底图经纬度边界
 * @returns 百分比坐标；边界非法或坐标越界时返回 undefined
 */
export function projectLinear(
  point: GeoPoint,
  bounds: GeoBounds
): { x: number; y: number } | undefined {
  if (!isValidBounds(bounds) || !isValidLatitude(point.latitude) || !isValidLongitude(point.longitude)) {
    return undefined;
  }
  const x = ((point.longitude - bounds.west) / (bounds.east - bounds.west)) * 100;
  const y = ((bounds.north - point.latitude) / (bounds.north - bounds.south)) * 100;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }
  return { x, y };
}

/**
 * 数值夹取。
 *
 * @param value - 原值
 * @param min - 下界
 * @param max - 上界
 * @returns 夹取后的值
 */
export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 缩放倍率夹取：限制在 [ZOOM_MIN, ZOOM_MAX] 并保留两位小数（对照旧源码 zoom 步进口径）。
 *
 * @param value - 原缩放倍率
 * @returns 夹取后的缩放倍率
 */
export function clampZoom(value: number): number {
  return Number(clampNumber(value, ZOOM_MIN, ZOOM_MAX).toFixed(2));
}

/**
 * 平移默认视图中心：纬度夹取 ±90、经度夹取 ±180，不绕回（对照旧源码 panView 算法）。
 *
 * @param center - 当前中心点
 * @param deltaLatitude - 纬度增量（度）
 * @param deltaLongitude - 经度增量（度）
 * @returns 平移后的中心点
 */
export function panCenter(center: GeoPoint, deltaLatitude: number, deltaLongitude: number): GeoPoint {
  return {
    latitude: clampNumber(center.latitude + deltaLatitude, -90, 90),
    longitude: clampNumber(center.longitude + deltaLongitude, -180, 180),
  };
}
