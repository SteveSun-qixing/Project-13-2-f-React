/**
 * 视频播放域：播放参数表、格式支持表与纯函数集（迁移件）。
 *
 * 迁移来源：旧仓 `Chips-VideoPlayer/src/utils/video-player.ts`（覆盖矩阵「四媒体查看器仓」§五
 * 「播放参数与格式表」行，判迁移：纯函数 + 数据表，测试随迁）。
 *
 * 适配说明（唯一旧 SDK 触达点的收口）：
 * - 旧实现 `import type { VideoCardOpenPayload } from "chips-sdk"`；`@chips/sdk` 不导出卡片
 *   content 载荷类型，播放载荷经 `IResourceOpenContext.payload`（业务上下文，平台原样透传）
 *   投递，故本模块按《01-卡片文件格式》§6.2 视频卡片 `playback` 段在本地声明
 *   `IVideoCardPlayback`（snake_case 字段），`normalizeVideoPlaybackOpenHints` 归一为运行时
 *   的 `VideoPlaybackOpenHints`；
 * - 播放核心基于宿主媒体能力（`<video>`），不引入第三方播放运行时（《10-官方内容处理与
 *   阅读服务设计》§3.3）。
 */

/** 视频卡片 playback 段（《01-卡片文件格式》§6.2 播放入口参数，snake_case 原样）。 */
export interface IVideoCardPlayback {
  readonly autoplay?: boolean;
  readonly loop?: boolean;
  readonly muted?: boolean;
  /** 允许域 0.25~4；播放器按本应用支持的倍速表白名单归一。 */
  readonly playback_rate?: number;
  /** 起播位置（秒，≥0）。 */
  readonly start_time?: number;
}

/** 打开目标：一次播放会话的来源描述（迁移件 `LaunchVideoTarget`）。 */
export interface LaunchVideoTarget {
  sourceId: string;
  filePath?: string;
  fileName?: string;
  mimeType?: string;
  title?: string;
  videoCard?: IVideoCardPlayback;
}

/** 播放入口参数（归一后的运行时形状）。 */
export interface VideoPlaybackOpenHints {
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  playbackRate: number;
  startTime: number;
}

/** 播放会话来源（迁移件 `VideoSource`）。 */
export interface VideoSource {
  sourceId: string;
  filePath?: string;
  fileName: string;
  title: string;
  resourceUri: string;
  mimeType?: string;
  extension?: string;
  revision: number;
  isRemote: boolean;
  playbackHints?: VideoPlaybackOpenHints;
}

/** 播放器界面反馈。 */
export interface ViewerFeedback {
  tone: 'info' | 'success' | 'error';
  message: string;
}

/** 视频尺寸。 */
export interface VideoDimensions {
  width: number;
  height: number;
}

/** 轨道选项（字幕/音轨共用）。 */
export interface VideoTrackOption {
  index: number;
  label: string;
  language: string;
  kind: string;
  selected: boolean;
}

/** 控制层自动隐藏判定输入。 */
export interface VideoChromeVisibilityState {
  hasVideo: boolean;
  isPlaying: boolean;
  isMorePanelOpen: boolean;
  isDragActive: boolean;
  hasOverlay: boolean;
}

export const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogv'];
export const SUPPORTED_VIDEO_EXTENSION_LABEL = SUPPORTED_VIDEO_EXTENSIONS.join(' ');
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

const DEFAULT_PLAYBACK_OPEN_HINTS: VideoPlaybackOpenHints = {
  autoplay: false,
  loop: false,
  muted: false,
  playbackRate: 1,
  startTime: 0,
};

/** 扩展名 → MIME 支持表（播放器自持面；生态级 MIME 总表见万能查看器 detect.ts，G-4 在册）。 */
const MIME_BY_EXTENSION: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.ogv': 'video/ogg',
};

export function resolveExtension(value: string): string {
  const normalized = value.trim().toLowerCase();
  const slashIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  const dotIndex = normalized.lastIndexOf('.');
  if (dotIndex <= slashIndex) {
    return '';
  }
  return normalized.slice(dotIndex);
}

export function resolveFileName(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.trim();
    if (pathname) {
      const segments = pathname.split('/').filter(Boolean);
      return segments[segments.length - 1] ?? pathname;
    }
  } catch {
    // 纯路径解析继续
  }

  const segments = normalized.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? normalized;
}

export function resolveVideoTitle(target: LaunchVideoTarget): string {
  return (
    target.title?.trim() ||
    target.fileName?.trim() ||
    resolveFileName(target.filePath ?? target.sourceId) ||
    target.sourceId
  );
}

export function normalizeVideoPlaybackOpenHints(input?: IVideoCardPlayback): VideoPlaybackOpenHints {
  if (!input) {
    return { ...DEFAULT_PLAYBACK_OPEN_HINTS };
  }

  const playbackRate = PLAYBACK_RATES.includes(input.playback_rate ?? -1)
    ? (input.playback_rate as number)
    : DEFAULT_PLAYBACK_OPEN_HINTS.playbackRate;
  const startTime = Number.isFinite(input.start_time) ? Math.max(0, input.start_time as number) : DEFAULT_PLAYBACK_OPEN_HINTS.startTime;

  return {
    autoplay: input.autoplay === true,
    loop: input.loop === true,
    muted: input.muted === true,
    playbackRate,
    startTime,
  };
}

export function inferVideoMimeType(value: string): string | undefined {
  const extension = resolveExtension(value);
  return MIME_BY_EXTENSION[extension];
}

export function resolveVideoFormatLabel(value: string, mimeType?: string): string {
  const extension = resolveExtension(value);
  if (extension) {
    return extension.slice(1).toUpperCase();
  }

  const normalizedMimeType = mimeType?.trim().toLowerCase();
  if (!normalizedMimeType) {
    return '';
  }

  const subtype = normalizedMimeType.split('/')[1] ?? normalizedMimeType;
  return subtype.replace(/^x-/, '').toUpperCase();
}

export function isSupportedVideoResource(target: LaunchVideoTarget): boolean {
  const mimeType = target.mimeType?.trim().toLowerCase();
  if (mimeType?.startsWith('video/')) {
    return true;
  }

  const extension = resolveExtension(target.filePath ?? target.sourceId);
  return SUPPORTED_VIDEO_EXTENSIONS.includes(extension);
}

export function isDirectPlayableUri(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return ['file:', 'http:', 'https:', 'blob:', 'data:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/** URI 段解码：`URL.pathname` 对非 ASCII 段做百分号编码，展示名按原文字还原；非法编码原样保留。 */
function decodeUriFileName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * 由可直接播放的 URI 构建播放会话来源。
 *
 * 本臂的会话装配面：`resource:open` video 槽位端到端随宿主资源打开路由落波后，
 * 启动投递将复用同一 `VideoSource` 形状（来源 ID = URI）。不可直播的 URI 返回 null，
 * 由界面层以简体中文如实提示，不假接线宿主能力。
 */
export function createVideoSourceFromUri(uri: string): VideoSource | null {
  const normalized = uri.trim();
  if (!isDirectPlayableUri(normalized)) {
    return null;
  }

  const fileName = decodeUriFileName(resolveFileName(normalized));
  const extension = resolveExtension(fileName);
  const mimeType = inferVideoMimeType(fileName);
  return {
    sourceId: normalized,
    fileName,
    title: resolveVideoTitle({ sourceId: normalized, fileName }),
    resourceUri: normalized,
    ...(mimeType !== undefined ? { mimeType } : {}),
    ...(extension !== '' ? { extension } : {}),
    revision: 1,
    isRemote: normalized.startsWith('http://') || normalized.startsWith('https://'),
  };
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.85;
  }
  return Math.min(1, Math.max(0, value));
}

export function clampPlaybackTime(value: number, duration: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, value);
  }

  return Math.min(duration, Math.max(0, value));
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '00:00';
  }

  const safeSeconds = Math.floor(totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatPlaybackRate(rate: number): string {
  const normalized = Number.isFinite(rate) ? rate : 1;
  return `${normalized.toFixed(normalized % 1 === 0 ? 0 : 2).replace(/0+$/, '').replace(/\.$/, '')}x`;
}

export function formatResolution(dimensions: VideoDimensions | null): string {
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    return '';
  }
  return `${dimensions.width} × ${dimensions.height}`;
}

/**
 * 媒体错误归一键：`MediaError.code` → 稳定错误键；文案映射见 `src/messages.ts`，
 * 业务域码按《10-官方内容处理与阅读服务设计》§3.4（`VIDEO_PLAYER_*`）归属。
 */
export function resolveMediaErrorKey(error: MediaError | null): string {
  if (!error) {
    return 'mediaSource';
  }

  switch (error.code) {
    case 1:
      return 'mediaAborted';
    case 2:
      return 'mediaNetwork';
    case 3:
      return 'mediaDecode';
    case 4:
      return 'mediaSource';
    default:
      return 'loadFailed';
  }
}

export function shouldAutoHideChrome(state: VideoChromeVisibilityState): boolean {
  return state.hasVideo && state.isPlaying && !state.isMorePanelOpen && !state.isDragActive && !state.hasOverlay;
}
