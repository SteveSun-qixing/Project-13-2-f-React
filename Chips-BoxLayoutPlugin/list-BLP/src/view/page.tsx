import React, { useEffect, useMemo, useState } from "react";
import { Button } from "antd";
import { EmptyHint, LayoutSkeleton, SkeletonBlock, SkeletonDot, SkeletonLine } from "@chips/ui";
import { hasFrameRegionContent, type LayoutConfig } from "../schema/layout-config";
import { FrameRegionSurface } from "../shared/frame-region";
import type { BoxEntryPage, BoxEntryQuery, BoxEntrySnapshot, BoxLayoutRuntime } from "../shared/types";
import { formatMessage } from "../lib/messages";
import { EntryRow } from "./entry-row";
import { LIST_LAYOUT_STYLE } from "./styles";

export interface LayoutViewProps {
  initialView: BoxEntryPage;
  config: LayoutConfig;
  runtime: BoxLayoutRuntime;
}

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

function buildRuntimeQuery(config: LayoutConfig, cursor?: string): BoxEntryQuery {
  const sort = config.props.sortMode === "name-asc"
    ? { key: "title", direction: "asc" as const }
    : config.props.sortMode === "name-desc"
      ? { key: "title", direction: "desc" as const }
      : undefined;

  return {
    ...(cursor ? { cursor } : {}),
    limit: config.props.pageSize,
    ...(sort ? { sort } : {}),
  };
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value ? value as Record<string, unknown> : undefined;
}

function resolveCreatedAtFromDetail(detail: Record<string, unknown>): string | undefined {
  const documentInfo = readRecord(detail.documentInfo);
  const metadata = readRecord(documentInfo?.metadata);
  const createdAt = metadata?.createdAt ?? metadata?.created_at;
  return typeof createdAt === "string" && createdAt.trim().length > 0 ? createdAt.trim() : undefined;
}

function resolveEntryTypeGroup(entry: BoxEntrySnapshot): string {
  if (entry.snapshot.contentType === "chips/box") {
    return formatMessage("layout.entry_type_box");
  }
  if (entry.snapshot.contentType && entry.snapshot.contentType !== "chips/card") {
    return entry.snapshot.contentType;
  }
  return formatMessage("layout.entry_type_card");
}

function resolveEntryTagGroup(entry: BoxEntrySnapshot): string {
  const firstTag = entry.snapshot.tags?.[0];
  if (Array.isArray(firstTag)) {
    return firstTag.join(" / ");
  }
  if (typeof firstTag === "string" && firstTag.trim().length > 0) {
    return firstTag.trim();
  }
  return formatMessage("layout.group_ungrouped");
}

function groupEntries(entries: BoxEntrySnapshot[], config: LayoutConfig): Array<{
  key: string;
  title: string;
  entries: BoxEntrySnapshot[];
}> {
  if (config.props.groupMode === "none") {
    return [{
      key: "all",
      title: "",
      entries,
    }];
  }

  const groups = new Map<string, BoxEntrySnapshot[]>();
  for (const entry of entries) {
    const title = config.props.groupMode === "type"
      ? resolveEntryTypeGroup(entry)
      : resolveEntryTagGroup(entry);
    const bucket = groups.get(title) ?? [];
    bucket.push(entry);
    groups.set(title, bucket);
  }

  return [...groups.entries()].map(([title, groupItems]) => ({
    key: title,
    title,
    entries: groupItems,
  }));
}

export function LayoutViewPage({
  initialView,
  config,
  runtime,
}: LayoutViewProps) {
  const [entryItems, setEntryItems] = useState<BoxEntrySnapshot[]>(initialView.items);
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialView.nextCursor);
  const [total, setTotal] = useState(initialView.total);
  const [loadingMore, setLoadingMore] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | undefined>(initialView.items[0]?.entryId);

  useEffect(() => {
    setEntryItems(initialView.items);
    setNextCursor(initialView.nextCursor);
    setTotal(initialView.total);
    setSelectedEntryIds([]);
    setActiveEntryId(initialView.items[0]?.entryId);
  }, [initialView]);

  const sortedEntries = useMemo(
    () => sortEntries(entryItems, config.props.sortMode),
    [config.props.sortMode, entryItems],
  );
  const groupedEntries = useMemo(
    () => groupEntries(sortedEntries, config),
    [config, sortedEntries],
  );
  const [createdAtByEntryId, setCreatedAtByEntryId] = useState<Record<string, string>>({});
  const showBackground = hasFrameRegionContent(config.props.background);
  const showTopRegion = hasFrameRegionContent(config.props.topRegion);
  const selectedCount = selectedEntryIds.length;
  const selectedSet = useMemo(() => new Set(selectedEntryIds), [selectedEntryIds]);
  const activeIndex = sortedEntries.findIndex((entry) => entry.entryId === activeEntryId);
  const canLoadMore = Boolean(nextCursor);

  useEffect(() => {
    if (sortedEntries.length === 0 || !config.props.visibleFields.includes("createdAt")) {
      setCreatedAtByEntryId({});
      return;
    }

    let cancelled = false;
    const entryIds = sortedEntries.map((entry) => entry.entryId);
    void runtime.readEntryDetail({
      entryIds,
      fields: ["documentInfo"],
    }).then((items) => {
      if (cancelled) {
        return;
      }

      const next: Record<string, string> = {};
      for (const item of items) {
        const createdAt = resolveCreatedAtFromDetail(item.detail);
        if (createdAt) {
          next[item.entryId] = createdAt;
        }
      }
      setCreatedAtByEntryId(next);
    }).catch(() => {
      if (!cancelled) {
        setCreatedAtByEntryId({});
      }
    });

    return () => {
      cancelled = true;
    };
  }, [config.props.visibleFields, runtime, sortedEntries]);

  useEffect(() => {
    if (sortedEntries.length === 0) {
      return;
    }

    const entryIds = sortedEntries.slice(0, 18).map((entry) => entry.entryId);
    void runtime.prefetchEntries({
      entryIds,
      targets: config.props.visibleFields.includes("createdAt")
        ? ["cover", "documentInfo"]
        : ["cover"],
    }).catch(() => undefined);
  }, [config.props.visibleFields, runtime, sortedEntries]);

  const loadMore = async () => {
    if (loadingMore || !canLoadMore) {
      return;
    }

    if (!nextCursor) {
      return;
    }

    setLoadingMore(true);
    setRuntimeError(null);
    try {
      const page = await runtime.listEntries(buildRuntimeQuery(config, nextCursor));
      setNextCursor(page.nextCursor);
      setTotal(page.total);
      setEntryItems((current) => {
        const known = new Set(current.map((entry) => entry.entryId));
        const merged = [...current];
        for (const entry of page.items) {
          if (!known.has(entry.entryId)) {
            merged.push(entry);
          }
        }
        return merged;
      });
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : formatMessage("layout.load_more_error"));
    } finally {
      setLoadingMore(false);
    }
  };

  const moveActiveEntry = (direction: "previous" | "next" | "first" | "last") => {
    if (sortedEntries.length === 0) {
      return;
    }
    const currentIndex = activeIndex >= 0 ? activeIndex : 0;
    const nextIndex = direction === "first"
      ? 0
      : direction === "last"
        ? sortedEntries.length - 1
        : direction === "previous"
          ? Math.max(0, currentIndex - 1)
          : Math.min(sortedEntries.length - 1, currentIndex + 1);
    setActiveEntryId(sortedEntries[nextIndex]?.entryId);
  };

  const openActiveEntry = () => {
    const activeEntry = sortedEntries.find((entry) => entry.entryId === activeEntryId);
    if (activeEntry) {
      void runtime.openEntry(activeEntry.entryId);
    }
  };

  const toggleSelectedEntry = (entryId: string, selected: boolean) => {
    setSelectedEntryIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(entryId);
      } else {
        next.delete(entryId);
      }
      return [...next];
    });
  };

  const toggleActiveSelection = () => {
    if (!activeEntryId) {
      return;
    }
    toggleSelectedEntry(activeEntryId, !selectedSet.has(activeEntryId));
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveEntry("next");
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveEntry("previous");
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      moveActiveEntry("first");
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      moveActiveEntry("last");
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      openActiveEntry();
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      toggleActiveSelection();
    }
  };

  const selectVisibleEntries = () => {
    setSelectedEntryIds(sortedEntries.map((entry) => entry.entryId));
  };

  const clearSelection = () => {
    setSelectedEntryIds([]);
  };

  return (
    <section
      data-scope="chips-box-list-layout"
      data-density={config.props.rowDensity}
      data-cover-size={config.props.coverSize}
    >
      <style>{LIST_LAYOUT_STYLE}</style>

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
              autoHeight
              readBoxAsset={runtime.readBoxAsset}
            />
          </div>
        ) : null}

        <div data-list-data-grid aria-label={formatMessage("layout.toolbar_aria_label")}>
          <div data-layout-toolbar>
            <span data-layout-selection-count>
              {formatMessage("layout.selected_count", { count: selectedCount })}
            </span>
            <Button
              type="default"
              disabled={sortedEntries.length === 0}
              onClick={selectVisibleEntries}
            >
              {formatMessage("layout.select_all_visible")}
            </Button>
            <Button
              type="default"
              disabled={selectedCount === 0}
              onClick={clearSelection}
            >
              {formatMessage("layout.clear_selection")}
            </Button>
          </div>
        </div>

        <div
          data-layout-list
          data-empty={sortedEntries.length === 0 ? "true" : undefined}
          role="listbox"
          tabIndex={0}
          aria-label={formatMessage("layout.list_aria_label")}
          aria-multiselectable="true"
          aria-activedescendant={activeEntryId ? `chips-list-row-${activeEntryId}` : undefined}
          onKeyDown={handleListKeyDown}
        >
          {sortedEntries.length > 0 ? (
            groupedEntries.map((group) => (
              <React.Fragment key={group.key}>
                {group.title ? (
                  <div data-list-group-heading role="presentation">
                    {group.title}
                  </div>
                ) : null}
                {group.entries.map((entry) => (
                  <EntryRow
                    key={entry.entryId}
                    entry={entry}
                    runtime={runtime}
                    createdAt={createdAtByEntryId[entry.entryId]}
                    visibleFields={config.props.visibleFields}
                    selected={selectedSet.has(entry.entryId)}
                    active={activeEntryId === entry.entryId}
                    rowDomId={`chips-list-row-${entry.entryId}`}
                    onToggleSelected={toggleSelectedEntry}
                  />
                ))}
              </React.Fragment>
            ))
          ) : (
            <LayoutSkeleton
              hint={
                <EmptyHint
                  align="center"
                  title={formatMessage("layout.empty")}
                  description={formatMessage("layout.empty_hint")}
                />
              }
            >
              <div data-list-empty-skeleton aria-hidden="true">
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    key={index}
                    data-list-empty-skeleton-row
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "10px 0",
                      borderBottom: "1px solid rgba(0, 0, 0, 0.05)",
                    }}
                  >
                    <SkeletonDot
                      size={16}
                      style={{
                        flexShrink: 0,
                        borderRadius: 4,
                        border: "1.5px dashed rgba(0, 0, 0, 0.10)",
                        background: "transparent",
                      }}
                    />
                    <SkeletonBlock width={48} height={36} radius={8} style={{ flexShrink: 0 }} />
                    <SkeletonLine style={{ flex: 1, maxWidth: 240 }} />
                    <SkeletonLine width={72} height={8} style={{ flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </LayoutSkeleton>
          )}
        </div>

        {runtimeError ? (
          <div data-layout-error role="status">
            <div data-layout-error-text>
              <strong data-layout-error-title>{formatMessage("layout.load_more_error")}</strong>
              <span data-layout-error-detail>{runtimeError}</span>
            </div>
            <Button
              type="default"
              size="small"
              onClick={() => { void loadMore(); }}
            >
              {formatMessage("layout.retry")}
            </Button>
          </div>
        ) : null}

        {sortedEntries.length > 0 && canLoadMore ? (
          <div data-layout-pagination>
            <Button
              type="default"
              loading={loadingMore}
              disabled={loadingMore}
              onClick={() => { void loadMore(); }}
            >
              {loadingMore ? formatMessage("layout.loading") : formatMessage("layout.load_more")}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
