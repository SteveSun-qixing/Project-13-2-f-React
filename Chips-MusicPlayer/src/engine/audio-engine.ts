import { clampPlaybackTime, clampVolume } from "../utils/music-player";

export const DEFAULT_ENGINE_VOLUME = 0.82;

export interface TimeRangesLike {
  readonly length: number;
  end(index: number): number;
}

export interface MediaErrorLike {
  readonly code: number;
}

export interface AudioElementLike {
  readonly paused: boolean;
  currentTime: number;
  readonly duration: number;
  volume: number;
  muted: boolean;
  loop: boolean;
  readonly buffered: TimeRangesLike | null;
  readonly error: MediaErrorLike | null;
  play(): Promise<void>;
  pause(): void;
}

export type LoopMode = "off" | "one";

export interface MusicPlayerEngineSnapshot {
  isReady: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  volume: number;
  duration: number;
  currentTime: number;
  bufferedUntil: number;
  loopMode: LoopMode;
  errorKey: string | null;
}

export interface MusicPlayerEngineOptions {
  defaultVolume?: number;
  defaultLoopMode?: LoopMode;
  onStateChange?: (snapshot: MusicPlayerEngineSnapshot) => void;
  onEnded?: () => void | Promise<void>;
}

export interface MusicPlayerEngine {
  getSnapshot(): MusicPlayerEngineSnapshot;
  attach(audio: AudioElementLike | null): void;
  togglePlayback(): Promise<void>;
  seekBy(offsetSeconds: number): void;
  seekTo(nextTime: number): void;
  setVolumeLevel(nextVolume: number): void;
  toggleMute(): void;
  toggleLoopMode(): void;
  resetSession(): void;
  handleLoadedMetadata(): void;
  handleCanPlay(): void;
  handlePlaying(): void;
  handlePause(): void;
  handleWaiting(): void;
  handleEnded(): void;
  handleTimeUpdate(): void;
  handleProgress(): void;
  handleVolumeChange(): void;
  handleError(): void;
}

export function fromHTMLMediaElement(audio: HTMLMediaElement): AudioElementLike {
  return audio;
}

export function resolveMediaErrorKey(error: MediaErrorLike | null): string {
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

export function createMusicPlayerEngine(options: MusicPlayerEngineOptions = {}): MusicPlayerEngine {
  const defaultVolume = options.defaultVolume ?? DEFAULT_ENGINE_VOLUME;
  const defaultLoopMode = options.defaultLoopMode ?? "one";
  let audio: AudioElementLike | null = null;
  let previousVolume = defaultVolume;

  const state: MusicPlayerEngineSnapshot = {
    isReady: false,
    isPlaying: false,
    isBuffering: false,
    isMuted: false,
    volume: defaultVolume,
    duration: 0,
    currentTime: 0,
    bufferedUntil: 0,
    loopMode: defaultLoopMode,
    errorKey: null,
  };

  function emit(): void {
    options.onStateChange?.({ ...state });
  }

  function attach(nextAudio: AudioElementLike | null): void {
    audio = nextAudio;
    if (!audio) {
      return;
    }

    audio.loop = state.loopMode === "one";
    audio.volume = state.volume;
    audio.muted = state.isMuted;
  }

  function syncProgress(): void {
    if (!audio) {
      return;
    }

    state.currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    state.duration = Number.isFinite(audio.duration) ? audio.duration : 0;

    if (audio.buffered && audio.buffered.length > 0) {
      state.bufferedUntil = audio.buffered.end(audio.buffered.length - 1);
      return;
    }

    state.bufferedUntil = 0;
  }

  async function togglePlayback(): Promise<void> {
    if (!audio) {
      return;
    }

    if (audio.paused) {
      state.errorKey = null;
      emit();
      try {
        await audio.play();
      } catch {
        state.errorKey = resolveMediaErrorKey(audio.error);
        emit();
      }
      return;
    }

    audio.pause();
  }

  function seekTo(nextTime: number): void {
    if (!audio) {
      return;
    }

    const targetTime = clampPlaybackTime(nextTime, audio.duration);
    audio.currentTime = targetTime;
    syncProgress();
    emit();
  }

  function seekBy(offsetSeconds: number): void {
    if (!audio) {
      return;
    }

    seekTo(audio.currentTime + offsetSeconds);
  }

  function setVolumeLevel(nextVolume: number): void {
    if (!audio) {
      return;
    }

    const normalized = clampVolume(nextVolume);
    audio.volume = normalized;
    audio.muted = normalized === 0;
    state.volume = normalized;
    state.isMuted = audio.muted;
    if (normalized > 0) {
      previousVolume = normalized;
    }
    emit();
  }

  function toggleMute(): void {
    if (!audio) {
      return;
    }

    if (audio.muted || audio.volume === 0) {
      const restoredVolume = previousVolume > 0 ? previousVolume : defaultVolume;
      audio.muted = false;
      audio.volume = restoredVolume;
      state.volume = restoredVolume;
      state.isMuted = false;
      emit();
      return;
    }

    previousVolume = audio.volume > 0 ? audio.volume : previousVolume;
    audio.muted = true;
    state.isMuted = true;
    emit();
  }

  function toggleLoopMode(): void {
    const nextMode = state.loopMode === "one" ? "off" : "one";
    state.loopMode = nextMode;
    if (audio) {
      audio.loop = nextMode === "one";
    }
    emit();
  }

  function resetSession(): void {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.loop = state.loopMode === "one";
      audio.volume = state.volume;
      audio.muted = state.isMuted;
    }

    state.isReady = false;
    state.isPlaying = false;
    state.isBuffering = false;
    state.duration = 0;
    state.currentTime = 0;
    state.bufferedUntil = 0;
    state.errorKey = null;
    emit();
  }

  function handleLoadedMetadata(): void {
    if (!audio) {
      return;
    }

    audio.loop = state.loopMode === "one";
    audio.volume = state.volume;
    audio.muted = state.isMuted;
    syncProgress();
    emit();
  }

  function handleCanPlay(): void {
    state.isReady = true;
    state.isBuffering = false;
    emit();
  }

  function handlePlaying(): void {
    state.isReady = true;
    state.isPlaying = true;
    state.isBuffering = false;
    state.errorKey = null;
    emit();
  }

  function handlePause(): void {
    state.isPlaying = false;
    state.isBuffering = false;
    emit();
  }

  function handleWaiting(): void {
    state.isBuffering = true;
    emit();
  }

  function handleEnded(): void {
    state.isPlaying = state.loopMode === "one";
    state.isBuffering = false;
    emit();

    if (state.loopMode !== "one") {
      void options.onEnded?.();
    }
  }

  function handleTimeUpdate(): void {
    syncProgress();
    emit();
  }

  function handleProgress(): void {
    syncProgress();
    emit();
  }

  function handleVolumeChange(): void {
    if (!audio) {
      return;
    }

    state.volume = audio.volume;
    state.isMuted = audio.muted;
    if (!audio.muted && audio.volume > 0) {
      previousVolume = audio.volume;
    }
    emit();
  }

  function handleError(): void {
    state.isReady = false;
    state.isPlaying = false;
    state.isBuffering = false;
    state.errorKey = resolveMediaErrorKey(audio?.error ?? null);
    emit();
  }

  return {
    getSnapshot: () => ({ ...state }),
    attach,
    togglePlayback,
    seekBy,
    seekTo,
    setVolumeLevel,
    toggleMute,
    toggleLoopMode,
    resetSession,
    handleLoadedMetadata,
    handleCanPlay,
    handlePlaying,
    handlePause,
    handleWaiting,
    handleEnded,
    handleTimeUpdate,
    handleProgress,
    handleVolumeChange,
    handleError,
  };
}
