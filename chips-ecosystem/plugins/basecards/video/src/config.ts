/**
 * 视频基础卡片配置模型（《01-卡片文件格式》§6.2、《08-基础卡片插件接口》§7）。
 *
 * 配置位于节点内容 `config` 字段；本模块提供归一（readConfig）、派生展示信息
 * （deriveDisplayTitle / deriveMetaLine）、资源打开请求组装（buildVideoOpenRequest，
 * 《14-资源打开与默认处理器契约》§5.4 权威载荷形状），与
 * `assets/schemas/video-card-config.schema.json` 保持同一口径（08 §7.3：validateConfig
 * 不得比 schema 宽松；倍速域与起始秒数域为 §6.2 数值域的显式补充校验）。
 */

import {
  inferSubtitleMimeType,
  inferVideoMimeType,
  isNonEmptyString,
  normalizeRelativeCardResourcePath,
  resolveFileName,
  stripFileExtension,
} from './shared/utils';

/** 卡片类型正式 ID（与 manifest capabilities.cardTypes[0].id 一致；历史别名 VideoCard 由平台归一）。 */
export const CARD_TYPE_ID = 'base.video';

/** 字幕轨语义类型（《01》§6.2）。 */
export type SubtitleKind = 'subtitles' | 'captions';

/** 外挂字幕轨条目（《01》§6.2：id / file_path 必填）。 */
export interface IVideoSubtitleTrack {
  id: string;
  label: string;
  language: string;
  kind: SubtitleKind;
  file_path: string;
  default: boolean;
}

/** 播放入口参数（《01》§6.2；播放器应用可按能力选择消费）。 */
export interface IVideoPlayback {
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  playback_rate: number;
  start_time: number;
}

/** 视频卡片配置。 */
export interface IVideoConfig {
  video_file: string;
  cover_image: string;
  subtitles: IVideoSubtitleTrack[];
  playback: IVideoPlayback;
  video_title: string;
  publish_time: string;
  creator: string;
}

export const DEFAULT_CONFIG: IVideoConfig = {
  video_file: '',
  cover_image: '',
  subtitles: [],
  playback: {
    autoplay: false,
    loop: false,
    muted: false,
    playback_rate: 1,
    start_time: 0,
  },
  video_title: '',
  publish_time: '',
  creator: '',
};

const PLAYBACK_RATE_MIN = 0.25;
const PLAYBACK_RATE_MAX = 4;

// ---------- 归一 ----------

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asFiniteNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeResourcePath(value: unknown): string {
  return normalizeRelativeCardResourcePath(value) ?? '';
}

function normalizeSubtitleKind(value: unknown): SubtitleKind {
  return value === 'captions' ? 'captions' : 'subtitles';
}

/**
 * 归一字幕轨条目：字段回退空值，`kind` 非法回退 `subtitles`；
 * 条目无显式形状（全空对象或非对象）时剔除；`id` 缺失时按位次补 `subtitle-<n>`，
 * 保证条目标识稳定（编辑器可增量填写，路径补齐前由 validateConfig 阻断发布）。
 */
function normalizeSubtitleTrack(input: unknown, index: number): IVideoSubtitleTrack | null {
  const record = input !== null && typeof input === 'object' ? (input as Record<string, unknown>) : {};

  const hasExplicitShape =
    typeof record['id'] === 'string' ||
    typeof record['label'] === 'string' ||
    typeof record['language'] === 'string' ||
    'kind' in record ||
    typeof record['file_path'] === 'string' ||
    'default' in record;

  if (!hasExplicitShape) {
    return null;
  }

  return {
    id: asString(record['id']) || `subtitle-${index + 1}`,
    label: asString(record['label']),
    language: asString(record['language']),
    kind: normalizeSubtitleKind(record['kind']),
    file_path: normalizeResourcePath(record['file_path']),
    default: asBoolean(record['default']),
  };
}

/** 归一播放入口参数：布尔只认 `true`、倍速钳制 0.25~4、起始秒数非负（旧族语义）。 */
function normalizePlayback(input: unknown): IVideoPlayback {
  const record = input !== null && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const playbackRate = clampNumber(
    asFiniteNumber(record['playback_rate'], 1),
    PLAYBACK_RATE_MIN,
    PLAYBACK_RATE_MAX,
  );
  const startTime = Math.max(0, asFiniteNumber(record['start_time'], 0));

  return {
    autoplay: asBoolean(record['autoplay']),
    loop: asBoolean(record['loop']),
    muted: asBoolean(record['muted']),
    playback_rate: Number(playbackRate.toFixed(2)),
    start_time: Number(startTime.toFixed(3)),
  };
}

/**
 * 归一任意输入为完整配置：缺失或非法字段回退默认值（08 §7.1 规则 2）。
 *
 * 默认字幕最多保留一轨：取首个 `default` 为真的条目（《01》§6.2 同一卡片最多一个默认轨）。
 */
export function readConfig(input: unknown): IVideoConfig {
  const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const subtitles = Array.isArray(record['subtitles'])
    ? record['subtitles']
        .map((item, index) => normalizeSubtitleTrack(item, index))
        .filter((item): item is IVideoSubtitleTrack => item !== null)
    : [];
  const defaultSubtitleId = subtitles.find((track) => track.default)?.id;

  return {
    video_file: normalizeResourcePath(record['video_file']),
    cover_image: normalizeResourcePath(record['cover_image']),
    subtitles: subtitles.map((track) => ({
      ...track,
      default: Boolean(defaultSubtitleId && track.id === defaultSubtitleId),
    })),
    playback: normalizePlayback(record['playback']),
    video_title: asString(record['video_title']),
    publish_time: asString(record['publish_time']),
    creator: asString(record['creator']),
  };
}

// ---------- 校验（与 schema 同口径：出现即校验，缺席不阻断） ----------

function isValidResourcePathField(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'string') {
    return false;
  }
  if (value.trim().length === 0) {
    return true;
  }
  return normalizeRelativeCardResourcePath(value) !== undefined;
}

function isValidSubtitleTrack(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;

  if (!isNonEmptyString(record['id'])) {
    return false;
  }
  if (!isNonEmptyString(record['file_path']) || normalizeRelativeCardResourcePath(record['file_path']) === undefined) {
    return false;
  }
  for (const key of ['label', 'language'] as const) {
    if (record[key] !== undefined && typeof record[key] !== 'string') {
      return false;
    }
  }
  if (record['kind'] !== undefined && record['kind'] !== 'subtitles' && record['kind'] !== 'captions') {
    return false;
  }
  if (record['default'] !== undefined && typeof record['default'] !== 'boolean') {
    return false;
  }
  return true;
}

function isValidPlayback(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;

  for (const key of ['autoplay', 'loop', 'muted'] as const) {
    if (record[key] !== undefined && typeof record[key] !== 'boolean') {
      return false;
    }
  }
  if (record['playback_rate'] !== undefined) {
    const rate = record['playback_rate'];
    if (typeof rate !== 'number' || !Number.isFinite(rate)) {
      return false;
    }
    if (rate < PLAYBACK_RATE_MIN || rate > PLAYBACK_RATE_MAX) {
      return false;
    }
  }
  if (record['start_time'] !== undefined) {
    const startTime = record['start_time'];
    if (typeof startTime !== 'number' || !Number.isFinite(startTime) || startTime < 0) {
      return false;
    }
  }
  return true;
}

/**
 * 校验节点内容中的 config（08 §2.4.3）：纯函数；`undefined` / `null` 视为未提供配置，
 * 必须返回 `true`。非空资源路径字段必须是合法包内相对路径；字幕条目按《01》§6.2 要求
 * `id` 与 `file_path` 必填；倍速域 [0.25, 4] 与起始秒数非负为 §6.2 数值域的显式补充校验。
 */
export function validateConfig(config: unknown): boolean {
  if (config === undefined || config === null) {
    return true;
  }
  if (typeof config !== 'object' || Array.isArray(config)) {
    return false;
  }
  const record = config as Record<string, unknown>;

  for (const key of ['video_file', 'cover_image'] as const) {
    if (!isValidResourcePathField(record[key])) {
      return false;
    }
  }
  for (const key of ['video_title', 'publish_time', 'creator'] as const) {
    if (record[key] !== undefined && typeof record[key] !== 'string') {
      return false;
    }
  }
  if (record['subtitles'] !== undefined) {
    if (!Array.isArray(record['subtitles'])) {
      return false;
    }
    if (!record['subtitles'].every((item) => isValidSubtitleTrack(item))) {
      return false;
    }
  }
  if (!isValidPlayback(record['playback'])) {
    return false;
  }
  return true;
}

// ---------- 内容组装 ----------

/**
 * 由配置组装节点内容（与 `createInitialContent` / 编辑器 replace 变更共用）。
 */
export function buildContent(config: IVideoConfig): Record<string, unknown> {
  return {
    card_type: CARD_TYPE_ID,
    config: { ...config },
  };
}

// ---------- 展示派生 ----------

/** 展示标题：视频标题优先，其次视频文件名去扩展名（旧族语义）。 */
export function deriveDisplayTitle(config: IVideoConfig): string {
  if (isNonEmptyString(config.video_title)) {
    return config.video_title.trim();
  }

  const videoFileName = resolveFileName(config.video_file);
  if (videoFileName) {
    return stripFileExtension(videoFileName);
  }

  return '';
}

/** 元信息行：创作者与发布时间以间隔号连接，缺席段剔除（旧族语义）。 */
export function deriveMetaLine(config: IVideoConfig): string {
  return [config.creator.trim(), config.publish_time.trim()]
    .filter((value) => value.length > 0)
    .join(' · ');
}

// ---------- 资源打开请求（《14》§5.4） ----------

/** 视频卡片打开载荷的资源条目。 */
export interface IVideoOpenPayloadResource {
  /** 资源受管引用；取内容中的引用原样透传，插件不构造作用域（06-资源协议规范 §2.3）。 */
  readonly uri: string;
  /** 发起方视角卡片包内相对路径（14 §5.4）。 */
  readonly relativePath: string;
  readonly fileName?: string;
  readonly mimeType?: string;
}

/** 载荷内的字幕轨引用（14 §5.4 `VideoSubtitleRef`）。 */
export interface IVideoOpenSubtitleRef extends IVideoOpenPayloadResource {
  readonly id: string;
  readonly label?: string;
  readonly language?: string;
  readonly kind: SubtitleKind;
  readonly default: boolean;
}

/** 视频卡片打开载荷（《14-资源打开与默认处理器契约》§5.4 权威形状）。 */
export interface IVideoOpenPayload {
  readonly kind: 'chips.video-card';
  readonly version: '1.0.0';
  readonly cardType: 'base.video';
  readonly resources: {
    readonly video: IVideoOpenPayloadResource;
    readonly cover?: IVideoOpenPayloadResource;
    readonly subtitles?: readonly IVideoOpenSubtitleRef[];
  };
  readonly display: {
    readonly title: string;
    readonly creator?: string;
    readonly publishTime?: string;
  };
  readonly playback: {
    readonly autoplay: boolean;
    readonly loop: boolean;
    readonly muted: boolean;
    readonly playbackRate: number;
    readonly startTime: number;
  };
}

/** `resource:open` 能力输入（《14》§2.2）。 */
export interface IVideoOpenRequest {
  readonly intent: 'view';
  readonly resource: {
    readonly uri: string;
    readonly mimeType?: string;
    readonly fileName?: string;
    readonly title: string;
    readonly payload: IVideoOpenPayload;
  };
}

function buildPayloadResource(resourcePath: string): IVideoOpenPayloadResource | null {
  const normalizedPath = normalizeRelativeCardResourcePath(resourcePath);
  if (!normalizedPath) {
    return null;
  }

  const fileName = resolveFileName(normalizedPath);
  const mimeType = inferVideoMimeType(normalizedPath);
  return {
    uri: normalizedPath,
    relativePath: normalizedPath,
    ...(fileName ? { fileName } : {}),
    ...(mimeType === undefined ? {} : { mimeType }),
  };
}

function buildSubtitleRef(track: IVideoSubtitleTrack): IVideoOpenSubtitleRef | null {
  const resource = buildPayloadResource(track.file_path);
  if (!resource) {
    return null;
  }

  const mimeType = inferSubtitleMimeType(track.file_path);
  return {
    ...resource,
    ...(mimeType === undefined ? {} : { mimeType }),
    id: track.id,
    ...(track.label ? { label: track.label } : {}),
    ...(track.language ? { language: track.language } : {}),
    kind: track.kind,
    default: track.default,
  };
}

/**
 * 组装视频卡片打开请求：主资源为视频，封面与字幕轨随载荷投递；视频引用为空时返回 `null`。
 *
 * `uri` 一律取内容中的引用原样透传（解析器在进入渲染前已把包内相对引用归一为受管
 * 作用域 URI，渲染层只消费归一结果，不重复归一、不构造作用域——06 §2.6、§2.3）。
 */
export function buildVideoOpenRequest(config: IVideoConfig): IVideoOpenRequest | null {
  const video = buildPayloadResource(config.video_file);
  if (!video) {
    return null;
  }

  const cover = buildPayloadResource(config.cover_image);
  const subtitles = config.subtitles
    .map((track) => buildSubtitleRef(track))
    .filter((track): track is IVideoOpenSubtitleRef => track !== null);
  const title = deriveDisplayTitle(config);
  const creator = config.creator.trim();
  const publishTime = config.publish_time.trim();

  const payload: IVideoOpenPayload = {
    kind: 'chips.video-card',
    version: '1.0.0',
    cardType: CARD_TYPE_ID,
    resources: {
      video,
      ...(cover === null ? {} : { cover }),
      ...(subtitles.length === 0 ? {} : { subtitles }),
    },
    display: {
      title,
      ...(creator ? { creator } : {}),
      ...(publishTime ? { publishTime } : {}),
    },
    playback: {
      autoplay: config.playback.autoplay,
      loop: config.playback.loop,
      muted: config.playback.muted,
      playbackRate: config.playback.playback_rate,
      startTime: config.playback.start_time,
    },
  };

  return {
    intent: 'view',
    resource: {
      uri: video.uri,
      ...(video.mimeType === undefined ? {} : { mimeType: video.mimeType }),
      ...(video.fileName === undefined ? {} : { fileName: video.fileName }),
      title,
      payload,
    },
  };
}
