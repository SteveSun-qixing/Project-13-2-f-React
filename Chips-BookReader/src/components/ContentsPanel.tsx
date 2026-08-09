import React, { useMemo, useState } from "react";
import type { EpubBook, EpubNavigationItem } from "../domain/epub/types";
import { NavigationTree } from "./NavigationTree";
import { PanelShell } from "./PanelShell";

export interface ContentsPanelProps {
  book: EpubBook;
  currentSectionIndex: number;
  sectionProgress?: number[];
  restoreFocusElement?: HTMLElement | null;
  onSelectSection: (index: number, fragment?: string) => void;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function filterNavigationItems(items: EpubNavigationItem[], query: string): EpubNavigationItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return items;
  }
  return items.flatMap((item) => {
    const children = filterNavigationItems(item.children, query);
    const labelMatches = item.label.toLowerCase().includes(normalizedQuery);
    if (labelMatches || children.length > 0) {
      return [{ ...item, children }];
    }
    return [];
  });
}

export function ContentsPanel(props: ContentsPanelProps): React.ReactElement {
  const { book, currentSectionIndex, sectionProgress, restoreFocusElement, onSelectSection, onClose, t } = props;
  const [query, setQuery] = useState("");
  const filteredItems = useMemo(() => filterNavigationItems(book.navigation, query), [book.navigation, query]);
  const hasQuery = query.trim().length > 0;

  return (
    <PanelShell
      title={t("book-reader.labels.contents")}
      eyebrow={book.metadata.title}
      onClose={onClose}
      className="book-reader-panel--contents"
      restoreFocusElement={restoreFocusElement}
      t={t}
    >
      <nav className="book-reader-nav" aria-label={t("book-reader.labels.contents")}>
        <div className="book-reader-search__field">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索章节"
            aria-label="搜索章节"
          />
        </div>
        {hasQuery && filteredItems.length === 0 ? <p className="book-reader-search__empty">无匹配章节</p> : null}
        <NavigationTree
          items={filteredItems}
          currentSectionIndex={currentSectionIndex}
          sectionProgress={sectionProgress}
          expandAll={hasQuery}
          onSelectSection={onSelectSection}
        />
      </nav>
    </PanelShell>
  );
}
