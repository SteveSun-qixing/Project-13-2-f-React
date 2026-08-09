import React, { useEffect, useRef, useState } from "react";
import type { MusicPlayerController } from "../../hooks/useMusicPlayerController";
import type { TrackPresentation } from "../../utils/music-player";

const TIME_SYNC_THRESHOLD_SECONDS = 0.02;

export interface SeekBarProps {
  controller: MusicPlayerController;
  track: TrackPresentation | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function SeekBar(props: SeekBarProps): React.ReactElement {
  const { controller, track, t } = props;
  const [playbackTime, setPlaybackTime] = useState(controller.currentTime);
  const [trackDuration, setTrackDuration] = useState(controller.duration);
  const controllerRef = useRef(controller);
  const playbackTimeRef = useRef(controller.currentTime);
  const trackDurationRef = useRef(controller.duration);

  useEffect(() => {
    controllerRef.current = controller;
  }, [controller]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let animationFrameId = 0;

    const renderProgressFrame = () => {
      const audio = controllerRef.current.audioRef.current;
      const nextTime = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const nextDuration = audio && Number.isFinite(audio.duration) ? audio.duration : 0;

      if (Math.abs(nextTime - playbackTimeRef.current) >= TIME_SYNC_THRESHOLD_SECONDS) {
        playbackTimeRef.current = nextTime;
        setPlaybackTime(nextTime);
      }

      if (nextDuration !== trackDurationRef.current) {
        trackDurationRef.current = nextDuration;
        setTrackDuration(nextDuration);
      }

      animationFrameId = window.requestAnimationFrame(renderProgressFrame);
    };

    animationFrameId = window.requestAnimationFrame(renderProgressFrame);
    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const progressRatio = trackDuration > 0 ? Math.min(100, (playbackTime / trackDuration) * 100) : 0;
  const inputValue = Math.min(playbackTime, trackDuration || playbackTime);

  return (
    <div className="processbar">
      <div className="process" style={{ width: `${progressRatio}%` }} />
      <input
        className="processinput"
        type="range"
        min={0}
        max={trackDuration || 0}
        step={0.01}
        value={inputValue}
        aria-label={t("music-player.section.details")}
        disabled={!track || trackDuration <= 0}
        onChange={(event) => {
          controller.seekTo(Number(event.currentTarget.value));
        }}
      />
    </div>
  );
}
