import type { VideoCardOpenPayload } from "chips-sdk";

export interface LaunchVideoTarget {
  sourceId: string;
  filePath?: string;
  fileName?: string;
  mimeType?: string;
  title?: string;
  videoCard?: VideoCardOpenPayload;
}

export interface VideoPlaybackOpenHints {
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  playbackRate: number;
  startTime: number;
}

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

export interface ViewerFeedback {
  tone: "info" | "success" | "error";
  message: string;
}

export interface VideoDimensions {
  width: number;
  height: number;
}

export interface VideoTrackOption {
  index: number;
  label: string;
  language: string;
  kind: string;
  selected: boolean;
}

export interface VideoChromeVisibilityState {
  hasVideo: boolean;
  isPlaying: boolean;
  isMorePanelOpen: boolean;
  isDragActive: boolean;
  hasOverlay: boolean;
}

export const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogv"];
export const SUPPORTED_VIDEO_EXTENSION_LABEL = SUPPORTED_VIDEO_EXTENSIONS.join(" ");
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

const DEFAULT_PLAYBACK_OPEN_HINTS: VideoPlaybackOpenHints = {
  autoplay: false,
  loop: false,
  muted: false,
  playbackRate: 1,
  startTime: 0,
};

const MIME_BY_EXTENSION: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".ogv": "video/ogg",
};

export function resolveExtension(value: string): string {
  const normalized = value.trim().toLowerCase();
  const slashIndex = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex <= slashIndex) {
    return "";
  }
  return normalized.slice(dotIndex);
}

export function resolveFileName(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.trim();
    if (pathname) {
      const segments = pathname.split("/").filter(Boolean);
      return segments[segments.length - 1] ?? pathname;
    }
  } catch {
    // ignore and continue with plain path parsing
  }

  const segments = normalized.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? normalized;
}

export function resolveVideoTitle(target: LaunchVideoTarget): string {
  return target.title?.trim() || target.fileName?.trim() || resolveFileName(target.filePath ?? target.sourceId) || target.sourceId;
}

export function normalizeVideoPlaybackOpenHints(input?: VideoCardOpenPayload["playback"]): VideoPlaybackOpenHints {
  if (!input) {
    return { ...DEFAULT_PLAYBACK_OPEN_HINTS };
  }

  const playbackRate = PLAYBACK_RATES.includes(input.playbackRate) ? input.playbackRate : DEFAULT_PLAYBACK_OPEN_HINTS.playbackRate;
  const startTime = Number.isFinite(input.startTime) ? Math.max(0, input.startTime) : DEFAULT_PLAYBACK_OPEN_HINTS.startTime;

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
    return "";
  }

  const subtype = normalizedMimeType.split("/")[1] ?? normalizedMimeType;
  return subtype.replace(/^x-/, "").toUpperCase();
}

export function isSupportedVideoResource(target: LaunchVideoTarget): boolean {
  const mimeType = target.mimeType?.trim().toLowerCase();
  if (mimeType?.startsWith("video/")) {
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
    return ["file:", "http:", "https:", "blob:", "data:"].includes(parsed.protocol);
  } catch {
    return false;
  }
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
    return "00:00";
  }

  const safeSeconds = Math.floor(totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatPlaybackRate(rate: number): string {
  const normalized = Number.isFinite(rate) ? rate : 1;
  return `${normalized.toFixed(normalized % 1 === 0 ? 0 : 2).replace(/0+$/, "").replace(/\.$/, "")}x`;
}

export function formatResolution(dimensions: VideoDimensions | null): string {
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    return "";
  }
  return `${dimensions.width} × ${dimensions.height}`;
}

export function resolveMediaErrorKey(error: MediaError | null): string {
  if (!error) {
    return "mediaSource";
  }

  switch (error.code) {
    case 1:
      return "mediaAborted";
    case 2:
      return "mediaNetwork";
    case 3:
      return "mediaDecode";
    case 4:
      return "mediaSource";
    default:
      return "loadFailed";
  }
}

export function shouldAutoHideChrome(state: VideoChromeVisibilityState): boolean {
  return state.hasVideo && state.isPlaying && !state.isMorePanelOpen && !state.isDragActive && !state.hasOverlay;
}
