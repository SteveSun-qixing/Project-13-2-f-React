import React, { useEffect, useMemo, useRef, useState } from "react";
import type { BasecardConfig, GridMode, ImageItem } from "../schema/card-config";
import { defaultLayoutOptions } from "../schema/card-config";
import { formatMessage } from "../lib/messages";
import {
  getEffectiveLayoutType,
  getImageDisplaySource,
  getSpacingMetrics,
  normalizeRelativeCardResourcePath,
} from "../shared/utils";

const MAX_RESOURCE_RETRY_COUNT = 3;

export const VIEW_STYLE_TEXT = `
.chips-image-card {
  width: 100%;
  color: #1d1d1f;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-image-card *,
.chips-image-card *::before,
.chips-image-card *::after {
  box-sizing: border-box;
}

.chips-image-card__surface {
  width: 100%;
}

.chips-image-card__empty {
  display: grid;
  place-items: center;
  min-height: 220px;
  border: 1px dashed rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background:
    radial-gradient(circle at top, rgba(10, 132, 255, 0.09), transparent 52%),
    #ffffff;
  color: #6e6e73;
}

.chips-image-card__empty-text {
  padding: 20px;
  text-align: center;
}

.chips-image-card__single {
  display: flex;
  width: 100%;
}

.chips-image-card__image-frame {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.02)),
    #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06);
}

.chips-image-card__image-frame--interactive {
  cursor: pointer;
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.chips-image-card__image-frame--interactive:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05), 0 8px 20px rgba(0, 0, 0, 0.10);
}

.chips-image-card__image-frame--interactive:active {
  transform: scale(0.99);
}

.chips-image-card__image-frame--interactive:focus-visible {
  outline: 2px solid rgba(10, 132, 255, 0.6);
  outline-offset: 2px;
}

.chips-image-card__image {
  display: block;
  width: 100%;
  height: auto;
  object-fit: cover;
  user-select: none;
}

.chips-image-card__image--fill {
  height: 100%;
}

.chips-image-card__image--dimmed {
  filter: brightness(0.48);
}

.chips-image-card__placeholder {
  display: grid;
  place-items: center;
  min-height: 180px;
  padding: 20px;
  color: #6e6e73;
  text-align: center;
}

.chips-image-card__grid {
  display: grid;
  width: 100%;
}

.chips-image-card__grid-cell {
  position: relative;
  min-width: 0;
}

.chips-image-card__grid-cell .chips-image-card__image-frame {
  aspect-ratio: 1 / 1;
}

.chips-image-card__overflow-badge {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.62));
}

.chips-image-card__long-scroll {
  width: 100%;
}

.chips-image-card__long-scroll-stack {
  display: flex;
  flex-direction: column;
}

.chips-image-card__long-scroll-stack .chips-image-card__image-frame {
  width: 100%;
}

.chips-image-card__horizontal {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
}

.chips-image-card__horizontal::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.chips-image-card__horizontal::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.chips-image-card__horizontal::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.chips-image-card__horizontal::-webkit-scrollbar-track {
  background: transparent;
}

.chips-image-card__horizontal-track {
  display: flex;
  align-items: stretch;
  width: max-content;
  min-width: 100%;
}

.chips-image-card__horizontal-item {
  flex: 0 0 auto;
  width: min(76vw, 560px);
}

.chips-image-card__horizontal-item .chips-image-card__image-frame {
  width: 100%;
  height: 100%;
}
`;

interface ImageCardViewProps {
  config: BasecardConfig;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  openResource?: (input: {
    resourceId: string;
    mimeType?: string;
    title?: string;
    fileName?: string;
  }) => void;
}

function ImageFrame(props: {
  image: ImageItem;
  src: string;
  fillHeight?: boolean;
  dimmed?: boolean;
  placeholderText: string;
  aspectRatio?: string;
  radius: number;
  onResourceError?: () => void;
  onOpenResource?: () => void;
  canOpenResource?: boolean;
}) {
  const {
    image,
    src,
    fillHeight = false,
    dimmed = false,
    placeholderText,
    aspectRatio,
    radius,
    onResourceError,
    onOpenResource,
    canOpenResource = false,
  } = props;
  const [loadFailed, setLoadFailed] = useState(false);
  const isInteractive = canOpenResource && typeof onOpenResource === "function" && src.trim().length > 0;

  useEffect(() => {
    setLoadFailed(false);
  }, [src]);

  return (
    <div
      className={[
        "chips-image-card__image-frame",
        isInteractive ? "chips-image-card__image-frame--interactive" : "",
      ].filter(Boolean).join(" ")}
      style={{
        ...(aspectRatio ? { aspectRatio } : undefined),
        borderRadius: `${radius}px`,
      }}
      {...(isInteractive
        ? {
            role: "button",
            tabIndex: 0,
            onClick: onOpenResource,
            onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenResource?.();
              }
            },
          }
        : undefined)}
    >
      {src && !loadFailed ? (
        <img
          src={src}
          alt={image.alt ?? ""}
          title={image.title ?? ""}
          className={[
            "chips-image-card__image",
            fillHeight ? "chips-image-card__image--fill" : "",
            dimmed ? "chips-image-card__image--dimmed" : "",
          ].filter(Boolean).join(" ")}
          onError={() => {
            setLoadFailed(true);
            onResourceError?.();
          }}
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="chips-image-card__placeholder">{placeholderText}</div>
      )}
    </div>
  );
}

function getGridColumns(gridMode: GridMode): number {
  if (gridMode === "2x2") {
    return 2;
  }

  return 3;
}

function getGridDisplayLimit(gridMode: GridMode): number {
  switch (gridMode) {
    case "2x2":
      return 4;
    case "3x3":
      return 9;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

async function resolveResourceUrlWithRetry(
  resolveResourceUrl: ((resourcePath: string) => Promise<string>) | undefined,
  resourcePath: string,
): Promise<string> {
  if (!resolveResourceUrl) {
    return "";
  }

  try {
    return await resolveResourceUrl(resourcePath);
  } catch (firstError) {
    await new Promise((resolve) => setTimeout(resolve, 16));
    return resolveResourceUrl(resourcePath).catch(() => {
      throw firstError;
    });
  }
}

function inferMimeTypeFromSource(image: ImageItem): string | undefined {
  if (image.source === "url") {
    try {
      const parsed = new URL(image.url ?? "");
      const pathname = parsed.pathname.toLowerCase();
      if (pathname.endsWith(".png")) {
        return "image/png";
      }
      if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
        return "image/jpeg";
      }
      if (pathname.endsWith(".webp")) {
        return "image/webp";
      }
      if (pathname.endsWith(".gif")) {
        return "image/gif";
      }
      if (pathname.endsWith(".bmp")) {
        return "image/bmp";
      }
      if (pathname.endsWith(".svg")) {
        return "image/svg+xml";
      }
      if (pathname.endsWith(".avif")) {
        return "image/avif";
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  const normalizedPath = normalizeRelativeCardResourcePath(image.file_path)?.toLowerCase() ?? "";
  if (normalizedPath.endsWith(".png")) {
    return "image/png";
  }
  if (normalizedPath.endsWith(".jpg") || normalizedPath.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalizedPath.endsWith(".webp")) {
    return "image/webp";
  }
  if (normalizedPath.endsWith(".gif")) {
    return "image/gif";
  }
  if (normalizedPath.endsWith(".bmp")) {
    return "image/bmp";
  }
  if (normalizedPath.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (normalizedPath.endsWith(".avif")) {
    return "image/avif";
  }
  return undefined;
}

function resolveResourceFileName(image: ImageItem): string | undefined {
  if (image.source === "file") {
    const normalizedPath = normalizeRelativeCardResourcePath(image.file_path);
    if (!normalizedPath) {
      return undefined;
    }
    const segments = normalizedPath.split("/");
    return segments[segments.length - 1];
  }

  try {
    const parsed = new URL(image.url ?? "");
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1];
  } catch {
    return undefined;
  }
}

export function ImageCardView({
  config,
  resolveResourceUrl,
  releaseResourceUrl,
  openResource,
}: ImageCardViewProps) {
  const horizontalRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const retryCountsRef = useRef(new Map<string, number>());
  const [resolvedFileUrls, setResolvedFileUrls] = useState<Map<string, string>>(new Map());
  const effectiveLayoutType = getEffectiveLayoutType(config);
  const layoutOptions = config.layout_options ?? defaultLayoutOptions;
  const spacing = getSpacingMetrics(layoutOptions);
  const fileResourcePaths = useMemo(() => {
    const paths = new Set<string>();

    for (const image of config.images) {
      if (image.source !== "file") {
        continue;
      }

      const normalizedPath = normalizeRelativeCardResourcePath(image.file_path);
      if (normalizedPath) {
        paths.add(normalizedPath);
      }
    }

    return Array.from(paths);
  }, [config.images]);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    retryCountsRef.current.clear();

    if (!resolveResourceUrl || fileResourcePaths.length === 0) {
      setResolvedFileUrls((current) => (current.size === 0 ? current : new Map()));
      return;
    }

    void Promise.all(fileResourcePaths.map(async (resourcePath) => {
      try {
        return [resourcePath, await resolveResourceUrlWithRetry(resolveResourceUrl, resourcePath)] as const;
      } catch {
        return [resourcePath, ""] as const;
      }
    })).then((entries) => {
      if (cancelled) {
        return;
      }

      const next = new Map<string, string>();
      for (const [resourcePath, resourceUrl] of entries) {
        if (resourceUrl) {
          next.set(resourcePath, resourceUrl);
        }
      }

      setResolvedFileUrls(next);
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;

      for (const resourcePath of fileResourcePaths) {
        void Promise.resolve(releaseResourceUrl?.(resourcePath)).catch(() => undefined);
      }
    };
  }, [config, fileResourcePaths, releaseResourceUrl, resolveResourceUrl]);

  const retryResource = (resourcePath: string | undefined): void => {
    const normalizedPath = normalizeRelativeCardResourcePath(resourcePath);
    if (!normalizedPath || !resolveResourceUrl) {
      return;
    }

    setResolvedFileUrls((current) => {
      if (!current.has(normalizedPath)) {
        return current;
      }

      const next = new Map(current);
      next.delete(normalizedPath);
      return next;
    });
    void Promise.resolve(releaseResourceUrl?.(normalizedPath)).catch(() => undefined);
    void resolveResourceUrlWithRetry(resolveResourceUrl, normalizedPath)
      .then((resourceUrl) => {
        if (!mountedRef.current) {
          void Promise.resolve(releaseResourceUrl?.(normalizedPath)).catch(() => undefined);
          return;
        }

        setResolvedFileUrls((current) => {
          const next = new Map(current);
          next.set(normalizedPath, resourceUrl);
          return next;
        });
      })
      .catch(() => undefined);
  };

  const handleResourceLoadError = (image: ImageItem): void => {
    if (image.source !== "file") {
      return;
    }

    const normalizedPath = normalizeRelativeCardResourcePath(image.file_path);
    if (!normalizedPath) {
      return;
    }

    const retryCount = (retryCountsRef.current.get(normalizedPath) ?? 0) + 1;
    retryCountsRef.current.set(normalizedPath, retryCount);
    if (retryCount > MAX_RESOURCE_RETRY_COUNT) {
      retryCountsRef.current.delete(normalizedPath);
      void Promise.resolve(releaseResourceUrl?.(normalizedPath)).catch(() => undefined);
      setResolvedFileUrls((current) => {
        if (!current.has(normalizedPath)) {
          return current;
        }

        const next = new Map(current);
        next.delete(normalizedPath);
        return next;
      });
      return;
    }

    retryResource(normalizedPath);
  };

  const handleHorizontalWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    if (!horizontalRef.current) {
      return;
    }

    horizontalRef.current.scrollLeft += event.deltaY;
  };

  const handleOpenImageResource = (image: ImageItem, src: string): void => {
    if (!openResource || src.trim().length === 0) {
      return;
    }

    let resourceId = "";
    if (image.source === "file") {
      const normalizedPath = normalizeRelativeCardResourcePath(image.file_path);
      if (!normalizedPath || !resolvedFileUrls.has(normalizedPath)) {
        return;
      }
      resourceId = normalizedPath;
    } else {
      resourceId = image.url?.trim() ?? "";
      if (!resourceId) {
        return;
      }
    }

    const displayTitle = [image.title, image.alt]
      .find((value) => typeof value === "string" && value.trim().length > 0)
      ?.trim();

    openResource({
      resourceId,
      mimeType: inferMimeTypeFromSource(image),
      title: displayTitle,
      fileName: resolveResourceFileName(image),
    });
  };

  if (config.images.length === 0) {
    return (
      <div className="chips-image-card">
        <div className="chips-image-card__empty">
          <span className="chips-image-card__empty-text">{formatMessage("image.empty")}</span>
        </div>
      </div>
    );
  }

  if (effectiveLayoutType === "single") {
    const singleImage = config.images[0];
    const alignment = layoutOptions.single_alignment ?? defaultLayoutOptions.single_alignment;
    const justifyContent = alignment === "left" ? "flex-start" : alignment === "right" ? "flex-end" : "center";
    const widthPercent = layoutOptions.single_width_percent ?? defaultLayoutOptions.single_width_percent;

    return (
      <div className="chips-image-card">
        <div className="chips-image-card__surface">
          <div className="chips-image-card__single" style={{ justifyContent }}>
            {singleImage ? (
              <div style={{ width: `${widthPercent}%`, maxWidth: "100%" }}>
                <ImageFrame
                  image={singleImage}
                  src={getImageDisplaySource(singleImage, resolvedFileUrls)}
                  placeholderText={formatMessage("image.unavailable")}
                  radius={spacing.radius}
                  canOpenResource={
                    singleImage.source === "url" ||
                    Boolean(
                      singleImage.file_path &&
                      normalizeRelativeCardResourcePath(singleImage.file_path) &&
                      resolvedFileUrls.has(normalizeRelativeCardResourcePath(singleImage.file_path)!),
                    )
                  }
                  onOpenResource={() => {
                    handleOpenImageResource(singleImage, getImageDisplaySource(singleImage, resolvedFileUrls));
                  }}
                  onResourceError={() => {
                    handleResourceLoadError(singleImage);
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (effectiveLayoutType === "grid") {
    const gridMode = layoutOptions.grid_mode ?? defaultLayoutOptions.grid_mode;
    const displayLimit = getGridDisplayLimit(gridMode);
    const hasOverflow = Number.isFinite(displayLimit) && config.images.length > displayLimit;
    const displayImages = hasOverflow ? config.images.slice(0, displayLimit) : config.images;
    const overflowCount = hasOverflow ? config.images.length - displayLimit + 1 : 0;

    return (
      <div className="chips-image-card">
        <div className="chips-image-card__surface">
          <div
            className="chips-image-card__grid"
            style={{
              gap: `${spacing.gap}px`,
              gridTemplateColumns: `repeat(${getGridColumns(gridMode)}, minmax(0, 1fr))`,
            }}
          >
            {displayImages.map((image, index) => {
              const isOverflowCell = hasOverflow && index === displayImages.length - 1;
              const src = getImageDisplaySource(image, resolvedFileUrls);

              return (
                <div key={image.id} className="chips-image-card__grid-cell">
                  <ImageFrame
                    image={image}
                    src={src}
                    dimmed={isOverflowCell}
                    fillHeight={true}
                    aspectRatio="1 / 1"
                    placeholderText={formatMessage("image.unavailable")}
                    radius={spacing.radius}
                    canOpenResource={
                      image.source === "url" ||
                      Boolean(
                        image.file_path &&
                        normalizeRelativeCardResourcePath(image.file_path) &&
                        resolvedFileUrls.has(normalizeRelativeCardResourcePath(image.file_path)!),
                      )
                    }
                    onOpenResource={() => {
                      handleOpenImageResource(image, src);
                    }}
                    onResourceError={() => {
                      handleResourceLoadError(image);
                    }}
                  />
                  {isOverflowCell ? (
                    <div className="chips-image-card__overflow-badge">+{overflowCount}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (effectiveLayoutType === "long-scroll") {
    return (
      <div className="chips-image-card">
        <div className="chips-image-card__surface chips-image-card__long-scroll">
          <div className="chips-image-card__long-scroll-stack" style={{ gap: `${spacing.gap}px` }}>
            {config.images.map((image) => (
              <ImageFrame
                key={image.id}
                image={image}
                src={getImageDisplaySource(image, resolvedFileUrls)}
                placeholderText={formatMessage("image.unavailable")}
                radius={spacing.radius}
                canOpenResource={
                  image.source === "url" ||
                  Boolean(
                    image.file_path &&
                    normalizeRelativeCardResourcePath(image.file_path) &&
                    resolvedFileUrls.has(normalizeRelativeCardResourcePath(image.file_path)!),
                  )
                }
                onOpenResource={() => {
                  handleOpenImageResource(image, getImageDisplaySource(image, resolvedFileUrls));
                }}
                onResourceError={() => {
                  if (image.source === "file") {
                    retryResource(image.file_path);
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chips-image-card">
      <div className="chips-image-card__surface">
        <div
          ref={horizontalRef}
          className="chips-image-card__horizontal"
          onWheel={handleHorizontalWheel}
        >
          <div className="chips-image-card__horizontal-track" style={{ gap: `${spacing.gap}px` }}>
            {config.images.map((image) => (
              <div key={image.id} className="chips-image-card__horizontal-item">
                <ImageFrame
                  image={image}
                  src={getImageDisplaySource(image, resolvedFileUrls)}
                  fillHeight={true}
                  placeholderText={formatMessage("image.unavailable")}
                  radius={spacing.radius}
                  canOpenResource={
                    image.source === "url" ||
                    Boolean(
                      image.file_path &&
                      normalizeRelativeCardResourcePath(image.file_path) &&
                      resolvedFileUrls.has(normalizeRelativeCardResourcePath(image.file_path)!),
                    )
                  }
                  onOpenResource={() => {
                    handleOpenImageResource(image, getImageDisplaySource(image, resolvedFileUrls));
                  }}
                  onResourceError={() => {
                    if (image.source === "file") {
                      retryResource(image.file_path);
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
