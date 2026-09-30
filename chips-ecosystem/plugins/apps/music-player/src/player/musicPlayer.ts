/**
 * 音乐播放域：播放目标类型、格式支持表与纯函数集（迁移件）。
 *
 * 迁移来源：旧仓 `Chips-MusicPlayer/src/utils/music-player.ts`（覆盖矩阵「音乐富文本社区
 * 客户端」§二「格式表与纯函数域」行，判迁移：纯表 + 纯函数，测试随迁）。
 *
 * 适配说明（唯一旧 SDK 触达点的收口）：
 * - 旧实现 `import type { MusicCardOpenPayload } from "chips-sdk"`；`@chips/sdk` 不导出卡片
 *   content 载荷类型，音乐卡片载荷经 `IResourceOpenContext.payload`（《14-资源打开与默认
 *   处理器契约》§5.4 标准业务载荷，平台原样透传）投递，故本模块按《01-卡片文件格式》§6.8
 *   音乐卡片与 14-契约 §5.4 载荷形状在本地声明 `IMusicCardOpenPayload`（vp `IVideoCardPlayback`
 *   同口径）；
 * - 旧文件内的 `resolveMediaErrorKey(MediaError)` 与 `audio-engine.ts` 的同名函数重复，收敛为
 *   引擎单份实现（判迁移 ≠ 复刻缺陷），本模块不再导出媒体错误键归一；
 * - 旧 `TrackPresentation`/`ArtworkSourceKind` 由会话装配层 `trackSession.ts` 以新形状收口
 *   （封面承载伴生地址/嵌入字节/默认三类来源，URI 未解析前不以 `artworkUri` 表达），不在本模块重复声明。
 */

/** 资源打开载荷内的受管引用（14-契约 §5.4 `IResourceOpenRef`）。 */
export interface IResourceOpenRef {
  /** 受管引用。 */
  readonly uri: string;
  /** 发起方视角的卡片包内相对路径；仅用于日志与展示。 */
  readonly relativePath: string;
  readonly fileName?: string;
  readonly mimeType?: string;
}

/** 音乐卡片打开载荷（14-契约 §5.4，`kind: 'chips.music-card'`）。 */
export interface IMusicCardOpenPayload {
  readonly kind: string;
  readonly version: string;
  /** 发起打开的基础卡片类型正式标识（`base.music`）。 */
  readonly cardType: string;
  readonly resources: {
    /** 主音频资源；与顶层 resourceOpen.uri 指向同一资源。 */
    readonly audio: IResourceOpenRef;
    readonly cover?: IResourceOpenRef;
    readonly lyrics?: IResourceOpenRef;
  };
  readonly display: {
    readonly title: string;
    readonly artist?: string;
  };
}

/** 一次播放会话的来源描述（迁移件 `LaunchAudioTarget`）。 */
export interface LaunchAudioTarget {
  sourceId: string;
  filePath?: string;
  fileName?: string;
  mimeType?: string;
  title?: string;
  musicCard?: IMusicCardOpenPayload;
}

/** 播放会话来源（迁移件 `AudioSource`）。 */
export interface AudioSource {
  sourceId: string;
  filePath?: string;
  fileName: string;
  title: string;
  resourceUri: string;
  mimeType?: string;
  extension?: string;
  revision: number;
  isRemote: boolean;
}

/** 文件选择归类（迁移件 `FileSelectionBundle`）。 */
export interface FileSelectionBundle {
  audioPath?: string;
  audioPaths?: string[];
  lyricsPath?: string;
  coverPath?: string;
}

/** 界面反馈（迁移件 `ViewerFeedback`）。 */
export interface ViewerFeedback {
  tone: 'info' | 'success' | 'error';
  message: string;
}

/** 支持的音频扩展名表（迁移件，生态级 MIME 单一事实源收口前按本表承载，矩阵 G-4 在册）。 */
export const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.flac', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.opus', '.webm'];
export const SUPPORTED_AUDIO_EXTENSION_LABEL = SUPPORTED_AUDIO_EXTENSIONS.join(' ');
export const SUPPORTED_ARTWORK_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];
export const SUPPORTED_LYRIC_EXTENSIONS = ['.lrc', '.txt'];

const MIME_BY_EXTENSION: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/ogg',
  '.webm': 'audio/webm',
};

export function resolveExtension(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.trim().toLowerCase();
    const dotIndex = pathname.lastIndexOf('.');
    return dotIndex >= 0 ? pathname.slice(dotIndex) : '';
  } catch {
    const lowered = normalized.toLowerCase();
    const slashIndex = Math.max(lowered.lastIndexOf('/'), lowered.lastIndexOf('\\'));
    const dotIndex = lowered.lastIndexOf('.');
    if (dotIndex <= slashIndex) {
      return '';
    }
    return lowered.slice(dotIndex);
  }
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
    // 非 URL 形式继续按普通路径解析
  }

  const segments = normalized.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? normalized;
}

export function resolveTrackTitle(target: LaunchAudioTarget): string {
  return (
    target.title?.trim() ||
    target.fileName?.trim() ||
    resolveFileName(target.filePath ?? target.sourceId) ||
    target.sourceId
  );
}

export function resolveStem(value: string): string {
  const fileName = resolveFileName(value);
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return fileName;
  }
  return fileName.slice(0, dotIndex);
}

export function resolveDirectoryPath(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  const separatorIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  if (separatorIndex <= 0) {
    return '';
  }

  return normalized.slice(0, separatorIndex);
}

export function joinPath(dir: string, fileName: string): string {
  if (!dir) {
    return fileName;
  }

  const separator = dir.includes('\\') ? '\\' : '/';
  return `${dir.replace(/[\\/]+$/, '')}${separator}${fileName}`;
}

export function inferAudioMimeType(value: string): string | undefined {
  const extension = resolveExtension(value);
  return MIME_BY_EXTENSION[extension];
}

export function resolveAudioFormatLabel(value: string, mimeType?: string): string {
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

export function isSupportedAudioResource(target: LaunchAudioTarget): boolean {
  const mimeType = target.mimeType?.trim().toLowerCase();
  if (mimeType?.startsWith('audio/')) {
    return true;
  }

  const extension = resolveExtension(target.filePath ?? target.sourceId);
  return SUPPORTED_AUDIO_EXTENSIONS.includes(extension);
}

export function isAudioFilePath(value: string): boolean {
  return SUPPORTED_AUDIO_EXTENSIONS.includes(resolveExtension(value));
}

export function isImageFilePath(value: string): boolean {
  return SUPPORTED_ARTWORK_EXTENSIONS.includes(resolveExtension(value));
}

export function isLyricsFilePath(value: string): boolean {
  return SUPPORTED_LYRIC_EXTENSIONS.includes(resolveExtension(value));
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

export function isLikelyLocalPath(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'file:';
  } catch {
    return true;
  }
}

export function resolveFileSelection(paths: string[]): FileSelectionBundle {
  const selection: FileSelectionBundle = {
    audioPaths: [],
  };

  for (const path of paths) {
    if (isAudioFilePath(path)) {
      selection.audioPaths?.push(path);
      selection.audioPath ??= path;
      continue;
    }

    if (!selection.coverPath && isImageFilePath(path)) {
      selection.coverPath = path;
      continue;
    }

    if (!selection.lyricsPath && isLyricsFilePath(path)) {
      selection.lyricsPath = path;
    }
  }

  if (selection.audioPaths?.length === 0) {
    delete selection.audioPaths;
  }

  return selection;
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

export function formatRemainingDuration(totalSeconds: number, currentTime: number): string {
  const remaining = Math.max(0, totalSeconds - currentTime);
  return `-${formatDuration(remaining)}`;
}
