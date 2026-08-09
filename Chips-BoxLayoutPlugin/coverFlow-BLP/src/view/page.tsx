import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmbeddedDocumentFrame } from "@chips/ui";
import { hasFrameRegionContent, type FrameRegionConfig, type LayoutConfig } from "../schema/layout-config";
import type {
  BoxEntryCoverView,
  BoxEntryPage,
  BoxEntrySnapshot,
  BoxLayoutRuntime,
  ResolvedRuntimeResource,
} from "../shared/types";
import { formatMessage } from "../lib/messages";

const PAGE_LIMIT = 72;
const COVER_LOAD_RADIUS = 2;
const VISIBLE_RADIUS = 5;

export interface LayoutViewProps {
  initialView: BoxEntryPage;
  config: LayoutConfig;
  runtime: BoxLayoutRuntime;
}

interface CoverState {
  status: "idle" | "loading" | "ready" | "error";
  view?: BoxEntryCoverView;
}

interface FrameRegionState {
  status: "idle" | "loading" | "ready" | "error";
  resource?: ResolvedRuntimeResource;
}

const COVERFLOW_STYLE = `
html,
body {
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

#chips-box-layout-root {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

[data-scope="chips-box-coverflow-layout"] {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
  color: #1d1d1f;
  background-color: #ffffff;
}

[data-scope="chips-box-coverflow-layout"],
[data-scope="chips-box-coverflow-layout"] * {
  box-sizing: border-box;
}

[data-scope="chips-box-coverflow-layout"] [data-layout-background] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  pointer-events: none;
  overflow: hidden;
}

[data-scope="chips-box-coverflow-layout"] [data-layout-shell] {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 16px;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 16px;
  overflow: hidden;
  container-type: size;
}

[data-scope="chips-box-coverflow-layout"] [data-layout-top-region] {
  grid-row: 1;
  min-width: 0;
  block-size: clamp(72px, min(24cqw, 28cqh), 288px);
  min-block-size: 0;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  overflow: hidden;
  background-color: #ffffff;
}

[data-scope="chips-box-coverflow-layout"] [data-frame-region],
[data-scope="chips-box-coverflow-layout"] [data-frame-region] .chips-embedded-document-frame,
[data-scope="chips-box-coverflow-layout"] [data-frame-region] .chips-embedded-document-frame iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-coverflow-layout"] [data-frame-region-image] {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

[data-scope="chips-box-coverflow-layout"] [data-frame-region-status],
[data-scope="chips-box-coverflow-layout"] [data-layout-empty],
[data-scope="chips-box-coverflow-layout"] [data-layout-page-error],
[data-scope="chips-box-coverflow-layout"] [data-coverflow-cover-placeholder] {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  background-color: #ffffff;
  color: #6e6e73;
}

[data-scope="chips-box-coverflow-layout"] [data-coverflow-stage] {
  position: relative;
  grid-row: 2;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  outline: none;
  touch-action: pan-y;
  perspective: 1200px;
  container-type: size;
}

[data-scope="chips-box-coverflow-layout"] [data-coverflow-track] {
  position: relative;
  min-width: 0;
  min-height: 0;
  height: 100%;
  transform-style: preserve-3d;
}

[data-scope="chips-box-coverflow-layout"] [data-coverflow-item] {
  position: absolute;
  inset-block-start: 50%;
  inset-inline-start: calc(50% + var(--coverflow-offset));
  display: grid;
  gap: 8px;
  width: min(var(--coverflow-cover-width), max(72px, min(calc(100cqw - 24px), 34cqh)));
  min-width: 0;
  transform:
    translate3d(-50%, -50%, var(--coverflow-z))
    rotateY(var(--coverflow-rotate))
    scale(var(--coverflow-scale));
  transform-origin: center center;
  transition:
    transform 220ms ease,
    opacity 180ms ease,
    filter 180ms ease;
  opacity: var(--coverflow-opacity);
  z-index: var(--coverflow-z-index);
  pointer-events: var(--coverflow-pointer-events);
  will-change: transform, opacity;
}

[data-scope="chips-box-coverflow-layout"] [data-coverflow-cover] {
  position: relative;
  display: block;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transform-style: preserve-3d;
}

[data-scope="chips-box-coverflow-layout"] [data-coverflow-cover-frame],
[data-scope="chips-box-coverflow-layout"] [data-coverflow-cover-placeholder] {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 10px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.16);
  background-color: #ffffff;
}

[data-scope="chips-box-coverflow-layout"] [data-coverflow-cover-frame] .chips-embedded-document-frame,
[data-scope="chips-box-coverflow-layout"] [data-coverflow-cover-frame] .chips-embedded-document-frame iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-coverflow-layout"] [data-coverflow-cover-frame] .chips-embedded-document-frame iframe {
  border: none;
  pointer-events: none;
}

[data-scope="chips-box-coverflow-layout"] [data-coverflow-cover-placeholder] {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 16px;
  text-align: center;
}

[data-scope="chips-box-coverflow-layout"] [data-layout-empty-title] {
  color: #1d1d1f;
  font-weight: 700;
}

[data-scope="chips-box-coverflow-layout"] [data-coverflow-placeholder-text],
[data-scope="chips-box-coverflow-layout"] [data-coverflow-placeholder-kind] {
  font-size: 12px;
}

[data-scope="chips-box-coverflow-layout"] [data-coverflow-reflection] {
  height: min(72px, 10cqw, 10cqh);
  border-radius: 0 0 10px 10px;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, #1d1d1f 12%, transparent),
      transparent 74%
    );
  opacity: 0.38;
  transform: scaleY(-1);
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.42), transparent);
}

[data-scope="chips-box-coverflow-layout"] [data-coverflow-stage]:focus-visible,
[data-scope="chips-box-coverflow-layout"] [data-coverflow-cover]:focus-visible,
[data-scope="chips-box-coverflow-layout"] [data-layout-load-more]:focus-visible,
[data-scope="chips-box-coverflow-layout"] [data-layout-retry]:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

[data-scope="chips-box-coverflow-layout"] [data-layout-footer] {
  grid-row: 3;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 0;
}

[data-scope="chips-box-coverflow-layout"] [data-layout-load-more],
[data-scope="chips-box-coverflow-layout"] [data-layout-retry] {
  min-block-size: 40px;
  border: none;
  border-radius: 10px;
  padding-inline: 16px;
  padding-block: 8px;
  background-color: #ffffff;
  color: #1d1d1f;
  font: inherit;
  cursor: pointer;
}

[data-scope="chips-box-coverflow-layout"] [data-layout-load-more]:disabled {
  cursor: default;
  color: #6e6e73;
  background-color: #f2f2f7;
}

[data-scope="chips-box-coverflow-layout"] [data-layout-empty],
[data-scope="chips-box-coverflow-layout"] [data-layout-page-error],
[data-scope="chips-box-coverflow-layout"] [data-frame-region-status] {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 180px;
  padding: 16px;
  text-align: center;
}

[data-scope="chips-box-coverflow-layout"] [data-layout-empty] {
  grid-row: 2;
  min-height: 0;
}

@media (max-width: 720px) {
  [data-scope="chips-box-coverflow-layout"] [data-layout-shell] {
    padding-inline: 12px;
  }

}
`;

const COVER_WIDTH_BY_SIZE: Record<LayoutConfig["props"]["coverSize"], number> = {
  compact: 180,
  regular: 244,
  large: 316,
};

const SPACING_BY_MODE: Record<LayoutConfig["props"]["spacing"], number> = {
  tight: 116,
  regular: 154,
  wide: 196,
};

const WHEEL_THRESHOLD_BY_SENSITIVITY: Record<LayoutConfig["props"]["wheelSensitivity"], number> = {
  low: 86,
  medium: 52,
  high: 28,
};

function resolveEntryTitle(entry: BoxEntrySnapshot): string {
  return entry.snapshot.title ?? entry.snapshot.documentId ?? entry.entryId;
}

function resolveEntryKindMessage(entry: BoxEntrySnapshot): string {
  if (entry.snapshot.contentType === "chips/box") {
    return formatMessage("layout.entry_type_box");
  }
  return formatMessage("layout.entry_type_card");
}

function toCssAspectRatio(value: string | number | undefined, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${value}`;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.includes(":") ? value.trim().replace(":", " / ") : value.trim();
  }

  return fallback.includes(":") ? fallback.replace(":", " / ") : fallback;
}

function toRatioToken(value: string | number | undefined, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${value}`;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return fallback;
}

function sortEntries(
  entries: BoxEntrySnapshot[],
  sortMode: LayoutConfig["props"]["sortMode"],
): BoxEntrySnapshot[] {
  if (sortMode === "manual") {
    return entries;
  }

  const direction = sortMode === "name-desc" ? -1 : 1;

  return [...entries].sort((left, right) => {
    const compared = resolveEntryTitle(left).localeCompare(resolveEntryTitle(right), "zh-CN");
    if (compared !== 0) {
      return compared * direction;
    }
    return left.entryId.localeCompare(right.entryId);
  });
}

function appendUniqueEntries(
  current: BoxEntrySnapshot[],
  incoming: BoxEntrySnapshot[]
): BoxEntrySnapshot[] {
  const seen = new Set(current.map((entry) => entry.entryId));
  const next = [...current];
  for (const entry of incoming) {
    if (!seen.has(entry.entryId)) {
      seen.add(entry.entryId);
      next.push(entry);
    }
  }
  return next;
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.min(length - 1, Math.max(0, index));
}

function FrameRegionSurface({
  region,
  runtime,
  title,
  ratio,
  decorative = false,
}: {
  region: FrameRegionConfig;
  runtime: BoxLayoutRuntime;
  title: string;
  ratio: string;
  decorative?: boolean;
}) {
  const [state, setState] = useState<FrameRegionState>({ status: "idle" });

  useEffect(() => {
    if (region.mode !== "image" || !region.assetPath) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    void runtime
      .readBoxAsset(region.assetPath)
      .then((resource) => {
        if (!cancelled) {
          setState({ status: "ready", resource });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [region.assetPath, region.mode, runtime]);

  if (region.mode === "html") {
    return (
      <div data-frame-region>
        <EmbeddedDocumentFrame
          title={title}
          srcDoc={region.html ?? ""}
          ratio={ratio}
          sandbox="allow-scripts"
        />
      </div>
    );
  }

  if (region.mode !== "image") {
    return null;
  }

  if (state.status === "ready" && state.resource?.resourceUrl) {
    return (
      <div data-frame-region>
        <img
          data-frame-region-image
          src={state.resource.resourceUrl}
          alt={decorative ? "" : title}
        />
      </div>
    );
  }

  const message =
    state.status === "loading"
      ? formatMessage("layout.asset_loading")
      : formatMessage("layout.asset_error");

  return (
    <div data-frame-region-status role={decorative ? undefined : "status"}>
      {message}
    </div>
  );
}

function CoverFlowCover({
  entry,
  runtime,
  shouldLoadCover,
  isFocused,
  showReflection,
  onActivate,
}: {
  entry: BoxEntrySnapshot;
  runtime: BoxLayoutRuntime;
  shouldLoadCover: boolean;
  isFocused: boolean;
  showReflection: boolean;
  onActivate(): void;
}) {
  const [coverState, setCoverState] = useState<CoverState>(() => ({
    status: entry.snapshot.cover?.mode === "none" || !shouldLoadCover ? "idle" : "loading",
  }));

  useEffect(() => {
    if (!shouldLoadCover || entry.snapshot.cover?.mode === "none") {
      setCoverState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setCoverState({ status: "loading" });
    void runtime
      .renderEntryCover(entry.entryId)
      .then((view) => {
        if (!cancelled) {
          setCoverState({ status: "ready", view });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCoverState({ status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [entry.entryId, entry.snapshot.cover?.mode, runtime, shouldLoadCover]);

  const fallbackRatio = "3:4";
  const aspectRatio = toCssAspectRatio(
    coverState.view?.ratio ?? entry.layoutHints?.aspectRatio,
    fallbackRatio
  );
  const ratioToken = toRatioToken(
    coverState.view?.ratio ?? entry.layoutHints?.aspectRatio,
    fallbackRatio
  );
  const title = resolveEntryTitle(entry);
  const frameTitle = coverState.view?.title || title;

  const coverContent = coverState.status === "ready" && coverState.view?.coverUrl ? (
    <div
      data-coverflow-cover-frame
      style={{ aspectRatio }}
    >
      <EmbeddedDocumentFrame
        title={frameTitle}
        src={coverState.view.coverUrl}
        ratio={ratioToken}
        sandbox="allow-scripts"
      />
    </div>
  ) : (
    <div
      data-coverflow-cover-placeholder
      data-state={coverState.status}
      style={{ aspectRatio }}
    >
      <span data-coverflow-placeholder-text>
        {coverState.status === "loading"
          ? formatMessage("layout.loading")
          : coverState.status === "error"
            ? formatMessage("layout.cover_error")
            : formatMessage(shouldLoadCover ? "layout.cover_missing" : "layout.cover_placeholder")}
      </span>
      <span data-coverflow-placeholder-kind>{resolveEntryKindMessage(entry)}</span>
    </div>
  );

  return (
    <button
      type="button"
      role="option"
      aria-selected={isFocused}
      tabIndex={isFocused ? 0 : -1}
      data-coverflow-cover
      data-focused={isFocused ? "true" : "false"}
      aria-label={isFocused
        ? formatMessage("layout.open_focused", { title })
        : formatMessage("layout.focus_entry", { title })}
      onClick={onActivate}
    >
      {coverContent}
      {showReflection ? <span data-coverflow-reflection aria-hidden="true" /> : null}
    </button>
  );
}

function CoverFlowItem({
  entry,
  index,
  focusIndex,
  config,
  runtime,
  onFocus,
  onOpen,
}: {
  entry: BoxEntrySnapshot;
  index: number;
  focusIndex: number;
  config: LayoutConfig;
  runtime: BoxLayoutRuntime;
  onFocus(index: number): void;
  onOpen(entryId: string): void;
}) {
  const distance = index - focusIndex;
  const absDistance = Math.abs(distance);
  const clampedDistance = Math.max(-VISIBLE_RADIUS, Math.min(VISIBLE_RADIUS, distance));
  const isFocused = distance === 0;
  const title = resolveEntryTitle(entry);
  const coverWidth = COVER_WIDTH_BY_SIZE[config.props.coverSize];
  const spacing = SPACING_BY_MODE[config.props.spacing];
  const sideAngle = config.props.sideAngleDeg * (distance < 0 ? 1 : -1);
  const rotate = isFocused ? 0 : sideAngle;
  const scale = isFocused ? config.props.centerScale : Math.max(0.7, 1 - Math.min(absDistance, 4) * 0.07);
  const opacity = absDistance > VISIBLE_RADIUS ? 0 : Math.max(0.18, 1 - absDistance * 0.13);
  const z = isFocused ? 120 : -Math.min(absDistance, 5) * 54;
  const style = {
    "--coverflow-cover-width": `${coverWidth}px`,
    "--coverflow-offset": `${(clampedDistance * spacing) / 10}%`,
    "--coverflow-z": `${z}px`,
    "--coverflow-rotate": `${rotate}deg`,
    "--coverflow-scale": `${scale}`,
    "--coverflow-opacity": `${opacity}`,
    "--coverflow-z-index": `${100 - absDistance}`,
    "--coverflow-pointer-events": absDistance <= VISIBLE_RADIUS ? "auto" : "none",
  } as React.CSSProperties;

  return (
    <article
      role="presentation"
      data-coverflow-item
      data-entry-id={entry.entryId}
      data-focused={isFocused ? "true" : "false"}
      aria-hidden={absDistance > VISIBLE_RADIUS ? "true" : undefined}
      style={style}
    >
      <CoverFlowCover
        entry={entry}
        runtime={runtime}
        shouldLoadCover={absDistance <= COVER_LOAD_RADIUS}
        isFocused={isFocused}
        showReflection={config.props.showReflection}
        onActivate={() => {
          if (isFocused) {
            onOpen(entry.entryId);
            return;
          }
          onFocus(index);
        }}
      />
    </article>
  );
}

export function LayoutViewPage({ initialView, config, runtime }: LayoutViewProps) {
  const isMountedRef = useRef(true);
  const wheelDeltaRef = useRef(0);
  const dragStartXRef = useRef<number | null>(null);
  const [items, setItems] = useState<BoxEntrySnapshot[]>(initialView.items);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialView.nextCursor);
  const [total, setTotal] = useState(initialView.total);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setItems(initialView.items);
    setNextCursor(initialView.nextCursor);
    setTotal(initialView.total);
    setIsLoadingNext(false);
    setPageError(false);
    setFocusIndex(0);
  }, [initialView]);

  const enabledEntries = useMemo(
    () => sortEntries(items.filter((entry) => entry.enabled), config.props.sortMode),
    [config.props.sortMode, items]
  );
  const hasTopRegion = hasFrameRegionContent(config.props.topRegion);
  const hasBackground = hasFrameRegionContent(config.props.background);

  useEffect(() => {
    setFocusIndex((current) => clampIndex(current, enabledEntries.length));
  }, [enabledEntries.length]);

  useEffect(() => {
    if (enabledEntries.length === 0) {
      return;
    }
    const start = Math.max(0, focusIndex - COVER_LOAD_RADIUS);
    const end = Math.min(enabledEntries.length, focusIndex + COVER_LOAD_RADIUS + 1);
    const entryIds = enabledEntries.slice(start, end).map((entry) => entry.entryId);
    void runtime.prefetchEntries({ entryIds, targets: ["cover"] }).catch(() => undefined);
  }, [enabledEntries, focusIndex, runtime]);

  const moveFocus = useCallback((delta: number) => {
    setFocusIndex((current) => clampIndex(current + delta, enabledEntries.length));
  }, [enabledEntries.length]);

  const openFocusedEntry = useCallback(() => {
    const entry = enabledEntries[focusIndex];
    if (entry) {
      void runtime.openEntry(entry.entryId);
    }
  }, [enabledEntries, focusIndex, runtime]);

  const openEntry = useCallback((entryId: string) => {
    void runtime.openEntry(entryId);
  }, [runtime]);

  const loadNextPage = useCallback(async () => {
    if (!nextCursor || isLoadingNext) {
      return;
    }

    setIsLoadingNext(true);
    setPageError(false);
    try {
      const page = await runtime.listEntries({
        cursor: nextCursor,
        limit: PAGE_LIMIT,
      });
      if (!page || !Array.isArray(page.items)) {
        throw new Error("Invalid box entry page.");
      }
      if (!isMountedRef.current) {
        return;
      }
      setItems((current) => appendUniqueEntries(current, page.items));
      setNextCursor(page.nextCursor);
      setTotal(page.total);
    } catch {
      if (isMountedRef.current) {
        setPageError(true);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingNext(false);
      }
    }
  }, [isLoadingNext, nextCursor, runtime]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (enabledEntries.length <= 1) {
      return;
    }
    const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    wheelDeltaRef.current += dominantDelta;
    const threshold = WHEEL_THRESHOLD_BY_SENSITIVITY[config.props.wheelSensitivity];
    if (Math.abs(wheelDeltaRef.current) >= threshold) {
      event.preventDefault();
      moveFocus(wheelDeltaRef.current > 0 ? 1 : -1);
      wheelDeltaRef.current = 0;
    }
  }, [config.props.wheelSensitivity, enabledEntries.length, moveFocus]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      openFocusedEntry();
    }
  }, [moveFocus, openFocusedEntry]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    dragStartXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const startX = dragStartXRef.current;
    dragStartXRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (typeof startX !== "number") {
      return;
    }
    const delta = event.clientX - startX;
    if (Math.abs(delta) >= 38) {
      moveFocus(delta < 0 ? 1 : -1);
    }
  }, [moveFocus]);

  return (
    <section data-scope="chips-box-coverflow-layout">
      <style>{COVERFLOW_STYLE}</style>

      {hasBackground ? (
        <div data-layout-background aria-hidden="true">
          <FrameRegionSurface
            region={config.props.background}
            runtime={runtime}
            title={formatMessage("layout.background_title")}
            ratio="16:9"
            decorative
          />
        </div>
      ) : null}

      <div data-layout-shell>
        {hasTopRegion ? (
          <div data-layout-top-region>
            <FrameRegionSurface
              region={config.props.topRegion}
              runtime={runtime}
              title={formatMessage("layout.top_region_title")}
              ratio="16:5"
            />
          </div>
        ) : null}

        {enabledEntries.length > 0 ? (
          <div
            data-coverflow-stage
            role="listbox"
            aria-label={formatMessage("layout.stage_label")}
            tabIndex={0}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <div data-coverflow-track>
              {enabledEntries.map((entry, index) => (
                <CoverFlowItem
                  key={entry.entryId}
                  entry={entry}
                  index={index}
                  focusIndex={focusIndex}
                  config={config}
                  runtime={runtime}
                  onFocus={setFocusIndex}
                  onOpen={openEntry}
                />
              ))}
            </div>
          </div>
        ) : (
          <div data-layout-empty>
            <strong data-layout-empty-title>{formatMessage("layout.empty")}</strong>
            <span>{formatMessage("layout.empty_hint")}</span>
          </div>
        )}

        {nextCursor || pageError ? (
          <div data-layout-footer data-total={total}>
            {pageError ? (
              <div data-layout-page-error role="status">
                <span>{formatMessage("layout.page_error")}</span>
                <button type="button" data-layout-retry onClick={loadNextPage}>
                  {formatMessage("layout.retry")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-layout-load-more
                onClick={loadNextPage}
                disabled={isLoadingNext}
              >
                {isLoadingNext
                  ? formatMessage("layout.loading_more")
                  : formatMessage("layout.load_more")}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
