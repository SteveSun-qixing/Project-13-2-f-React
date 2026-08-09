import React, { useEffect, useRef, useState } from "react";
import type { MusicPlayerControllerActions, MusicPlayerQueueItem } from "../app/AppRuntimeProvider";
import { useMusicPlayerController } from "../hooks/useMusicPlayerController";
import type { TrackPresentation, ViewerFeedback } from "../utils/music-player";
import { shouldUseMobilePagerLayout } from "../utils/layout";
import { AtmosphereCanvas } from "./atmosphere/AtmosphereCanvas";
import { ArtworkPanel } from "./artwork/ArtworkPanel";
import { SeekBar } from "./seek/SeekBar";
import { TransportControls } from "./controls/TransportControls";
import { LyricsPane } from "./lyrics/LyricsPane";
import { MobilePager } from "./layout/MobilePager";

interface MusicPlayerStageProps {
  track: TrackPresentation | null;
  queue: MusicPlayerQueueItem[];
  queueIndex: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isResolving: boolean;
  isSaving: boolean;
  feedback: ViewerFeedback | null;
  onOpenFiles: () => void | Promise<void>;
  onSaveAudio: () => void | Promise<void>;
  onDropFiles: (files: File[]) => void | Promise<void>;
  onPreviousTrack: () => void | Promise<void>;
  onNextTrack: () => void | Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  setPlayerActions: (actions: MusicPlayerControllerActions | null) => void;
}

const DEFAULT_ARTWORK_URI = new URL("../../assets/artwork/default-cover.svg", import.meta.url).href;

export function MusicPlayerStage(props: MusicPlayerStageProps): React.ReactElement {
  const {
    track,
    queue,
    queueIndex,
    canGoPrevious,
    canGoNext,
    isResolving,
    isSaving,
    feedback,
    onOpenFiles,
    onSaveAudio,
    onDropFiles,
    onPreviousTrack,
    onNextTrack,
    t,
    setPlayerActions,
  } = props;
  const [isDragActive, setIsDragActive] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  const [viewportHeight, setViewportHeight] = useState(() => (typeof window === "undefined" ? 720 : window.innerHeight));
  const controller = useMusicPlayerController({
    sessionKey: track ? `${track.source.sourceId}:${track.source.revision}` : null,
    onEnded: canGoNext ? onNextTrack : undefined,
  });
  const dragDepthRef = useRef(0);
  const controllerRef = useRef(controller);

  const artworkUri = track?.artworkUri ?? DEFAULT_ARTWORK_URI;
  const overlayMessage = controller.errorKey
    ? t(`music-player.errors.${controller.errorKey}`)
    : isResolving
      ? t("music-player.viewer.loading")
      : controller.isBuffering
        ? t("music-player.viewer.buffering")
        : null;
  const isMobilePagerLayout = shouldUseMobilePagerLayout(viewportWidth, viewportHeight);
  const queueStatus = queue.length > 1
    ? t("music-player.labels.queueStatus", {
        current: queueIndex + 1,
        total: queue.length,
      })
    : "";

  useEffect(() => {
    controllerRef.current = controller;
  }, [controller]);

  useEffect(() => {
    setPlayerActions({
      getVolume: () => controllerRef.current?.volume ?? 0.85,
      togglePlayback: () => void controllerRef.current?.togglePlayback(),
      seekBy: (offsetSeconds) => controllerRef.current?.seekBy(offsetSeconds),
      setVolumeLevel: (nextVolume) => controllerRef.current?.setVolumeLevel(nextVolume),
      toggleMute: () => void controllerRef.current?.toggleMute(),
      toggleLoopMode: () => void controllerRef.current?.toggleLoopMode(),
    });
    return () => setPlayerActions(null);
  }, [setPlayerActions]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.classList.toggle("no-files", !track);
    return () => {
      document.body.classList.remove("no-files");
    };
  }, [track]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      className={`music-player-shell${isDragActive ? " music-player-shell--drag" : ""}`}
      ref={controller.surfaceRef}
      tabIndex={0}
      onKeyDown={controller.handleKeyDown}
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
          setIsDragActive(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepthRef.current = 0;
        setIsDragActive(false);
        void onDropFiles(Array.from(event.dataTransfer.files ?? []));
      }}
    >
      <div className="background" aria-hidden="true" />
      <MobilePager isMobilePagerLayout={isMobilePagerLayout} viewportWidth={viewportWidth} t={t}>
        <section className="leftcontent" aria-label={t("music-player.app.title")}>
          <ArtworkPanel
            controller={controller}
            track={track}
            artworkUri={artworkUri}
            queueStatus={queueStatus}
            onOpenFiles={onOpenFiles}
            t={t}
          />
          <SeekBar controller={controller} track={track} t={t} />
          <TransportControls
            controller={controller}
            track={track}
            canGoPrevious={canGoPrevious}
            canGoNext={canGoNext}
            isSaving={isSaving}
            onPreviousTrack={onPreviousTrack}
            onNextTrack={onNextTrack}
            onSaveAudio={onSaveAudio}
            t={t}
          />
        </section>
        <aside className="rightcontent" aria-label={t("music-player.section.lyrics")}>
          <LyricsPane controller={controller} track={track} viewportHeight={viewportHeight} t={t} />
        </aside>
      </MobilePager>
      <AtmosphereCanvas artworkUri={artworkUri} />

      {feedback ? (
        <div
          className={`music-player-feedback music-player-feedback--${feedback.tone}`}
          role={feedback.tone === "error" ? "alert" : "status"}
          aria-live={feedback.tone === "error" ? "assertive" : "polite"}
        >
          {feedback.message}
        </div>
      ) : null}
      {overlayMessage ? (
        <div className="music-player-overlay" role="status" aria-live="polite">
          {overlayMessage}
        </div>
      ) : null}

      <audio
        key={track?.source.revision ?? "empty"}
        ref={controller.audioRef}
        className="music-player-audio"
        aria-label={track?.source.title ?? t("music-player.app.title")}
        src={track?.source.resourceUri}
        preload="metadata"
        autoPlay
        loop={controller.loopMode === "one"}
        onLoadedMetadata={controller.handleLoadedMetadata}
        onCanPlay={controller.handleCanPlay}
        onPlaying={controller.handlePlaying}
        onPause={controller.handlePause}
        onWaiting={controller.handleWaiting}
        onEnded={controller.handleEnded}
        onTimeUpdate={controller.handleTimeUpdate}
        onProgress={controller.handleProgress}
        onVolumeChange={controller.handleVolumeChange}
        onError={controller.handleError}
      />
    </div>
  );
}
