// @vitest-environment jsdom

import React, { useRef, useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "../../src/engine/search-engine";
import type { EpubNavigationItem } from "../../src/domain/epub/types";
import type { Bookmark } from "../../src/hooks/useBookmarks";
import { BookmarkPanel } from "../../src/components/BookmarkPanel";
import { NavigationTree } from "../../src/components/NavigationTree";
import { PanelShell } from "../../src/components/PanelShell";
import { SearchPanel } from "../../src/components/SearchPanel";

function t(key: string, params?: Record<string, string | number>): string {
  if (key === "book-reader.actions.closePanel") {
    return "关闭面板";
  }
  if (key === "book-reader.labels.search") {
    return "搜索";
  }
  if (key === "book-reader.actions.search") {
    return "搜索电子书";
  }
  if (key === "book-reader.placeholders.search") {
    return "搜索电子书内容...";
  }
  if (key === "book-reader.search.results") {
    return `找到 ${params?.count} 个结果`;
  }
  if (key === "book-reader.search.matchesInSection") {
    return `${params?.count} 个匹配`;
  }
  if (key === "book-reader.search.resultLabel") {
    return `搜索结果：${params?.section}，${params?.excerpt}`;
  }
  if (key === "book-reader.labels.bookmarks") {
    return "书签";
  }
  if (key === "book-reader.labels.appName") {
    return "书籍阅读器";
  }
  if (key === "book-reader.bookmarks.count") {
    return `共 ${params?.count} 个书签`;
  }
  if (key === "book-reader.bookmarks.pageLabel") {
    return `第 ${params?.page} 页`;
  }
  if (key === "book-reader.bookmarks.scrollLabel") {
    return `${params?.percentage}% 处`;
  }
  if (key === "book-reader.bookmarks.openLabel") {
    return `打开书签：${params?.section}，${params?.position}，创建于 ${params?.createdAt}`;
  }
  if (key === "book-reader.bookmarks.removeLabel") {
    return `删除书签：${params?.section}，${params?.position}`;
  }
  if (key === "book-reader.actions.removeBookmark") {
    return "删除书签";
  }
  return key;
}

function dispatchKeyboard(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("BookReader focus keyboard and a11y", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("目录树使用单一 Tab 入口并支持纵向 roving 键盘导航", async () => {
    const onSelectSection = vi.fn();
    const items: EpubNavigationItem[] = [
      {
        id: "chapter-1",
        label: "第一章",
        href: "chapter-1.xhtml",
        path: "OEBPS/chapter-1.xhtml",
        sectionIndex: 0,
        children: [
          {
            id: "chapter-1-1",
            label: "第一节",
            href: "chapter-1.xhtml#part",
            path: "OEBPS/chapter-1.xhtml",
            fragment: "part",
            sectionIndex: 1,
            children: [],
          },
        ],
      },
      {
        id: "chapter-2",
        label: "第二章",
        href: "chapter-2.xhtml",
        path: "OEBPS/chapter-2.xhtml",
        sectionIndex: 2,
        children: [],
      },
    ];

    await act(async () => {
      root.render(
        <NavigationTree
          items={items}
          currentSectionIndex={0}
          onSelectSection={onSelectSection}
        />,
      );
    });

    const treeItems = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="treeitem"]'));
    expect(container.querySelector('[role="tree"]')).toBeTruthy();
    expect(treeItems.map((item) => item.tabIndex)).toEqual([0, -1, -1]);
    expect(treeItems[0]?.getAttribute("aria-selected")).toBe("true");
    expect(treeItems[1]?.getAttribute("aria-level")).toBe("2");

    await act(async () => {
      treeItems[0]?.focus();
    });
    await act(async () => {
      dispatchKeyboard(treeItems[0], "ArrowDown");
    });

    expect(document.activeElement).toBe(treeItems[1]);
    expect(treeItems.map((item) => item.tabIndex)).toEqual([-1, 0, -1]);

    await act(async () => {
      dispatchKeyboard(treeItems[1], "End");
    });

    expect(document.activeElement).toBe(treeItems[2]);

    await act(async () => {
      dispatchKeyboard(treeItems[2], "Enter");
    });

    expect(onSelectSection).toHaveBeenCalledWith(2, undefined);
  });

  it("搜索结果列表接入 roving tabindex 并保留结果激活语义", async () => {
    const onSelectResult = vi.fn();
    const results: SearchResult[] = [
      {
        sectionIndex: 0,
        sectionTitle: "第一章",
        excerpt: "winter night",
        matchOffset: 0,
        matchLength: 6,
        query: "winter",
      },
      {
        sectionIndex: 1,
        sectionTitle: "第二章",
        excerpt: "winter wind",
        matchOffset: 8,
        matchLength: 6,
        query: "winter",
      },
    ];

    await act(async () => {
      root.render(
        <SearchPanel
          query="winter"
          results={results}
          isSearching={false}
          statusLabel="找到 2 个结果"
          onQueryChange={vi.fn()}
          onSelectResult={onSelectResult}
          onClose={vi.fn()}
          t={t}
        />,
      );
    });

    const resultButtons = Array.from(container.querySelectorAll<HTMLButtonElement>(".book-reader-search__item"));
    expect(resultButtons.map((item) => item.tabIndex)).toEqual([0, -1]);
    expect(resultButtons[0]?.getAttribute("aria-label")).toContain("第一章");

    await act(async () => {
      resultButtons[0]?.focus();
    });
    await act(async () => {
      dispatchKeyboard(resultButtons[0], "ArrowDown");
    });

    expect(document.activeElement).toBe(resultButtons[1]);
    expect(resultButtons.map((item) => item.tabIndex)).toEqual([-1, 0]);

    await act(async () => {
      resultButtons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSelectResult).toHaveBeenCalledWith(results[1]);
  });

  it("书签列表用 roving 管理打开入口，并为删除动作提供独立标签", async () => {
    const onGoToBookmark = vi.fn();
    const onRemoveBookmark = vi.fn();
    const bookmarks: Bookmark[] = [
      {
        id: "bookmark-1",
        sectionIndex: 0,
        sectionTitle: "第一章",
        spreadIndex: 0,
        scrollFraction: 0.1,
        readingMode: "paginated",
        createdAt: 1000,
      },
      {
        id: "bookmark-2",
        sectionIndex: 1,
        sectionTitle: "第二章",
        spreadIndex: 2,
        scrollFraction: 0.5,
        readingMode: "paginated",
        createdAt: 2000,
      },
    ];

    await act(async () => {
      root.render(
        <BookmarkPanel
          bookmarks={bookmarks}
          activeBookmarkId="bookmark-1"
          onGoToBookmark={onGoToBookmark}
          onRemoveBookmark={onRemoveBookmark}
          onClose={vi.fn()}
          t={t}
        />,
      );
    });

    const openButtons = Array.from(container.querySelectorAll<HTMLButtonElement>(".book-reader-bookmarks__open"));
    expect(openButtons.map((item) => item.tabIndex)).toEqual([0, -1]);
    expect(openButtons[0]?.getAttribute("aria-current")).toBe("true");

    await act(async () => {
      openButtons[0]?.focus();
    });
    await act(async () => {
      dispatchKeyboard(openButtons[0], "ArrowDown");
    });

    expect(document.activeElement).toBe(openButtons[1]);
    expect(openButtons.map((item) => item.tabIndex)).toEqual([-1, 0]);

    const removeButtons = Array.from(container.querySelectorAll<HTMLButtonElement>(".book-reader-bookmarks__remove"));
    expect(removeButtons[0]?.getAttribute("aria-label")).toContain("删除书签");

    await act(async () => {
      openButtons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onGoToBookmark).toHaveBeenCalledWith(bookmarks[1]);
  });

  it("面板 Escape 关闭后会恢复打开前焦点", async () => {
    function Harness(): React.ReactElement {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef<HTMLButtonElement | null>(null);

      return (
        <>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(true)}
          >
            打开面板
          </button>
          {open ? (
            <PanelShell
              title="阅读偏好"
              onClose={() => setOpen(false)}
              restoreFocusElement={triggerRef.current}
              t={t}
            >
              <button type="button">面板内按钮</button>
            </PanelShell>
          ) : null}
        </>
      );
    }

    await act(async () => {
      root.render(<Harness />);
    });

    const trigger = container.querySelector<HTMLButtonElement>("button");
    await act(async () => {
      trigger?.focus();
    });
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");

    await act(async () => {
      dispatchKeyboard(dialog as HTMLElement, "Escape");
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
