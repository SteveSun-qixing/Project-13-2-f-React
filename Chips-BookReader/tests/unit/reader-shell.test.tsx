// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandProvider } from "@chips/ui";
import { ReaderShell } from "../../src/components/ReaderShell";
import type { EpubBook } from "../../src/domain/epub/types";
import type { ReaderPreferences } from "../../src/utils/book-reader";

const DEFAULT_PREFERENCES: ReaderPreferences = {
  fontScale: 1,
  contentWidth: 760,
  fontFamily: "serif",
  readingMode: "paginated",
  backgroundTone: "theme",
};

const DEFAULT_THEME = {
  surface: "#f5f2ea",
  text: "#1f1d19",
  mutedText: "#6b665d",
  primary: "#2158d2",
  border: "rgba(0, 0, 0, 0.12)",
  accentSurface: "#eef3ff",
  resolvedTone: "theme" as const,
  isDark: false,
  transition: {
    durationMs: 300,
    className: "book-reader-theme-transition",
    cssText: "transition: background-color 300ms ease, color 300ms ease",
  },
};

const { useAppRuntimeMock, readingPositionMock } = vi.hoisted(() => ({
  useAppRuntimeMock: vi.fn(),
  readingPositionMock: {
    savedPosition: null,
    track: vi.fn(),
    flush: vi.fn(),
    restore: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock("../../src/app/AppRuntimeProvider", () => ({
  useAppRuntime: useAppRuntimeMock,
}));

const configGet = vi.fn(async (_key: string) => []);
const configSet = vi.fn(async (_key: string, _value: unknown) => undefined);

const CONFIG_CLIENT = {
  get: async <T = unknown>(key: string) => (await configGet(key)) as T,
  set: async <T = unknown>(key: string, value: T) => {
    await configSet(key, value);
  },
};

const MESSAGES: Record<string, string> = {
  "book-reader.empty.prompt": "拖入电子书，或点击导入",
  "book-reader.labels.appName": "书籍阅读器",
  "book-reader.labels.importBook": "导入电子书",
  "book-reader.labels.progress": "阅读进度",
  "book-reader.labels.bookmarks": "书签",
  "book-reader.labels.search": "搜索",
  "book-reader.labels.contents": "目录",
  "book-reader.labels.preferences": "阅读偏好",
  "book-reader.labels.readingMode": "阅读模式",
  "book-reader.labels.backgroundTone": "背景颜色",
  "book-reader.labels.paginated": "翻页",
  "book-reader.labels.scroll": "滚动",
  "book-reader.labels.backgroundTheme": "主题",
  "book-reader.labels.backgroundWarm": "暖白",
  "book-reader.labels.backgroundMist": "雾蓝",
  "book-reader.labels.backgroundNight": "夜间",
  "book-reader.labels.fontScale": "字号",
  "book-reader.labels.contentWidth": "版心宽度",
  "book-reader.labels.fontFamily": "字体风格",
  "book-reader.labels.serif": "衬线",
  "book-reader.labels.sans": "无衬线",
  "book-reader.actions.openFile": "打开电子书",
  "book-reader.actions.openUrl": "打开链接",
  "book-reader.actions.openLibrary": "导入书籍",
  "book-reader.actions.openPreferences": "打开阅读偏好",
  "book-reader.actions.openBookmarks": "打开书签",
  "book-reader.actions.closePanel": "关闭面板",
  "book-reader.actions.toggleToc": "切换目录",
  "book-reader.actions.toggleSearch": "搜索",
  "book-reader.actions.toggleBookmark": "切换书签",
  "book-reader.actions.previousPage": "上一页",
  "book-reader.actions.nextPage": "下一页",
  "book-reader.actions.previousSection": "上一章",
  "book-reader.actions.nextSection": "下一章",
  "book-reader.actions.decreaseFont": "减小字号",
  "book-reader.actions.increaseFont": "增大字号",
  "book-reader.actions.narrowContent": "缩窄版心",
  "book-reader.actions.widenContent": "放宽版心",
  "book-reader.reader.unknownCreator": "未知作者",
  "book-reader.reader.localSource": "本地文件",
  "book-reader.reader.remoteSource": "远程链接",
  "book-reader.status.loading": "正在准备阅读内容...",
  "book-reader.placeholders.remoteUrl": "粘贴 EPUB 链接，例如 https://example.com/book.epub",
  "book-reader.placeholders.search": "搜索电子书内容...",
  "book-reader.bookmarks.empty": "还没有书签",
  "book-reader.bookmarks.count": "共 0 个书签",
  "book-reader.search.noResults": "没有找到匹配的内容",
};

function t(key: string, params?: Record<string, string | number>): string {
  if (key === "book-reader.reader.sectionPosition") {
    return `第 ${params?.current ?? "?"} / ${params?.total ?? "?"} 章`;
  }

  return MESSAGES[key] ?? key;
}

function createBookFixture(sectionCount = 1): EpubBook {
  const sectionTitles = ["第一章", "第二章", "第三章"];
  const sections = Array.from({ length: sectionCount }, (_, index) => ({
    id: `chapter-${index + 1}`,
    href: `chapter-${index + 1}.xhtml`,
    path: `OEBPS/chapter-${index + 1}.xhtml`,
    title: sectionTitles[index] ?? `第${index + 1}章`,
    linear: true,
  }));

  return {
    source: {
      sourceId: "/tmp/demo.epub",
      filePath: "/tmp/demo.epub",
      fileName: "demo.epub",
      title: "Demo",
      isRemote: false,
    },
    metadata: {
      title: "示例书籍",
      creator: "测试作者",
      language: "zh-CN",
    },
    archive: {} as EpubBook["archive"],
    publication: {
      readingOrder: [],
      resources: [],
      toc: [],
      linksByPath: new Map(),
    },
    packagePath: "OEBPS/content.opf",
    manifest: new Map(),
    manifestByPath: new Map(),
    sections,
    navigation: sections.map((section, index) => ({
      id: `nav-${index + 1}`,
      label: section.title,
      href: section.href,
      path: section.path,
      sectionIndex: index,
      children: [],
    })),
  };
}

describe("ReaderShell 沉浸式阅读界面", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useAppRuntimeMock.mockReturnValue({ readingPosition: readingPositionMock });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("空态只展示中心导入提示，并且可以唤起导入面板", async () => {
    const onOpenFile = vi.fn(async () => undefined);

    await act(async () => {
      root.render(
        <CommandProvider>
          <ReaderShell
            book={null}
            renderedSection={null}
            currentSectionIndex={0}
            feedback={null}
            isResolving={false}
            isLoadingSection={false}
            preferences={DEFAULT_PREFERENCES}
            themePalette={DEFAULT_THEME}
            configClient={CONFIG_CLIENT}
            onOpenFile={onOpenFile}
            onOpenUrl={vi.fn(async () => undefined)}
            onSelectSection={vi.fn()}
            onStepSection={vi.fn()}
            onUpdatePreferences={vi.fn()}
            onDropFiles={vi.fn(async () => undefined)}
            onOpenExternalLink={vi.fn(async () => undefined)}
            t={t}
          />
        </CommandProvider>,
      );
    });

    const prompt = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent?.trim() === t("book-reader.empty.prompt"),
    );

    expect(prompt).toBeTruthy();
    expect(container.textContent).not.toContain(t("book-reader.actions.openFile"));

    await act(async () => {
      prompt?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain(t("book-reader.labels.importBook"));

    const openFileButton = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent?.trim() === t("book-reader.actions.openFile"),
    );

    expect(openFileButton).toBeTruthy();

    await act(async () => {
      openFileButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenFile).toHaveBeenCalledTimes(1);
  });

  it("阅读态默认隐藏控制层，并可通过点击阅读面唤出目录入口", async () => {
    await act(async () => {
      root.render(
        <CommandProvider>
          <ReaderShell
            book={createBookFixture()}
            renderedSection={null}
            currentSectionIndex={0}
            feedback={null}
            isResolving={false}
            isLoadingSection={false}
            preferences={DEFAULT_PREFERENCES}
            themePalette={DEFAULT_THEME}
            configClient={CONFIG_CLIENT}
            onOpenFile={vi.fn(async () => undefined)}
            onOpenUrl={vi.fn(async () => undefined)}
            onSelectSection={vi.fn()}
            onStepSection={vi.fn()}
            onUpdatePreferences={vi.fn()}
            onDropFiles={vi.fn(async () => undefined)}
            onOpenExternalLink={vi.fn(async () => undefined)}
            t={t}
          />
        </CommandProvider>,
      );
    });

    const chromeHost = container.querySelector(".book-reader-chromeHost");
    expect(chromeHost?.getAttribute("data-state")).toBe("hidden");

    const frameHost = container.querySelector(".book-reader-frameHost");
    expect(frameHost).toBeTruthy();

    await act(async () => {
      frameHost?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(chromeHost?.getAttribute("data-state")).toBe("visible");

    const contentsButton = Array.from(container.querySelectorAll("button")).find(
      (element) => element.getAttribute("aria-label") === "目录",
    );

    expect(contentsButton).toBeTruthy();

    await act(async () => {
      contentsButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain(t("book-reader.labels.contents"));
    expect(container.textContent).toContain("第一章");
  });

  it("控制层在空闲后自动隐藏，指针移动会重新计时", async () => {
    vi.useFakeTimers();

    await act(async () => {
      root.render(
        <CommandProvider>
          <ReaderShell
            book={createBookFixture()}
            renderedSection={null}
            currentSectionIndex={0}
            feedback={null}
            isResolving={false}
            isLoadingSection={false}
            preferences={DEFAULT_PREFERENCES}
            themePalette={DEFAULT_THEME}
            configClient={CONFIG_CLIENT}
            onOpenFile={vi.fn(async () => undefined)}
            onOpenUrl={vi.fn(async () => undefined)}
            onSelectSection={vi.fn()}
            onStepSection={vi.fn()}
            onUpdatePreferences={vi.fn()}
            onDropFiles={vi.fn(async () => undefined)}
            onOpenExternalLink={vi.fn(async () => undefined)}
            t={t}
          />
        </CommandProvider>,
      );
    });

    const chromeHost = container.querySelector(".book-reader-chromeHost");
    const frameHost = container.querySelector(".book-reader-frameHost");

    await act(async () => {
      frameHost?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(chromeHost?.getAttribute("data-state")).toBe("visible");

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(chromeHost?.getAttribute("data-state")).toBe("visible");

    await act(async () => {
      window.dispatchEvent(new PointerEvent("pointermove"));
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(chromeHost?.getAttribute("data-state")).toBe("visible");

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(chromeHost?.getAttribute("data-state")).toBe("hidden");
  });

  it("章节切换后展示章节横幅，并在定时后消失", async () => {
    vi.useFakeTimers();
    const book = createBookFixture(2);
    const renderShell = (currentSectionIndex: number) => (
      <CommandProvider>
        <ReaderShell
          book={book}
          renderedSection={null}
          currentSectionIndex={currentSectionIndex}
          feedback={null}
          isResolving={false}
          isLoadingSection={false}
          preferences={DEFAULT_PREFERENCES}
          themePalette={DEFAULT_THEME}
          configClient={CONFIG_CLIENT}
          onOpenFile={vi.fn(async () => undefined)}
          onOpenUrl={vi.fn(async () => undefined)}
          onSelectSection={vi.fn()}
          onStepSection={vi.fn()}
          onUpdatePreferences={vi.fn()}
          onDropFiles={vi.fn(async () => undefined)}
          onOpenExternalLink={vi.fn(async () => undefined)}
          t={t}
        />
      </CommandProvider>
    );

    await act(async () => {
      root.render(renderShell(0));
    });
    expect(container.querySelector(".book-reader-sectionBanner")).toBeNull();

    await act(async () => {
      root.render(renderShell(1));
    });

    const banner = container.querySelector(".book-reader-sectionBanner");
    expect(banner).toBeTruthy();
    expect(banner?.textContent).toBe("第二章");

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(container.querySelector(".book-reader-sectionBanner")).toBeNull();
  });
});
