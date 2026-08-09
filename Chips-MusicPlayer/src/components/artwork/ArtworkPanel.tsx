import React from "react";
import type { MusicPlayerController } from "../../hooks/useMusicPlayerController";
import type { TrackPresentation } from "../../utils/music-player";
import { formatDuration, formatRemainingDuration, resolveAudioFormatLabel } from "../../utils/music-player";
import { TooltipAnchor } from "../shared/TooltipAnchor";

export interface ArtworkPanelProps {
  controller: MusicPlayerController;
  track: TrackPresentation | null;
  artworkUri: string;
  queueStatus: string;
  onOpenFiles: () => void | Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ArtworkPanel(props: ArtworkPanelProps): React.ReactElement {
  const { controller, track, artworkUri, queueStatus, onOpenFiles, t } = props;
  const formatLabel = track
    ? resolveAudioFormatLabel(track.source.fileName || track.source.sourceId, track.source.mimeType)
    : "";
  const sourceBadge = track
    ? (track.source.isRemote ? t("music-player.labels.remote") : t("music-player.labels.local"))
    : "";
  const metaPrimary = track
    ? track.artist || t("music-player.viewer.metadataFallback")
    : t("music-player.viewer.emptyHint");
  const metaSecondary = track
    ? track.album || [sourceBadge, formatLabel || t("music-player.labels.unknown")].filter(Boolean).join(" · ")
    : t("music-player.viewer.selectBundleHint");

  return (
    <>
      <TooltipAnchor label={track ? t("music-player.actions.open") : t("music-player.viewer.emptyPrompt")}>
        <button
          className={`svgcontainer${controller.isPlaying ? " svgcontainer--playing" : ""}`}
          type="button"
          aria-label={track ? t("music-player.actions.open") : t("music-player.viewer.emptyPrompt")}
          onClick={() => void onOpenFiles()}
          style={{ backgroundImage: `url("${artworkUri}")` }}
        >
          <span className="svg" aria-hidden="true" />
        </button>
      </TooltipAnchor>

      <div className="time">
        <p className="start">{formatDuration(controller.currentTime)}</p>
        <p className="name">{track?.source.title ?? t("music-player.viewer.emptyPrompt")}</p>
        <p className="end">{formatRemainingDuration(controller.duration, controller.currentTime)}</p>
      </div>

      <div className="metarow" aria-live="polite">
        <p>{metaPrimary}</p>
        <p>{metaSecondary}</p>
        {queueStatus ? <p>{queueStatus}</p> : null}
      </div>
    </>
  );
}
