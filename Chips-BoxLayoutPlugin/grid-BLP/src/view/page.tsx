import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyHint, LayoutSkeleton, SkeletonBlock, SkeletonLine } from "@chips/ui";
import { hasFrameRegionContent, type LayoutConfig } from "../schema/layout-config";
import { FrameRegionSurface } from "../shared/frame-region";
import type { BoxEntryPage, BoxEntrySnapshot, BoxLayoutRuntime } from "../shared/types";
import { formatMessage } from "../lib/messages";
import { EntryTile } from "./entry-tile";
import { GRID_LAYOUT_STYLE } from "./styles";

export interface LayoutViewProps {
  initialView: BoxEntryPage;
  config: LayoutConfig;
  runtime: BoxLayoutRuntime;
}

const PAGE_LIMIT = 48;

const SKELETON_CELL_KEYS = Array.from({ length: 6 }, (_, index) => index);

function resolveEntryTitle(entry: BoxEntrySnapshot): string {
  return entry.snapshot.title ?? entry.snapshot.documentId ?? entry.entryId;
}

function sortEntries(entries: BoxEntrySnapshot[], sortMode: LayoutConfig["props"]["sortMode"]): BoxEntrySnapshot[] {
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

function appendUniqueEntries(current: BoxEntrySnapshot[], next: BoxEntrySnapshot[]): BoxEntrySnapshot[] {
  const seen = new Set(current.map((entry) => entry.entryId));
  const appended = next.filter((entry) => {
    if (seen.has(entry.entryId)) {
      return false;
    }
    seen.add(entry.entryId);
    return true;
  });

  return [...current, ...appended];
}

export function LayoutViewPage({
  initialView,
  config,
  runtime,
}: LayoutViewProps) {
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

  const sortedEntries = useMemo(
    () => sortEntries(items.filter((entry) => entry.enabled), config.props.sortMode),
    [config.props.sortMode, items],
  );
  const prefetchEntries = useMemo(
    () => sortedEntries.slice(-PAGE_LIMIT),
    [sortedEntries],
  );
  const showBackground = hasFrameRegionContent(config.props.background);
  const showTopRegion = hasFrameRegionContent(config.props.topRegion);

  useEffect(() => {
    if (prefetchEntries.length === 0) {
      return;
    }

    void runtime.prefetchEntries({
      entryIds: prefetchEntries.map((entry) => entry.entryId),
      targets: ["cover"],
    }).catch(() => undefined);
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

      {showBackground ? (
        <div data-layout-background aria-hidden="true">
          <FrameRegionSurface
            region={config.props.background}
            title={formatMessage("editor.background_title")}
            ratio="16:9"
            readBoxAsset={runtime.readBoxAsset}
          />
        </div>
      ) : null}

      <div data-layout-shell>
        {showTopRegion ? (
          <div data-layout-top-region>
            <FrameRegionSurface
              region={config.props.topRegion}
              title={formatMessage("editor.top_region_title")}
              ratio="16:5"
              readBoxAsset={runtime.readBoxAsset}
            />
          </div>
        ) : null}

        <div data-layout-grid data-empty={sortedEntries.length === 0 ? "true" : undefined}>
          {sortedEntries.length > 0 ? (
            sortedEntries.map((entry) => (
              <EntryTile
                key={entry.entryId}
                entry={entry}
                runtime={runtime}
              />
            ))
          ) : (
            <LayoutSkeleton
              hint={
                <EmptyHint
                  title={formatMessage("layout.empty")}
                  description={formatMessage("layout.empty_hint")}
                />
              }
            >
              <div data-layout-skeleton-grid>
                {SKELETON_CELL_KEYS.map((key) => (
                  <div data-layout-skeleton-cell key={key}>
                    <SkeletonBlock width="100%" radius={12} style={{ aspectRatio: "3 / 4" }} />
                    <SkeletonLine width="62%" />
                    <SkeletonLine width="40%" height={8} radius={4} />
                  </div>
                ))}
              </div>
            </LayoutSkeleton>
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
