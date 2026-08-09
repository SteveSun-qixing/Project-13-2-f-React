import React, { useEffect, useMemo, useState } from "react";
import { Checkbox } from "antd";
import { EmbeddedDocumentFrame } from "@chips/ui";
import type { VisibleFieldKey } from "../schema/layout-config";
import type { BoxEntryCoverView, BoxEntrySnapshot, BoxLayoutRuntime } from "../shared/types";
import { formatMessage } from "../lib/messages";

interface CoverState {
  status: "idle" | "loading" | "ready" | "error";
  view?: BoxEntryCoverView;
}

function resolveEntryTitle(entry: BoxEntrySnapshot): string {
  return entry.snapshot.title ?? entry.snapshot.documentId ?? entry.entryId;
}

function resolveEntryKindLabel(entry: BoxEntrySnapshot): string {
  if (entry.snapshot.contentType === "chips/box") {
    return formatMessage("layout.entry_type_box");
  }
  if (entry.snapshot.contentType && entry.snapshot.contentType !== "chips/card") {
    return entry.snapshot.contentType;
  }
  return formatMessage("layout.entry_type_card");
}

function resolveAspectRatio(entry: BoxEntrySnapshot, coverView?: BoxEntryCoverView): string {
  if (coverView?.ratio) {
    return coverView.ratio;
  }
  const value = entry.layoutHints?.aspectRatio;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${value} / 1`;
  }
  return "3:4";
}

function resolveEntryTags(entry: BoxEntrySnapshot): string[] {
  return (entry.snapshot.tags ?? [])
    .map((tag) => Array.isArray(tag) ? tag.join(" / ") : tag)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function EntryRow({
  entry,
  runtime,
  createdAt,
  visibleFields,
  selected,
  active,
  rowDomId,
  onToggleSelected,
}: {
  entry: BoxEntrySnapshot;
  runtime: BoxLayoutRuntime;
  createdAt?: string;
  visibleFields: VisibleFieldKey[];
  selected: boolean;
  active: boolean;
  rowDomId: string;
  onToggleSelected(entryId: string, selected: boolean): void;
}) {
  const [coverState, setCoverState] = useState<CoverState>(() => ({
    status: entry.snapshot.cover?.mode === "none" ? "idle" : "loading",
  }));

  const title = useMemo(() => resolveEntryTitle(entry), [entry]);
  const kindLabel = useMemo(() => resolveEntryKindLabel(entry), [entry]);
  const createdAtLabel = useMemo(() => {
    if (typeof createdAt !== "string" || createdAt.trim().length === 0) {
      return formatMessage("layout.created_at_unknown");
    }

    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
      return formatMessage("layout.created_at_unknown");
    }

    const formatted = new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    return formatMessage("layout.created_at", { date: formatted });
  }, [createdAt]);
  const tags = useMemo(() => resolveEntryTags(entry), [entry]);
  const showCreatedAt = visibleFields.includes("createdAt");
  const showSummary = visibleFields.includes("summary") && typeof entry.snapshot.summary === "string" && entry.snapshot.summary.trim().length > 0;
  const showTags = visibleFields.includes("tags") && tags.length > 0;
  const showType = visibleFields.includes("type");

  useEffect(() => {
    if (entry.snapshot.cover?.mode === "none") {
      setCoverState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setCoverState({ status: "loading" });
    void runtime.renderEntryCover(entry.entryId).then((view) => {
      if (!cancelled) {
        setCoverState({
          status: "ready",
          view,
        });
      }
    }).catch(() => {
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

  return (
    <article
      id={rowDomId}
      data-list-entry
      data-entry-id={entry.entryId}
      data-selected={selected ? "true" : "false"}
      data-active={active ? "true" : "false"}
      role="option"
      aria-selected={selected ? "true" : "false"}
    >
      <div
        data-list-selection
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <Checkbox
          checked={selected}
          aria-label={formatMessage("layout.select_entry", { title })}
          onChange={(event) => {
            onToggleSelected(entry.entryId, event.target.checked);
          }}
        />
      </div>

      <div data-list-cover-shell style={{ aspectRatio: resolveAspectRatio(entry, coverState.view).replace(":", " / ") }}>
        {coverState.status === "ready" && coverState.view?.coverUrl ? (
          <EmbeddedDocumentFrame
            title={coverState.view.title || title}
            src={coverState.view.coverUrl}
            ratio={coverState.view.ratio ?? resolveAspectRatio(entry, coverState.view)}
            sandbox="allow-scripts"
            onActivate={openEntry}
          />
        ) : (
          <button type="button" data-list-cover-placeholder onClick={openEntry}>
            <strong data-list-cover-placeholder-title>{formatMessage("layout.cover_placeholder")}</strong>
            <span data-list-cover-placeholder-text>
              {coverState.status === "loading"
                ? formatMessage("layout.loading")
                : `${kindLabel} · ${formatMessage("layout.cover_missing")}`}
            </span>
          </button>
        )}
      </div>

      <div data-list-entry-body>
        <button type="button" data-list-entry-title onClick={openEntry}>
          {title}
        </button>
        <div data-list-entry-meta>
          {showType ? (
            <span data-list-entry-chip>{kindLabel}</span>
          ) : null}
          {showCreatedAt ? (
            <span data-list-entry-date>{createdAtLabel}</span>
          ) : null}
        </div>
        {showSummary ? (
          <p data-list-entry-summary>{entry.snapshot.summary}</p>
        ) : null}
        {showTags ? (
          <div data-list-entry-tags aria-label={formatMessage("layout.tags_label")}>
            {tags.map((tag) => (
              <span key={tag} data-list-entry-tag>{tag}</span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
