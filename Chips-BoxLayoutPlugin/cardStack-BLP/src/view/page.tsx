import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyHint, EmbeddedDocumentFrame, LayoutSkeleton, SkeletonBlock, SkeletonLine } from "@chips/ui";
import { hasFrameRegionContent, type FrameRegionConfig, type LayoutConfig } from "../schema/layout-config";
import type {
  BoxEntryCoverView,
  BoxEntryPage,
  BoxEntrySnapshot,
  BoxLayoutRuntime,
  ResolvedRuntimeResource,
} from "../shared/types";
import { formatMessage } from "../lib/messages";

const PAGE_LIMIT = 64;
const PREFETCH_AHEAD = 2;
const WHEEL_COOLDOWN_MS = 420;
const NAVIGATION_ANIMATION_MS = 180;

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

interface DragState {
  active: boolean;
  pointerId: number;
  startX: number;
  currentX: number;
}

const CARD_SIZE_STYLE: Record<LayoutConfig["props"]["cardSize"], {
  width: string;
  minHeight: string;
}> = {
  compact: {
    width: "min(82vw, 320px)",
    minHeight: "420px",
  },
  regular: {
    width: "min(86vw, 420px)",
    minHeight: "520px",
  },
  large: {
    width: "min(90vw, 520px)",
    minHeight: "620px",
  },
};

const CARD_STACK_LAYOUT_STYLE = `
[data-scope="chips-box-cardstack-layout"] {
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 100%;
  box-sizing: border-box;
  color: #1d1d1f;
  background-color: #ffffff;
  overflow: visible;
}

[data-scope="chips-box-cardstack-layout"] [data-layout-background] {
  position: sticky;
  top: 0;
  width: 100%;
  block-size: 100vh;
  margin-block-end: -100vh;
  pointer-events: none;
}

[data-scope="chips-box-cardstack-layout"] [data-layout-shell] {
  position: relative;
  display: grid;
  gap: 16px;
  justify-items: center;
  padding: 16px;
  min-width: 0;
  min-height: 100%;
  box-sizing: border-box;
}

[data-scope="chips-box-cardstack-layout"] [data-layout-top-region] {
  width: min(100%, 960px);
  min-width: 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

[data-scope="chips-box-cardstack-layout"] [data-frame-region],
[data-scope="chips-box-cardstack-layout"] [data-frame-region] .chips-embedded-document-frame,
[data-scope="chips-box-cardstack-layout"] [data-frame-region] iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-cardstack-layout"] [data-frame-region-image] {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

[data-scope="chips-box-cardstack-layout"] [data-layout-top-region] [data-frame-region-image] {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
}

[data-scope="chips-box-cardstack-layout"] [data-frame-region-status],
[data-scope="chips-box-cardstack-layout"] [data-layout-page-error] {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background-color: #ffffff;
  color: #6e6e73;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-stage] {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
  min-height: min(72vh, 720px);
  padding-block: clamp(8px, 3vw, 32px);
}

[data-scope="chips-box-cardstack-layout"] [data-stack-count] {
  color: #6e6e73;
  font-size: 12px;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-viewport] {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--card-stack-width);
  min-height: var(--card-stack-min-height);
  touch-action: pan-y;
  user-select: none;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-placeholder] {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #f2f2f7;
  box-shadow: 0 8px 24px rgb(15 23 42 / 10%);
  opacity: calc(0.82 - (var(--stack-layer) * 0.12));
  transform:
    translate3d(calc(var(--stack-layer) * 12px), calc(var(--stack-layer) * 12px), 0)
    rotate(calc(var(--stack-rotation) * var(--stack-layer) * 1deg));
}

[data-scope="chips-box-cardstack-layout"] [data-stack-current-card] {
  position: relative;
  z-index: 4;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 12px;
  width: 100%;
  min-height: var(--card-stack-min-height);
  padding: 0;
  overflow: hidden;
  text-align: start;
  color: inherit;
  font: inherit;
  cursor: grab;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background-color: #ffffff;
  box-shadow: 0 18px 42px rgb(15 23 42 / 16%);
  transform: translateX(var(--drag-x, 0px)) rotate(var(--drag-rotation, 0deg));
  transition: transform 180ms ease, box-shadow 180ms ease;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-current-card][data-dragging="true"] {
  cursor: grabbing;
  transition: none;
  box-shadow: 0 24px 56px rgb(15 23 42 / 20%);
}

[data-scope="chips-box-cardstack-layout"] [data-stack-current-card][data-motion="next"] {
  transform: translateX(16px) rotate(2deg);
}

[data-scope="chips-box-cardstack-layout"] [data-stack-current-card][data-motion="prev"] {
  transform: translateX(-16px) rotate(-2deg);
}

[data-scope="chips-box-cardstack-layout"] [data-stack-cover] {
  position: relative;
  min-height: 0;
  background-color: #f2f2f7;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-cover] .chips-embedded-document-frame,
[data-scope="chips-box-cardstack-layout"] [data-stack-cover] iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-cover] iframe {
  pointer-events: none;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-cover-placeholder] {
  display: grid;
  place-items: center;
  gap: 8px;
  width: 100%;
  min-height: 100%;
  padding: 24px;
  text-align: center;
  color: #6e6e73;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-cover-placeholder-title] {
  color: #1d1d1f;
  font-weight: 700;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-card-body] {
  display: grid;
  gap: 8px;
  padding: 16px;
  min-width: 0;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-title] {
  margin: 0;
  color: #1d1d1f;
  font-size: clamp(18px, 2.4vw, 24px);
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-summary] {
  margin: 0;
  color: #6e6e73;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-entry-kind] {
  color: #6e6e73;
  font-size: 12px;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-controls] {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-button] {
  min-block-size: 40px;
  padding-inline: 16px;
  padding-block: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background-color: #ffffff;
  color: #1d1d1f;
  font: inherit;
  cursor: pointer;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-button]:disabled {
  cursor: default;
  color: #6e6e73;
  background-color: #f2f2f7;
}

[data-scope="chips-box-cardstack-layout"] [data-layout-page-error],
[data-scope="chips-box-cardstack-layout"] [data-frame-region-status] {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 160px;
  padding: 16px;
  text-align: center;
}

[data-scope="chips-box-cardstack-layout"] [data-stack-current-card]:focus-visible,
[data-scope="chips-box-cardstack-layout"] [data-stack-button]:focus-visible {
  outline: 2px solid #0a84ff;
  outline-offset: 2px;
}

@media (max-width: 520px) {
  [data-scope="chips-box-cardstack-layout"] [data-layout-shell] {
    padding-inline: 12px;
  }

  [data-scope="chips-box-cardstack-layout"] [data-stack-stage] {
    min-height: 620px;
  }
}
`;

function resolveEntryTitle(entry: BoxEntrySnapshot): string {
  return entry.snapshot.title ?? entry.snapshot.documentId ?? entry.entryId;
}

function resolveEntrySummary(entry: BoxEntrySnapshot): string {
  const summary = entry.snapshot.summary?.trim();
  return summary && summary.length > 0 ? summary : formatMessage("layout.summary_missing");
}

function resolveEntryKindMessage(entry: BoxEntrySnapshot): string {
  if (entry.snapshot.contentType === "chips/box") {
    return formatMessage("layout.entry_type_box");
  }
  return formatMessage("layout.entry_type_card");
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sortEntries(
  entries: BoxEntrySnapshot[],
  config: LayoutConfig
): BoxEntrySnapshot[] {
  if (config.props.sortMode === "manual") {
    return entries;
  }

  if (config.props.sortMode === "name") {
    return [...entries].sort((left, right) => {
      const compared = resolveEntryTitle(left).localeCompare(resolveEntryTitle(right), "zh-CN");
      return compared !== 0 ? compared : left.entryId.localeCompare(right.entryId);
    });
  }

  const seed = config.props.randomSeed;
  return [...entries].sort((left, right) => {
    const leftScore = hashString(`${seed}\u0000${left.entryId}`);
    const rightScore = hashString(`${seed}\u0000${right.entryId}`);
    return leftScore !== rightScore ? leftScore - rightScore : left.entryId.localeCompare(right.entryId);
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

function collectNextEntries(
  entries: BoxEntrySnapshot[],
  startIndex: number,
  count: number,
  loop: boolean
): BoxEntrySnapshot[] {
  if (entries.length <= 1 || count <= 0) {
    return [];
  }

  const next: BoxEntrySnapshot[] = [];
  for (let offset = 1; offset <= count; offset += 1) {
    const rawIndex = startIndex + offset;
    if (rawIndex < entries.length) {
      const entry = entries[rawIndex];
      if (entry) {
        next.push(entry);
      }
    } else if (loop) {
      const entry = entries[rawIndex % entries.length];
      if (entry) {
        next.push(entry);
      }
    }
  }

  return [...new Map(next.map((entry) => [entry.entryId, entry])).values()];
}

function FrameRegionSurface({
  region,
  runtime,
  title,
  ratio,
  autoHeight = false,
  decorative = false,
}: {
  region: FrameRegionConfig;
  runtime: BoxLayoutRuntime;
  title: string;
  ratio?: string;
  autoHeight?: boolean;
  decorative?: boolean;
}) {
  const [state, setState] = useState<FrameRegionState>({ status: "idle" });

  useEffect(() => {
    if (region.mode !== "image" || !region.assetPath) {
      setState({ status: "idle" });
      return;
    }

    const assetPath = region.assetPath;
    let cancelled = false;
    setState({ status: "loading" });
    void Promise
      .resolve()
      .then(() => runtime.readBoxAsset(assetPath))
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
          ratio={autoHeight ? undefined : ratio}
          autoHeight={autoHeight}
          maxHeightFactor={autoHeight ? 3 : undefined}
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

function CurrentCover({
  entry,
  runtime,
  onOpen,
}: {
  entry: BoxEntrySnapshot;
  runtime: BoxLayoutRuntime;
  onOpen(): void;
}) {
  const [coverState, setCoverState] = useState<CoverState>(() => ({
    status: entry.snapshot.cover?.mode === "none" ? "idle" : "loading",
  }));

  useEffect(() => {
    if (entry.snapshot.cover?.mode === "none") {
      setCoverState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setCoverState({ status: "loading" });
    void Promise
      .resolve()
      .then(() => runtime.renderEntryCover(entry.entryId))
      .then((view) => {
        if (!cancelled) {
          setCoverState({
            status: "ready",
            view,
          });
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

  const title = resolveEntryTitle(entry);
  const ratio = coverState.view?.ratio ?? "3:4";

  if (coverState.status === "ready" && coverState.view?.coverUrl) {
    return (
      <div data-stack-cover>
        <EmbeddedDocumentFrame
          title={coverState.view.title || title}
          src={coverState.view.coverUrl}
          ratio={ratio}
          sandbox="allow-scripts"
          onActivate={onOpen}
        />
      </div>
    );
  }

  const message =
    coverState.status === "loading"
      ? formatMessage("layout.loading")
      : coverState.status === "error"
        ? formatMessage("layout.cover_error")
        : formatMessage("layout.cover_missing");

  return (
    <div data-stack-cover>
      <div data-stack-cover-placeholder data-state={coverState.status}>
        <strong data-stack-cover-placeholder-title>{title}</strong>
        <span>{message}</span>
        <span data-stack-entry-kind>{resolveEntryKindMessage(entry)}</span>
      </div>
    </div>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function LayoutViewPage({ initialView, config, runtime }: LayoutViewProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const isMountedRef = useRef(true);
  const wheelTimeRef = useRef(0);
  const animationTimerRef = useRef<number | undefined>();
  const suppressClickRef = useRef(false);
  const [items, setItems] = useState<BoxEntrySnapshot[]>(initialView.items);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialView.nextCursor);
  const [total, setTotal] = useState(initialView.total);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [motion, setMotion] = useState<"next" | "prev" | undefined>();
  const [drag, setDrag] = useState<DragState | undefined>();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (animationTimerRef.current !== undefined) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setItems(initialView.items);
    setNextCursor(initialView.nextCursor);
    setTotal(initialView.total);
    setCurrentIndex(0);
    setIsLoadingNext(false);
    setPageError(false);
  }, [initialView]);

  const enabledEntries = useMemo(
    () => sortEntries(items.filter((entry) => entry.enabled), config),
    [config, items]
  );
  const currentEntry = enabledEntries[currentIndex];
  const loop = config.props.reviewLoop === "loop";
  const lowerEntries = useMemo(
    () => collectNextEntries(enabledEntries, currentIndex, config.props.stackDepth - 1, loop),
    [config.props.stackDepth, currentIndex, enabledEntries, loop]
  );
  const prefetchEntries = useMemo(
    () => collectNextEntries(enabledEntries, currentIndex, PREFETCH_AHEAD, loop),
    [currentIndex, enabledEntries, loop]
  );
  const hasTopRegion = hasFrameRegionContent(config.props.topRegion);
  const hasBackground = hasFrameRegionContent(config.props.background);
  const cardSize = CARD_SIZE_STYLE[config.props.cardSize];
  const hasPrevious = enabledEntries.length > 1 && (currentIndex > 0 || loop);
  const hasNext = Boolean(currentEntry)
    && (currentIndex < enabledEntries.length - 1 || (loop && enabledEntries.length > 1) || Boolean(nextCursor));
  const dragX = drag?.active ? drag.currentX - drag.startX : 0;

  const markMotion = useCallback((direction: "next" | "prev") => {
    if (animationTimerRef.current !== undefined) {
      window.clearTimeout(animationTimerRef.current);
    }
    setMotion(direction);
    animationTimerRef.current = window.setTimeout(() => {
      if (isMountedRef.current) {
        setMotion(undefined);
      }
    }, NAVIGATION_ANIMATION_MS);
  }, []);

  const loadNextPage = useCallback(async (): Promise<boolean> => {
    if (!nextCursor || isLoadingNext) {
      return false;
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
        return false;
      }
      setItems((current) => appendUniqueEntries(current, page.items));
      setNextCursor(page.nextCursor);
      setTotal(page.total);
      return page.items.length > 0;
    } catch {
      if (isMountedRef.current) {
        setPageError(true);
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsLoadingNext(false);
      }
    }
  }, [isLoadingNext, nextCursor, runtime]);

  const goNext = useCallback(() => {
    if (enabledEntries.length === 0) {
      return;
    }
    markMotion("next");
    if (currentIndex < enabledEntries.length - 1) {
      setCurrentIndex((index) => Math.min(index + 1, enabledEntries.length - 1));
      return;
    }
    if (nextCursor) {
      void loadNextPage().then((added) => {
        if (added && isMountedRef.current) {
          setCurrentIndex((index) => Math.min(index + 1, Math.max(enabledEntries.length, index + 1)));
        } else if (loop && isMountedRef.current) {
          setCurrentIndex(0);
        }
      });
      return;
    }
    if (loop) {
      setCurrentIndex(0);
    }
  }, [currentIndex, enabledEntries.length, loadNextPage, loop, markMotion, nextCursor]);

  const goPrevious = useCallback(() => {
    if (enabledEntries.length === 0) {
      return;
    }
    markMotion("prev");
    if (currentIndex > 0) {
      setCurrentIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (loop) {
      setCurrentIndex(enabledEntries.length - 1);
    }
  }, [currentIndex, enabledEntries.length, loop, markMotion]);

  useEffect(() => {
    if (currentIndex <= enabledEntries.length - 1) {
      return;
    }
    setCurrentIndex(Math.max(0, enabledEntries.length - 1));
  }, [currentIndex, enabledEntries.length]);

  useEffect(() => {
    if (prefetchEntries.length === 0) {
      return;
    }
    void runtime
      .prefetchEntries({
        entryIds: prefetchEntries.map((entry) => entry.entryId),
        targets: ["cover"],
      })
      .catch(() => undefined);
  }, [prefetchEntries, runtime]);

  useEffect(() => {
    const ownerDocument = rootRef.current?.ownerDocument ?? document;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        goNext();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        goPrevious();
      }
    };
    ownerDocument.addEventListener("keydown", handleKeyDown);
    return () => {
      ownerDocument.removeEventListener("keydown", handleKeyDown);
    };
  }, [goNext, goPrevious]);

  const handleOpen = useCallback(() => {
    if (!currentEntry || suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    void runtime.openEntry(currentEntry.entryId);
  }, [currentEntry, runtime]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (Math.abs(event.deltaY) < 20) {
      return;
    }
    event.preventDefault();
    const now = Date.now();
    if (now - wheelTimeRef.current < WHEEL_COOLDOWN_MS) {
      return;
    }
    wheelTimeRef.current = now;
    if (event.deltaY > 0) {
      goNext();
    } else {
      goPrevious();
    }
  }, [goNext, goPrevious]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture may be unavailable in test environments.
    }
    setDrag({
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      currentX: event.clientX,
    });
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    setDrag((current) => {
      if (!current?.active || current.pointerId !== event.pointerId) {
        return current;
      }
      return {
        ...current,
        currentX: event.clientX,
      };
    });
  }, []);

  const finishDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    setDrag((current) => {
      if (!current?.active || current.pointerId !== event.pointerId) {
        return current;
      }
      const offset = current.currentX - current.startX;
      suppressClickRef.current = Math.abs(offset) > 8;
      if (Math.abs(offset) >= config.props.swipeThreshold) {
        if (offset < 0) {
          goNext();
        } else {
          goPrevious();
        }
      }
      return undefined;
    });
  }, [config.props.swipeThreshold, goNext, goPrevious]);

  return (
    <section
      ref={rootRef}
      data-scope="chips-box-cardstack-layout"
      style={{
        "--card-stack-width": cardSize.width,
        "--card-stack-min-height": cardSize.minHeight,
        "--stack-rotation": String(config.props.spreadRotationDeg),
      } as React.CSSProperties}
    >
      <style>{CARD_STACK_LAYOUT_STYLE}</style>

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
              autoHeight
            />
          </div>
        ) : null}

        {currentEntry ? (
          <div data-stack-stage onWheel={handleWheel}>
            <span data-stack-count>
              {formatMessage("layout.position", {
                current: currentIndex + 1,
                total: total || enabledEntries.length,
              })}
            </span>
            <div data-stack-viewport data-entry-count={enabledEntries.length}>
              {lowerEntries.map((entry, index) => (
                <div
                  key={`${entry.entryId}-${index}`}
                  data-stack-placeholder
                  data-entry-id={entry.entryId}
                  aria-hidden="true"
                  style={{
                    "--stack-layer": String(index + 1),
                  } as React.CSSProperties}
                />
              ))}
              <button
                type="button"
                data-stack-current-card
                data-entry-id={currentEntry.entryId}
                data-dragging={drag?.active ? "true" : undefined}
                data-motion={motion}
                style={{
                  "--drag-x": `${dragX}px`,
                  "--drag-rotation": `${Math.max(-10, Math.min(10, dragX / 24))}deg`,
                } as React.CSSProperties}
                onClick={handleOpen}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
              >
                <CurrentCover
                  entry={currentEntry}
                  runtime={runtime}
                  onOpen={handleOpen}
                />
                <span data-stack-card-body>
                  <strong data-stack-title>{resolveEntryTitle(currentEntry)}</strong>
                  <span data-stack-summary>{resolveEntrySummary(currentEntry)}</span>
                  <span data-stack-entry-kind>{resolveEntryKindMessage(currentEntry)}</span>
                </span>
              </button>
            </div>
            <div data-stack-controls>
              <button
                type="button"
                data-stack-button
                data-stack-prev
                disabled={!hasPrevious}
                onClick={goPrevious}
              >
                {formatMessage("layout.previous")}
              </button>
              <button
                type="button"
                data-stack-button
                data-stack-next
                disabled={!hasNext || isLoadingNext}
                onClick={goNext}
              >
                {isLoadingNext
                  ? formatMessage("layout.loading_more")
                  : formatMessage("layout.next")}
              </button>
            </div>
            {pageError ? (
              <div data-layout-page-error role="status">
                <span>{formatMessage("layout.page_error")}</span>
                <button type="button" data-stack-button onClick={() => void loadNextPage()}>
                  {formatMessage("layout.retry")}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <LayoutSkeleton
            minHeight={300}
            hint={
              <EmptyHint
                title={formatMessage("layout.empty")}
                description={formatMessage("layout.empty_hint")}
              />
            }
          >
            <div
              data-layout-skeleton-stack
              style={{
                position: "relative",
                width: 200,
                aspectRatio: "3 / 4",
                margin: "0 auto",
              }}
            >
              <div
                data-layout-skeleton-card
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: "translate(-14px, 8px) rotate(-4deg)",
                }}
              >
                <SkeletonBlock width="100%" height="100%" radius={12} />
              </div>
              <div
                data-layout-skeleton-card
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: "translate(14px, 8px) rotate(4deg)",
                }}
              >
                <SkeletonBlock width="100%" height="100%" radius={12} />
              </div>
              <div
                data-layout-skeleton-card
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 3,
                }}
              >
                <SkeletonBlock
                  dashed
                  width="100%"
                  height="100%"
                  radius={12}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "#ffffff",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    padding: 24,
                  }}
                >
                  <SkeletonLine width="60%" />
                  <SkeletonLine width="40%" height={8} radius={4} />
                </div>
              </div>
            </div>
          </LayoutSkeleton>
        )}
      </div>
    </section>
  );
}
