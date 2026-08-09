import React, { useEffect, useMemo, useState } from "react";
import { Button, Empty, Image, Tag } from "antd";
import { ReadOutlined } from "@ant-design/icons";
import type { BasecardConfig } from "../schema/card-config";
import { formatMessage } from "../lib/messages";
import {
  buildOpenResourceDescriptor,
  deriveDisplayAuthor,
  deriveDisplayTitle,
  formatBookFormatLabel,
  inferBookMimeType,
  inferImageMimeTypeFromPath,
  isNonEmptyString,
  normalizeRelativeCardResourcePath,
  resolveFileName,
  resolveResourceUrlWithRetry,
  sortImageItems,
  type BookCardOpenPayload,
  type BookOpenResource,
} from "../shared/utils";

export const VIEW_STYLE_TEXT = `
.chips-book-card {
  --chips-book-card-focus-ring: rgba(10, 132, 255, 0.18);
  --chips-book-card-cover-shadow: 0 12px 26px rgba(0, 0, 0, 0.12);
  width: 100%;
  color: #1d1d1f;
  font: 14px/1.5 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-book-card,
.chips-book-card * {
  box-sizing: border-box;
}

.chips-book-card__surface,
.chips-book-card__button {
  display: flex;
  align-items: stretch;
  justify-content: flex-start;
  gap: clamp(16px, 4vw, 28px);
  width: 100%;
  min-height: 184px;
  padding: clamp(16px, 4vw, 28px);
  border: 0;
  border-radius: 8px;
  background: #f2f2f7;
}

.chips-book-card__button {
  color: inherit;
  font: inherit;
  text-align: left;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.chips-book-card__button > span {
  display: flex;
  align-items: stretch;
  gap: inherit;
  width: 100%;
  min-width: 0;
}

.chips-book-card__button:hover {
  background: #f2f2f7;
}

.chips-book-card__button:focus-visible {
  background: #f2f2f7;
  box-shadow: 0 0 0 3px var(--chips-book-card-focus-ring);
}

.chips-book-card__cover {
  position: relative;
  align-self: center;
  flex: 0 0 clamp(112px, 32%, 190px);
  width: clamp(112px, 32%, 190px);
  min-width: 112px;
  height: auto;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: var(--chips-book-card-cover-shadow);
}

.chips-book-card__cover .ant-image {
  display: block;
  width: 100%;
  height: 100%;
}

.chips-book-card__cover-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chips-book-card__cover-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  padding: 8px;
  color: #6e6e73;
  background: #f2f2f7;
}

.chips-book-card__cover-placeholder-icon {
  font-size: 42px;
}

.chips-book-card__content {
  display: grid;
  align-content: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  padding: 4px 0;
}

.chips-book-card__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.25;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.chips-book-card__author {
  margin: 0;
  color: #6e6e73;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chips-book-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.chips-book-card__meta-item {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: #ffffff;
  color: #6e6e73;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.chips-book-card__empty {
  min-height: 116px;
  border-radius: 8px;
  border: 0;
  color: #6e6e73;
  background: #f2f2f7;
  text-align: center;
}

.chips-book-card__empty-copy {
  display: grid;
  gap: 2px;
}

.chips-book-card__empty-title {
  font-weight: 700;
}

.chips-book-card__empty-description {
  color: #6e6e73;
  font-size: 12px;
}

@media (max-width: 560px) {
  .chips-book-card__surface,
  .chips-book-card__button {
    gap: 14px;
    min-height: 150px;
    padding: 14px;
  }

  .chips-book-card__cover {
    flex-basis: min(36%, 128px);
    width: min(36%, 128px);
    min-width: 96px;
  }

  .chips-book-card__title {
    font-size: 16px;
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
    payload?: BookCardOpenPayload;
  }) => void;
}

function useResolvedResources(
  resourcePaths: string[],
  resolveResourceUrl?: (resourcePath: string) => Promise<string>,
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void,
): Map<string, string> {
  const [resolved, setResolved] = useState<Map<string, string>>(new Map());
  const resourceKey = resourcePaths.join("\n");
  const normalizedPaths = useMemo(() => (
    Array.from(new Set(resourcePaths
      .map((path) => normalizeRelativeCardResourcePath(path))
      .filter((path): path is string => Boolean(path))))
  ), [resourceKey]);

  useEffect(() => {
    let cancelled = false;
    const next = new Map<string, string>();

    async function resolveAll() {
      for (const resourcePath of normalizedPaths) {
        if (!resolveResourceUrl) {
          next.set(resourcePath, resourcePath);
          continue;
        }

        try {
          next.set(resourcePath, await resolveResourceUrlWithRetry(resolveResourceUrl, resourcePath));
        } catch {
          next.set(resourcePath, "");
        }
      }

      if (!cancelled) {
        setResolved(next);
      }
    }

    void resolveAll();

    return () => {
      cancelled = true;
      if (releaseResourceUrl && resolveResourceUrl) {
        for (const resourcePath of normalizedPaths) {
          void releaseResourceUrl(resourcePath);
        }
      }
    };
  }, [normalizedPaths, releaseResourceUrl, resolveResourceUrl]);

  return resolved;
}

function MetaItem(props: { children: React.ReactNode }) {
  return (
    <Tag className="chips-book-card__meta-item">
      {props.children}
    </Tag>
  );
}

function Cover(props: { src: string; alt: string }) {
  if (props.src) {
    return (
      <Image
        className="chips-book-card__cover-image"
        src={props.src}
        alt={props.alt}
        preview={false}
        loading="lazy"
        draggable={false}
      />
    );
  }

  return (
    <div className="chips-book-card__cover-placeholder" aria-hidden="true">
      <ReadOutlined className="chips-book-card__cover-placeholder-icon" aria-hidden={true} />
    </div>
  );
}

function createImagePayload(input: {
  config: BasecardConfig;
  title: string;
  author: string;
}): BookCardOpenPayload | null {
  const images = sortImageItems(input.config.image_sequence, input.config.image_sort_basis)
    .map((image) => buildOpenResourceDescriptor(
      image.file_path,
      image.file_path,
      image.mime_type || inferImageMimeTypeFromPath(image.file_path),
    ))
    .filter((item): item is BookOpenResource => item !== null);

  if (images.length === 0) {
    return null;
  }

  return {
    kind: "chips.book-card",
    version: "1.0.0",
    cardType: "base.book",
    mode: "image-sequence",
    resources: {
      images,
    },
    display: {
      title: input.title,
      author: input.author,
    },
  };
}

function createEbookPayload(input: {
  config: BasecardConfig;
  title: string;
  author: string;
}): BookCardOpenPayload | null {
  const book = buildOpenResourceDescriptor(
    input.config.book_file,
    input.config.book_file,
    inferBookMimeType(input.config.book_format || input.config.book_file),
  );

  if (!book) {
    return null;
  }

  return {
    kind: "chips.book-card",
    version: "1.0.0",
    cardType: "base.book",
    mode: "ebook",
    resources: {
      book,
    },
    display: {
      title: input.title,
      author: input.author,
    },
  };
}

export function BasecardView({
  config,
  resolveResourceUrl,
  releaseResourceUrl,
  openResource,
}: BasecardViewProps) {
  const sortedImages = useMemo(
    () => sortImageItems(config.image_sequence, config.image_sort_basis),
    [config.image_sequence, config.image_sort_basis],
  );
  const coverPath = config.cover_image || sortedImages[0]?.file_path || "";
  const resourcePaths = [
    config.book_file,
    coverPath,
    ...sortedImages.map((image) => image.file_path),
  ];
  const resolvedUrls = useResolvedResources(resourcePaths, resolveResourceUrl, releaseResourceUrl);
  const title = deriveDisplayTitle(config, formatMessage("view.untitled"));
  const author = deriveDisplayAuthor(config, formatMessage("view.unknown_author"));
  const coverUrl = coverPath ? (resolvedUrls.get(coverPath) || coverPath) : "";
  const hasPrimaryResource = config.source_type === "image-sequence"
    ? sortedImages.length > 0
    : isNonEmptyString(config.book_file);
  const formatLabel = formatBookFormatLabel(config);

  const handleOpen = () => {
    if (!openResource || !hasPrimaryResource) {
      return;
    }

    if (config.source_type === "image-sequence") {
      const firstImage = sortedImages[0];
      if (!firstImage) {
        return;
      }

      const payload = createImagePayload({
        config,
        title,
        author,
      });
      if (!payload) {
        return;
      }

      openResource({
        resourceId: firstImage.file_path,
        mimeType: firstImage.mime_type || inferImageMimeTypeFromPath(firstImage.file_path),
        title,
        fileName: resolveFileName(firstImage.file_path),
        payload,
      });
      return;
    }

    const payload = createEbookPayload({
      config,
      title,
      author,
    });
    if (!payload) {
      return;
    }

    openResource({
      resourceId: config.book_file,
      mimeType: inferBookMimeType(config.book_format || config.book_file),
      title,
      fileName: resolveFileName(config.book_file),
      payload,
    });
  };

  if (!hasPrimaryResource) {
    return (
      <div className="chips-book-card" data-card-type={config.card_type}>
        <Empty
          className="chips-book-card__empty"
          aria-label={formatMessage("view.empty")}
          image={<ReadOutlined aria-hidden={true} style={{ fontSize: 42, color: "#6e6e73" }} />}
          description={
            <span className="chips-book-card__empty-copy">
              <span className="chips-book-card__empty-title">{formatMessage("view.empty")}</span>
              <span className="chips-book-card__empty-description">{formatMessage("view.empty_description")}</span>
            </span>
          }
        />
      </div>
    );
  }

  const content = (
    <>
      <div className="chips-book-card__cover">
        <Cover src={coverUrl} alt={title} />
      </div>
      <div className="chips-book-card__content">
        <h2 className="chips-book-card__title">{title}</h2>
        <p className="chips-book-card__author">{author}</p>
        <div className="chips-book-card__meta">
          {formatLabel ? <MetaItem>{formatLabel}</MetaItem> : null}
          {config.source_type === "image-sequence" ? (
            <MetaItem>{formatMessage("view.image_count", { count: sortedImages.length })}</MetaItem>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <div className="chips-book-card" data-card-type={config.card_type}>
      {openResource ? (
        <Button
          type="text"
          className="chips-book-card__button"
          onClick={handleOpen}
        >
          {content}
        </Button>
      ) : (
        <div className="chips-book-card__surface">{content}</div>
      )}
    </div>
  );
}
