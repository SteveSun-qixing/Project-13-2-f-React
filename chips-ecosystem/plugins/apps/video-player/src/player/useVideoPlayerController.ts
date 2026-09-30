/**
 * 播放器控制器（重写件：壳装配层）。
 *
 * 旧实现 `Chips-VideoPlayer/src/hooks/useVideoPlayerController.ts`（判重写：装配层写偏好 +
 * localStorage 旁路 + 旧文案/主题耦合）。本件以迁移件 hook 族重新装配：
 * - 播放引擎（usePlaybackEngine）、轨道（useTracks）、全屏/画中画（useFullscreen）、
 *   控制层显隐（useChromeVisibility）、键位（usePlayerKeyboard）；
 * - 偏好写入收敛到 `VideoPlayerPreferenceStore`（窗口会话内存态，工单065 在册；
 *   `config:*` 域处理器落波后换接 `IAppConfig` 读写实现，本层零改动）；
 * - 偏好快照按会话取值（旧装配层语义：会话建立时读一次，用户操作即时回写）；
 *   载荷入口参数（`source.playbackHints`）优先于用户偏好（《10-官方内容处理与阅读服务设计》
 *   §3.3：卡片 `playback` 字段是本次打开的入口参数，不是用户偏好）。
 */

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
  type SyntheticEvent,
} from 'react';
import type { VideoDimensions, VideoSource, VideoTrackOption } from './videoPlayer';
import { usePlaybackEngine } from './usePlaybackEngine';
import { useTracks } from './useTracks';
import { useFullscreen } from './useFullscreen';
import { useChromeVisibility } from './useChromeVisibility';
import { usePlayerKeyboard, type PlayerKeyboardActions } from './usePlayerKeyboard';
import { getWindowVideoPlayerPreferenceStore, type VideoPlayerPreferenceStore } from './preferences';

export interface UseVideoPlayerControllerOptions {
  /** 播放会话来源；null 表示空态。 */
  source: VideoSource | null;
  /** 键位帮助打开入口（界面层装配）。 */
  onOpenKeyHelp?: () => void;
  /** 偏好存储；缺省取窗口会话默认实例（测试可注入隔离实例）。 */
  preferenceStore?: VideoPlayerPreferenceStore;
}

export interface VideoPlayerController {
  surfaceRef: MutableRefObject<HTMLDivElement | null>;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  source: VideoSource | null;
  sessionKey: string | null;
  isReady: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  volume: number;
  playbackRate: number;
  duration: number;
  currentTime: number;
  bufferedUntil: number;
  isFullscreen: boolean;
  isPictureInPicture: boolean;
  canUsePictureInPicture: boolean;
  videoSize: VideoDimensions | null;
  errorKey: string | null;
  subtitleTracks: VideoTrackOption[];
  audioTracks: VideoTrackOption[];
  isEnded: boolean;
  chromeVisible: boolean;
  loop: boolean;
  toggleLoop: () => void;
  togglePlayback: () => Promise<void>;
  seekBy: (offsetSeconds: number) => void;
  seekPreviewTo: (nextTime: number) => void;
  commitSeek: (nextTime: number) => void;
  seekToFraction: (fraction: number) => void;
  setVolumeLevel: (nextVolume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (nextRate: number) => void;
  cyclePlaybackRate: () => void;
  selectSubtitleTrack: (nextIndex: number | null) => void;
  selectAudioTrack: (nextIndex: number | null) => void;
  toggleFullscreen: () => Promise<void>;
  togglePictureInPicture: () => Promise<void>;
  toggleChrome: () => void;
  revealChrome: () => void;
  scheduleChromeHide: (delayMs?: number) => void;
  /** 更多面板开合（联动控制层显隐判定）。 */
  setMorePanelOpen: (open: boolean) => void;
  /** 浮层占用登记（结束遮罩/键位帮助等，隐藏期间不自动收控制层）。 */
  setOverlayActive: (active: boolean) => void;
  frameStep: (direction: 'backward' | 'forward') => void;
  handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
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

/** 播放器支持的倍速循环序列（cyclePlaybackRate 的轮转序）。 */
const RATE_CYCLE: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function useVideoPlayerController(options: UseVideoPlayerControllerOptions): VideoPlayerController {
  const { source, onOpenKeyHelp } = options;
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const preferenceStore = options.preferenceStore ?? getWindowVideoPlayerPreferenceStore();

  // 会话键 = 来源 ID + 修订号：同源重开也触发引擎复位。
  const sessionKey = source ? `${source.sourceId}#${source.revision}` : null;
  // 偏好快照按会话取值：载荷入口参数缺位时以用户偏好起播。
  const sessionPreferences = useMemo(
    () => (source ? preferenceStore.read() : undefined),
    [preferenceStore, source],
  );

  const playback = usePlaybackEngine({
    sessionKey,
    ...(source?.playbackHints !== undefined ? { hints: source.playbackHints } : {}),
    ...(sessionPreferences !== undefined ? { preferences: sessionPreferences } : {}),
    videoRef,
  });
  const tracks = useTracks({ videoRef, sessionKey });
  const fullscreen = useFullscreen({ surfaceRef, videoRef, sessionKey });

  const [isMorePanelOpen, setMorePanelOpenState] = useState(false);
  const [hasOverlayExternal, setHasOverlayExternal] = useState(false);
  const chrome = useChromeVisibility({
    state: {
      hasVideo: sessionKey !== null,
      isPlaying: playback.state.isPlaying,
      isMorePanelOpen,
      isDragActive: false,
      hasOverlay: hasOverlayExternal || isMorePanelOpen,
    },
  });

  const setMorePanelOpen = useCallback((open: boolean): void => {
    setMorePanelOpenState(open);
  }, []);

  const setOverlayActive = useCallback((active: boolean): void => {
    setHasOverlayExternal(active);
  }, []);

  const persistVolume = useCallback(
    (nextVolume: number): void => {
      playback.setVolumeLevel(nextVolume);
      preferenceStore.write({ volume: nextVolume, muted: nextVolume === 0 });
    },
    [playback, preferenceStore],
  );

  const persistToggleMute = useCallback((): void => {
    playback.toggleMute();
    preferenceStore.write({ muted: !playback.state.isMuted });
  }, [playback, preferenceStore]);

  const persistPlaybackRate = useCallback(
    (nextRate: number): void => {
      playback.setPlaybackRate(nextRate);
      preferenceStore.write({ playbackRate: nextRate });
    },
    [playback, preferenceStore],
  );

  const persistToggleLoop = useCallback((): void => {
    playback.toggleLoop();
    preferenceStore.write({ loop: !playback.state.loop });
  }, [playback, preferenceStore]);

  const persistSelectSubtitleTrack = useCallback(
    (nextIndex: number | null): void => {
      tracks.selectSubtitleTrack(nextIndex);
      preferenceStore.write({ subtitleIndex: nextIndex });
    },
    [preferenceStore, tracks],
  );

  const seekToFraction = useCallback(
    (fraction: number): void => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration <= 0) {
        return;
      }
      playback.commitSeek(duration * Math.min(1, Math.max(0, fraction)));
    },
    [playback],
  );

  const frameStep = useCallback(
    (direction: 'backward' | 'forward'): void => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      if (!video.paused) {
        video.pause();
      }

      const frameSeconds = 1 / 24;
      playback.commitSeek(video.currentTime + (direction === 'backward' ? -frameSeconds : frameSeconds));
    },
    [playback],
  );

  const cyclePlaybackRate = useCallback((): void => {
    const index = RATE_CYCLE.indexOf(playback.state.playbackRate);
    const next = RATE_CYCLE[(index + 1) % RATE_CYCLE.length] ?? 1;
    persistPlaybackRate(next);
  }, [persistPlaybackRate, playback.state.playbackRate]);

  const keyboardActions = useMemo<PlayerKeyboardActions>(
    () => ({
      togglePlayback: playback.togglePlayback,
      seekBy: playback.seekBy,
      seekToFraction,
      adjustVolume: persistVolume,
      toggleMute: persistToggleMute,
      toggleFullscreen: fullscreen.toggleFullscreen,
      togglePictureInPicture: fullscreen.togglePictureInPicture,
      openKeyHelp: onOpenKeyHelp ?? ((): void => undefined),
      toggleChrome: chrome.toggle,
      frameStep,
    }),
    [
      chrome.toggle,
      frameStep,
      fullscreen.toggleFullscreen,
      fullscreen.togglePictureInPicture,
      onOpenKeyHelp,
      persistToggleMute,
      persistVolume,
      playback.seekBy,
      playback.togglePlayback,
      seekToFraction,
    ],
  );

  const { handleKeyDown } = usePlayerKeyboard(keyboardActions);

  return useMemo<VideoPlayerController>(() => {
    const state = playback.state;
    return {
      surfaceRef,
      videoRef,
      source,
      sessionKey,
      isReady: state.isReady,
      isPlaying: state.isPlaying,
      isBuffering: state.isBuffering,
      isMuted: state.isMuted,
      volume: state.volume,
      playbackRate: state.playbackRate,
      duration: state.duration,
      currentTime: state.currentTime,
      bufferedUntil: state.bufferedUntil,
      isFullscreen: fullscreen.isFullscreen,
      isPictureInPicture: fullscreen.isPictureInPicture,
      canUsePictureInPicture: fullscreen.canUsePictureInPicture,
      videoSize: state.videoSize,
      errorKey: state.errorKey,
      subtitleTracks: tracks.subtitleTracks,
      audioTracks: tracks.audioTracks,
      isEnded: state.isEnded,
      chromeVisible: chrome.visible,
      loop: state.loop,
      toggleLoop: persistToggleLoop,
      togglePlayback: playback.togglePlayback,
      seekBy: playback.seekBy,
      seekPreviewTo: playback.seekPreviewTo,
      commitSeek: playback.commitSeek,
      seekToFraction,
      setVolumeLevel: persistVolume,
      toggleMute: persistToggleMute,
      setPlaybackRate: persistPlaybackRate,
      cyclePlaybackRate,
      selectSubtitleTrack: persistSelectSubtitleTrack,
      selectAudioTrack: tracks.selectAudioTrack,
      toggleFullscreen: fullscreen.toggleFullscreen,
      togglePictureInPicture: fullscreen.togglePictureInPicture,
      toggleChrome: chrome.toggle,
      revealChrome: chrome.reveal,
      scheduleChromeHide: chrome.scheduleHide,
      setMorePanelOpen,
      setOverlayActive,
      frameStep,
      handleKeyDown,
      handleLoadedMetadata: playback.handleLoadedMetadata,
      handleCanPlay: playback.handleCanPlay,
      handlePlaying: playback.handlePlaying,
      handlePause: playback.handlePause,
      handleWaiting: playback.handleWaiting,
      handleEnded: playback.handleEnded,
      handleTimeUpdate: playback.handleTimeUpdate,
      handleDurationChange: playback.handleDurationChange,
      handleProgress: playback.handleProgress,
      handleVolumeChange: playback.handleVolumeChange,
      handleError: playback.handleError,
    };
  }, [
    chrome.scheduleHide,
    chrome.toggle,
    chrome.visible,
    cyclePlaybackRate,
    fullscreen,
    frameStep,
    handleKeyDown,
    persistPlaybackRate,
    persistSelectSubtitleTrack,
    persistToggleLoop,
    persistToggleMute,
    persistVolume,
    playback,
    seekToFraction,
    sessionKey,
    setMorePanelOpen,
    setOverlayActive,
    source,
    tracks,
  ]);
}
