import React, { useEffect, useRef } from "react";
import { Empty, Image, Skeleton, Tag } from "antd";
import { CaretRightFilled, VideoCameraOutlined } from "@ant-design/icons";
import type { VideoCardOpenPayload, VideoCardOpenResource, VideoCardOpenSubtitleResource } from "chips-sdk";
import type { BasecardConfig } from "../schema/card-config";
import { formatMessage } from "../lib/messages";
import {
  deriveDisplayTitle,
  deriveMetaLine,
  inferSubtitleMimeType,
  inferVideoMimeType,
  normalizeRelativeCardResourcePath,
  resolveFileName,
  useResolvedResourceUrl,
} from "../shared/utils";

export const VIEW_STYLE_TEXT = `
.chips-video-card {
  width: 100%;
  color: #1d1d1f;
  font: 14px/1.55 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-video-card,
.chips-video-card * {
  box-sizing: border-box;
}

.chips-video-card__surface,
.chips-video-card__surface-button {
  width: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

.chips-video-card__surface-button {
  cursor: pointer;
}

.chips-video-card__surface-button:focus-visible {
  outline: 2px solid rgba(10, 132, 255, 0.6);
  outline-offset: 2px;
}

.chips-video-card__poster-shell {
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background:
    linear-gradient(160deg, rgba(242, 242, 247, 0.98), rgba(242, 242, 247, 0.96)),
    #f2f2f7;
  aspect-ratio: 16 / 9;
}

.chips-video-card__poster-shell .ant-image {
  display: block;
  width: 100%;
  height: 100%;
}

.chips-video-card__poster,
.chips-video-card__fallback-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #030712;
}

.chips-video-card__poster-skeleton {
  display: block;
  width: 100%;
  height: 100%;
}

.chips-video-card__poster-skeleton .ant-skeleton-image {
  width: 100%;
  height: 100%;
  border-radius: 0;
}

.chips-video-card__empty {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  padding: 20px;
  color: #1d1d1f;
  text-align: center;
}

.chips-video-card__empty .ant-empty {
  min-height: 100%;
  margin-block: 0;
}

.chips-video-card__empty-icon {
  font-size: 56px;
  line-height: 1;
  color: #c7c7cc;
}

.chips-video-card__empty-desc {
  color: #86868b;
}

.chips-video-card__overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.12);
  opacity: 0;
  transition:
    opacity 0.18s ease,
    background-color 0.18s ease;
}

.chips-video-card__surface-button:hover .chips-video-card__overlay,
.chips-video-card__surface-button:focus-visible .chips-video-card__overlay,
.chips-video-card__poster-shell:hover .chips-video-card__overlay {
  opacity: 1;
  background: rgba(0, 0, 0, 0.42);
}

.chips-video-card__play-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.56);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(8px);
}

.chips-video-card__play-icon {
  margin-left: 6px;
  font-size: 34px;
  color: rgba(255, 255, 255, 0.95);
}

.chips-video-card__info {
  display: grid;
  gap: 4px;
  padding: 12px 6px 0;
}

.chips-video-card__title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0;
  color: #1d1d1f;
}

.chips-video-card__meta {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #6e6e73;
}

.chips-video-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 6px 0;
}

.chips-video-card__badge {
  border-radius: 6px;
  margin-inline-end: 0;
}

.chips-video-card__badge--accent {
  background: rgba(10, 132, 255, 0.08);
  border-color: rgba(10, 132, 255, 0.2);
  color: #0a84ff;
}

.chips-video-card__badge--neutral {
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.08);
  color: #6e6e73;
}

@media (max-width: 560px) {
  .chips-video-card__play-badge {
    width: 60px;
    height: 60px;
  }
}
`;

export interface BasecardViewProps {
  config: BasecardConfig;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  openResource?: (input: {
    resourceId: string;
    mimeType?: string;
    title?: string;
    fileName?: string;
    payload?: VideoCardOpenPayload;
  }) => void;
}

function VideoFallbackPoster(props: { src: string }) {
  const { src } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    const handleLoadedMetadata = () => {
      const duration = Number.isFinite(element.duration) ? element.duration : 0;
      const targetTime = duration > 0.08 ? Math.min(0.08, duration / 2) : 0;

      if (targetTime <= 0) {
        element.pause();
        return;
      }

      try {
        element.currentTime = targetTime;
      } catch {
        element.pause();
      }
    };

    const handleSeeked = () => {
      element.pause();
    };

    element.addEventListener("loadedmetadata", handleLoadedMetadata);
    element.addEventListener("seeked", handleSeeked);

    return () => {
      element.removeEventListener("loadedmetadata", handleLoadedMetadata);
      element.removeEventListener("seeked", handleSeeked);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className="chips-video-card__fallback-video"
      src={src}
      preload="metadata"
      playsInline
      muted
      aria-hidden="true"
    />
  );
}

function buildOpenResourceDescriptor(
  resourceId: string,
  resourcePath: string,
  mimeType?: string,
): VideoCardOpenResource | null {
  const normalizedResourceId = resourceId.trim();
  const normalizedRelativePath = normalizeRelativeCardResourcePath(resourcePath);
  if (!normalizedResourceId || !normalizedRelativePath) {
    return null;
  }

  return {
    resourceId: normalizedResourceId,
    relativePath: normalizedRelativePath,
    fileName: resolveFileName(normalizedRelativePath) || undefined,
    mimeType,
  };
}

function buildVideoCardOpenPayload(input: {
  config: BasecardConfig;
  displayTitle: string;
}): VideoCardOpenPayload | null {
  const video = buildOpenResourceDescriptor(
    input.config.video_file,
    input.config.video_file,
    inferVideoMimeType(input.config.video_file),
  );
  if (!video) {
    return null;
  }

  const cover = buildOpenResourceDescriptor(input.config.cover_image, input.config.cover_image);
  const subtitles = input.config.subtitles
    .map((subtitle): VideoCardOpenSubtitleResource | null => {
      const resource = buildOpenResourceDescriptor(
        subtitle.file_path,
        subtitle.file_path,
        inferSubtitleMimeType(subtitle.file_path),
      );
      if (!resource) {
        return null;
      }

      return {
        ...resource,
        id: subtitle.id,
        label: subtitle.label || undefined,
        language: subtitle.language || undefined,
        kind: subtitle.kind,
        default: subtitle.default || undefined,
      };
    })
    .filter((subtitle): subtitle is VideoCardOpenSubtitleResource => subtitle !== null);

  return {
    kind: "chips.video-card",
    version: "1.0.0",
    cardType: "base.video",
    config: {
      card_type: "VideoCard",
      theme: input.config.theme || "",
      video_file: input.config.video_file,
      cover_image: input.config.cover_image,
      subtitles: input.config.subtitles.map((subtitle) => ({ ...subtitle })),
      playback: { ...input.config.playback },
      video_title: input.config.video_title,
      publish_time: input.config.publish_time,
      creator: input.config.creator,
    },
    resources: {
      video,
      ...(cover ? { cover } : undefined),
      ...(subtitles.length > 0 ? { subtitles } : undefined),
    },
    display: {
      title: input.displayTitle,
      creator: input.config.creator || undefined,
      publishTime: input.config.publish_time || undefined,
    },
    playback: {
      autoplay: input.config.playback.autoplay,
      loop: input.config.playback.loop,
      muted: input.config.playback.muted,
      playbackRate: input.config.playback.playback_rate,
      startTime: input.config.playback.start_time,
    },
  };
}

export function BasecardView({
  config,
  resolveResourceUrl,
  releaseResourceUrl,
  openResource,
}: BasecardViewProps) {
  const videoUrl = useResolvedResourceUrl(config.video_file, resolveResourceUrl, releaseResourceUrl);
  const coverUrl = useResolvedResourceUrl(config.cover_image, resolveResourceUrl, releaseResourceUrl);
  const displayTitle = deriveDisplayTitle(config);
  const metaLine = deriveMetaLine(config);
  const canOpen = Boolean(openResource && normalizeRelativeCardResourcePath(config.video_file));
  const openPayload = buildVideoCardOpenPayload({
    config,
    displayTitle,
  });
  const subtitleCount = config.subtitles.length;
  const coverConfigured = Boolean(normalizeRelativeCardResourcePath(config.cover_image));

  const posterSkeleton = (
    <div
      className="chips-video-card__poster-skeleton"
      role="status"
      aria-label={formatMessage("video.view.poster_loading")}
    >
      <Skeleton.Image active style={{ width: "100%", height: "100%", borderRadius: 0 }} />
    </div>
  );

  const content = (
    <>
      <div className="chips-video-card__poster-shell">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={displayTitle}
            preview={false}
            className="chips-video-card__poster"
            loading="lazy"
          />
        ) : coverConfigured ? (
          posterSkeleton
        ) : videoUrl ? (
          <VideoFallbackPoster src={videoUrl} />
        ) : (
          posterSkeleton
        )}

        <div className="chips-video-card__overlay" aria-hidden="true">
          <span className="chips-video-card__play-badge">
            <CaretRightFilled className="chips-video-card__play-icon" aria-hidden="true" />
          </span>
        </div>
      </div>

      {subtitleCount > 0 || config.playback.loop || config.playback.autoplay ? (
        <div className="chips-video-card__badges">
          {subtitleCount > 0 ? (
            <Tag className="chips-video-card__badge chips-video-card__badge--accent">
              {formatMessage("video.view.badge_subtitles", { count: subtitleCount })}
            </Tag>
          ) : null}
          {config.playback.loop ? (
            <Tag className="chips-video-card__badge chips-video-card__badge--neutral">
              {formatMessage("video.view.badge_loop")}
            </Tag>
          ) : null}
          {config.playback.autoplay ? (
            <Tag className="chips-video-card__badge chips-video-card__badge--neutral">
              {formatMessage("video.view.badge_autoplay")}
            </Tag>
          ) : null}
        </div>
      ) : null}

      {displayTitle || metaLine ? (
        <div className="chips-video-card__info">
          {config.video_title.trim() ? <p className="chips-video-card__title">{config.video_title.trim()}</p> : null}
          {metaLine ? <p className="chips-video-card__meta">{metaLine}</p> : null}
        </div>
      ) : null}
    </>
  );

  if (!normalizeRelativeCardResourcePath(config.video_file)) {
    return (
      <div className="chips-video-card" data-card-type={config.card_type}>
        <div className="chips-video-card__poster-shell">
          <div className="chips-video-card__empty">
            <Empty
              image={<VideoCameraOutlined className="chips-video-card__empty-icon" />}
              styles={{ image: { height: "auto" } }}
              description={<span className="chips-video-card__empty-desc">{formatMessage("video.view.empty")}</span>}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chips-video-card" data-card-type={config.card_type}>
      {canOpen ? (
        <button
          type="button"
          className="chips-video-card__surface-button"
          onClick={() => {
            const resourceId = normalizeRelativeCardResourcePath(config.video_file);
            if (!resourceId) {
              return;
            }
            openResource?.({
              resourceId,
              mimeType: inferVideoMimeType(config.video_file),
              title: displayTitle || undefined,
              fileName: resolveFileName(config.video_file) || undefined,
              payload: openPayload || undefined,
            });
          }}
          aria-label={
            displayTitle
              ? formatMessage("video.view.open_named", { title: displayTitle })
              : formatMessage("video.view.open")
          }
        >
          {content}
        </button>
      ) : (
        <div className="chips-video-card__surface">{content}</div>
      )}
    </div>
  );
}
