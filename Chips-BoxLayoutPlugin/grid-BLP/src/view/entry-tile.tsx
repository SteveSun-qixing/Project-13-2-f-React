import React, { useEffect, useMemo, useState } from "react";
import { EmbeddedDocumentFrame } from "@chips/ui";
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

export function EntryTile({
  entry,
  runtime,
}: {
  entry: BoxEntrySnapshot;
  runtime: BoxLayoutRuntime;
}) {
  const [coverState, setCoverState] = useState<CoverState>(() => ({
    status: entry.snapshot.cover?.mode === "none" ? "idle" : "loading",
  }));

  const title = useMemo(() => resolveEntryTitle(entry), [entry]);
  const kindLabel = useMemo(() => resolveEntryKindLabel(entry), [entry]);

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

  const frameView = coverState.status === "ready" ? coverState.view : undefined;
  const showFrame = frameView != null && frameView.coverUrl != null;
  const coverOpenLabel = `${formatMessage("layout.open_entry")}: ${title}`;

  return (
    <article data-grid-entry data-entry-id={entry.entryId}>
      <div
        data-grid-cover-shell
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
        style={{ aspectRatio: resolveAspectRatio(entry, coverState.view).replace(":", " / ") }}
      >
        {showFrame ? (
          <EmbeddedDocumentFrame
            title={frameView.title || title}
            src={frameView.coverUrl}
            ratio={frameView.ratio ?? resolveAspectRatio(entry, frameView)}
            sandbox="allow-scripts"
            onActivate={openEntry}
          />
        ) : (
          <button
            type="button"
            data-grid-cover-placeholder
            aria-label={coverOpenLabel}
            onClick={openEntry}
          >
            <strong data-grid-cover-placeholder-title>{title}</strong>
            <span data-grid-cover-placeholder-text>
              {coverState.status === "loading"
                ? formatMessage("layout.loading")
                : `${kindLabel} · ${formatMessage(coverState.status === "error" ? "layout.cover_error" : "layout.cover_missing")}`}
            </span>
          </button>
        )}
      </div>

      <div data-grid-entry-body>
        <button
          type="button"
          data-grid-entry-title
          aria-label={`${formatMessage("layout.open_entry")}: ${title}`}
          title={title}
          onClick={openEntry}
        >
          {title}
        </button>
      </div>
    </article>
  );
}
