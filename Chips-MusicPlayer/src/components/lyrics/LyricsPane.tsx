import React, { useEffect, useRef, useState } from "react";
import type { MusicPlayerController } from "../../hooks/useMusicPlayerController";
import { findActiveLyricIndex, resolveActiveLyricProgress } from "../../utils/lyrics";
import {
  getLyricsLayoutPosition,
  getLyricsTransitionDelay,
  resolveLyricsViewportOffset,
} from "../../utils/lyrics-layout";
import type { TrackPresentation } from "../../utils/music-player";

type LyricLineStyle = React.CSSProperties & {
  "--lyric-fill-progress": string;
  "--lyric-line-opacity": string;
};

export interface LyricsPaneProps {
  controller: MusicPlayerController;
  track: TrackPresentation | null;
  viewportHeight: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function LyricsPane(props: LyricsPaneProps): React.ReactElement {
  const { controller, track, viewportHeight, t } = props;
  const [lyricsLayoutVersion, setLyricsLayoutVersion] = useState(0);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const lyricLineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lyricTimeoutIdsRef = useRef<number[]>([]);
  const lyricProgressFrameRef = useRef(0);
  const lastAnimatedLyricIndexRef = useRef<number>(-2);

  const activeLyricIndex =
    track?.lyrics.mode === "timed" ? findActiveLyricIndex(track.lyrics.lines, controller.currentTime * 1_000) : -1;
  const fallbackLyricIndex = activeLyricIndex >= 0 ? activeLyricIndex : 0;
  const lyricsViewportHeight = lyricsContainerRef.current?.clientHeight ?? viewportHeight;
  const initialLyricsOffset = resolveLyricsViewportOffset(lyricsViewportHeight);

  function applyLyricProgressState(playbackTimeMs: number): void {
    if (track?.lyrics.mode !== "timed") {
      return;
    }

    const currentIndex = findActiveLyricIndex(track.lyrics.lines, playbackTimeMs);
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
    const currentProgress = resolveActiveLyricProgress(track.lyrics.lines, playbackTimeMs, currentIndex);

    if (currentIndex !== lastAnimatedLyricIndexRef.current) {
      track.lyrics.lines.forEach((_, index) => {
        const element = lyricLineRefs.current[index];
        if (!element) {
          return;
        }

        element.style.filter = `blur(${Math.abs(index - fallbackIndex)}px)`;
        element.style.setProperty("--lyric-line-opacity", index < currentIndex ? "0.74" : index === currentIndex ? "1" : "0.22");
        element.style.setProperty("--lyric-fill-progress", index < currentIndex ? "1" : index === currentIndex ? String(currentProgress) : "0");
      });
      lastAnimatedLyricIndexRef.current = currentIndex;
      return;
    }

    if (currentIndex >= 0) {
      const activeElement = lyricLineRefs.current[currentIndex];
      activeElement?.style.setProperty("--lyric-fill-progress", String(currentProgress));
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || typeof ResizeObserver === "undefined") {
      return;
    }

    const container = lyricsContainerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setLyricsLayoutVersion((current) => current + 1);
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [track?.source.revision, track?.lyrics.mode]);

  useEffect(() => {
    if (typeof window === "undefined" || track?.lyrics.mode !== "timed") {
      lastAnimatedLyricIndexRef.current = -2;
      return;
    }

    const renderProgressFrame = () => {
      const playbackTimeMs = (controller.audioRef.current?.currentTime ?? controller.currentTime) * 1_000;
      applyLyricProgressState(playbackTimeMs);

      if (controller.isPlaying) {
        lyricProgressFrameRef.current = window.requestAnimationFrame(renderProgressFrame);
      }
    };

    window.cancelAnimationFrame(lyricProgressFrameRef.current);
    renderProgressFrame();

    return () => {
      window.cancelAnimationFrame(lyricProgressFrameRef.current);
    };
  }, [controller.isPlaying, track, lyricsLayoutVersion]);

  useEffect(() => {
    if (track?.lyrics.mode !== "timed" || controller.isPlaying) {
      return;
    }

    applyLyricProgressState(controller.currentTime * 1_000);
  }, [controller.currentTime, controller.isPlaying, track]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    lyricTimeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    lyricTimeoutIdsRef.current = [];

    if (track?.lyrics.mode !== "timed") {
      lyricLineRefs.current = [];
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const lineHeights = track.lyrics.lines.map((_, index) => lyricLineRefs.current[index]?.getBoundingClientRect().height ?? 0);
      const resolvedIndex = activeLyricIndex >= 0 ? activeLyricIndex : 0;
      const hasActiveLyric = activeLyricIndex >= 0;
      const viewportOffset = resolveLyricsViewportOffset(lyricsContainerRef.current?.clientHeight ?? viewportHeight);

      track.lyrics.lines.forEach((_, index) => {
        const element = lyricLineRefs.current[index];
        if (!element) {
          return;
        }

        const position = getLyricsLayoutPosition(resolvedIndex, index, lineHeights, viewportOffset);
        const delay = hasActiveLyric ? getLyricsTransitionDelay(resolvedIndex, index) : 0;
        const timeoutId = window.setTimeout(() => {
          element.style.transform = `translateY(${position}px)`;
        }, delay);
        lyricTimeoutIdsRef.current.push(timeoutId);
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      lyricTimeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      lyricTimeoutIdsRef.current = [];
    };
  }, [activeLyricIndex, lyricsLayoutVersion, track, viewportHeight]);

  return (
    <div className="lyricscontainer" ref={lyricsContainerRef}>
      {track?.lyrics.mode === "timed" ? (
        <div className="lyrics" aria-live="polite">
          {track.lyrics.lines.map((line, index) => (
            <div
              key={line.id}
              className="item"
              style={
                {
                  transform: `translateY(${initialLyricsOffset + index * 72}px)`,
                  filter: `blur(${Math.abs(index - fallbackLyricIndex)}px)`,
                  "--lyric-fill-progress": index < activeLyricIndex ? "1" : "0",
                  "--lyric-line-opacity": index < activeLyricIndex ? "0.74" : "0.22",
                } as LyricLineStyle
              }
              ref={(element) => {
                lyricLineRefs.current[index] = element;
              }}
            >
              <p data-text={line.text}>{line.text}</p>
            </div>
          ))}
        </div>
      ) : track?.lyrics.mode === "plain" ? (
        <div className="lyrics lyrics--plain">
          {track.lyrics.lines.map((line) => (
            <div key={line.id} className="item item--plain">
              <p data-text={line.text}>{line.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="lyrics lyrics--empty">
          <div className="lyrics-empty-message">{track ? t("music-player.viewer.lyricsEmpty") : t("music-player.section.lyrics")}</div>
        </div>
      )}
    </div>
  );
}
