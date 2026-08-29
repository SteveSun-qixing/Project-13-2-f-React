import React, { useEffect, useState } from "react";
import { Empty, Image } from "antd";
import { FileOutlined } from "@ant-design/icons";
import type { BasecardOpenResourceInput } from "../index";
import type { BasecardConfig } from "../schema/card-config";
import { formatMessage } from "../lib/messages";
import { inferFileMimeType, resolveFileCategory } from "../shared/file-types";
import { resolveCategoryCoverUrl } from "../shared/default-covers";
import {
  deriveFileStem,
  formatExtensionBadge,
  normalizeRelativeCardResourcePath,
  resolveFileName,
  resolveFileExtension,
  resolveResourceUrlWithRetry,
} from "../shared/utils";

export const VIEW_STYLE_TEXT = `
.chips-file-card {
  width: 100%;
  color: #1d1d1f;
  font: 14px/1.5 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-file-card,
.chips-file-card * {
  box-sizing: border-box;
}

.chips-file-card__surface,
.chips-file-card__surface-button {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 108px;
  padding: 12px 14px;
  border: none;
  border-radius: 12px;
  background: rgba(242, 242, 247, 0.94);
}

.chips-file-card__surface-button {
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-align: left;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.chips-file-card__surface-button:hover {
  background: #e8e8ed;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.chips-file-card__surface-button:focus-visible {
  outline: 2px solid rgba(10, 132, 255, 0.6);
  outline-offset: 2px;
}

.chips-file-card__surface-button:active {
  background: #dcdce1;
}

.chips-file-card__cover {
  position: relative;
  flex: 0 0 88px;
  width: 88px;
  height: 88px;
  min-width: 88px;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.88);
}

.chips-file-card__cover-image {
  display: block;
  margin: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chips-file-card__cover-fallback {
  display: block;
  width: 100%;
  height: 100%;
}

.chips-file-card__content {
  flex: 1;
  min-width: 0;
}

.chips-file-card__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.chips-file-card__name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.chips-file-card__extension {
  margin: 0;
  color: #6e6e73;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chips-file-card__empty {
  min-height: 108px;
  border-radius: 12px;
  background: rgba(242, 242, 247, 0.94);
  color: #6e6e73;
  text-align: center;
}

.chips-file-card__empty .ant-empty {
  min-height: 106px;
  padding: 20px;
  background: transparent;
}

.chips-file-card__empty-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
}

.chips-file-card__empty-description {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: #6e6e73;
}

@media (max-width: 560px) {
  .chips-file-card__surface,
  .chips-file-card__surface-button {
    gap: 12px;
    min-height: 92px;
    padding: 10px 12px;
    border-radius: 12px;
  }

  .chips-file-card__cover {
    flex-basis: 72px;
    width: 72px;
    height: 72px;
    min-width: 72px;
    border-radius: 14px;
  }

  .chips-file-card__name {
    font-size: 16px;
  }
}
`;

interface FileBasecardViewProps {
  config: BasecardConfig;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  openResource?: (input: BasecardOpenResourceInput) => void;
}

function ExtensionBadgeCover({ badge }: { badge: string }) {
  const fontSize = badge.length > 3 ? 13 : 17;

  return (
    <svg
      className="chips-file-card__cover-fallback"
      viewBox="0 0 96 96"
      role="img"
      aria-label={badge}
    >
      <path
        d="M28 12h26l14 14v54a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4Z"
        fill="#ffffff"
        stroke="#c7c7cc"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M54 12v14h14"
        fill="none"
        stroke="#c7c7cc"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {badge ? (
        <text
          x="48"
          y="56"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fontWeight="700"
          fill="#6e6e73"
          fontFamily='"SF Pro Text", "PingFang SC", sans-serif'
        >
          {badge}
        </text>
      ) : null}
    </svg>
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

export function FileBasecardView({
  config,
  resolveResourceUrl,
  releaseResourceUrl,
  openResource,
}: FileBasecardViewProps) {
  const filePath = normalizeRelativeCardResourcePath(config.file_file) ?? "";
  const extension = config.file_extension || resolveFileExtension(config.file_file);
  const extensionBadge = formatExtensionBadge(extension);
  const displayFileName = config.file_name || deriveFileStem(config.file_file)
    || formatMessage("file.view.unnamed");
  const categoryCoverUrl = resolveCategoryCoverUrl(resolveFileCategory(extension));
  const customCoverUrl = useResolvedResourceUrl(
    config.cover_image,
    resolveResourceUrl,
    releaseResourceUrl,
  );

  const displayCoverUrl = customCoverUrl || categoryCoverUrl;
  const canOpen = Boolean(openResource && filePath);

  const content = (
    <>
      <div className="chips-file-card__cover" aria-hidden="true">
        {displayCoverUrl ? (
          <Image
            className="chips-file-card__cover-image"
            src={displayCoverUrl}
            alt={displayFileName}
            preview={false}
            loading="lazy"
          />
        ) : (
          <ExtensionBadgeCover badge={extensionBadge} />
        )}
      </div>

      <div className="chips-file-card__content">
        <div className="chips-file-card__main">
          <h2 className="chips-file-card__name">{displayFileName}</h2>
          <p className="chips-file-card__extension">
            {extensionBadge || formatMessage("file.view.no_extension")}
          </p>
        </div>
      </div>
    </>
  );

  if (!filePath) {
    return (
      <div className="chips-file-card">
        <div className="chips-file-card__empty">
          <Empty
            className="chips-file-card__empty-state"
            image={<FileOutlined aria-hidden={true} style={{ fontSize: 42, color: "#86868b" }} />}
            description={
              <>
                <span className="chips-file-card__empty-title">
                  {formatMessage("file.view.unnamed")}
                </span>
                <span className="chips-file-card__empty-description">
                  {formatMessage("file.view.empty")}
                </span>
              </>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="chips-file-card" data-card-type={config.card_type}>
      {canOpen ? (
        <button
          type="button"
          className="chips-file-card__surface-button"
          onClick={() => {
            openResource?.({
              resourceId: filePath,
              mimeType: inferFileMimeType(extension),
              title: displayFileName,
              fileName: resolveFileName(config.file_file),
            });
          }}
          aria-label={extensionBadge
            ? formatMessage("file.view.openExtension", { extension: extensionBadge })
            : formatMessage("file.view.open", { title: displayFileName })}
        >
          {content}
        </button>
      ) : (
        <div className="chips-file-card__surface">
          {content}
        </div>
      )}
    </div>
  );
}
