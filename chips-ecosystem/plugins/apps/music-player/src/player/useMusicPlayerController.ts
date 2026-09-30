/**
 * 播放器元素绑定控制器（迁移件 hook）。
 *
 * 迁移来源：旧仓 `Chips-MusicPlayer/src/hooks/useMusicPlayerController.ts`（覆盖矩阵
 * 「播放状态机与引擎」行组成部分，判迁移：引擎与 `<audio>` 元素的绑定 hook）。
 * 适配收口：
 * - `appConfig.defaultLoopMode` 常量随迁内联（矩阵口径）；
 * - 旧 `handleKeyDown` 空实现不随迁（禁占位）：窗口键位由界面层
 *   `usePlayerKeyboard`（重写件）承载真实键位语义。
 */

import { useEffect, useRef, useState, type MutableRefObject, type SyntheticEvent } from 'react';
import {
  createMusicPlayerEngine,
  DEFAULT_ENGINE_VOLUME,
  fromHTMLMediaElement,
  type LoopMode,
  type MusicPlayerEngine,
} from './audioEngine';

/** 应用缺省循环模式（旧 appConfig.defaultLoopMode 常量随迁内联）。 */
export const DEFAULT_LOOP_MODE: LoopMode = 'one';

export interface MusicPlayerController {
  audioRef: MutableRefObject<HTMLAudioElement | null>;
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
  togglePlayback: () => Promise<void>;
  seekBy: (offsetSeconds: number) => void;
  seekTo: (nextTime: number) => void;
  setVolumeLevel: (nextVolume: number) => void;
  toggleMute: () => void;
  toggleLoopMode: () => void;
  handleLoadedMetadata: (event: SyntheticEvent<HTMLAudioElement>) => void;
  handleCanPlay: () => void;
  handlePlaying: () => void;
  handlePause: () => void;
  handleWaiting: () => void;
  handleEnded: () => void;
  handleTimeUpdate: () => void;
  handleProgress: () => void;
  handleVolumeChange: () => void;
  handleError: () => void;
}

interface UseMusicPlayerControllerOptions {
  /** 会话键：当前曲目变化时复位引擎会话。 */
  sessionKey: string | null;
  /** 单曲播完回调（循环模式为 off 时由引擎触发）。 */
  onEnded?: () => void | Promise<void>;
}

export function useMusicPlayerController(options: UseMusicPlayerControllerOptions): MusicPlayerController {
  const { sessionKey } = options;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedRef = useRef(options.onEnded);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_ENGINE_VOLUME);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedUntil, setBufferedUntil] = useState(0);
  const [loopMode, setLoopMode] = useState<LoopMode>(DEFAULT_LOOP_MODE);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const engineRef = useRef<MusicPlayerEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createMusicPlayerEngine({
      defaultVolume: DEFAULT_ENGINE_VOLUME,
      defaultLoopMode: DEFAULT_LOOP_MODE,
      onStateChange: (nextState) => {
        setIsReady(nextState.isReady);
        setIsPlaying(nextState.isPlaying);
        setIsBuffering(nextState.isBuffering);
        setIsMuted(nextState.isMuted);
        setVolume(nextState.volume);
        setDuration(nextState.duration);
        setCurrentTime(nextState.currentTime);
        setBufferedUntil(nextState.bufferedUntil);
        setLoopMode(nextState.loopMode);
        setErrorKey(nextState.errorKey);
      },
      onEnded: () => void onEndedRef.current?.(),
    });
  }
  const engine = engineRef.current;

  useEffect(() => {
    onEndedRef.current = options.onEnded;
  }, [options.onEnded]);

  useEffect(() => {
    engine.attach(audioRef.current ? fromHTMLMediaElement(audioRef.current) : null);
  });

  useEffect(() => {
    engine.resetSession();
  }, [engine, sessionKey]);

  return {
    audioRef,
    isReady,
    isPlaying,
    isBuffering,
    isMuted,
    volume,
    duration,
    currentTime,
    bufferedUntil,
    loopMode,
    errorKey,
    togglePlayback: () => engine.togglePlayback(),
    seekBy: (offsetSeconds) => engine.seekBy(offsetSeconds),
    seekTo: (nextTime) => engine.seekTo(nextTime),
    setVolumeLevel: (nextVolume) => engine.setVolumeLevel(nextVolume),
    toggleMute: () => engine.toggleMute(),
    toggleLoopMode: () => engine.toggleLoopMode(),
    handleLoadedMetadata: (_event: SyntheticEvent<HTMLAudioElement>) => engine.handleLoadedMetadata(),
    handleCanPlay: () => engine.handleCanPlay(),
    handlePlaying: () => engine.handlePlaying(),
    handlePause: () => engine.handlePause(),
    handleWaiting: () => engine.handleWaiting(),
    handleEnded: () => engine.handleEnded(),
    handleTimeUpdate: () => engine.handleTimeUpdate(),
    handleProgress: () => engine.handleProgress(),
    handleVolumeChange: () => engine.handleVolumeChange(),
    handleError: () => engine.handleError(),
  };
}
