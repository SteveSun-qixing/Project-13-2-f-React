import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createKeyboardMap,
  createRovingTabIndex,
  getKeyboardAction,
  getRovingTabIndexProps,
} from "../utils/a11y";
import type { EpubNavigationItem } from "../domain/epub/types";

export interface NavigationTreeProps {
  items: EpubNavigationItem[];
  currentSectionIndex: number;
  sectionProgress?: number[];
  expandAll?: boolean;
  onSelectSection: (sectionIndex: number, fragment?: string) => void;
}

interface NavigationRow {
  id: string;
  item: EpubNavigationItem;
  level: number;
  parentIds: string[];
  disabled: boolean;
}

const NAVIGATION_TREE_KEYBOARD_MAP = createKeyboardMap({
  activate: ["Enter", " "],
  next: "ArrowDown",
  previous: "ArrowUp",
  first: "Home",
  last: "End",
});

const NAVIGATION_PULSE_DURATION = 600;

function flattenNavigationItems(items: EpubNavigationItem[], parentIds: string[] = [], level = 1): NavigationRow[] {
  return items.flatMap((item) => [
    {
      id: item.id,
      item,
      level,
      parentIds,
      disabled: typeof item.sectionIndex !== "number",
    },
    ...flattenNavigationItems(item.children, [...parentIds, item.id], level + 1),
  ]);
}

function createNavigationDomId(id: string): string {
  return `book-reader-nav-item-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function getInitialCollapsedIds(rows: NavigationRow[], currentSectionIndex: number): Set<string> {
  const currentRow = rows.find(
    (row) => row.item.sectionIndex === currentSectionIndex && !row.disabled,
  );
  const expanded = new Set(currentRow ? [currentRow.id, ...currentRow.parentIds] : []);
  return new Set(
    rows.filter((row) => row.item.children.length > 0 && !expanded.has(row.id)).map((row) => row.id),
  );
}

function getSectionPercentageLabel(
  sectionIndex: number | undefined,
  sectionProgress: number[] | undefined,
): string | null {
  if (typeof sectionIndex !== "number" || !sectionProgress) {
    return null;
  }
  const value = sectionProgress[sectionIndex];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return `${Math.round(value * 100)}%`;
}

export function NavigationTree(props: NavigationTreeProps): React.ReactElement {
  const { items, currentSectionIndex, sectionProgress, expandAll = false, onSelectSection } = props;
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const rows = useMemo(() => flattenNavigationItems(items), [items]);
  const selectedRow = useMemo(
    () => rows.find((row) => row.item.sectionIndex === currentSectionIndex && !row.disabled) ?? null,
    [currentSectionIndex, rows],
  );
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => getInitialCollapsedIds(rows, currentSectionIndex));
  const [activeId, setActiveId] = useState<string | null>(selectedRow?.id ?? null);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const visibleRows = useMemo(
    () => rows.filter((row) => !row.parentIds.some((parentId) => !expandAll && collapsedIds.has(parentId))),
    [collapsedIds, expandAll, rows],
  );
  const roving = useMemo(
    () =>
      createRovingTabIndex(visibleRows, {
        activeId: activeId ?? selectedRow?.id,
        selectedId: selectedRow?.id,
        orientation: "vertical",
        loop: false,
      }),
    [activeId, selectedRow?.id, visibleRows],
  );

  useEffect(() => {
    setActiveId(selectedRow?.id ?? null);
  }, [selectedRow?.id]);

  useEffect(() => {
    if (!selectedRow) {
      return;
    }
    buttonRefs.current.get(selectedRow.id)?.scrollIntoView({ block: "center" });
    setPulseId(selectedRow.id);
    const timer = window.setTimeout(() => {
      setPulseId(null);
    }, NAVIGATION_PULSE_DURATION);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  function focusRow(rowId: string): void {
    buttonRefs.current.get(rowId)?.focus();
  }

  function toggleCollapse(id: string): void {
    const isCollapsing = !expandAll && !collapsedIds.has(id);
    if (isCollapsing && activeId !== null && rows.some((row) => row.parentIds.includes(id) && row.id === activeId)) {
      setActiveId(id);
    }
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (rows.length === 0) {
    return <div role="tree" className="book-reader-nav__tree" />;
  }

  return (
    <div role="tree" className="book-reader-nav__tree">
      {roving.items.map((rovingItem) => {
        const row = rovingItem.item;
        const { item } = row;
        const isSelected = item.sectionIndex === currentSectionIndex;
        const hasChildren = item.children.length > 0;
        const isCollapsed = hasChildren && !expandAll && collapsedIds.has(item.id);
        const tabIndexProps = getRovingTabIndexProps(rovingItem);
        const percentageLabel = getSectionPercentageLabel(item.sectionIndex, sectionProgress);

        return (
          <div
            key={item.id}
            className="book-reader-nav__branch"
            style={{ marginLeft: `${(row.level - 1) * 14}px` }}
          >
            <div className="book-reader-nav__row">
              {hasChildren ? (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={isCollapsed ? "展开" : "收起"}
                  aria-expanded={!isCollapsed}
                  className={`book-reader-nav__toggle${isCollapsed ? "" : " book-reader-nav__toggle--expanded"}`}
                  onClick={() => toggleCollapse(item.id)}
                >
                  <span className="book-reader-nav__toggle-icon" aria-hidden="true" />
                </button>
              ) : (
                <span className="book-reader-nav__spacer" aria-hidden="true" />
              )}
              <button
                ref={(element) => {
                  if (element) {
                    buttonRefs.current.set(row.id, element);
                  } else {
                    buttonRefs.current.delete(row.id);
                  }
                }}
                id={createNavigationDomId(row.id)}
                type="button"
                role="treeitem"
                aria-level={row.level}
                aria-selected={isSelected}
                aria-current={isSelected ? "true" : undefined}
                aria-expanded={hasChildren ? !isCollapsed : undefined}
                aria-disabled={row.disabled ? "true" : undefined}
                className={[
                  "book-reader-nav__item",
                  isSelected ? "book-reader-nav__item--active" : "",
                  pulseId === row.id ? "book-reader-nav__item--pulse" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={row.disabled}
                tabIndex={tabIndexProps.tabIndex}
                data-active={tabIndexProps["data-active"]}
                onClick={() => {
                  if (typeof item.sectionIndex === "number") {
                    onSelectSection(item.sectionIndex, item.fragment);
                  }
                }}
                onKeyDown={(event) => {
                  if (hasChildren) {
                    if (event.key === "ArrowRight" && isCollapsed) {
                      event.preventDefault();
                      toggleCollapse(item.id);
                      return;
                    }
                    if (event.key === "ArrowLeft" && !isCollapsed) {
                      event.preventDefault();
                      toggleCollapse(item.id);
                      return;
                    }
                  }
                  const nextIndex = roving.getIndexByKey(event.nativeEvent, {
                    keyboardMap: NAVIGATION_TREE_KEYBOARD_MAP,
                    orientation: "vertical",
                    loop: false,
                  });
                  if (nextIndex >= 0) {
                    event.preventDefault();
                    const nextRow = roving.items[nextIndex]?.item;
                    if (nextRow) {
                      setActiveId(nextRow.id);
                      focusRow(nextRow.id);
                    }
                    return;
                  }

                  if (getKeyboardAction(event.nativeEvent, NAVIGATION_TREE_KEYBOARD_MAP) === "activate") {
                    event.preventDefault();
                    if (typeof item.sectionIndex === "number") {
                      onSelectSection(item.sectionIndex, item.fragment);
                    }
                  }
                }}
              >
                <span className="book-reader-nav__label">{item.label}</span>
                {percentageLabel ? <span className="book-reader-nav__percentage">{percentageLabel}</span> : null}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
