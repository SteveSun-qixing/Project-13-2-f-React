import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmbeddedDocumentFrame, EmptyHint, LayoutSkeleton, SkeletonBlock, SkeletonDot, SkeletonLine } from "@chips/ui";
import {
  hasCustomMapImage,
  hasFrameRegionContent,
  isValidBounds,
  isValidLatitude,
  isValidLongitude,
  type FrameRegionConfig,
  type GeoPoint,
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

const PAGE_LIMIT = 120;

export interface LayoutViewProps {
  initialView: BoxEntryPage;
  config: LayoutConfig;
  runtime: BoxLayoutRuntime;
}

interface ResourceState {
  status: "idle" | "loading" | "ready" | "error";
  resource?: ResolvedRuntimeResource;
}

interface CoverState {
  status: "idle" | "loading" | "ready" | "error";
  view?: BoxEntryCoverView;
}

interface PositionedEntry {
  entry: BoxEntrySnapshot;
  location: LayoutConfig["props"]["entries"][string];
  label: string;
  x: number;
  y: number;
}

const MAP_LAYOUT_STYLE = `
[data-scope="chips-box-map-layout"] {
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 100%;
  box-sizing: border-box;
  color: #1d1d1f;
  background: #ffffff;
  font: inherit;
}

[data-scope="chips-box-map-layout"],
[data-scope="chips-box-map-layout"] * {
  box-sizing: border-box;
}

[data-scope="chips-box-map-layout"] [data-layout-shell] {
  position: relative;
  display: grid;
  gap: 16px;
  min-width: 0;
  min-height: 100%;
  padding: 16px;
}

[data-scope="chips-box-map-layout"] [data-layout-top-region] {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: transparent;
}

[data-scope="chips-box-map-layout"] [data-frame-region],
[data-scope="chips-box-map-layout"] [data-frame-region] .chips-embedded-document-frame,
[data-scope="chips-box-map-layout"] [data-frame-region] .chips-embedded-document-frame iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-map-layout"] [data-frame-region-image] {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

[data-scope="chips-box-map-layout"] [data-layout-top-region] [data-frame-region-image] {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
}

[data-scope="chips-box-map-layout"] [data-map-stage] {
  position: relative;
  min-width: 0;
  min-height: clamp(420px, 66vh, 760px);
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: #ffffff;
  isolation: isolate;
}

[data-scope="chips-box-map-layout"] [data-map-world] {
  position: absolute;
  inset: 0;
  transform-origin: center;
  transition: transform 180ms ease;
}

[data-scope="chips-box-map-layout"] [data-map-default-image] {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 34%, color-mix(in srgb, #0a84ff 18%, transparent) 0 10%, transparent 11%),
    radial-gradient(circle at 72% 46%, color-mix(in srgb, #5e5ce6 22%, transparent) 0 13%, transparent 14%),
    radial-gradient(circle at 48% 72%, color-mix(in srgb, #af52de 16%, transparent) 0 11%, transparent 12%),
    linear-gradient(120deg, transparent 0 44%, color-mix(in srgb, #0a84ff 14%, transparent) 45% 47%, transparent 48%),
    linear-gradient(35deg, transparent 0 52%, color-mix(in srgb, #5e5ce6 14%, transparent) 53% 55%, transparent 56%),
    repeating-linear-gradient(0deg, color-mix(in srgb, #6e6e73 16%, transparent) 0 1px, transparent 1px 11.111%),
    repeating-linear-gradient(90deg, color-mix(in srgb, #6e6e73 16%, transparent) 0 1px, transparent 1px 11.111%),
    #f2f2f7;
}

[data-scope="chips-box-map-layout"] [data-map-asset-image] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

[data-scope="chips-box-map-layout"] [data-map-unavailable],
[data-scope="chips-box-map-layout"] [data-map-asset-status],
[data-scope="chips-box-map-layout"] [data-layout-page-error] {
  display: grid;
  place-items: center;
  min-height: 120px;
  padding: 16px;
  text-align: center;
  color: #6e6e73;
}

[data-scope="chips-box-map-layout"] [data-map-markers] {
  position: absolute;
  inset: 0;
}

[data-scope="chips-box-map-layout"] [data-map-marker] {
  position: absolute;
  left: var(--marker-x);
  top: var(--marker-y);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  max-width: min(280px, 48vw);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  padding: 4px 12px;
  color: #1d1d1f;
  background: color-mix(in srgb, #ffffff 92%, transparent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  font: inherit;
  cursor: pointer;
  transform: translate(-50%, -50%);
  transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}

[data-scope="chips-box-map-layout"] [data-map-marker][data-marker-style="pin-title"] {
  border-radius: 12px;
}

[data-scope="chips-box-map-layout"] [data-map-marker][data-selected="true"] {
  border-color: #0a84ff;
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
  transform: translate(-50%, -50%) scale(1.04);
  z-index: 3;
}

[data-scope="chips-box-map-layout"] [data-map-marker-dot] {
  inline-size: 10px;
  block-size: 10px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #0a84ff;
}

[data-scope="chips-box-map-layout"] [data-map-marker][data-marker-style="pin-title"] [data-map-marker-dot] {
  inline-size: 12px;
  block-size: 12px;
  border-radius: 999px 999px 999px 2px;
  transform: rotate(-45deg);
}

[data-scope="chips-box-map-layout"] [data-map-marker-label] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}

[data-scope="chips-box-map-layout"] [data-map-controls] {
  position: absolute;
  inset-block-start: 12px;
  inset-inline-end: 12px;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

[data-scope="chips-box-map-layout"] [data-map-controls] button,
[data-scope="chips-box-map-layout"] [data-map-marker],
[data-scope="chips-box-map-layout"] [data-layout-load-more],
[data-scope="chips-box-map-layout"] [data-layout-retry],
[data-scope="chips-box-map-layout"] [data-unlocated-entry] {
  border: 1px solid rgba(0, 0, 0, 0.08);
}

[data-scope="chips-box-map-layout"] [data-map-controls] button,
[data-scope="chips-box-map-layout"] [data-layout-load-more],
[data-scope="chips-box-map-layout"] [data-layout-retry],
[data-scope="chips-box-map-layout"] [data-unlocated-entry] {
  min-height: 36px;
  border-radius: 12px;
  padding-inline: 12px;
  background: #ffffff;
  color: #1d1d1f;
  font: inherit;
  cursor: pointer;
}

[data-scope="chips-box-map-layout"] [data-map-selected] {
  position: absolute;
  inset-inline: 12px;
  inset-block-end: 12px;
  z-index: 4;
  display: grid;
  grid-template-columns: minmax(0, 120px) minmax(0, 1fr);
  gap: 12px;
  max-width: min(520px, calc(100% - 48px));
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: color-mix(in srgb, #ffffff 94%, transparent);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
}

[data-scope="chips-box-map-layout"] [data-selected-cover] {
  min-width: 0;
  overflow: hidden;
  border-radius: 12px;
  background: #ffffff;
  aspect-ratio: 3 / 4;
}

[data-scope="chips-box-map-layout"] [data-selected-cover],
[data-scope="chips-box-map-layout"] [data-selected-cover] .chips-embedded-document-frame,
[data-scope="chips-box-map-layout"] [data-selected-cover] .chips-embedded-document-frame iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-map-layout"] [data-selected-cover-status] {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  padding: 8px;
  color: #6e6e73;
  text-align: center;
}

[data-scope="chips-box-map-layout"] [data-selected-body] {
  display: grid;
  align-content: center;
  gap: 8px;
  min-width: 0;
}

[data-scope="chips-box-map-layout"] [data-selected-title] {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

[data-scope="chips-box-map-layout"] [data-selected-summary] {
  margin: 0;
  color: #6e6e73;
}

[data-scope="chips-box-map-layout"] [data-selected-actions] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

[data-scope="chips-box-map-layout"] [data-selected-actions] button {
  min-height: 36px;
  border: none;
  border-radius: 12px;
  padding-inline: 12px;
  color: #1d1d1f;
  background: #f2f2f7;
  font: inherit;
  cursor: pointer;
}

[data-scope="chips-box-map-layout"] [data-unlocated] {
  display: grid;
  gap: 8px;
  min-width: 0;
}

[data-scope="chips-box-map-layout"] [data-unlocated-list] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

[data-scope="chips-box-map-layout"] [data-layout-footer] {
  display: flex;
  justify-content: center;
  align-items: center;
}

[data-scope="chips-box-map-layout"] button:focus-visible,
[data-scope="chips-box-map-layout"] [data-map-marker]:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

@media (max-width: 640px) {
  [data-scope="chips-box-map-layout"] [data-layout-shell] {
    padding: 12px;
  }

  [data-scope="chips-box-map-layout"] [data-map-stage] {
    min-height: 520px;
  }

  [data-scope="chips-box-map-layout"] [data-map-selected] {
    grid-template-columns: minmax(0, 1fr);
  }
}
`;

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

function projectPoint(point: GeoPoint, config: LayoutConfig): { x: number; y: number } | undefined {
  const bounds = config.props.mapSource.bounds;
  if (!isValidBounds(bounds) || !isValidLatitude(point.latitude) || !isValidLongitude(point.longitude)) {
    return undefined;
  }
  const x = ((point.longitude - bounds.west) / (bounds.east - bounds.west)) * 100;
  const y = ((bounds.north - point.latitude) / (bounds.north - bounds.south)) * 100;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }
  return {
    x,
    y,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function FrameRegionSurface({
  region,
  runtime,
  title,
  ratio,
  autoHeight,
}: {
  region: FrameRegionConfig;
  runtime: BoxLayoutRuntime;
  title: string;
  ratio?: string;
  autoHeight?: boolean;
}) {
  const [state, setState] = useState<ResourceState>({ status: "idle" });

  useEffect(() => {
    if (region.mode !== "image" || !region.assetPath) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    void runtime.readBoxAsset(region.assetPath)
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
        <img data-frame-region-image src={state.resource.resourceUrl} alt={title} />
      </div>
    );
  }

  return (
    <div data-map-asset-status role="status">
      {state.status === "loading"
        ? formatMessage("layout.asset_loading")
        : formatMessage("layout.asset_error")}
    </div>
  );
}

function MapAssetLayer({
  config,
  runtime,
}: {
  config: LayoutConfig;
  runtime: BoxLayoutRuntime;
}) {
  const [state, setState] = useState<ResourceState>({ status: "idle" });
  const assetPath = config.props.mapSource.assetPath;

  useEffect(() => {
    if (!hasCustomMapImage(config.props.mapSource) || !assetPath) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    void runtime.readBoxAsset(assetPath)
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
  }, [assetPath, config.props.mapSource, runtime]);

  if (state.status === "ready" && state.resource?.resourceUrl) {
    return <img data-map-asset-image src={state.resource.resourceUrl} alt={formatMessage("layout.map_image_alt")} />;
  }

  return (
    <>
      <div data-map-default-image aria-hidden="true" />
      {state.status === "loading" || state.status === "error" ? (
        <div data-map-asset-status role="status">
          {state.status === "loading"
            ? formatMessage("layout.asset_loading")
            : formatMessage("layout.asset_error")}
        </div>
      ) : null}
    </>
  );
}

function SelectedEntryPreview({
  entry,
  runtime,
  showCover,
  onClose,
}: {
  entry: BoxEntrySnapshot;
  runtime: BoxLayoutRuntime;
  showCover: boolean;
  onClose(): void;
}) {
  const [coverState, setCoverState] = useState<CoverState>({ status: "idle" });

  useEffect(() => {
    if (!showCover || entry.snapshot.cover?.mode === "none") {
      setCoverState({ status: "idle" });
      return;
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
  }, [entry.entryId, entry.snapshot.cover?.mode, runtime, showCover]);

  const title = resolveEntryTitle(entry);
  const openEntry = () => {
    void runtime.openEntry(entry.entryId);
  };

  return (
    <aside data-map-selected data-entry-id={entry.entryId}>
      {showCover ? (
        <div data-selected-cover>
          {coverState.status === "ready" && coverState.view?.coverUrl ? (
            <EmbeddedDocumentFrame
              title={coverState.view.title || title}
              src={coverState.view.coverUrl}
              ratio={coverState.view.ratio ?? "3:4"}
              sandbox="allow-scripts"
              onActivate={openEntry}
            />
          ) : (
            <div data-selected-cover-status role={coverState.status === "loading" ? "status" : undefined}>
              {coverState.status === "loading"
                ? formatMessage("layout.loading")
                : coverState.status === "error"
                  ? formatMessage("layout.cover_error")
                  : formatMessage("layout.cover_missing")}
            </div>
          )}
        </div>
      ) : null}
      <div data-selected-body>
        <h2 data-selected-title>{title}</h2>
        {entry.snapshot.summary ? <p data-selected-summary>{entry.snapshot.summary}</p> : null}
        <div data-selected-actions>
          <button type="button" onClick={openEntry}>{formatMessage("layout.open_entry")}</button>
          <button type="button" onClick={onClose}>{formatMessage("layout.close_preview")}</button>
        </div>
      </div>
    </aside>
  );
}

const SKELETON_PIN_SPOTS = [
  { left: 24, top: 36 },
  { left: 56, top: 64 },
  { left: 78, top: 42 },
] as const;

function MapSkeletonPin({ left, top }: { left: number; top: number }): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: `${left}%`,
        top: `${top}%`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: "translate(-50%, -100%)",
      }}
    >
      <SkeletonBlock width={64} height={44} radius={10} />
      <span
        style={{
          width: 2,
          height: 20,
          flex: "0 0 auto",
          background: "rgba(0, 0, 0, 0.05)",
          borderRadius: 1,
        }}
      />
      <SkeletonDot size={12} />
    </div>
  );
}

function MapLayoutSkeleton(): React.ReactElement {
  return (
    <LayoutSkeleton
      minHeight={320}
      hint={
        <EmptyHint
          title={formatMessage("layout.empty")}
          description={formatMessage("layout.empty_hint")}
        />
      }
    >
      <div
        data-map-skeleton
        aria-hidden="true"
        style={{
          position: "relative",
          width: "100%",
          height: 240,
          overflow: "hidden",
          borderRadius: 16,
          background: "linear-gradient(180deg, #f7f7fa 0%, #f2f2f7 100%)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.04) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.04) 0 1px, transparent 1px 40px)",
          }}
        />
        <SkeletonLine
          width="100%"
          height={3}
          radius={2}
          style={{
            position: "absolute",
            left: 0,
            top: "16%",
            transform: "rotate(-8deg)",
            background: "rgba(0, 0, 0, 0.05)",
          }}
        />
        <SkeletonLine
          width="100%"
          height={3}
          radius={2}
          style={{
            position: "absolute",
            left: 0,
            top: "34%",
            transform: "rotate(12deg)",
            background: "rgba(0, 0, 0, 0.05)",
          }}
        />
        <SkeletonLine
          width="100%"
          height={3}
          radius={2}
          style={{
            position: "absolute",
            left: 0,
            top: "62%",
            transform: "rotate(-12deg)",
            background: "rgba(0, 0, 0, 0.05)",
          }}
        />
        {SKELETON_PIN_SPOTS.map((spot) => (
          <MapSkeletonPin key={`${spot.left}-${spot.top}`} left={spot.left} top={spot.top} />
        ))}
      </div>
    </LayoutSkeleton>
  );
}

export function LayoutViewPage({ initialView, config, runtime }: LayoutViewProps) {
  const isMountedRef = useRef(true);
  const [items, setItems] = useState<BoxEntrySnapshot[]>(initialView.items);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialView.nextCursor);
  const [total, setTotal] = useState(initialView.total);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | undefined>();
  const [viewState, setViewState] = useState(() => ({
    center: config.props.defaultView,
    zoom: config.props.defaultView.zoom,
  }));

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
    setSelectedEntryId(undefined);
  }, [initialView]);

  useEffect(() => {
    setViewState({
      center: config.props.defaultView,
      zoom: config.props.defaultView.zoom,
    });
  }, [config.props.defaultView]);

  const enabledEntries = useMemo(
    () => items.filter((entry) => entry.enabled),
    [items],
  );
  const positionedEntries = useMemo<PositionedEntry[]>(() => {
    return enabledEntries.flatMap((entry) => {
      const location = config.props.entries[entry.entryId];
      if (!location) {
        return [];
      }
      const projected = projectPoint(location, config);
      if (!projected) {
        return [];
      }
      return [{
        entry,
        location,
        label: location.labelOverride ?? resolveEntryTitle(entry),
        x: projected.x,
        y: projected.y,
      }];
    });
  }, [config, enabledEntries]);
  const locatedIds = useMemo(
    () => new Set(positionedEntries.map((item) => item.entry.entryId)),
    [positionedEntries],
  );
  const unlocatedEntries = useMemo(
    () => enabledEntries.filter((entry) => !locatedIds.has(entry.entryId)),
    [enabledEntries, locatedIds],
  );
  const selectedEntry = selectedEntryId
    ? enabledEntries.find((entry) => entry.entryId === selectedEntryId)
    : undefined;
  const hasTopRegion = hasFrameRegionContent(config.props.topRegion);
  const centerProjection = projectPoint(viewState.center, config) ?? { x: 50, y: 50 };
  const translateX = 50 - centerProjection.x;
  const translateY = 50 - centerProjection.y;
  const mapTransform = `translate(${translateX}%, ${translateY}%) scale(${viewState.zoom})`;

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

  const resetView = () => {
    setViewState({
      center: config.props.defaultView,
      zoom: config.props.defaultView.zoom,
    });
  };

  const panView = (deltaLatitude: number, deltaLongitude: number) => {
    setViewState((current) => ({
      ...current,
      center: {
        ...current.center,
        latitude: clamp(current.center.latitude + deltaLatitude, -90, 90),
        longitude: clamp(current.center.longitude + deltaLongitude, -180, 180),
      },
    }));
  };

  const zoomView = (delta: number) => {
    setViewState((current) => ({
      ...current,
      zoom: clamp(Number((current.zoom + delta).toFixed(2)), 0.5, 8),
    }));
  };

  return (
    <section data-scope="chips-box-map-layout">
      <style>{MAP_LAYOUT_STYLE}</style>
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

        <div data-map-stage>
          {enabledEntries.length === 0 ? (
            <MapLayoutSkeleton />
          ) : (
            <>
              {config.props.mapSource.mode === "host-map" ? (
                <div data-map-unavailable role="status">
                  {formatMessage("layout.host_map_unavailable")}
                </div>
              ) : (
                <div data-map-world style={{ transform: mapTransform }}>
                  <MapAssetLayer config={config} runtime={runtime} />
                  <div data-map-markers>
                    {positionedEntries.map((item) => {
                      const selected = selectedEntryId === item.entry.entryId;
                      return (
                        <button
                          key={item.entry.entryId}
                          type="button"
                          data-map-marker
                          data-marker-style={config.props.markerStyle}
                          data-selected={selected ? "true" : undefined}
                          data-entry-id={item.entry.entryId}
                          style={{
                            "--marker-x": `${item.x}%`,
                            "--marker-y": `${item.y}%`,
                          } as React.CSSProperties}
                          title={item.label}
                          onClick={() => {
                            if (selected) {
                              void runtime.openEntry(item.entry.entryId);
                              return;
                            }
                            setSelectedEntryId(item.entry.entryId);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              if (selected) {
                                void runtime.openEntry(item.entry.entryId);
                              } else {
                                setSelectedEntryId(item.entry.entryId);
                              }
                            }
                          }}
                        >
                          <span data-map-marker-dot aria-hidden="true" />
                          <span data-map-marker-label>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div data-map-controls aria-label={formatMessage("layout.map_controls")}>
                <button type="button" onClick={() => zoomView(0.25)} aria-label={formatMessage("layout.zoom_in")}>+</button>
                <button type="button" onClick={() => zoomView(-0.25)} aria-label={formatMessage("layout.zoom_out")}>-</button>
                <button type="button" onClick={() => panView(5, 0)} aria-label={formatMessage("layout.pan_north")}>↑</button>
                <button type="button" onClick={() => panView(-5, 0)} aria-label={formatMessage("layout.pan_south")}>↓</button>
                <button type="button" onClick={() => panView(0, -5)} aria-label={formatMessage("layout.pan_west")}>←</button>
                <button type="button" onClick={() => panView(0, 5)} aria-label={formatMessage("layout.pan_east")}>→</button>
                <button type="button" onClick={resetView}>{formatMessage("layout.reset_view")}</button>
              </div>

              {selectedEntry ? (
                <SelectedEntryPreview
                  entry={selectedEntry}
                  runtime={runtime}
                  showCover={config.props.showCoverOnSelect}
                  onClose={() => setSelectedEntryId(undefined)}
                />
              ) : null}
            </>
          )}
        </div>

        {unlocatedEntries.length > 0 ? (
          <section data-unlocated aria-label={formatMessage("layout.unlocated_title")}>
            <strong>{formatMessage("layout.unlocated_title")}</strong>
            <div data-unlocated-list>
              {unlocatedEntries.map((entry) => (
                <button
                  key={entry.entryId}
                  type="button"
                  data-unlocated-entry
                  onClick={() => {
                    void runtime.openEntry(entry.entryId);
                  }}
                >
                  {resolveEntryTitle(entry)}
                </button>
              ))}
            </div>
          </section>
        ) : null}

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
