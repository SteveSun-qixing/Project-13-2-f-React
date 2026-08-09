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

const PAGE_LIMIT = 48;

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

const GRID_LAYOUT_STYLE = `
[data-scope="chips-box-grid-layout"] {
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 100%;
  box-sizing: border-box;
  color: #1d1d1f;
  background-color: #ffffff;
}

[data-scope="chips-box-grid-layout"] *,
[data-scope="chips-box-grid-layout"] *::before,
[data-scope="chips-box-grid-layout"] *::after {
  box-sizing: border-box;
}

[data-scope="chips-box-grid-layout"] [data-layout-background] {
  position: sticky;
  top: 0;
  width: 100%;
  block-size: 100vh;
  margin-block-end: -100vh;
  pointer-events: none;
}

[data-scope="chips-box-grid-layout"] [data-layout-background] .chips-embedded-document-frame,
[data-scope="chips-box-grid-layout"] [data-layout-background] iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-grid-layout"] [data-layout-shell] {
  position: relative;
  display: grid;
  gap: 16px;
  padding: 16px;
  min-width: 0;
  min-height: 100%;
}

[data-scope="chips-box-grid-layout"] [data-layout-top-region] {
  min-width: 0;
  min-block-size: clamp(132px, 24vw, 288px);
  border-radius: 12px;
  overflow: hidden;
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

[data-scope="chips-box-grid-layout"] [data-frame-region] {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-grid-layout"] [data-frame-region] .chips-embedded-document-frame,
[data-scope="chips-box-grid-layout"] [data-frame-region] iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-grid-layout"] [data-frame-region-image] {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

[data-scope="chips-box-grid-layout"] [data-frame-region-status],
[data-scope="chips-box-grid-layout"] [data-layout-empty],
[data-scope="chips-box-grid-layout"] [data-layout-page-error] {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background-color: #ffffff;
  color: #6e6e73;
}

[data-scope="chips-box-grid-layout"] [data-layout-grid] {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
  gap: 12px;
  align-items: start;
  min-width: 0;
  align-content: start;
}

[data-scope="chips-box-grid-layout"] [data-layout-grid][data-empty="true"] {
  grid-template-columns: minmax(0, 1fr);
}

[data-scope="chips-box-grid-layout"] [data-grid-entry] {
  display: grid;
  gap: 8px;
  min-width: 0;
  align-content: start;
}

[data-scope="chips-box-grid-layout"] [data-grid-cover-shell] {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 12px;
  background-color: #ffffff;
}

[data-scope="chips-box-grid-layout"] [data-grid-cover-shell] .chips-embedded-document-frame,
[data-scope="chips-box-grid-layout"] [data-grid-cover-shell] iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-grid-layout"] [data-grid-cover-shell] iframe {
  display: block;
  border: none;
  background: transparent;
  pointer-events: none;
}

[data-scope="chips-box-grid-layout"] [data-grid-cover-placeholder] {
  width: 100%;
  height: 100%;
  min-height: 180px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background-color: #ffffff;
  color: #1d1d1f;
  text-align: center;
  cursor: pointer;
  font: inherit;
}

[data-scope="chips-box-grid-layout"] [data-grid-cover-placeholder-title] {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
}

[data-scope="chips-box-grid-layout"] [data-grid-cover-placeholder-text],
[data-scope="chips-box-grid-layout"] [data-grid-cover-placeholder-kind] {
  font-size: 12px;
  color: #6e6e73;
}

[data-scope="chips-box-grid-layout"] [data-grid-entry-title],
[data-scope="chips-box-grid-layout"] [data-layout-load-more],
[data-scope="chips-box-grid-layout"] [data-layout-retry] {
  border: none;
  margin: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

[data-scope="chips-box-grid-layout"] [data-grid-entry-title] {
  padding: 0;
  color: #1d1d1f;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
  width: 100%;
  min-width: 0;
}

[data-scope="chips-box-grid-layout"] [data-layout-footer] {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

[data-scope="chips-box-grid-layout"] [data-layout-load-more],
[data-scope="chips-box-grid-layout"] [data-layout-retry] {
  min-block-size: 40px;
  padding-inline: 16px;
  padding-block: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  background-color: #ffffff;
  color: #1d1d1f;
}

[data-scope="chips-box-grid-layout"] [data-layout-load-more]:disabled {
  cursor: default;
  color: #6e6e73;
}

[data-scope="chips-box-grid-layout"] [data-layout-empty],
[data-scope="chips-box-grid-layout"] [data-layout-page-error],
[data-scope="chips-box-grid-layout"] [data-frame-region-status] {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 160px;
  padding: 16px;
  text-align: center;
}

[data-scope="chips-box-grid-layout"] [data-layout-empty-title] {
  color: #1d1d1f;
  font-weight: 700;
}

[data-scope="chips-box-grid-layout"] [data-grid-entry-title]:focus-visible,
[data-scope="chips-box-grid-layout"] [data-grid-cover-placeholder]:focus-visible,
[data-scope="chips-box-grid-layout"] [data-layout-load-more]:focus-visible,
[data-scope="chips-box-grid-layout"] [data-layout-retry]:focus-visible {
  outline: 2px solid #0a84ff;
  outline-offset: 2px;
}
`;

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

function CoverTile({
  entry,
  runtime,
}: {
  entry: BoxEntrySnapshot;
  runtime: BoxLayoutRuntime;
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
    void runtime
      .renderEntryCover(entry.entryId)
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

  const handleOpen = () => {
    void runtime.openEntry(entry.entryId);
  };

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
  const coverView = coverState.status === "ready" ? coverState.view : undefined;
  const showFrame = Boolean(coverView?.coverUrl);
  const coverOpenLabel = `${formatMessage("layout.open_entry")}: ${title}`;

  return (
    <div
      data-grid-cover-shell
      role={showFrame ? "button" : undefined}
      tabIndex={showFrame ? 0 : undefined}
      aria-label={showFrame ? coverOpenLabel : undefined}
      onClick={showFrame ? handleOpen : undefined}
      onKeyDown={(event) => {
        if (!showFrame) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpen();
        }
      }}
      style={{
        aspectRatio,
      }}
    >
      {showFrame && coverView ? (
        <EmbeddedDocumentFrame
          title={coverView.title || title}
          src={coverView.coverUrl}
          ratio={ratioToken}
          sandbox="allow-scripts"
          onActivate={handleOpen}
        />
      ) : (
        <button
          type="button"
          data-grid-cover-placeholder
          aria-label={coverOpenLabel}
          onClick={handleOpen}
        >
          <strong data-grid-cover-placeholder-title>{title}</strong>
          <span data-grid-cover-placeholder-text>
            {coverState.status === "loading"
              ? formatMessage("layout.loading")
              : formatMessage(coverState.status === "error" ? "layout.cover_error" : "layout.cover_missing")}
          </span>
          <span data-grid-cover-placeholder-kind>{resolveEntryKindMessage(entry)}</span>
        </button>
      )}
    </div>
  );
}

function EntryCard({
  entry,
  runtime,
}: {
  entry: BoxEntrySnapshot;
  runtime: BoxLayoutRuntime;
}) {
  const handleOpen = () => {
    void runtime.openEntry(entry.entryId);
  };
  const title = resolveEntryTitle(entry);

  return (
    <article
      key={entry.entryId}
      data-entry-id={entry.entryId}
      data-grid-entry
    >
      <CoverTile
        entry={entry}
        runtime={runtime}
      />
      <button
        type="button"
        data-grid-entry-title
        onClick={handleOpen}
        title={title}
      >
        {title}
      </button>
    </article>
  );
}

export function LayoutViewPage({ initialView, config, runtime }: LayoutViewProps) {
  const isMountedRef = useRef(true);
  const [items, setItems] = useState<BoxEntrySnapshot[]>(initialView.items);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialView.nextCursor);
  const [total, setTotal] = useState(initialView.total);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [pageError, setPageError] = useState(false);

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
  }, [initialView]);

  const enabledEntries = useMemo(
    () => sortEntries(items.filter((entry) => entry.enabled), config.props.sortMode),
    [config.props.sortMode, items]
  );
  const prefetchEntries = useMemo(
    () => items.filter((entry) => entry.enabled).slice(-PAGE_LIMIT),
    [items]
  );
  const hasTopRegion = hasFrameRegionContent(config.props.topRegion);
  const hasBackground = hasFrameRegionContent(config.props.background);

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

  return (
    <section data-scope="chips-box-grid-layout" aria-label={formatMessage("layout.aria_label")}>
      <style>{GRID_LAYOUT_STYLE}</style>

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

        <div data-layout-grid data-empty={enabledEntries.length === 0 ? "true" : undefined}>
          {enabledEntries.length > 0 ? (
            enabledEntries.map((entry) => (
              <EntryCard
                key={entry.entryId}
                entry={entry}
                runtime={runtime}
              />
            ))
          ) : (
            <div data-layout-empty>
              <strong data-layout-empty-title>{formatMessage("layout.empty")}</strong>
              <span>{formatMessage("layout.empty_hint")}</span>
            </div>
          )}
        </div>

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
