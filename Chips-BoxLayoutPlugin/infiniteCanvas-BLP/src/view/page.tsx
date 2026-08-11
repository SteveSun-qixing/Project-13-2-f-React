import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EmbeddedDocumentFrame,
  EmptyHint,
  LayoutSkeleton,
  SkeletonBlock,
  SkeletonLine,
} from "@chips/ui";
import {
  GRID_SIZE,
  type CanvasItemConfig,
  type ItemDisplayMode,
  type LayoutConfig,
} from "../schema/layout-config";
import type {
  BoxEntryCoverView,
  BoxEntryPage,
  BoxEntrySnapshot,
  BoxLayoutRuntime,
  ResolvedRuntimeResource,
} from "../shared/types";
import { formatMessage } from "../lib/messages";

const PAGE_LIMIT = 240;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const VIEWPORT_MARGIN = 640;

export interface LayoutViewProps {
  initialView: BoxEntryPage;
  config: LayoutConfig;
  runtime: BoxLayoutRuntime;
}

interface ViewState {
  x: number;
  y: number;
  zoom: number;
}

interface CoverState {
  status: "idle" | "loading" | "ready" | "error";
  view?: BoxEntryCoverView;
}

interface BackgroundState {
  status: "idle" | "loading" | "ready" | "error";
  resource?: ResolvedRuntimeResource;
}

const STYLE_TEXT = `
[data-scope="chips-box-infinite-canvas-layout"] {
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 100%;
  height: max(100%, 720px);
  overflow: hidden;
  box-sizing: border-box;
  color: #1d1d1f;
  background: #ffffff;
  touch-action: none;
}

[data-scope="chips-box-infinite-canvas-layout"] * {
  box-sizing: border-box;
}

[data-infinite-canvas-viewport] {
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: grab;
  background-color: #ffffff;
}

[data-infinite-canvas-viewport][data-panning="true"] {
  cursor: grabbing;
}

[data-infinite-canvas-grid] {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.55;
  background-image:
    linear-gradient(to right, rgba(0, 0, 0, 0.08) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.08) 1px, transparent 1px);
}

[data-infinite-canvas-world] {
  position: absolute;
  inset-inline-start: 0;
  inset-block-start: 0;
  transform-origin: 0 0;
  min-width: 1px;
  min-height: 1px;
}

[data-infinite-canvas-background] {
  position: absolute;
  inset-inline-start: 0;
  inset-block-start: 0;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #f2f2f7;
  pointer-events: none;
}

[data-infinite-canvas-background] img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

[data-infinite-canvas-background-status] {
  position: absolute;
  inset-inline-start: 24px;
  inset-block-start: 24px;
  min-width: 220px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #ffffff;
  color: #6e6e73;
}

[data-canvas-entry] {
  position: absolute;
  display: grid;
  min-width: 0;
  transform: translate(-50%, -50%);
}

[data-canvas-point] {
  display: grid;
  grid-template-columns: 14px minmax(0, max-content);
  align-items: center;
  gap: 8px;
  min-height: 32px;
  border: 0;
  padding: 6px 10px 6px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, #ffffff 88%, transparent);
  color: #1d1d1f;
  box-shadow: 0 6px 20px color-mix(in srgb, #000 14%, transparent);
  font: inherit;
  cursor: pointer;
}

[data-canvas-point-dot] {
  inline-size: 12px;
  block-size: 12px;
  border-radius: 999px;
  background: #0a84ff;
  box-shadow: 0 0 0 3px color-mix(in srgb, #0a84ff 18%, transparent);
}

[data-canvas-point-label],
[data-canvas-cover-title] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-canvas-cover] {
  display: grid;
  gap: 8px;
  width: 180px;
  min-width: 0;
}

[data-canvas-cover-shell],
[data-canvas-cover-placeholder] {
  width: 100%;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #ffffff;
  box-shadow: 0 10px 28px color-mix(in srgb, #000 16%, transparent);
}

[data-canvas-cover-shell] .chips-embedded-document-frame,
[data-canvas-cover-shell] iframe {
  width: 100%;
  height: 100%;
}

[data-canvas-cover-placeholder] {
  min-height: 136px;
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 12px;
  color: #6e6e73;
  text-align: center;
  font: inherit;
  cursor: pointer;
}

[data-canvas-cover-title] {
  border: 0;
  padding: 0;
  background: transparent;
  color: #1d1d1f;
  font: inherit;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
}

[data-infinite-canvas-empty] {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 32px;
  pointer-events: none;
}

[data-infinite-canvas-footer] {
  position: absolute;
  inset-inline: 0;
  inset-block-end: 16px;
  display: flex;
  justify-content: center;
  gap: 8px;
  pointer-events: none;
}

[data-infinite-canvas-footer] button,
[data-canvas-point],
[data-canvas-cover-placeholder],
[data-canvas-cover-title] {
  pointer-events: auto;
}

[data-infinite-canvas-footer] button {
  min-height: 36px;
  border: 0;
  border-radius: 14px;
  padding-inline: 16px;
  background: #ffffff;
  color: #1d1d1f;
  font: inherit;
  cursor: pointer;
}

[data-canvas-point]:focus-visible,
[data-canvas-cover-placeholder]:focus-visible,
[data-canvas-cover-title]:focus-visible,
[data-infinite-canvas-footer] button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
`;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveEntryTitle(entry: BoxEntrySnapshot): string {
  return entry.snapshot.title ?? entry.snapshot.documentId ?? entry.entryId;
}

function resolveItemTitle(entry: BoxEntrySnapshot, item: CanvasItemConfig): string {
  return item.labelOverride ?? resolveEntryTitle(entry);
}

function resolveEntryMode(config: LayoutConfig, item: CanvasItemConfig): ItemDisplayMode {
  if (config.props.displayMode === "point") {
    return "point";
  }
  if (config.props.displayMode === "cover") {
    return "cover";
  }
  return item.mode ?? "point";
}

function toCssAspectRatio(value: string | number | undefined, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${value}`;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.includes(":") ? value.trim().replace(":", " / ") : value.trim();
  }
  return fallback.replace(":", " / ");
}

function appendUniqueEntries(current: BoxEntrySnapshot[], incoming: BoxEntrySnapshot[]): BoxEntrySnapshot[] {
  const seen = new Set(current.map((entry) => entry.entryId));
  const next = [...current];
  incoming.forEach((entry) => {
    if (!seen.has(entry.entryId)) {
      seen.add(entry.entryId);
      next.push(entry);
    }
  });
  return next;
}

function useCanvasSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }

    const update = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: rect.width > 0 ? rect.width : 1200,
        height: rect.height > 0 ? rect.height : 800,
      });
    };
    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => {
        window.removeEventListener("resize", update);
      };
    }

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return size;
}

function BackgroundLayer({
  config,
  runtime,
}: {
  config: LayoutConfig;
  runtime: BoxLayoutRuntime;
}) {
  const background = config.props.background;
  const [state, setState] = useState<BackgroundState>({ status: "idle" });

  useEffect(() => {
    if (background.mode !== "image" || !background.assetPath) {
      setState({ status: "idle" });
      return undefined;
    }

    let cancelled = false;
    setState({ status: "loading" });
    void runtime.readBoxAsset(background.assetPath)
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
  }, [background.assetPath, background.mode, runtime]);

  if (background.mode !== "image") {
    return null;
  }

  const width = background.width ?? 1600;
  const height = background.height ?? 1000;

  if (state.status === "ready" && state.resource?.resourceUrl) {
    return (
      <div
        data-infinite-canvas-background
        style={{
          width,
          height,
          opacity: background.opacity ?? 1,
        }}
      >
        <img
          src={state.resource.resourceUrl}
          alt=""
        />
      </div>
    );
  }

  return (
    <div data-infinite-canvas-background-status role="status">
      {state.status === "loading"
        ? formatMessage("layout.background_loading")
        : formatMessage("layout.background_error")}
    </div>
  );
}

function CoverEntry({
  entry,
  item,
  runtime,
}: {
  entry: BoxEntrySnapshot;
  item: CanvasItemConfig;
  runtime: BoxLayoutRuntime;
}) {
  const [coverState, setCoverState] = useState<CoverState>(() => ({
    status: entry.snapshot.cover?.mode === "none" ? "idle" : "loading",
  }));

  useEffect(() => {
    if (entry.snapshot.cover?.mode === "none") {
      setCoverState({ status: "idle" });
      return undefined;
    }

    let cancelled = false;
    setCoverState({ status: "loading" });
    void runtime.renderEntryCover(entry.entryId)
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
  }, [entry.entryId, entry.snapshot.cover?.mode, runtime]);

  const title = resolveItemTitle(entry, item);
  const handleOpen = () => {
    void runtime.openEntry(entry.entryId);
  };
  const width = item.width ?? 180;
  const aspectRatio = toCssAspectRatio(coverState.view?.ratio ?? entry.layoutHints?.aspectRatio, "3:4");

  return (
    <div
      data-canvas-cover
      style={{ width }}
    >
      {coverState.status === "ready" && coverState.view?.coverUrl ? (
        <div
          data-canvas-cover-shell
          style={{ aspectRatio }}
        >
          <EmbeddedDocumentFrame
            title={coverState.view.title || title}
            src={coverState.view.coverUrl}
            ratio={coverState.view.ratio ?? "3:4"}
            sandbox="allow-scripts"
            onActivate={handleOpen}
          />
        </div>
      ) : (
        <button
          type="button"
          data-canvas-cover-placeholder
          data-state={coverState.status}
          style={{ aspectRatio }}
          onClick={handleOpen}
        >
          <strong>{title}</strong>
          <span>
            {coverState.status === "loading"
              ? formatMessage("layout.cover_loading")
              : coverState.status === "error"
                ? formatMessage("layout.cover_error")
                : formatMessage("layout.cover_missing")}
          </span>
        </button>
      )}
      <button
        type="button"
        data-canvas-cover-title
        title={title}
        onClick={handleOpen}
      >
        {title}
      </button>
    </div>
  );
}

function CanvasEntry({
  entry,
  item,
  mode,
  runtime,
}: {
  entry: BoxEntrySnapshot;
  item: CanvasItemConfig;
  mode: ItemDisplayMode;
  runtime: BoxLayoutRuntime;
}) {
  const title = resolveItemTitle(entry, item);
  const handleOpen = () => {
    void runtime.openEntry(entry.entryId);
  };

  return (
    <article
      data-canvas-entry
      data-entry-id={entry.entryId}
      data-mode={mode}
      style={{
        left: item.x,
        top: item.y,
      }}
    >
      {mode === "cover" ? (
        <CoverEntry
          entry={entry}
          item={item}
          runtime={runtime}
        />
      ) : (
        <button
          type="button"
          data-canvas-point
          title={title}
          onClick={handleOpen}
        >
          <span data-canvas-point-dot aria-hidden="true" />
          <span data-canvas-point-label>{title}</span>
        </button>
      )}
    </article>
  );
}

export function LayoutViewPage({ initialView, config, runtime }: LayoutViewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const [items, setItems] = useState<BoxEntrySnapshot[]>(initialView.items);
  const [nextCursor, setNextCursor] = useState(initialView.nextCursor);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [view, setView] = useState<ViewState>(() => ({ ...config.props.defaultView }));
  const [isPanning, setIsPanning] = useState(false);
  const size = useCanvasSize(viewportRef);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setItems(initialView.items);
    setNextCursor(initialView.nextCursor);
    setIsLoadingNext(false);
    setPageError(false);
  }, [initialView]);

  useEffect(() => {
    setView({ ...config.props.defaultView });
  }, [config.props.defaultView]);

  const placedEntries = useMemo(() => {
    return items
      .filter((entry) => entry.enabled && config.props.items[entry.entryId])
      .map((entry) => ({
        entry,
        item: config.props.items[entry.entryId] as CanvasItemConfig,
      }));
  }, [config.props.items, items]);

  const visibleEntries = useMemo(() => {
    return placedEntries.filter(({ item }) => {
      const screenX = item.x * view.zoom + view.x;
      const screenY = item.y * view.zoom + view.y;
      return (
        screenX >= -VIEWPORT_MARGIN
        && screenX <= size.width + VIEWPORT_MARGIN
        && screenY >= -VIEWPORT_MARGIN
        && screenY <= size.height + VIEWPORT_MARGIN
      );
    });
  }, [placedEntries, size.height, size.width, view.x, view.y, view.zoom]);

  useEffect(() => {
    if (visibleEntries.length === 0) {
      return;
    }
    void runtime.prefetchEntries({
      entryIds: visibleEntries.slice(0, 80).map(({ entry }) => entry.entryId),
      targets: ["cover"],
    }).catch(() => undefined);
  }, [runtime, visibleEntries]);

  const loadNextPage = useCallback(async () => {
    if (!nextCursor || isLoadingNext) {
      return;
    }
    setIsLoadingNext(true);
    setPageError(false);
    try {
      const page = await runtime.listEntries({ cursor: nextCursor, limit: PAGE_LIMIT });
      if (!isMountedRef.current) {
        return;
      }
      setItems((current) => appendUniqueEntries(current, page.items));
      setNextCursor(page.nextCursor);
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

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    setView((current) => {
      const nextZoom = clamp(current.zoom * (event.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM);
      const worldX = (pointerX - current.x) / current.zoom;
      const worldY = (pointerY - current.y) / current.zoom;
      return {
        zoom: nextZoom,
        x: pointerX - worldX * nextZoom,
        y: pointerY - worldY * nextZoom,
      };
    });
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) {
      return;
    }
    setView((current) => ({
      ...current,
      x: current.x + event.movementX,
      y: current.y + event.movementY,
    }));
  }, [isPanning]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsPanning(false);
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 96 : 32;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      setView((current) => ({
        ...current,
        x: current.x + (event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0),
        y: current.y + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0),
      }));
    }
    if (event.key === "+" || event.key === "=" || event.key === "-") {
      event.preventDefault();
      setView((current) => ({
        ...current,
        zoom: clamp(current.zoom * (event.key === "-" ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM),
      }));
    }
  }, []);

  const gridSize = GRID_SIZE * view.zoom;

  return (
    <section data-scope="chips-box-infinite-canvas-layout">
      <style>{STYLE_TEXT}</style>
      <div
        ref={viewportRef}
        data-infinite-canvas-viewport
        data-panning={isPanning ? "true" : undefined}
        role="application"
        aria-label={formatMessage("layout.canvas_label")}
        tabIndex={0}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        {config.props.gridVisible ? (
          <div
            data-infinite-canvas-grid
            aria-hidden="true"
            style={{
              backgroundSize: `${gridSize}px ${gridSize}px`,
              backgroundPosition: `${view.x}px ${view.y}px`,
            }}
          />
        ) : null}
        <div
          data-infinite-canvas-world
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          }}
        >
          <BackgroundLayer
            config={config}
            runtime={runtime}
          />
          {visibleEntries.map(({ entry, item }) => (
            <CanvasEntry
              key={entry.entryId}
              entry={entry}
              item={item}
              mode={resolveEntryMode(config, item)}
              runtime={runtime}
            />
          ))}
        </div>
        {placedEntries.length === 0 ? (
          <div data-infinite-canvas-empty>
            <LayoutSkeleton
              hint={
                <EmptyHint
                  title={formatMessage("layout.empty")}
                  description={formatMessage("layout.empty_hint")}
                />
              }
            >
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage:
                    "linear-gradient(to right, rgba(0, 0, 0, 0.04) 1px, transparent 1px),"
                    + " linear-gradient(to bottom, rgba(0, 0, 0, 0.04) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minWidth: 300,
                  minHeight: 240,
                }}
              >
                <div style={{ position: "relative", width: 170, height: 210 }}>
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      transform: "translate(110px, 30px) rotate(4deg)",
                    }}
                  >
                    <SkeletonBlock
                      width={150}
                      height={190}
                      radius={12}
                      style={{ background: "#f2f2f7" }}
                    />
                    <SkeletonLine
                      width="55%"
                      style={{
                        position: "absolute",
                        insetInlineStart: 14,
                        insetBlockEnd: 12,
                        background: "#e4e4ea",
                      }}
                    />
                  </div>
                  <div aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
                    <SkeletonBlock
                      width="100%"
                      height="100%"
                      radius={12}
                      dashed
                      style={{ background: "#ffffff" }}
                    />
                    <SkeletonLine
                      width="55%"
                      style={{
                        position: "absolute",
                        insetInlineStart: 14,
                        insetBlockEnd: 12,
                      }}
                    />
                  </div>
                </div>
              </div>
            </LayoutSkeleton>
          </div>
        ) : null}
        {nextCursor || pageError ? (
          <div data-infinite-canvas-footer>
            {pageError ? (
              <>
                <span role="status">{formatMessage("layout.page_error")}</span>
                <button type="button" data-layout-retry onClick={loadNextPage}>
                  {formatMessage("layout.retry")}
                </button>
              </>
            ) : (
              <button
                type="button"
                data-layout-load-more
                disabled={isLoadingNext}
                onClick={loadNextPage}
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
