import React, { useMemo } from "react";
import { Button, Empty, Image, Tag } from "antd";
import { ReadOutlined } from "@ant-design/icons";
import type { BasecardConfig } from "../schema/card-config";
import { formatMessage } from "../lib/messages";
import { useResolvedResourceMap } from "../shared/use-resolved-resources";
import {
  buildOpenResourceDescriptor,
  deriveDisplayAuthor,
  deriveDisplayTitle,
  formatBookFormatLabel,
  inferBookMimeType,
  inferImageMimeTypeFromPath,
  isNonEmptyString,
  resolveFileName,
  sortImageItems,
  type BookCardOpenPayload,
  type BookOpenResource,
} from "../shared/utils";

const COVER_FALLBACK_IMAGE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="192" viewBox="0 0 128 192">',
      '<rect width="128" height="192" rx="8" fill="#f2f2f7"/>',
      '<g transform="translate(16 48) scale(0.1154)" fill="#6e6e73">',
      '<path d="M928 161H699.2c-49.1 0-97.1 14.1-138.4 40.7L512 233l-48.8-31.3A255.2 255.2 0 0 0 324.8 161H96c-17.7 0-32 14.3-32 32v568c0 17.7 14.3 32 32 32h228.8c49.1 0 97.1 14.1 138.4 40.7l44.4 28.6c1.3.8 2.8 1.3 4.3 1.3s3-.4 4.3-1.3l44.4-28.6C602 807.1 650.1 793 699.2 793H928c17.7 0 32-14.3 32-32V193c0-17.7-14.3-32-32-32zM324.8 721H136V233h188.8c35.4 0 69.8 10.1 99.5 29.2l48.8 31.3 6.9 4.5v462c-47.6-25.6-100.8-39-155.2-39zm563.2 0H699.2c-54.4 0-107.6 13.4-155.2 39V298l6.9-4.5 48.8-31.3c29.7-19.1 64.1-29.2 99.5-29.2H888v488zM396.9 361H211.1c-3.9 0-7.1 3.4-7.1 7.5v45c0 4.1 3.2 7.5 7.1 7.5h185.7c3.9 0 7.1-3.4 7.1-7.5v-45c.1-4.1-3.1-7.5-7-7.5zm223.1 7.5v45c0 4.1 3.2 7.5 7.1 7.5h185.7c3.9 0 7.1-3.4 7.1-7.5v-45c0-4.1-3.2-7.5-7.1-7.5H627.1c-3.9 0-7.1 3.4-7.1 7.5zM396.9 501H211.1c-3.9 0-7.1 3.4-7.1 7.5v45c0 4.1 3.2 7.5 7.1 7.5h185.7c3.9 0 7.1-3.4 7.1-7.5v-45c.1-4.1-3.1-7.5-7-7.5zm416 0H627.1c-3.9 0-7.1 3.4-7.1 7.5v45c0 4.1 3.2 7.5 7.1 7.5h185.7c3.9 0 7.1-3.4 7.1-7.5v-45c.1-4.1-3.1-7.5-7-7.5z"/>',
      "</g>",
      "</svg>",
    ].join(""),
  );

export const VIEW_STYLE_TEXT = `
.chips-book-card {
  --chips-book-card-focus-ring: rgba(10, 132, 255, 0.18);
  --chips-book-card-cover-shadow: 0 12px 26px rgba(0, 0, 0, 0.12);
  width: 100%;
  color: #1d1d1f;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
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
  background: #ebebed;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06);
}

.chips-book-card__button:active {
  background: #e4e4e8;
  box-shadow: none;
  transform: translateY(1px);
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

.chips-book-card__meta .ant-tag {
  margin-inline-end: 0;
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
        classNames={{ image: "chips-book-card__cover-image" }}
        src={props.src}
        alt={props.alt}
        preview={false}
        fallback={COVER_FALLBACK_IMAGE}
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
  const resolvedUrls = useResolvedResourceMap(
    coverPath ? [coverPath] : [],
    resolveResourceUrl,
    releaseResourceUrl,
  );
  const coverUrl = coverPath ? (resolvedUrls.get(coverPath) ?? "") : "";
  const title = deriveDisplayTitle(config, formatMessage("view.untitled"));
  const author = deriveDisplayAuthor(config, formatMessage("view.unknown_author"));
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
