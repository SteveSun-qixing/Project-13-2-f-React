import React, { useEffect, useMemo, useRef, useState } from "react";
import { createKeyboardMap, createRovingTabIndex, getRovingTabIndexProps } from "../utils/a11y";
import type { Bookmark } from "../hooks/useBookmarks";
import { PanelShell } from "./PanelShell";

export interface BookmarkPanelProps {
  bookmarks: Bookmark[];
  activeBookmarkId?: string | null;
  restoreFocusElement?: HTMLElement | null;
  onGoToBookmark: (bookmark: Bookmark) => void;
  onRemoveBookmark: (id: string) => void;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function formatBookmarkPosition(bookmark: Bookmark, t: BookmarkPanelProps["t"]): string {
  if (bookmark.readingMode === "paginated") {
    return t("book-reader.bookmarks.pageLabel", {
      page: bookmark.spreadIndex + 1,
    });
  }

  return t("book-reader.bookmarks.scrollLabel", {
    percentage: Math.round(bookmark.scrollFraction * 100),
  });
}

const BOOKMARKS_KEYBOARD_MAP = createKeyboardMap({
  next: "ArrowDown",
  previous: "ArrowUp",
  first: "Home",
  last: "End",
});

interface BookmarkRow {
  id: string;
}

export function BookmarkPanel(props: BookmarkPanelProps): React.ReactElement {
  const { bookmarks, activeBookmarkId, restoreFocusElement, onGoToBookmark, onRemoveBookmark, onClose, t } = props;
  const bookmarkRefs = useRef(new Map<string, HTMLButtonElement>());

  const groups = useMemo(() => {
    return bookmarks.reduce<Map<string, Bookmark[]>>((map, bookmark) => {
      const title = bookmark.sectionTitle || t("book-reader.bookmarks.untitledSection");
      const bucket = map.get(title) ?? [];
      bucket.push(bookmark);
      map.set(title, bucket);
      return map;
    }, new Map());
  }, [bookmarks, t]);
  const bookmarkRows = useMemo<BookmarkRow[]>(() => {
    return Array.from(groups.values()).flatMap((sectionBookmarks) =>
      sectionBookmarks
        .slice()
        .sort((left, right) => right.createdAt - left.createdAt)
        .map((bookmark) => ({
          id: bookmark.id,
        })),
    );
  }, [groups]);
  const [activeRovingId, setActiveRovingId] = useState<string | null>(activeBookmarkId ?? null);
  const activeBookmarkExists = activeBookmarkId ? bookmarkRows.some((row) => row.id === activeBookmarkId) : false;
  const activeBookmark = useMemo(
    () => (activeBookmarkExists ? bookmarks.find((bookmark) => bookmark.id === activeBookmarkId) ?? null : null),
    [activeBookmarkExists, activeBookmarkId, bookmarks],
  );
  const roving = useMemo(
    () => createRovingTabIndex(bookmarkRows, {
      activeId: activeRovingId ?? activeBookmarkId,
      selectedId: activeBookmarkExists ? activeBookmarkId : undefined,
      orientation: "vertical",
      loop: false,
    }),
    [activeBookmarkExists, activeBookmarkId, activeRovingId, bookmarkRows],
  );

  useEffect(() => {
    setActiveRovingId(activeBookmarkId ?? bookmarkRows[0]?.id ?? null);
  }, [activeBookmarkId, bookmarkRows]);

  function focusBookmark(rowId: string): void {
    bookmarkRefs.current.get(rowId)?.focus();
  }

  return (
    <PanelShell
      title={t("book-reader.labels.bookmarks")}
      eyebrow={t("book-reader.labels.appName")}
      onClose={onClose}
      className="book-reader-panel--bookmarks"
      restoreFocusElement={restoreFocusElement}
      t={t}
    >
      <div className="book-reader-bookmarks">
        {activeBookmark ? (
          <button
            type="button"
            className="book-reader-bookmarks__current"
            aria-label={t("book-reader.bookmarks.openLabel", {
              section: activeBookmark.sectionTitle,
              position: formatBookmarkPosition(activeBookmark, t),
              createdAt: new Date(activeBookmark.createdAt).toLocaleString(),
            })}
            onClick={() => onGoToBookmark(activeBookmark)}
          >
            <strong className="book-reader-bookmarks__current-title">当前页已添加书签</strong>
            <span className="book-reader-bookmarks__current-caption">
              {activeBookmark.excerpt ?? `${activeBookmark.sectionTitle} · ${formatBookmarkPosition(activeBookmark, t)}`}
            </span>
          </button>
        ) : null}

        <p className="book-reader-bookmarks__count">{t("book-reader.bookmarks.count", { count: bookmarks.length })}</p>

        {bookmarks.length === 0 ? <p className="book-reader-bookmarks__empty">{t("book-reader.bookmarks.empty")}</p> : null}

        {Array.from(groups.entries()).map(([sectionTitle, sectionBookmarks]) => (
          <section key={sectionTitle} className="book-reader-bookmarks__group">
            <h3>{sectionTitle}</h3>
            <div className="book-reader-bookmarks__items">
              {sectionBookmarks
                .slice()
                .sort((left, right) => right.createdAt - left.createdAt)
                .map((bookmark) => {
                  const rovingItem = roving.items.find((item) => item.id === bookmark.id);
                  const tabIndexProps = getRovingTabIndexProps(rovingItem);
                  const positionLabel = formatBookmarkPosition(bookmark, t);
                  const createdAtLabel = new Date(bookmark.createdAt).toLocaleString();

                  return (
                    <article
                      key={bookmark.id}
                      className={`book-reader-bookmarks__item${activeBookmarkId === bookmark.id ? " book-reader-bookmarks__item--active" : ""}`}
                    >
                      <button
                        ref={(element) => {
                          if (element) {
                            bookmarkRefs.current.set(bookmark.id, element);
                          } else {
                            bookmarkRefs.current.delete(bookmark.id);
                          }
                        }}
                        type="button"
                        className="book-reader-bookmarks__open"
                        tabIndex={tabIndexProps.tabIndex}
                        data-active={tabIndexProps["data-active"]}
                        aria-current={activeBookmarkId === bookmark.id ? "true" : undefined}
                        aria-label={t("book-reader.bookmarks.openLabel", {
                          section: sectionTitle,
                          position: positionLabel,
                          createdAt: createdAtLabel,
                        })}
                        onClick={() => onGoToBookmark(bookmark)}
                        onFocus={() => setActiveRovingId(bookmark.id)}
                        onKeyDown={(event) => {
                          const nextIndex = roving.getIndexByKey(event.nativeEvent, {
                            keyboardMap: BOOKMARKS_KEYBOARD_MAP,
                            orientation: "vertical",
                            loop: false,
                          });

                          if (nextIndex >= 0) {
                            event.preventDefault();
                            const nextRow = roving.items[nextIndex]?.item;
                            if (nextRow) {
                              setActiveRovingId(nextRow.id);
                              focusBookmark(nextRow.id);
                            }
                          }
                        }}
                      >
                        {bookmark.excerpt ? (
                          <strong className="book-reader-bookmarks__excerpt">{bookmark.excerpt}</strong>
                        ) : (
                          <strong>{positionLabel}</strong>
                        )}
                        <span>{createdAtLabel}</span>
                      </button>
                      <button
                        type="button"
                        className="book-reader-bookmarks__remove"
                        aria-label={t("book-reader.bookmarks.removeLabel", {
                          section: sectionTitle,
                          position: positionLabel,
                        })}
                        onClick={() => onRemoveBookmark(bookmark.id)}
                      >
                        {t("book-reader.actions.removeBookmark")}
                      </button>
                    </article>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </PanelShell>
  );
}
