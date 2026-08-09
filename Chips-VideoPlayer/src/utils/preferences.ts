export interface VideoPlayerPreferences {
  volume: number;
  muted: boolean;
  playbackRate: number;
  subtitleIndex: number | null;
  loop: boolean;
}

export const DEFAULT_PREFERENCES: VideoPlayerPreferences = {
  volume: 0.85,
  muted: false,
  playbackRate: 1,
  subtitleIndex: null,
  loop: false,
};

const PREFERENCES_STORAGE_KEY = "chips.video-player.preferences.v1";

export function readVideoPlayerPreferences(): VideoPlayerPreferences {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return { ...DEFAULT_PREFERENCES };
  }

  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_PREFERENCES };
    }

    const parsed = JSON.parse(raw) as Partial<VideoPlayerPreferences>;
    return {
      volume:
        typeof parsed.volume === "number" && Number.isFinite(parsed.volume)
          ? Math.min(1, Math.max(0, parsed.volume))
          : DEFAULT_PREFERENCES.volume,
      muted: parsed.muted === true,
      playbackRate:
        typeof parsed.playbackRate === "number" && Number.isFinite(parsed.playbackRate)
          ? parsed.playbackRate
          : DEFAULT_PREFERENCES.playbackRate,
      subtitleIndex:
        typeof parsed.subtitleIndex === "number" ? parsed.subtitleIndex : DEFAULT_PREFERENCES.subtitleIndex,
      loop: parsed.loop === true,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function writeVideoPlayerPreferences(patch: Partial<VideoPlayerPreferences>): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }

  try {
    const current = readVideoPlayerPreferences();
    const next = { ...current, ...patch };
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 存储不可用时静默降级
  }
}
