// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressBar, type ProgressBarBookmark, type ProgressBarSectionMark } from "../../src/components/ProgressBar";
import type { ReadingProgress } from "../../src/engine/types";

const PROGRESS: ReadingProgress = {
  readingMode: "paginated",
  sectionIndex: 0,
  sectionCount: 2,
  sectionTitle: "第一章",
  sectionFraction: 0.5,
  bookFraction: 0.25,
  bookPercentage: 25,
  currentPage: 3,
  totalPages: 10,
};

const SECTION_MARKS: ProgressBarSectionMark[] = [
  { fraction: 0, title: "第一章" },
  { fraction: 0.5, title: "第二章" },
];

const BOOKMARKS: ProgressBarBookmark[] = [
  { sectionIndex: 0, scrollFraction: 0.4, readingMode: "paginated" },
];

function t(key: string, params?: Record<string, string | number>): string {
  if (key === "book-reader.reader.pagePosition") {
    return `第 ${params?.current} / ${params?.total} 页`;
  }
  if (key === "book-reader.reader.bookProgress") {
    return `全书 ${params?.percentage}%`;
  }
  if (key === "book-reader.labels.progress") {
    return "阅读进度";
  }
  return key;
}

describe("ProgressBar 进度条增强", () => {
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

  function renderProgressBar(overrides: Partial<React.ComponentProps<typeof ProgressBar>> = {}): Promise<void> {
    return act(async () => {
      root.render(
        <ProgressBar
          progress={PROGRESS}
          onSeek={vi.fn()}
          bookmarks={BOOKMARKS}
          sectionMarks={SECTION_MARKS}
          sectionWeights={[1, 1]}
          onBookmarkClick={vi.fn()}
          onPreviousSection={vi.fn()}
          onNextSection={vi.fn()}
          canPreviousSection={false}
          canNextSection={true}
          t={t}
          {...overrides}
        />,
      );
    });
  }

  it("渲染章节标题、页码进度与全书进度", async () => {
    await renderProgressBar();

    expect(container.querySelector(".book-reader-progress__section")?.textContent).toBe("第一章");
    expect(container.querySelector(".book-reader-progress__label")?.textContent).toContain("第 3 / 10 页");
    expect(container.querySelector(".book-reader-progress__label")?.textContent).toContain("全书 25%");
    expect(container.querySelector('[role="slider"]')).toBeTruthy();
  });

  it("按章节刻度渲染标记，并渲染书签点且可点击", async () => {
    const onBookmarkClick = vi.fn();
    await renderProgressBar({ onBookmarkClick });

    const markHits = container.querySelectorAll(".book-reader-progress__markHit");
    expect(markHits).toHaveLength(SECTION_MARKS.length);

    const bookmarkButton = container.querySelector<HTMLButtonElement>(".book-reader-progress__bookmark");
    expect(bookmarkButton).toBeTruthy();
    expect(bookmarkButton?.getAttribute("aria-label")).toBe("书签：第一章");

    await act(async () => {
      bookmarkButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onBookmarkClick).toHaveBeenCalledTimes(1);
    expect(onBookmarkClick).toHaveBeenCalledWith(BOOKMARKS[0]);
  });

  it("按章节边界禁用上一条/下一条按钮", async () => {
    const onPreviousSection = vi.fn();
    const onNextSection = vi.fn();
    await renderProgressBar({ onPreviousSection, onNextSection });

    const previousButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (element) => element.getAttribute("aria-label") === "上一章",
    );
    const nextButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (element) => element.getAttribute("aria-label") === "下一章",
    );

    expect(previousButton?.disabled).toBe(true);
    expect(nextButton?.disabled).toBe(false);

    await act(async () => {
      previousButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onPreviousSection).not.toHaveBeenCalled();

    await act(async () => {
      nextButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onNextSection).toHaveBeenCalledTimes(1);
  });

  it("进度为 null 时不渲染", async () => {
    await renderProgressBar({ progress: null });

    expect(container.querySelector(".book-reader-progress")).toBeNull();
  });
});
