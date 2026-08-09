import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "antd";
import { createKeyboardMap, createRovingTabIndex, getRovingTabIndexProps } from "../utils/a11y";
import { splitExcerptIntoMatchSegments, type SearchResult } from "../engine/search-engine";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { PanelShell } from "./PanelShell";

export interface SearchPanelProps {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  statusLabel?: string | null;
  activeResultKey?: string | null;
  currentSectionIndex?: number;
  restoreFocusElement?: HTMLElement | null;
  onQueryChange: (query: string) => void;
  onSelectResult: (result: SearchResult) => void;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function createResultKey(result: SearchResult): string {
  return `${result.sectionIndex}:${result.matchOffset}:${result.matchLength}:${result.query}`;
}

function renderExcerpt(result: SearchResult): React.ReactNode {
  const segments = splitExcerptIntoMatchSegments(result.excerpt, result.query);
  return (
    <>
      {segments.before}
      {segments.match ? <mark className="book-reader-search__mark">{segments.match}</mark> : null}
      {segments.after}
    </>
  );
}

const SEARCH_DEBOUNCE_MS = 300;
const PULSE_DURATION_MS = 400;

const SEARCH_RESULTS_KEYBOARD_MAP = createKeyboardMap({
  next: "ArrowDown",
  previous: "ArrowUp",
  first: "Home",
  last: "End",
});

interface SearchResultRow {
  id: string;
}

export function SearchPanel(props: SearchPanelProps): React.ReactElement {
  const {
    query,
    results,
    isSearching,
    statusLabel,
    activeResultKey,
    currentSectionIndex,
    restoreFocusElement,
    onQueryChange,
    onSelectResult,
    onClose,
    t,
  } = props;
  const resultRefs = useRef(new Map<string, HTMLButtonElement>());
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftQuery, setDraftQuery] = useState(query);
  const [pulsingResultKey, setPulsingResultKey] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(draftQuery, { delay: SEARCH_DEBOUNCE_MS });

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery === query) {
      return;
    }

    onQueryChange(debouncedQuery);
  }, [debouncedQuery, onQueryChange, query]);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current !== null) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  const groups = useMemo(() => {
    return results.reduce<Map<string, SearchResult[]>>((map, result) => {
      const bucket = map.get(result.sectionTitle) ?? [];
      bucket.push(result);
      map.set(result.sectionTitle, bucket);
      return map;
    }, new Map());
  }, [results]);
  const resultRows = useMemo<SearchResultRow[]>(() => {
    return Array.from(groups.values()).flatMap((sectionResults) =>
      sectionResults.map((result) => ({
        id: createResultKey(result),
      })),
    );
  }, [groups]);
  const [activeRovingId, setActiveRovingId] = useState<string | null>(activeResultKey ?? null);
  const selectedResultExists = activeResultKey ? resultRows.some((row) => row.id === activeResultKey) : false;
  const roving = useMemo(
    () => createRovingTabIndex(resultRows, {
      activeId: activeRovingId ?? activeResultKey,
      selectedId: selectedResultExists ? activeResultKey : undefined,
      orientation: "vertical",
      loop: false,
    }),
    [activeResultKey, activeRovingId, resultRows, selectedResultExists],
  );

  useEffect(() => {
    setActiveRovingId(activeResultKey ?? resultRows[0]?.id ?? null);
  }, [activeResultKey, resultRows]);

  function focusResult(rowId: string): void {
    resultRefs.current.get(rowId)?.focus();
  }

  const statusLine = useMemo(() => {
    const hasQuery = query.trim().length > 0;
    if (!hasQuery) {
      return t("book-reader.actions.search");
    }
    if (isSearching) {
      return statusLabel ?? t("book-reader.search.searching", { current: 0, total: 0 });
    }
    if (currentSectionIndex === undefined) {
      return statusLabel ?? t("book-reader.search.results", { count: results.length });
    }

    const sectionResultCount = results.filter((result) => result.sectionIndex === currentSectionIndex).length;
    return `共 ${results.length} 个结果 · 本章 ${sectionResultCount} 个`;
  }, [currentSectionIndex, isSearching, query, results, statusLabel, t]);

  const currentResultIndex = useMemo(() => {
    if (activeResultKey === null || activeResultKey === undefined) {
      return -1;
    }
    return results.findIndex((result) => createResultKey(result) === activeResultKey);
  }, [activeResultKey, results]);

  function stepToResult(direction: "previous" | "next"): void {
    if (currentResultIndex < 0) {
      return;
    }

    const targetIndex = direction === "previous" ? currentResultIndex - 1 : currentResultIndex + 1;
    const target = results[targetIndex];
    if (!target) {
      return;
    }

    const targetKey = createResultKey(target);
    onSelectResult(target);
    setPulsingResultKey(targetKey);

    if (pulseTimerRef.current !== null) {
      clearTimeout(pulseTimerRef.current);
    }
    pulseTimerRef.current = setTimeout(() => {
      setPulsingResultKey((current) => (current === targetKey ? null : current));
      pulseTimerRef.current = null;
    }, PULSE_DURATION_MS);

    requestAnimationFrame(() => {
      resultRefs.current.get(targetKey)?.scrollIntoView({ block: "nearest" });
    });
  }

  return (
    <PanelShell
      title={t("book-reader.labels.search")}
      eyebrow={t("book-reader.actions.search")}
      onClose={onClose}
      className="book-reader-panel--search"
      restoreFocusElement={restoreFocusElement}
      focusOnMount={false}
      t={t}
    >
      <div className="book-reader-search">
        <Input.Search
          id="book-reader-search-input"
          value={draftQuery}
          autoFocus
          aria-label={t("book-reader.actions.search")}
          placeholder={t("book-reader.placeholders.search")}
          onChange={(event) => setDraftQuery(event.target.value)}
        />

        <p className="book-reader-search__status">{statusLine}</p>

        <div className="book-reader-search__results">
          {query.trim() && !isSearching && results.length === 0 ? (
            <p className="book-reader-search__empty">{t("book-reader.search.noResults")}</p>
          ) : null}

          {Array.from(groups.entries()).map(([sectionTitle, sectionResults]) => (
            <section key={sectionTitle} className="book-reader-search__group">
              <header className="book-reader-search__groupHeader">
                <h3>{sectionTitle}</h3>
                <span>{t("book-reader.search.matchesInSection", { count: sectionResults.length })}</span>
              </header>
              <div className="book-reader-search__items">
                {sectionResults.map((result) => {
                  const resultKey = createResultKey(result);
                  const rovingItem = roving.items.find((item) => item.id === resultKey);
                  const tabIndexProps = getRovingTabIndexProps(rovingItem);
                  return (
                    <button
                      ref={(element) => {
                        if (element) {
                          resultRefs.current.set(resultKey, element);
                        } else {
                          resultRefs.current.delete(resultKey);
                        }
                      }}
                      key={resultKey}
                      type="button"
                      className={`book-reader-search__item${activeResultKey === resultKey ? " book-reader-search__item--active" : ""}${pulsingResultKey === resultKey ? " book-reader-search__item--pulse" : ""}`}
                      tabIndex={tabIndexProps.tabIndex}
                      data-active={tabIndexProps["data-active"]}
                      aria-current={activeResultKey === resultKey ? "true" : undefined}
                      aria-label={t("book-reader.search.resultLabel", {
                        section: result.sectionTitle,
                        excerpt: result.excerpt,
                      })}
                      onClick={() => onSelectResult(result)}
                      onFocus={() => setActiveRovingId(resultKey)}
                      onKeyDown={(event) => {
                        const nextIndex = roving.getIndexByKey(event.nativeEvent, {
                          keyboardMap: SEARCH_RESULTS_KEYBOARD_MAP,
                          orientation: "vertical",
                          loop: false,
                        });

                        if (nextIndex >= 0) {
                          event.preventDefault();
                          const nextRow = roving.items[nextIndex]?.item;
                          if (nextRow) {
                            setActiveRovingId(nextRow.id);
                            focusResult(nextRow.id);
                          }
                        }
                      }}
                    >
                      <span>{renderExcerpt(result)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {results.length > 0 ? (
          <footer className="book-reader-search__footer">
            <div className="book-reader-search__nav">
              <button
                type="button"
                className="book-reader-search__navButton"
                disabled={currentResultIndex <= 0}
                onClick={() => stepToResult("previous")}
              >
                上一条
              </button>
              <button
                type="button"
                className="book-reader-search__navButton"
                disabled={currentResultIndex < 0 || currentResultIndex >= results.length - 1}
                onClick={() => stepToResult("next")}
              >
                下一条
              </button>
            </div>
          </footer>
        ) : null}
      </div>
    </PanelShell>
  );
}
