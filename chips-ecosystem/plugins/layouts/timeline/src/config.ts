import type { EntryView } from '@chips/sdk';

/** 时间线方向：竖向轴排布或横向轴排布。 */
export type TimelineOrientation = 'vertical' | 'horizontal';

/** 比例方式：时间点等距，或按可解析日期的间距线性映射。 */
export type TimelineScaleMode = 'equal-points' | 'date-distance';

/** 卡片密度：控制条目封面槽位尺寸与内边距档位。 */
export type TimelineCardDensity = 'compact' | 'comfortable' | 'spacious';

/** 区域呈现模式：不显示、箱子图片、内联 HTML 代码。 */
export type FrameRegionMode = 'none' | 'image' | 'html';

/** 时间点配置：条目绑定的轴上节点。 */
export interface ITimelinePointConfig {
  /** 稳定标识；文法 `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`，归一时保证唯一。 */
  id: string;
  /** 时间点名称。 */
  label: string;
  /** 日期自由文本；可解析日期参与日期间距比例与本地化呈现。 */
  date?: string;
  /** 绑定条目标识；同一时间点内唯一，跨时间点先到先得。 */
  entry_ids: string[];
  /** 时间点说明。 */
  note?: string;
}

/** 布局区域配置（背景区 / 顶部内容区共用形状）。 */
export interface IFrameRegion {
  mode: FrameRegionMode;
  /** 图片模式的箱子自有资源路径：以 `assets/` 开头的包内相对 POSIX 路径。 */
  assetPath?: string;
  /** 代码模式的内联 HTML 文档。 */
  html?: string;
}

/** 布局配置。 */
export interface ITimelineConfig {
  orientation: TimelineOrientation;
  scale_mode: TimelineScaleMode;
  show_covers: boolean;
  card_density: TimelineCardDensity;
  points: ITimelinePointConfig[];
  background: IFrameRegion;
  top_region: IFrameRegion;
}

/** 时间线分组：时间点或未安排区块的呈现模型。 */
export interface ITimelineGroup {
  id: string;
  label: string;
  date?: string;
  note?: string;
  entries: EntryView[];
  position: number;
  isUnscheduled?: boolean;
}

/** 默认值；必须与 assets/schemas 下配置 schema 的约束保持一致。 */
export const DEFAULT_CONFIG: ITimelineConfig = {
  orientation: 'vertical',
  scale_mode: 'equal-points',
  show_covers: true,
  card_density: 'comfortable',
  points: [],
  background: { mode: 'none' },
  top_region: { mode: 'none' },
};

/** 编辑器产出配置所遵循的 schema 版本，必须落在 manifest 的 schemaVersions 范围内。 */
export const CONFIG_SCHEMA_VERSION = '1.0.0';

export const ORIENTATION_OPTIONS: readonly TimelineOrientation[] = ['vertical', 'horizontal'];

export const ORIENTATION_LABELS: Readonly<Record<TimelineOrientation, string>> = {
  vertical: '竖向',
  horizontal: '横向',
};

export const SCALE_MODE_OPTIONS: readonly TimelineScaleMode[] = ['equal-points', 'date-distance'];

export const SCALE_MODE_LABELS: Readonly<Record<TimelineScaleMode, string>> = {
  'equal-points': '时间点等距',
  'date-distance': '日期间距',
};

export const SCALE_MODE_HINT = '日期间距只对可解析日期生效，无法解析的日期按自由文本显示';

export const DENSITY_OPTIONS: readonly TimelineCardDensity[] = ['compact', 'comfortable', 'spacious'];

export const DENSITY_LABELS: Readonly<Record<TimelineCardDensity, string>> = {
  compact: '紧凑',
  comfortable: '舒适',
  spacious: '宽松',
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

/** 时间点标识文法。 */
export const POINT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** 未安排区块的分组标识与呈现名称。 */
export const UNSCHEDULED_GROUP_ID = '__unscheduled';
export const UNSCHEDULED_LABEL = '未安排条目';

/** 折叠态下每个时间点直呈的条目数，其余折叠进展开按钮。 */
export const COLLAPSED_VISIBLE_ENTRIES = 2;

/** 横向时间线单次键盘滚动的步长（px，结构常量）。 */
export const HORIZONTAL_SCROLL_STEP = 320;

/** 各密度档位的条目封面槽位宽度（px，结构常量，与旧档位一致）。 */
export const DENSITY_COVER_SIZE: Readonly<Record<TimelineCardDensity, number>> = {
  compact: 72,
  comfortable: 104,
  spacious: 132,
};

/** 紧凑排布断点：容器不宽于该值时时间点标记列与条目封面改为纵向堆叠（结构常量）。 */
export const RESPONSIVE_MAX_WIDTH = 720;

/** 箱子自有资源安全路径：以 `assets/` 开头、不含绝对路径、scheme、`.` 与 `..` 段。 */
const BOX_ASSET_PATH_PATTERN = /^assets\/[^\\:?#/]+(?:\/[^\\:?#/]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOrientation(value: unknown): value is TimelineOrientation {
  return value === 'vertical' || value === 'horizontal';
}

function isScaleMode(value: unknown): value is TimelineScaleMode {
  return value === 'equal-points' || value === 'date-distance';
}

function isCardDensity(value: unknown): value is TimelineCardDensity {
  return value === 'compact' || value === 'comfortable' || value === 'spacious';
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

function normalizeEntryIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entryIds = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return [...new Set(entryIds)];
}

function normalizePointId(value: unknown, index: number, usedIds: Set<string>): string {
  const rawId = typeof value === 'string' ? value.trim() : '';
  const baseId = POINT_ID_PATTERN.test(rawId) ? rawId : `point-${index + 1}`;
  let candidate = baseId;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function normalizePointText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTimelinePoints(value: unknown): ITimelinePointConfig[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const usedIds = new Set<string>();
  const assignedEntries = new Set<string>();
  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((point, index) => {
      const entryIds = normalizeEntryIds(point.entry_ids).filter((entryId) => {
        if (assignedEntries.has(entryId)) {
          return false;
        }
        assignedEntries.add(entryId);
        return true;
      });
      const date = normalizePointText(point.date);
      const note = normalizePointText(point.note);
      return {
        id: normalizePointId(point.id, index, usedIds),
        label: normalizePointText(point.label) ?? `时间点 ${index + 1}`,
        entry_ids: entryIds,
        ...(date === undefined ? {} : { date }),
        ...(note === undefined ? {} : { note }),
      };
    });
}

/**
 * 生成不与既有时间点冲突的新标识。
 *
 * @param points - 既有时间点列表
 * @returns 可用的 `point-N` 标识
 */
export function createPointId(points: readonly ITimelinePointConfig[]): string {
  const used = new Set(points.map((point) => point.id));
  let index = points.length + 1;
  let id = `point-${index}`;
  while (used.has(id)) {
    index += 1;
    id = `point-${index}`;
  }
  return id;
}

/**
 * 派生当前配置引用的箱子资源列表（`asset_refs` 口径）：图片模式区域的合法路径去重集合。
 *
 * @param config - 归一后的布局配置
 * @returns 以 `assets/` 开头的资源路径数组
 */
export function deriveAssetRefs(config: ITimelineConfig): string[] {
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

function isPointShapeValid(point: unknown, seenIds: Set<string>): boolean {
  if (!isRecord(point)) {
    return false;
  }
  const { id, label, date, entry_ids, note } = point;
  if (typeof id !== 'string' || !POINT_ID_PATTERN.test(id) || seenIds.has(id)) {
    return false;
  }
  seenIds.add(id);
  if (typeof label !== 'string' || label.trim().length === 0) {
    return false;
  }
  if (date !== undefined && (typeof date !== 'string' || date.trim().length === 0)) {
    return false;
  }
  if (note !== undefined && (typeof note !== 'string' || note.trim().length === 0)) {
    return false;
  }
  if (!Array.isArray(entry_ids)) {
    return false;
  }
  const seenEntries = new Set<string>();
  for (const item of entry_ids) {
    if (typeof item !== 'string' || item.trim().length === 0 || seenEntries.has(item)) {
      return false;
    }
    seenEntries.add(item);
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
  if (config.orientation !== undefined && !isOrientation(config.orientation)) {
    return false;
  }
  if (config.scale_mode !== undefined && !isScaleMode(config.scale_mode)) {
    return false;
  }
  if (config.show_covers !== undefined && typeof config.show_covers !== 'boolean') {
    return false;
  }
  if (config.card_density !== undefined && !isCardDensity(config.card_density)) {
    return false;
  }
  if (config.points !== undefined) {
    if (!Array.isArray(config.points)) {
      return false;
    }
    const seenIds = new Set<string>();
    for (const point of config.points) {
      if (!isPointShapeValid(point, seenIds)) {
        return false;
      }
    }
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
 * 归一布局配置：字段缺失或非法时回退默认值，保证渲染不因坏配置失败。
 *
 * @param input - 布局配置原始值
 * @returns 归一后的配置
 */
export function readConfig(input: unknown): ITimelineConfig {
  const record = isRecord(input) ? input : {};
  const orientation = record.orientation;
  const scaleMode = record.scale_mode;
  const showCovers = record.show_covers;
  const cardDensity = record.card_density;
  return {
    orientation: isOrientation(orientation) ? orientation : DEFAULT_CONFIG.orientation,
    scale_mode: isScaleMode(scaleMode) ? scaleMode : DEFAULT_CONFIG.scale_mode,
    show_covers: typeof showCovers === 'boolean' ? showCovers : DEFAULT_CONFIG.show_covers,
    card_density: isCardDensity(cardDensity) ? cardDensity : DEFAULT_CONFIG.card_density,
    points: normalizeTimelinePoints(record.points),
    background: normalizeFrameRegion(record.background),
    top_region: normalizeFrameRegion(record.top_region),
  };
}

/**
 * 读取时间点的可解析时间戳。
 *
 * @param point - 时间点配置
 * @returns 可解析返回毫秒时间戳，否则 undefined
 */
export function readPointTime(point: ITimelinePointConfig): number | undefined {
  if (point.date === undefined) {
    return undefined;
  }
  const time = new Date(point.date).getTime();
  return Number.isNaN(time) ? undefined : time;
}

/**
 * 计算时间点在轴上的位置：等距为位次；日期间距把可解析日期线性映射到 `[0, n-1]`，
 * 可解析点不足两个时整体退化为等距，不可解析日期回退位次。
 *
 * @param points - 时间点列表
 * @param scaleMode - 比例方式
 * @returns 时间点标识到位置的映射
 */
export function calculatePointPositions(
  points: readonly ITimelinePointConfig[],
  scaleMode: TimelineScaleMode
): Map<string, number> {
  const positions = new Map<string, number>();
  if (points.length === 0) {
    return positions;
  }
  if (scaleMode !== 'date-distance') {
    points.forEach((point, index) => {
      positions.set(point.id, index);
    });
    return positions;
  }

  const datedPoints = points
    .map((point) => ({ point, time: readPointTime(point) }))
    .filter((item): item is { point: ITimelinePointConfig; time: number } => item.time !== undefined);
  if (datedPoints.length < 2) {
    points.forEach((point, index) => {
      positions.set(point.id, index);
    });
    return positions;
  }

  const times = datedPoints.map((item) => item.time);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(1, max - min);
  points.forEach((point, index) => {
    const time = readPointTime(point);
    positions.set(
      point.id,
      time === undefined ? index : ((time - min) / span) * Math.max(1, points.length - 1)
    );
  });
  return positions;
}

/**
 * 把条目集合按时间点绑定分组：绑定条目按 `entry_ids` 顺序、跳过缺失与禁用条目；
 * 跨时间点重复绑定先到先得；未绑定条目全部归入「未安排条目」区块，不因配置未完成而丢失。
 *
 * @param entries - 箱子条目渲染视图列表
 * @param config - 归一后的布局配置
 * @returns 时间线分组列表
 */
export function buildTimelineGroups(
  entries: readonly EntryView[],
  config: ITimelineConfig
): ITimelineGroup[] {
  const enabledEntries = entries.filter((entry) => entry.enabled);
  const entryById = new Map(enabledEntries.map((entry) => [entry.entry_id, entry]));
  const assigned = new Set<string>();
  const positions = calculatePointPositions(config.points, config.scale_mode);
  const groups: ITimelineGroup[] = config.points.map((point, index) => {
    const pointEntries: EntryView[] = [];
    for (const entryId of point.entry_ids) {
      if (assigned.has(entryId)) {
        continue;
      }
      const entry = entryById.get(entryId);
      if (entry === undefined) {
        continue;
      }
      assigned.add(entryId);
      pointEntries.push(entry);
    }
    return {
      id: point.id,
      label: point.label,
      ...(point.date === undefined ? {} : { date: point.date }),
      ...(point.note === undefined ? {} : { note: point.note }),
      entries: pointEntries,
      position: positions.get(point.id) ?? index,
    };
  });

  const unscheduledEntries = enabledEntries.filter((entry) => !assigned.has(entry.entry_id));
  if (unscheduledEntries.length > 0) {
    groups.push({
      id: UNSCHEDULED_GROUP_ID,
      label: UNSCHEDULED_LABEL,
      entries: unscheduledEntries,
      position: groups.length,
      isUnscheduled: true,
    });
  }
  return groups;
}

/**
 * 把时间点日期呈现为简体中文本地化文本；不可解析日期原样透传（自由文本口径）。
 *
 * @param date - 日期文本
 * @returns 呈现文本；无日期返回 undefined
 */
export function formatPointDate(date: string | undefined): string | undefined {
  if (date === undefined) {
    return undefined;
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
}

/**
 * 把封面比例提示换算为 CSS `aspect-ratio` 值。
 *
 * @param value - 比例提示（数值、`a:b` 字符串或任意文本）
 * @param fallback - 缺省比例
 * @returns CSS `aspect-ratio` 值
 */
export function toCssAspectRatio(value: unknown, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return `${value}`;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const trimmed = value.trim();
    return trimmed.includes(':') ? trimmed.replace(':', ' / ') : trimmed;
  }
  return fallback;
}

/**
 * 判定容器宽度是否进入紧凑排布；未测量（宽度 0）时保持桌面排布。
 *
 * @param containerWidth - 容器内容宽度（px）
 * @returns 紧凑排布返回 true，否则 false
 */
export function isCompactWidth(containerWidth: number): boolean {
  return containerWidth > 0 && containerWidth <= RESPONSIVE_MAX_WIDTH;
}
