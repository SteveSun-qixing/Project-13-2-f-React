import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmbeddedDocumentFrame, EmptyHint, LayoutSkeleton, SkeletonBlock, SkeletonLine } from "@chips/ui";
import { hasFrameRegionContent, type LayoutConfig } from "../schema/layout-config";
import { createScatterPlacements, orderScatteredEntries } from "../shared/scatter";
import { FrameRegionSurface } from "../shared/frame-region";
import type {
  BoxEntryCoverView,
  BoxEntryPage,
  BoxEntrySnapshot,
  BoxLayoutRuntime,
} from "../shared/types";
import { formatMessage } from "../lib/messages";

const PAGE_LIMIT = 36;
const COVER_PREFETCH_COUNT = 4;

export interface LayoutViewProps {
  initialView: BoxEntryPage;
  config: LayoutConfig;
  runtime: BoxLayoutRuntime;
}

interface CoverState {
  status: "idle" | "loading" | "ready" | "error";
  view?: BoxEntryCoverView;
}

const SCATTERED_LAYOUT_STYLE = `
[data-scope="chips-box-scattered-layout"] {
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 100%;
  overflow: visible;
  box-sizing: border-box;
  color: #1d1d1f;
  background: #ffffff;
}

[data-scope="chips-box-scattered-layout"] * {
  box-sizing: border-box;
}

[data-scope="chips-box-scattered-layout"] [data-layout-background] {
  position: sticky;
  top: 0;
  width: 100%;
  height: 100vh;
  margin-bottom: -100vh;
  z-index: 0;
  pointer-events: none;
}

[data-scope="chips-box-scattered-layout"] [data-layout-background] .chips-embedded-document-frame,
[data-scope="chips-box-scattered-layout"] [data-layout-background] iframe,
[data-scope="chips-box-scattered-layout"] [data-layout-top-region] .chips-embedded-document-frame,
[data-scope="chips-box-scattered-layout"] [data-layout-top-region] iframe,
[data-scope="chips-box-scattered-layout"] [data-scattered-real-cover] .chips-embedded-document-frame,
[data-scope="chips-box-scattered-layout"] [data-scattered-real-cover] iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-real-cover] iframe {
  pointer-events: none;
}

[data-scope="chips-box-scattered-layout"] [data-layout-shell] {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 18px;
  min-width: 0;
  min-height: 100%;
  padding: 18px;
}

[data-scope="chips-box-scattered-layout"] [data-layout-top-region] {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
}

[data-scope="chips-box-scattered-layout"] [data-frame-region-status] {
  display: grid;
  place-items: center;
  min-height: 128px;
  padding: 18px;
  color: #6e6e73;
  text-align: center;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-stage] {
  --scattered-card-width: clamp(190px, 34vw, 320px);
  position: relative;
  display: grid;
  place-items: center;
  min-height: clamp(440px, 68vh, 760px);
  padding: clamp(48px, 8vw, 92px) 18px;
  overflow: visible;
  isolation: isolate;
  outline: none;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-stage][data-card-size="compact"] {
  --scattered-card-width: clamp(168px, 28vw, 252px);
}

[data-scope="chips-box-scattered-layout"] [data-scattered-stage][data-card-size="large"] {
  --scattered-card-width: clamp(220px, 40vw, 380px);
}

[data-scope="chips-box-scattered-layout"] [data-scattered-stack] {
  position: relative;
  width: min(100%, calc(var(--scattered-card-width) + 220px));
  min-height: calc(var(--scattered-card-width) * 1.62);
}

[data-scope="chips-box-scattered-layout"] [data-scattered-fake],
[data-scope="chips-box-scattered-layout"] [data-scattered-real] {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--scattered-card-width);
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  transform: translate(calc(-50% + var(--scatter-x)), calc(-50% + var(--scatter-y))) rotate(var(--scatter-rotate)) scale(var(--scatter-scale));
  transform-origin: center;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-fake] {
  z-index: var(--scatter-depth);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: var(--scatter-color);
}

[data-scope="chips-box-scattered-layout"] [data-scattered-real] {
  z-index: 64;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 22px 58px rgba(0, 0, 0, 0.24);
  background: #ffffff;
  transition: transform 240ms ease, box-shadow 240ms ease;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-real-cover] {
  position: relative;
  min-height: 0;
  background: #f2f2f7;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-real-cover]:focus-visible {
  outline: 2px solid #0a84ff;
  outline-offset: 2px;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-cover-placeholder] {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  gap: 8px;
  border: none;
  padding: 18px;
  background: transparent;
  color: #1d1d1f;
  cursor: pointer;
  text-align: center;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-cover-placeholder-title] {
  font-weight: 700;
  line-height: 1.45;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-cover-placeholder-text] {
  color: #6e6e73;
  font-size: 12px;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-real-body] {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 12px 14px 14px;
  background: #ffffff;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-title],
[data-scope="chips-box-scattered-layout"] [data-scattered-nav],
[data-scope="chips-box-scattered-layout"] [data-layout-retry] {
  border: none;
  margin: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-title] {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  background: transparent;
  color: #1d1d1f;
  font-weight: 700;
  line-height: 1.45;
  text-align: start;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-summary] {
  overflow: hidden;
  color: #6e6e73;
  font-size: 12px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-controls] {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-nav],
[data-scope="chips-box-scattered-layout"] [data-layout-retry] {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  background: #ffffff;
  color: #1d1d1f;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

[data-scope="chips-box-scattered-layout"] [data-scattered-count] {
  display: inline-grid;
  place-items: center;
  min-height: 38px;
  padding: 0 12px;
  color: #6e6e73;
  font-size: 12px;
}

[data-scope="chips-box-scattered-layout"] [data-layout-page-error] {
  position: relative;
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: clamp(360px, 62vh, 620px);
  overflow: hidden;
  color: #6e6e73;
  text-align: center;
}

[data-scope="chips-box-scattered-layout"] [data-layout-page-error] > * {
  position: relative;
  z-index: 1;
}

[data-scope="chips-box-scattered-layout"] [data-scattered-title]:focus-visible,
[data-scope="chips-box-scattered-layout"] [data-scattered-cover-placeholder]:focus-visible,
[data-scope="chips-box-scattered-layout"] [data-scattered-nav]:focus-visible,
[data-scope="chips-box-scattered-layout"] [data-layout-retry]:focus-visible,
[data-scope="chips-box-scattered-layout"] [data-scattered-stage]:focus-visible {
  outline: 2px solid #0a84ff;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  [data-scope="chips-box-scattered-layout"] [data-scattered-real] {
    transition: none;
  }
}
`;

const FAKE_CARD_COLORS = [
  "color-mix(in srgb, #0a84ff 24%, #ffffff)",
  "color-mix(in srgb, #34c759 24%, #ffffff)",
  "color-mix(in srgb, #ff2d55 22%, #ffffff)",
  "color-mix(in srgb, #ff9f0a 20%, #ffffff)",
  "color-mix(in srgb, #30b0c7 20%, #ffffff)",
  "color-mix(in srgb, #ffcc00 20%, #ffffff)",
  "color-mix(in srgb, #f2f2f7 86%, #0a84ff)",
];

function resolveEntryTitle(entry: BoxEntrySnapshot): string {
  return entry.snapshot.title ?? entry.snapshot.documentId ?? entry.entryId;
}

function appendUniqueEntries(current: BoxEntrySnapshot[], incoming: BoxEntrySnapshot[]): BoxEntrySnapshot[] {
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

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(media.matches);
    const handleChange = () => {
      setPrefersReducedMotion(media.matches);
    };
    media.addEventListener?.("change", handleChange);
    return () => {
      media.removeEventListener?.("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

function TopEntryCard({
  entry,
  runtime,
}: {
  entry: BoxEntrySnapshot;
  runtime: BoxLayoutRuntime;
}) {
  const [coverState, setCoverState] = useState<CoverState>(() => ({
    status: entry.snapshot.cover?.mode === "none" ? "idle" : "loading",
  }));
  const title = resolveEntryTitle(entry);

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

  const openEntry = () => {
    void runtime.openEntry(entry.entryId);
  };

  const placeholderMessage = coverState.status === "loading"
    ? formatMessage("layout.loading")
    : coverState.status === "error"
      ? formatMessage("layout.cover_error")
      : formatMessage("layout.cover_missing");

  const coverView = coverState.status === "ready" ? coverState.view : undefined;
  const showFrame = coverView != null && coverView.coverUrl != null;
  const coverOpenLabel = `${formatMessage("layout.open_entry")}: ${title}`;

  return (
    <article data-scattered-real data-entry-id={entry.entryId}>
      <div
        data-scattered-real-cover
        role={showFrame ? "button" : undefined}
        tabIndex={showFrame ? 0 : undefined}
        aria-label={showFrame ? coverOpenLabel : undefined}
        onClick={showFrame ? openEntry : undefined}
        onKeyDown={(event) => {
          if (!showFrame) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openEntry();
          }
        }}
      >
        {showFrame ? (
          <EmbeddedDocumentFrame
            title={coverView.title || title}
            src={coverView.coverUrl}
            ratio={coverView.ratio ?? "3:4"}
            sandbox="allow-scripts"
            onActivate={openEntry}
          />
        ) : (
          <button
            type="button"
            data-scattered-cover-placeholder
            onClick={openEntry}
            aria-label={coverOpenLabel}
          >
            <strong data-scattered-cover-placeholder-title>{title}</strong>
            <span data-scattered-cover-placeholder-text>{placeholderMessage}</span>
          </button>
        )}
      </div>
      <div data-scattered-real-body>
        <button
          type="button"
          data-scattered-title
          onClick={openEntry}
          title={title}
          aria-label={coverOpenLabel}
        >
          {title}
        </button>
        {entry.snapshot.summary ? (
          <span data-scattered-summary>{entry.snapshot.summary}</span>
        ) : null}
      </div>
    </article>
  );
}

function mod(value: number, length: number): number {
  return ((value % length) + length) % length;
}

interface ScatteredSkeletonCardSpec {
  width: number;
  height: number;
  left: string;
  top: number;
  rotate: number;
  dashed: boolean;
  depth: number;
}

const SCATTERED_SKELETON_CARDS: ScatteredSkeletonCardSpec[] = [
  { width: 150, height: 200, left: "22%", top: 0, rotate: -8, dashed: false, depth: 1 },
  { width: 130, height: 180, left: "50%", top: 36, rotate: 6, dashed: true, depth: 3 },
  { width: 140, height: 190, left: "30%", top: 96, rotate: -3, dashed: false, depth: 2 },
];

function ScatteredSkeleton(): React.ReactElement {
  return (
    <div
      data-scattered-skeleton
      aria-hidden="true"
      style={{
        position: "relative",
        height: 320,
        width: "100%",
        maxWidth: 440,
        margin: "0 auto",
      }}
    >
      {SCATTERED_SKELETON_CARDS.map((card) => (
        <div
          key={`${card.left}-${card.top}`}
          data-scattered-skeleton-card
          style={{
            position: "absolute",
            left: card.left,
            top: card.top,
            width: card.width,
            height: card.height,
            transform: `rotate(${card.rotate}deg)`,
            zIndex: card.depth,
          }}
        >
          <SkeletonBlock width={card.width} height={card.height} radius={12} dashed={card.dashed} />
          <SkeletonLine
            width="55%"
            style={{
              position: "absolute",
              left: 12,
              bottom: 12,
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function LayoutViewPage({ initialView, config, runtime }: LayoutViewProps) {
  const isMountedRef = useRef(true);
  const wheelTimeRef = useRef(0);
  const [items, setItems] = useState<BoxEntrySnapshot[]>(initialView.items);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialView.nextCursor);
  const [total, setTotal] = useState(initialView.total);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();

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
    setActiveIndex(0);
  }, [initialView]);

  const enabledEntries = useMemo(
    () => orderScatteredEntries(
      items.filter((entry) => entry.enabled),
      config.props.sortMode,
      config.props.randomSeed,
    ),
    [config.props.randomSeed, config.props.sortMode, items],
  );

  useEffect(() => {
    if (enabledEntries.length === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((current) => mod(current, enabledEntries.length));
  }, [enabledEntries.length]);

  const activeEntry = enabledEntries.length > 0 ? enabledEntries[mod(activeIndex, enabledEntries.length)] : undefined;
  const hasTopRegion = hasFrameRegionContent(config.props.topRegion);
  const hasBackground = hasFrameRegionContent(config.props.background);
  const shouldAutoCycle = config.props.motion !== "reduced" && !prefersReducedMotion && enabledEntries.length > 1;

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

  const moveActive = useCallback((direction: 1 | -1) => {
    if (enabledEntries.length === 0) {
      return;
    }
    setActiveIndex((current) => {
      const next = mod(current + direction, enabledEntries.length);
      if (direction > 0 && next >= enabledEntries.length - 3 && nextCursor) {
        void loadNextPage();
      }
      return next;
    });
  }, [enabledEntries.length, loadNextPage, nextCursor]);

  useEffect(() => {
    if (!shouldAutoCycle) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      moveActive(1);
    }, config.props.cycleIntervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [config.props.cycleIntervalMs, moveActive, shouldAutoCycle]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        moveActive(1);
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        moveActive(-1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [moveActive]);

  useEffect(() => {
    if (enabledEntries.length === 0 || !activeEntry) {
      return;
    }
    const entryIds = Array.from({ length: Math.min(COVER_PREFETCH_COUNT, enabledEntries.length) }, (_, index) => {
      const entry = enabledEntries[mod(activeIndex + index, enabledEntries.length)];
      return entry?.entryId;
    }).filter((entryId): entryId is string => typeof entryId === "string");

    void runtime.prefetchEntries({
      entryIds,
      targets: ["cover"],
    }).catch(() => undefined);
  }, [activeEntry, activeIndex, enabledEntries, runtime]);

  const fakePlacements = useMemo(
    () => createScatterPlacements(
      Math.min(config.props.visibleFakeCount, Math.max(0, enabledEntries.length - 1)),
      `${config.props.randomSeed}:${activeEntry?.entryId ?? "empty"}`,
      config.props.spread,
    ),
    [activeEntry?.entryId, config.props.randomSeed, config.props.spread, config.props.visibleFakeCount, enabledEntries.length],
  );

  const handleWheel = (event: React.WheelEvent<HTMLElement>) => {
    if (Math.abs(event.deltaY) < 18) {
      return;
    }
    const now = Date.now();
    if (now - wheelTimeRef.current < 420) {
      return;
    }
    wheelTimeRef.current = now;
    moveActive(event.deltaY > 0 ? 1 : -1);
  };

  return (
    <section data-scope="chips-box-scattered-layout">
      <style>{SCATTERED_LAYOUT_STYLE}</style>

      {hasBackground ? (
        <div data-layout-background aria-hidden="true">
          <FrameRegionSurface
            region={config.props.background}
            title={formatMessage("layout.background_title")}
            ratio="16:9"
            readBoxAsset={runtime.readBoxAsset}
          />
        </div>
      ) : null}

      <div data-layout-shell>
        {hasTopRegion ? (
          <div data-layout-top-region>
            <FrameRegionSurface
              region={config.props.topRegion}
              title={formatMessage("layout.top_region_title")}
              autoHeight
              readBoxAsset={runtime.readBoxAsset}
            />
          </div>
        ) : null}

        {enabledEntries.length > 0 && activeEntry ? (
          <>
            <section
              data-scattered-stage
              data-card-size={config.props.cardSize}
              data-motion={config.props.motion}
              tabIndex={0}
              aria-label={formatMessage("layout.stage_label")}
              onWheel={handleWheel}
            >
              <div data-scattered-stack>
                {fakePlacements.map((placement, index) => (
                  <div
                    key={`${activeEntry.entryId}-fake-${index}`}
                    data-scattered-fake
                    aria-hidden="true"
                    style={{
                      "--scatter-x": `${placement.x}%`,
                      "--scatter-y": `${placement.y}%`,
                      "--scatter-rotate": `${placement.rotate}deg`,
                      "--scatter-scale": placement.scale,
                      "--scatter-depth": index + 1,
                      "--scatter-color": FAKE_CARD_COLORS[placement.colorIndex % FAKE_CARD_COLORS.length],
                    } as React.CSSProperties}
                  />
                ))}
                <TopEntryCard
                  key={activeEntry.entryId}
                  entry={activeEntry}
                  runtime={runtime}
                />
              </div>
            </section>

            <div data-scattered-controls>
              <button type="button" data-scattered-nav onClick={() => moveActive(-1)}>
                {formatMessage("layout.previous")}
              </button>
              <span data-scattered-count>
                {formatMessage("layout.position", {
                  current: mod(activeIndex, enabledEntries.length) + 1,
                  total: total || enabledEntries.length,
                })}
              </span>
              <button type="button" data-scattered-nav onClick={() => moveActive(1)}>
                {formatMessage("layout.next")}
              </button>
            </div>
          </>
        ) : (
          <LayoutSkeleton
            minHeight={480}
            hint={
              <EmptyHint
                title={formatMessage("layout.empty")}
                description={formatMessage("layout.empty_hint")}
              />
            }
          >
            <ScatteredSkeleton />
          </LayoutSkeleton>
        )}

        {pageError ? (
          <div data-layout-page-error role="status">
            <span>{formatMessage("layout.page_error")}</span>
            <button type="button" data-layout-retry onClick={loadNextPage}>
              {formatMessage("layout.retry")}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
