import { useEffect, useRef, useState, type KeyboardEvent, type MutableRefObject, type SyntheticEvent } from "react";
import { appConfig } from "../../config/app-config";
import {
  createMusicPlayerEngine,
  DEFAULT_ENGINE_VOLUME,
  fromHTMLMediaElement,
  type MusicPlayerEngine,
} from "../engine/audio-engine";

export interface MusicPlayerController {
  surfaceRef: MutableRefObject<HTMLDivElement | null>;
  audioRef: MutableRefObject<HTMLAudioElement | null>;
  isReady: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  volume: number;
  duration: number;
  currentTime: number;
  bufferedUntil: number;
  loopMode: "off" | "one";
  errorKey: string | null;
  togglePlayback: () => Promise<void>;
  seekBy: (offsetSeconds: number) => void;
  seekTo: (nextTime: number) => void;
  setVolumeLevel: (nextVolume: number) => void;
  toggleMute: () => void;
  toggleLoopMode: () => void;
  handleKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
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
  sessionKey: string | null;
  onEnded?: () => void | Promise<void>;
}

export function useMusicPlayerController(options: UseMusicPlayerControllerOptions): MusicPlayerController {
  const { sessionKey } = options;
  const surfaceRef = useRef<HTMLDivElement | null>(null);
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
  const [loopMode, setLoopMode] = useState<"off" | "one">(appConfig.defaultLoopMode);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const engineRef = useRef<MusicPlayerEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createMusicPlayerEngine({
      defaultVolume: DEFAULT_ENGINE_VOLUME,
      defaultLoopMode: appConfig.defaultLoopMode,
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
    surfaceRef,
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
    handleKeyDown: (_event: KeyboardEvent<HTMLDivElement>) => undefined,
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
