import React, { useEffect, useState } from "react";
import { Empty, Image } from "antd";
import type { MusicCardOpenPayload, MusicCardOpenResource } from "chips-sdk";
import type { BasecardConfig } from "../schema/card-config";
import { DEFAULT_MUSIC_COVER_URL } from "../shared/default-cover";
import { formatMessage } from "../lib/messages";
import {
  deriveDisplayTitle,
  derivePrimaryArtist,
  inferAudioMimeType,
  normalizeRelativeCardResourcePath,
  resolveResourceUrlWithRetry,
  resolveFileName,
} from "../shared/utils";

export const VIEW_STYLE_TEXT = `
.chips-music-card {
  width: 100%;
  color: #1d1d1f;
  font: 14px/1.5 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-music-card,
.chips-music-card * {
  box-sizing: border-box;
}

.chips-music-card__surface,
.chips-music-card__surface-button {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 108px;
  padding: 12px 14px;
  border: none;
  border-radius: 20px;
  background: rgba(242, 242, 247, 0.94);
}

.chips-music-card__surface-button {
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-align: left;
  appearance: none;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color 0.16s ease;
}

.chips-music-card__surface-button:hover,
.chips-music-card__surface-button:focus-visible {
  background: rgba(242, 242, 247, 0.98);
  outline: none;
}

.chips-music-card__cover {
  position: relative;
  flex: 0 0 88px;
  width: 88px;
  height: 88px;
  min-width: 88px;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.88);
}

.chips-music-card__cover-image {
  display: block;
  margin: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chips-music-card__content {
  flex: 1;
  min-width: 0;
}

.chips-music-card__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.chips-music-card__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chips-music-card__artist {
  margin: 0;
  color: #6e6e73;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chips-music-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 2px;
}

.chips-music-card__meta-item {
  color: #6e6e73;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.chips-music-card__empty {
  min-height: 108px;
  border-radius: 20px;
  border: 1px dashed rgba(0, 0, 0, 0.14);
  color: #6e6e73;
  background: #ffffff;
  text-align: center;
}

.chips-music-card__empty .ant-empty {
  min-height: 106px;
  padding: 20px;
  background: transparent;
}

.chips-music-card__empty-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
}

.chips-music-card__empty-description {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: #6e6e73;
}

@media (max-width: 560px) {
  .chips-music-card__surface,
  .chips-music-card__surface-button {
    gap: 12px;
    min-height: 92px;
    padding: 10px 12px;
    border-radius: 16px;
  }

  .chips-music-card__cover {
    flex-basis: 72px;
    width: 72px;
    height: 72px;
    min-width: 72px;
    border-radius: 14px;
  }

  .chips-music-card__title {
    font-size: 16px;
  }
}
`;

interface MusicBasecardViewProps {
  config: BasecardConfig;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  openResource?: (input: {
    resourceId: string;
    mimeType?: string;
    title?: string;
    fileName?: string;
    payload?: MusicCardOpenPayload;
  }) => void;
}

function cloneProductionTeam(config: BasecardConfig): MusicCardOpenPayload["config"]["production_team"] {
  return config.production_team.map((role) => ({
    id: role.id,
    role: role.role,
    people: [...role.people],
  }));
}

function buildOpenResourceDescriptor(
  resourceId: string,
  resourcePath: string,
  mimeType?: string,
): MusicCardOpenResource | null {
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

function buildMusicCardOpenPayload(input: {
  config: BasecardConfig;
  audioUrl: string;
  coverUrl: string;
  lyricsUrl: string;
  displayTitle: string;
  artistLabel: string;
}): MusicCardOpenPayload | null {
  const audio = buildOpenResourceDescriptor(
    input.audioUrl,
    input.config.audio_file,
    inferAudioMimeType(input.config.audio_file),
  );
  if (!audio) {
    return null;
  }

  const cover = buildOpenResourceDescriptor(input.coverUrl, input.config.album_cover);
  const lyrics = buildOpenResourceDescriptor(input.lyricsUrl, input.config.lyrics_file);

  return {
    kind: "chips.music-card",
    version: "1.0.0",
    cardType: "base.music",
    config: {
      card_type: "MusicCard",
      theme: input.config.theme || "",
      audio_file: input.config.audio_file,
      music_name: input.config.music_name,
      album_cover: input.config.album_cover,
      lyrics_file: input.config.lyrics_file,
      production_team: cloneProductionTeam(input.config),
      release_date: input.config.release_date,
      album_name: input.config.album_name,
      language: input.config.language,
      genre: input.config.genre,
    },
    resources: {
      audio,
      ...(cover ? { cover } : undefined),
      ...(lyrics ? { lyrics } : undefined),
    },
    display: {
      title: input.displayTitle,
      artist: input.artistLabel,
    },
  };
}

function MetaItem(props: { children: React.ReactNode }) {
  const { children } = props;

  return (
    <span className="chips-music-card__meta-item">{children}</span>
  );
}

function useResolvedResourceUrl(
  resourcePath: string,
  resolveResourceUrl?: (resourcePath: string) => Promise<string>,
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void,
): string {
  const [resolvedUrl, setResolvedUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    const normalizedPath = normalizeRelativeCardResourcePath(resourcePath);

    if (!normalizedPath || !resolveResourceUrl) {
      setResolvedUrl(normalizedPath ?? "");
      return undefined;
    }

    setResolvedUrl("");

    void resolveResourceUrlWithRetry(resolveResourceUrl, normalizedPath)
      .then((nextUrl) => {
        if (!cancelled) {
          setResolvedUrl(nextUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedUrl("");
        }
      });

    return () => {
      cancelled = true;
      void Promise.resolve(releaseResourceUrl?.(normalizedPath)).catch(() => undefined);
    };
  }, [releaseResourceUrl, resolveResourceUrl, resourcePath]);

  return resolvedUrl;
}

export function MusicBasecardView({
  config,
  resolveResourceUrl,
  releaseResourceUrl,
  openResource,
}: MusicBasecardViewProps) {
  const audioUrl = useResolvedResourceUrl(config.audio_file, resolveResourceUrl, releaseResourceUrl);
  const coverUrl = useResolvedResourceUrl(config.album_cover, resolveResourceUrl, releaseResourceUrl);
  const lyricsUrl = useResolvedResourceUrl(config.lyrics_file, resolveResourceUrl, releaseResourceUrl);
  const displayCoverUrl = coverUrl || DEFAULT_MUSIC_COVER_URL;
  const displayTitle = deriveDisplayTitle(config) || formatMessage("music.view.untitled");
  const artistLabel = derivePrimaryArtist(config) || formatMessage("music.view.artistFallback");
  const canOpen = Boolean(openResource && audioUrl);
  const openPayload = buildMusicCardOpenPayload({
    config,
    audioUrl,
    coverUrl,
    lyricsUrl,
    displayTitle,
    artistLabel,
  });

  const metaItems = [
    config.album_name ? formatMessage("music.view.meta.album", { value: config.album_name }) : "",
    config.language ? formatMessage("music.view.meta.language", { value: config.language }) : "",
    config.genre ? formatMessage("music.view.meta.genre", { value: config.genre }) : "",
    config.release_date ? formatMessage("music.view.meta.release_date", { value: config.release_date }) : "",
  ].filter((item) => item.length > 0);

  const content = (
    <>
      <div className="chips-music-card__cover" aria-hidden="true">
        <Image
          className="chips-music-card__cover-image"
          src={displayCoverUrl}
          alt={displayTitle}
          preview={false}
          loading="lazy"
        />
      </div>

      <div className="chips-music-card__content">
        <div className="chips-music-card__main">
          <h2 className="chips-music-card__title">{displayTitle}</h2>
          <p className="chips-music-card__artist">{artistLabel}</p>
          {metaItems.length > 0 ? (
            <div className="chips-music-card__meta">
              {metaItems.map((item) => (
                <MetaItem key={item}>{item}</MetaItem>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  if (!normalizeRelativeCardResourcePath(config.audio_file)) {
    return (
      <div className="chips-music-card">
        <div className="chips-music-card__empty">
          <Empty
            className="chips-music-card__empty-state"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <>
                <span className="chips-music-card__empty-title">
                  {formatMessage("music.view.untitled")}
                </span>
                <span className="chips-music-card__empty-description">
                  {formatMessage("music.view.empty")}
                </span>
              </>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="chips-music-card" data-card-type={config.card_type}>
      {canOpen ? (
        <button
          type="button"
          className="chips-music-card__surface-button"
          onClick={() => {
            openResource?.({
              resourceId: audioUrl,
              mimeType: inferAudioMimeType(config.audio_file),
              title: displayTitle,
              fileName: resolveFileName(config.audio_file),
              ...(openPayload ? { payload: openPayload } : undefined),
            });
          }}
          aria-label={formatMessage("music.view.open", { title: displayTitle })}
        >
          {content}
        </button>
      ) : (
        <div className="chips-music-card__surface">
          {content}
        </div>
      )}
    </div>
  );
}
