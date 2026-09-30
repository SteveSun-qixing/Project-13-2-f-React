/**
 * 播放状态机（迁移件）。
 *
 * 迁移来源：旧仓 `Chips-VideoPlayer/src/hooks/usePlaybackEngine.ts`（覆盖矩阵「四媒体查看器仓」
 * §五「播放状态机」行，判迁移：纯 `<video>` DOM 事件状态机，零 SDK 触达；测试随迁）。
 * 适配仅限导入路径（`../player/videoPlayer`、`../player/preferences`）与引号风格。
 */

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type SyntheticEvent } from 'react';
import {
  PLAYBACK_RATES,
  clampPlaybackTime,
  clampVolume,
  resolveMediaErrorKey,
  type VideoDimensions,
  type VideoPlaybackOpenHints,
} from './videoPlayer';
import { DEFAULT_PREFERENCES, type VideoPlayerPreferences } from './preferences';

export interface PlaybackState {
  isReady: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  volume: number;
  playbackRate: number;
  duration: number;
  currentTime: number;
  bufferedUntil: number;
  videoSize: VideoDimensions | null;
  errorKey: string | null;
  isEnded: boolean;
  loop: boolean;
}

export function createPlaybackState(hints?: VideoPlaybackOpenHints, preferences?: VideoPlayerPreferences): PlaybackState {
  const preferredRate = preferences?.playbackRate ?? DEFAULT_PREFERENCES.playbackRate;
  return {
    isReady: false,
    isPlaying: false,
    isBuffering: false,
    isMuted: hints?.muted === true ? true : (preferences?.muted ?? DEFAULT_PREFERENCES.muted),
    volume: hints?.muted ? 0 : (preferences?.volume ?? DEFAULT_PREFERENCES.volume),
    playbackRate: PLAYBACK_RATES.includes(hints?.playbackRate ?? -1)
      ? (hints?.playbackRate ?? 1)
      : PLAYBACK_RATES.includes(preferredRate)
        ? preferredRate
        : 1,
    duration: 0,
    currentTime: 0,
    bufferedUntil: 0,
    videoSize: null,
    errorKey: null,
    isEnded: false,
    loop: hints?.loop === true ? true : (preferences?.loop ?? DEFAULT_PREFERENCES.loop),
  };
}

export interface UsePlaybackEngineOptions {
  sessionKey: string | null;
  hints?: VideoPlaybackOpenHints;
  preferences?: VideoPlayerPreferences;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  onTracksChanged?: () => void;
}

export interface PlaybackEngine {
  state: PlaybackState;
  togglePlayback: () => Promise<void>;
  seekPreviewTo: (nextTime: number) => void;
  commitSeek: (nextTime: number) => void;
  seekBy: (offsetSeconds: number) => void;
  setVolumeLevel: (nextVolume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (nextRate: number) => void;
  toggleLoop: () => void;
  handleLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void;
  handleCanPlay: () => void;
  handlePlaying: () => void;
  handlePause: () => void;
  handleWaiting: () => void;
  handleEnded: () => void;
  handleTimeUpdate: () => void;
  handleDurationChange: () => void;
  handleProgress: () => void;
  handleVolumeChange: () => void;
  handleError: () => void;
}

const PROGRESS_FLUSH_INTERVAL_MS = 250;

export function usePlaybackEngine(options: UsePlaybackEngineOptions): PlaybackEngine {
  const { sessionKey, hints, preferences, videoRef } = options;
  const [state, setState] = useState<PlaybackState>(() => createPlaybackState(hints, preferences));

  const progressRef = useRef({ currentTime: 0, bufferedUntil: 0 });
  const flushTimerRef = useRef<number | null>(null);

  const flushProgress = useCallback(() => {
    flushTimerRef.current = null;
    setState((current) => {
      const next = progressRef.current;
      if (
        Math.abs(current.currentTime - next.currentTime) < 0.25 &&
        Math.abs(current.bufferedUntil - next.bufferedUntil) < 0.5
      ) {
        return current;
      }
      return { ...current, currentTime: next.currentTime, bufferedUntil: next.bufferedUntil };
    });
  }, []);

  const scheduleProgressFlush = useCallback(() => {
    if (flushTimerRef.current !== null) {
      return;
    }
    flushTimerRef.current = window.setTimeout(flushProgress, PROGRESS_FLUSH_INTERVAL_MS);
  }, [flushProgress]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const nextVolume = hints?.muted ? 0 : (preferences?.volume ?? DEFAULT_PREFERENCES.volume);
    const nextPlaybackRate = PLAYBACK_RATES.includes(hints?.playbackRate ?? -1)
      ? (hints?.playbackRate ?? 1)
      : PLAYBACK_RATES.includes(preferences?.playbackRate ?? -1)
        ? (preferences?.playbackRate ?? 1)
        : 1;
    video.volume = nextVolume;
    video.playbackRate = nextPlaybackRate;
    video.muted = hints?.muted === true ? true : (preferences?.muted ?? DEFAULT_PREFERENCES.muted);
    video.loop = hints?.loop === true ? true : (preferences?.loop ?? DEFAULT_PREFERENCES.loop);
    if (hints && hints.startTime > 0) {
      video.currentTime = hints.startTime;
    }
    progressRef.current = {
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      bufferedUntil: 0,
    };
    setState((current) => ({
      ...current,
      isMuted: video.muted,
      volume: nextVolume,
      playbackRate: nextPlaybackRate,
      currentTime: progressRef.current.currentTime,
    }));
    if (hints?.autoplay) {
      void video.play().catch(() => undefined);
    }
    // 判迁移保真：hints/preferences 对象变更时重放媒体元素参数（与旧实现一致；
    // 依赖面宽是有意的装配语义，本仓未启用 exhaustive-deps 规则）。
  }, [hints, sessionKey, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
    }
    progressRef.current = { currentTime: 0, bufferedUntil: 0 };
    // 判迁移保真修复（旧实现同源缺陷）：会话复位同样携带偏好快照，
    // 避免「元素参数含偏好、状态复位回默认」的双轨不一致。
    setState(createPlaybackState(hints, preferences));
    // 会话键切换即复位播放会话（依赖面宽是有意的装配语义，本仓未启用 exhaustive-deps 规则）。
  }, [hints, sessionKey, videoRef]);

  const togglePlayback = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.paused) {
      setState((current) => ({ ...current, errorKey: null, isEnded: false }));
      try {
        await video.play();
      } catch {
        setState((current) => ({ ...current, errorKey: resolveMediaErrorKey(video.error) }));
      }
      return;
    }

    video.pause();
  }, [videoRef]);

  const commitSeek = useCallback(
    (nextTime: number): void => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      const targetTime = clampPlaybackTime(nextTime, video.duration);
      video.currentTime = targetTime;
      progressRef.current = {
        currentTime: targetTime,
        bufferedUntil: progressRef.current.bufferedUntil,
      };
      setState((current) => ({
        ...current,
        currentTime: targetTime,
        duration: Number.isFinite(video.duration) ? video.duration : current.duration,
        isEnded: false,
      }));
    },
    [videoRef],
  );

  const seekPreviewTo = useCallback(
    (nextTime: number): void => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      const targetTime = clampPlaybackTime(nextTime, video.duration);
      progressRef.current = { ...progressRef.current, currentTime: targetTime };
      setState((current) => ({ ...current, currentTime: targetTime }));
    },
    [videoRef],
  );

  const seekBy = useCallback(
    (offsetSeconds: number): void => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      commitSeek(video.currentTime + offsetSeconds);
    },
    [commitSeek, videoRef],
  );

  const setVolumeLevel = useCallback(
    (nextVolume: number): void => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      const normalized = clampVolume(nextVolume);
      video.volume = normalized;
      video.muted = normalized === 0;
      setState((current) => ({ ...current, volume: normalized, isMuted: video.muted }));
    },
    [videoRef],
  );

  const toggleMute = useCallback((): void => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = !video.muted;
    setState((current) => ({ ...current, isMuted: video.muted }));
  }, [videoRef]);

  const setPlaybackRate = useCallback(
    (nextRate: number): void => {
      const video = videoRef.current;
      const normalized = PLAYBACK_RATES.includes(nextRate) ? nextRate : 1;
      if (video) {
        video.playbackRate = normalized;
      }
      setState((current) => ({ ...current, playbackRate: normalized }));
    },
    [videoRef],
  );

  const toggleLoop = useCallback((): void => {
    const video = videoRef.current;
    setState((current) => {
      const nextLoop = !current.loop;
      if (video) {
        video.loop = nextLoop;
      }
      return { ...current, loop: nextLoop };
    });
  }, [videoRef]);

  const handleLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>): void => {
      const video = event.currentTarget;
      setState((current) => ({
        ...current,
        videoSize: { width: video.videoWidth, height: video.videoHeight },
        duration: Number.isFinite(video.duration) ? video.duration : current.duration,
        currentTime: Number.isFinite(video.currentTime) ? video.currentTime : current.currentTime,
      }));
      options.onTracksChanged?.();
    },
    [options],
  );

  const handleCanPlay = useCallback((): void => {
    setState((current) => ({ ...current, isReady: true, isBuffering: false, errorKey: null }));
    options.onTracksChanged?.();
  }, [options]);

  const handlePlaying = useCallback((): void => {
    setState((current) => ({
      ...current,
      isReady: true,
      isPlaying: true,
      isBuffering: false,
      errorKey: null,
      isEnded: false,
    }));
  }, []);

  const handlePause = useCallback((): void => {
    setState((current) => ({ ...current, isPlaying: false, isBuffering: false }));
  }, []);

  const handleWaiting = useCallback((): void => {
    setState((current) => ({ ...current, isBuffering: true }));
  }, []);

  const handleEnded = useCallback((): void => {
    setState((current) => ({ ...current, isPlaying: false, isBuffering: false, isEnded: true }));
  }, []);

  const handleTimeUpdate = useCallback((): void => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    progressRef.current = {
      currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      bufferedUntil: progressRef.current.bufferedUntil,
    };
    if (Number.isFinite(video.duration) && video.duration !== state.duration) {
      setState((current) => ({ ...current, duration: video.duration }));
    }
    scheduleProgressFlush();
  }, [scheduleProgressFlush, state.duration, videoRef]);

  const handleDurationChange = useCallback((): void => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setState((current) => ({ ...current, duration: Number.isFinite(video.duration) ? video.duration : 0 }));
  }, [videoRef]);

  const handleProgress = useCallback((): void => {
    const video = videoRef.current;
    if (!video || video.buffered.length === 0) {
      progressRef.current = { ...progressRef.current, bufferedUntil: 0 };
      scheduleProgressFlush();
      return;
    }
    progressRef.current = {
      ...progressRef.current,
      bufferedUntil: video.buffered.end(video.buffered.length - 1),
    };
    scheduleProgressFlush();
  }, [scheduleProgressFlush, videoRef]);

  const handleVolumeChange = useCallback((): void => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setState((current) => ({ ...current, volume: clampVolume(video.volume), isMuted: video.muted }));
  }, [videoRef]);

  const handleError = useCallback((): void => {
    const video = videoRef.current;
    setState((current) => ({
      ...current,
      isReady: false,
      isPlaying: false,
      isBuffering: false,
      errorKey: resolveMediaErrorKey(video?.error ?? null),
    }));
  }, [videoRef]);

  return {
    state,
    togglePlayback,
    seekPreviewTo,
    commitSeek,
    seekBy,
    setVolumeLevel,
    toggleMute,
    setPlaybackRate,
    toggleLoop,
    handleLoadedMetadata,
    handleCanPlay,
    handlePlaying,
    handlePause,
    handleWaiting,
    handleEnded,
    handleTimeUpdate,
    handleDurationChange,
    handleProgress,
    handleVolumeChange,
    handleError,
  };
}
