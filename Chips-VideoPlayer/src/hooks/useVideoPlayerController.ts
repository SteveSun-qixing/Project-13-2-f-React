import { useCallback, useMemo, useRef, type KeyboardEvent, type MutableRefObject, type SyntheticEvent } from "react";
import {
  type VideoPlaybackOpenHints,
  type VideoTrackOption,
  type VideoDimensions,
} from "../utils/video-player";
import { writeVideoPlayerPreferences, type VideoPlayerPreferences } from "../utils/preferences";
import { usePlaybackEngine, type PlaybackEngine, type PlaybackState } from "./usePlaybackEngine";
import { readAudioTracks, readSubtitleTracks } from "./useTracks";
import { isSurfaceFullscreen } from "./useFullscreen";
import { useTracks, type TracksController } from "./useTracks";
import { useFullscreen, type FullscreenController } from "./useFullscreen";
import { useChromeVisibility, type ChromeVisibilityController, shouldAutoHideChrome } from "./useChromeVisibility";
import { usePlayerKeyboard } from "./usePlayerKeyboard";

interface UseVideoPlayerControllerOptions {
  sessionKey: string | null;
  playbackHints?: VideoPlaybackOpenHints;
  preferences?: VideoPlayerPreferences;
}

export interface VideoPlayerSessionResetState {
  isReady: false;
  isPlaying: false;
  isBuffering: false;
  duration: 0;
  currentTime: 0;
  bufferedUntil: 0;
  videoSize: null;
  errorKey: null;
  isPictureInPicture: false;
  subtitleTracks: [];
  audioTracks: [];
  playbackRate: number;
}

export interface VideoPlayerController {
  surfaceRef: MutableRefObject<HTMLDivElement | null>;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
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
  seekTo: (nextTime: number) => void;
  seekPreviewTo: (nextTime: number) => void;
  commitSeek: (nextTime: number) => void;
  setVolumeLevel: (nextVolume: number) => void;
  adjustVolume: (delta: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (nextRate: number) => void;
  selectSubtitleTrack: (nextIndex: number | null) => void;
  selectAudioTrack: (nextIndex: number | null) => void;
  toggleFullscreen: () => Promise<void>;
  togglePictureInPicture: () => Promise<void>;
  toggleChrome: () => void;
  revealChrome: () => void;
  scheduleChromeHide: (delayMs?: number) => void;
  frameStep: (direction: "backward" | "forward") => void;
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

export function resolveInitialRate(): number {
  return 1;
}

export function createVideoPlayerSessionResetState(): VideoPlayerSessionResetState {
  return {
    isReady: false,
    isPlaying: false,
    isBuffering: false,
    duration: 0,
    currentTime: 0,
    bufferedUntil: 0,
    videoSize: null,
    errorKey: null,
    isPictureInPicture: false,
    subtitleTracks: [],
    audioTracks: [],
    playbackRate: 1,
  };
}

export interface KeyboardActionHandlers {
  openKeyHelp: () => void;
}

export function useVideoPlayerController(
  options: UseVideoPlayerControllerOptions,
  keyboardActions?: KeyboardActionHandlers,
): VideoPlayerController {
  const { playbackHints, preferences, sessionKey } = options;
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const playback = usePlaybackEngine({ sessionKey, hints: playbackHints, preferences, videoRef });
  const tracks = useTracks({ videoRef, sessionKey });
  const fullscreen = useFullscreen({ surfaceRef, videoRef, sessionKey });
  const chrome = useChromeVisibility({
    state: {
      hasVideo: Boolean(videoRef.current?.src),
      isPlaying: playback.state.isPlaying,
      isMorePanelOpen: false,
      isDragActive: false,
      hasOverlay: false,
    },
  });

  const persistPreferences = useCallback((patch: Partial<VideoPlayerPreferences>): void => {
    writeVideoPlayerPreferences(patch);
  }, []);

  const wrappedSetVolumeLevel = useCallback(
    (nextVolume: number): void => {
      playback.setVolumeLevel(nextVolume);
      persistPreferences({ volume: nextVolume, muted: nextVolume === 0 });
    },
    [persistPreferences, playback],
  );

  const wrappedToggleMute = useCallback((): void => {
    playback.toggleMute();
    persistPreferences({ muted: !playback.state.isMuted });
  }, [persistPreferences, playback]);

  const wrappedSetPlaybackRate = useCallback(
    (nextRate: number): void => {
      playback.setPlaybackRate(nextRate);
      persistPreferences({ playbackRate: nextRate });
    },
    [persistPreferences, playback],
  );

  const wrappedToggleLoop = useCallback((): void => {
    playback.toggleLoop();
    persistPreferences({ loop: !playback.state.loop });
  }, [persistPreferences, playback]);

  const wrappedSelectSubtitleTrack = useCallback(
    (nextIndex: number | null): void => {
      tracks.selectSubtitleTrack(nextIndex);
      persistPreferences({ subtitleIndex: nextIndex });
    },
    [persistPreferences, tracks],
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
    (direction: "backward" | "forward"): void => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      if (!video.paused) {
        video.pause();
      }

      const frameSeconds = 1 / 24;
      playback.commitSeek(video.currentTime + (direction === "backward" ? -frameSeconds : frameSeconds));
    },
    [playback],
  );

  const handleKeyDown = usePlayerKeyboard({
    togglePlayback: playback.togglePlayback,
    seekBy: playback.seekBy,
    seekToFraction,
    adjustVolume: playback.setVolumeLevel,
    toggleMute: playback.toggleMute,
    toggleFullscreen: fullscreen.toggleFullscreen,
    togglePictureInPicture: fullscreen.togglePictureInPicture,
    openKeyHelp: keyboardActions?.openKeyHelp ?? (() => undefined),
    toggleChrome: chrome.toggle,
    frameStep,
  });

  const controller = useMemo<VideoPlayerController>(() => {
    const state: PlaybackState = playback.state;
    return {
      surfaceRef,
      videoRef,
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
      toggleLoop: wrappedToggleLoop,
      togglePlayback: playback.togglePlayback,
      seekBy: playback.seekBy,
      seekTo: playback.commitSeek,
      seekPreviewTo: playback.seekPreviewTo,
      commitSeek: playback.commitSeek,
      setVolumeLevel: wrappedSetVolumeLevel,
      adjustVolume: wrappedSetVolumeLevel,
      toggleMute: wrappedToggleMute,
      setPlaybackRate: wrappedSetPlaybackRate,
      selectSubtitleTrack: wrappedSelectSubtitleTrack,
      selectAudioTrack: tracks.selectAudioTrack,
      toggleFullscreen: fullscreen.toggleFullscreen,
      togglePictureInPicture: fullscreen.togglePictureInPicture,
      toggleChrome: chrome.toggle,
      revealChrome: chrome.reveal,
      scheduleChromeHide: chrome.scheduleHide,
      frameStep,
      handleKeyDown: handleKeyDown.handleKeyDown,
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
    chrome.reveal,
    chrome.scheduleHide,
    chrome.toggle,
    chrome.visible,
    frameStep,
    fullscreen,
    handleKeyDown,
    playback,
    tracks,
    wrappedSelectSubtitleTrack,
    wrappedSetPlaybackRate,
    wrappedSetVolumeLevel,
    wrappedToggleLoop,
    wrappedToggleMute,
  ]);

  return controller;
}

export { shouldAutoHideChrome, isSurfaceFullscreen, readAudioTracks, readSubtitleTracks };
