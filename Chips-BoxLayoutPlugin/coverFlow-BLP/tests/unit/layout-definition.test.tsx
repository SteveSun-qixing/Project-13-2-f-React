import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { layoutDefinition } from "../../src/index";
import type { BoxEntryPage, BoxEntrySnapshot, BoxLayoutRuntime, ResolvedRuntimeResource } from "../../src/shared/types";
import type { LayoutConfig } from "../../src/schema/layout-config";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function createEntry(entryId: string, title: string, contentType = "chips/card"): BoxEntrySnapshot {
  return {
    entryId,
    url: `file:///tmp/${entryId}.card`,
    enabled: true,
    snapshot: {
      documentId: `document-${entryId}`,
      title,
      summary: `Summary ${title}`,
      cover: {
        mode: "runtime",
      },
      contentType,
    },
  };
}

function createRuntime(overrides: Partial<BoxLayoutRuntime> = {}): BoxLayoutRuntime {
  return {
    listEntries: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
    }),
    readEntryDetail: vi.fn(),
    renderEntryCover: vi.fn((entryId: string) => Promise.resolve({
      title: `Cover ${entryId}`,
      coverUrl: `chips-render://cover/${entryId}`,
      mimeType: "text/html",
      ratio: "3:4",
    })),
    resolveEntryResource: vi.fn(),
    readBoxAsset: vi.fn().mockResolvedValue({
      resourceUrl: "chips-render://asset/background",
      mimeType: "image/png",
    }),
    prefetchEntries: vi.fn().mockResolvedValue(undefined),
    openEntry: vi.fn().mockResolvedValue({
      mode: "document-window",
      documentType: "card",
      windowId: "window-1",
    }),
    ...overrides,
  };
}

async function renderView({
  container,
  initialView,
  runtime,
  config = layoutDefinition.createDefaultConfig(),
}: {
  container: HTMLElement;
  initialView: BoxEntryPage;
  runtime: BoxLayoutRuntime;
  config?: Record<string, unknown>;
}) {
  let cleanup: (() => void) | undefined;
  await act(async () => {
    const maybeCleanup = layoutDefinition.renderView({
      container,
      sessionId: "session-1",
      box: {
        boxId: "box-1",
        boxFile: "/tmp/demo.box",
        name: "Demo",
        activeLayoutType: "chips.layout.coverflow.blp",
        availableLayouts: ["chips.layout.coverflow.blp"],
      },
      initialView,
      config,
      runtime,
      locale: "zh-CN",
    });
    cleanup = typeof maybeCleanup === "function" ? maybeCleanup : undefined;
    await Promise.resolve();
    await Promise.resolve();
  });
  return cleanup ?? (() => undefined);
}

async function renderEditor({
  container,
  initialConfig = layoutDefinition.createDefaultConfig(),
  onChange = vi.fn(),
  readBoxAsset,
  importBoxAsset,
  deleteBoxAsset,
}: {
  container: HTMLElement;
  initialConfig?: Record<string, unknown>;
  onChange?: ReturnType<typeof vi.fn>;
  readBoxAsset?: (assetPath: string) => Promise<ResolvedRuntimeResource>;
  importBoxAsset?: (input: { file: File; preferredPath?: string }) => Promise<{ assetPath: string }>;
  deleteBoxAsset?: (assetPath: string) => Promise<void>;
}) {
  let cleanup: (() => void) | undefined;
  await act(async () => {
    const maybeCleanup = layoutDefinition.renderEditor?.({
      container,
      entries: [
        createEntry("entry-1", "Alpha"),
        createEntry("entry-2", "Beta", "chips/box"),
      ],
      initialConfig,
      onChange,
      readBoxAsset,
      importBoxAsset,
      deleteBoxAsset,
      locale: "zh-CN",
    });
    cleanup = typeof maybeCleanup === "function" ? maybeCleanup : undefined;
    await Promise.resolve();
  });
  return cleanup ?? (() => undefined);
}

function clickButtonByText(container: HTMLElement, text: string): void {
  const button = Array.from(container.querySelectorAll("button"))
    .find((candidate) => candidate.textContent?.includes(text));
  expect(button).toBeTruthy();
  button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function clickSegmentedItemByText(container: HTMLElement, text: string): void {
  const item = Array.from(container.querySelectorAll(".ant-segmented-item"))
    .find((candidate) => candidate.textContent === text);
  expect(item).toBeTruthy();
  item?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

async function uploadFile(input: HTMLInputElement, file: File): Promise<void> {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("layoutDefinition", () => {
  it("uses the official cover flow identity", () => {
    expect(layoutDefinition.pluginId).toBe("chips.layout.coverflow.blp");
    expect(layoutDefinition.layoutType).toBe("chips.layout.coverflow.blp");
    expect(layoutDefinition.displayName).toBe("唱片布局插件");
    expect(layoutDefinition.icon).toMatchObject({
      name: "view_carousel",
      decorative: true,
    });
    expect(layoutDefinition.getInitialQuery?.(layoutDefinition.createDefaultConfig())).toEqual({ limit: 72 });
  });

  it("renders initial cover flow, lazy-loads nearby covers and opens only the focused entry", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const entries = [
      createEntry("entry-1", "Alpha"),
      createEntry("entry-2", "Beta"),
      createEntry("entry-3", "Gamma"),
      createEntry("entry-4", "Delta"),
      createEntry("entry-5", "Epsilon"),
    ];

    const cleanup = await renderView({
      container,
      runtime,
      initialView: {
        items: entries,
        total: entries.length,
      },
    });

    expect(container.querySelector('[data-scope="chips-box-coverflow-layout"]')).toBeTruthy();
    expect(container.querySelector('[role="listbox"]')).toBeTruthy();
    expect(container.querySelector("style")?.textContent).toMatch(
      /\[data-scope="chips-box-coverflow-layout"\] \[data-coverflow-stage\] \{[^}]*grid-row: 2;/s
    );
    expect(container.querySelectorAll('[role="option"]').length).toBe(entries.length);
    expect(container.querySelector('[role="option"][aria-selected="true"]')).toBeTruthy();
    expect(container.querySelector('[data-entry-id="entry-1"]')?.getAttribute("data-focused")).toBe("true");
    expect(container.querySelectorAll('[data-coverflow-focused-title]').length).toBe(0);
    expect(container.querySelectorAll('[data-coverflow-item-title]').length).toBe(0);
    expect(container.textContent).toContain("远端占位");
    expect(runtime.renderEntryCover).toHaveBeenCalledWith("entry-1");
    expect(runtime.renderEntryCover).toHaveBeenCalledWith("entry-2");
    expect(runtime.renderEntryCover).toHaveBeenCalledWith("entry-3");
    expect(runtime.renderEntryCover).not.toHaveBeenCalledWith("entry-4");
    expect(runtime.openEntry).not.toHaveBeenCalled();

    const secondCover = container.querySelector('[data-entry-id="entry-2"] [data-coverflow-cover]');
    await act(async () => {
      secondCover?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(runtime.openEntry).not.toHaveBeenCalled();
    expect(container.querySelector('[data-entry-id="entry-2"]')?.getAttribute("data-focused")).toBe("true");

    const focusedCover = container.querySelector('[data-entry-id="entry-2"] [data-coverflow-cover]');
    focusedCover?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(runtime.openEntry).toHaveBeenCalledWith("entry-2");

    await act(async () => {
      cleanup();
    });
    expect(container.textContent ?? "").toBe("");
  });

  it("supports keyboard and wheel focus changes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    await renderView({
      container,
      runtime,
      initialView: {
        items: [
          createEntry("entry-1", "Alpha"),
          createEntry("entry-2", "Beta"),
          createEntry("entry-3", "Gamma"),
        ],
        total: 3,
      },
    });

    const stage = container.querySelector('[data-coverflow-stage]');
    expect(stage).toBeTruthy();
    await act(async () => {
      stage?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await Promise.resolve();
    });
    expect(container.querySelector('[data-entry-id="entry-2"]')?.getAttribute("data-focused")).toBe("true");

    await act(async () => {
      stage?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await Promise.resolve();
    });
    expect(runtime.openEntry).toHaveBeenCalledWith("entry-2");

    await act(async () => {
      stage?.dispatchEvent(new WheelEvent("wheel", { deltaY: 80, bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(container.querySelector('[data-entry-id="entry-3"]')?.getAttribute("data-focused")).toBe("true");
  });

  it("sorts entries by title when ascending mode is enabled", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const config = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "name-asc",
      },
    });

    await renderView({
      container,
      runtime: createRuntime(),
      config,
      initialView: {
        items: [
          createEntry("entry-b", "Beta"),
          createEntry("entry-a", "Alpha"),
        ],
        total: 2,
      },
    });

    expect(container.querySelector('[data-entry-id="entry-a"]')?.getAttribute("data-focused")).toBe("true");
  });

  it("loads additional pages and keeps existing entries when pagination fails", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const listEntries = vi.fn()
      .mockResolvedValueOnce({
        items: [createEntry("entry-2", "Beta")],
        total: 2,
        nextCursor: "cursor-2",
      })
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        items: [],
        total: 2,
      });
    const runtime = createRuntime({ listEntries });

    await renderView({
      container,
      runtime,
      initialView: {
        items: [createEntry("entry-1", "Alpha")],
        total: 2,
        nextCursor: "cursor-1",
      },
    });

    const loadMore = container.querySelector('[data-layout-load-more]');
    expect(loadMore).toBeTruthy();
    await act(async () => {
      loadMore?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(listEntries).toHaveBeenCalledWith({
      cursor: "cursor-1",
      limit: 72,
    });
    expect(container.querySelector('[data-entry-id="entry-1"]')).toBeTruthy();
    expect(container.querySelector('[data-entry-id="entry-2"]')).toBeTruthy();

    await act(async () => {
      container
        .querySelector('[data-layout-load-more]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain("后续条目加载失败");

    await act(async () => {
      container
        .querySelector('[data-layout-retry]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(listEntries).toHaveBeenCalledTimes(3);
  });

  it("renders cover failures and box entries without card-specific wrappers", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime({
      renderEntryCover: vi.fn().mockRejectedValue(new Error("cover failed")),
    });

    await renderView({
      container,
      runtime,
      initialView: {
        items: [createEntry("entry-box", "Nested Box", "chips/box")],
        total: 1,
      },
    });

    expect(container.textContent).toContain("封面加载失败");
    expect(container.textContent).toContain("箱子");
    expect(container.querySelector('[data-scope="card-cover-frame"]')).toBeNull();
  });

  it("reads box assets for configured frame regions", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const config = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.coverflow.blp/background.png",
        },
        topRegion: {
          mode: "html",
          html: "<section>Top</section>",
        },
      },
    });

    await renderView({
      container,
      runtime,
      config,
      initialView: {
        items: [],
        total: 0,
      },
    });

    expect(runtime.readBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.coverflow.blp/background.png");
    expect(container.querySelector('[data-layout-background] img')).toBeTruthy();
    expect(container.querySelector('[data-layout-top-region] [data-chips-embedded-frame="embedded-document-frame"]')).toBeTruthy();
  });

  it("renders cover flow shaped empty skeleton when the box has no entries", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();

    await renderView({
      container,
      runtime,
      initialView: {
        items: [],
        total: 0,
      },
    });

    expect(container.querySelector('[data-layout-skeleton]')).toBeTruthy();
    expect(container.querySelector('[data-layout-empty-hint]')).toBeTruthy();
    expect(container.querySelector('[data-layout-empty-title]')?.textContent).toBe("这里还没有内容");
    expect(container.querySelector('[data-layout-empty-text]')?.textContent).toBe("在编辑器中添加卡片或箱子，开始填充这个箱子");
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(container.querySelectorAll('[data-coverflow-item]').length).toBe(0);

    const skeletonParts = Array.from(
      container.querySelectorAll('[data-layout-skeleton] span[aria-hidden="true"]')
    ).map((node) => (node as HTMLElement).style.width);
    expect(skeletonParts).toEqual(["150px", "220px", "55%", "150px"]);
  });

  it("does not update the DOM after cleanup while runtime promises are pending", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let resolveCover: ((value: {
      title: string;
      coverUrl: string;
      mimeType: string;
    }) => void) | undefined;
    const renderEntryCover = vi.fn(() => new Promise<{
      title: string;
      coverUrl: string;
      mimeType: string;
    }>((resolve) => {
      resolveCover = resolve;
    }));
    const runtime = createRuntime({ renderEntryCover });

    const cleanup = await renderView({
      container,
      runtime,
      initialView: {
        items: [createEntry("entry-1", "Demo Card")],
        total: 1,
      },
    });

    await act(async () => {
      cleanup();
    });
    await act(async () => {
      resolveCover?.({
        title: "Late Cover",
        coverUrl: "chips-render://late",
        mimeType: "text/html",
      });
      await Promise.resolve();
    });
    expect(container.textContent ?? "").toBe("");
  });

  it("renders editor with cover flow controls and imports box assets into config snapshots", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/chips.layout.coverflow.blp/background/hero.png",
    });
    const readBoxAsset = vi.fn().mockResolvedValue({
      resourceUrl: "chips-render://asset/hero",
      mimeType: "image/png",
    });
    const deleteBoxAsset = vi.fn().mockResolvedValue(undefined);

    const cleanup = await renderEditor({
      container,
      onChange,
      readBoxAsset,
      importBoxAsset,
      deleteBoxAsset,
    });

    expect(container.querySelector('[data-scope="chips-coverflow-layout-editor"]')).toBeTruthy();
    expect(container.querySelector('[data-chips-coverflow-layout-editor-root="true"]')).toBeTruthy();
    expect(container.querySelector(".ant-select")).toBeTruthy();
    expect(container.querySelector(".ant-segmented")).toBeTruthy();
    expect(container.querySelector(".ant-input-number")).toBeTruthy();
    expect(container.querySelector(".ant-checkbox-wrapper")).toBeTruthy();
    expect(container.querySelector('input[type="number"]')).toBeNull();
    expect(container.textContent).toContain("封面尺寸");
    expect(container.textContent).toContain("侧面角度");
    expect(container.textContent).toContain("中央放大");
    expect(container.textContent).toContain("滚轮灵敏度");
    expect(container.textContent).toContain("当前箱子包含 2 个条目");

    await act(async () => {
      clickSegmentedItemByText(container, "大");
      await Promise.resolve();
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      props: expect.objectContaining({
        coverSize: "large",
      }),
    }));

    await act(async () => {
      clickSegmentedItemByText(container, "图片");
      await Promise.resolve();
    });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    const file = new File(["hero"], "hero.png", { type: "image/png" });
    await uploadFile(input as HTMLInputElement, file);

    expect(importBoxAsset).toHaveBeenCalledWith({
      file,
      preferredPath: expect.stringMatching(/^assets\/layouts\/chips.layout.coverflow.blp\/background\/\d+-hero\.png$/),
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      assetRefs: ["assets/layouts/chips.layout.coverflow.blp/background/hero.png"],
      props: expect.objectContaining({
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.coverflow.blp/background/hero.png",
        },
      }),
    }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(readBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.coverflow.blp/background/hero.png");

    await act(async () => {
      cleanup();
    });
  });

  it("deletes replaced and cleared box assets from the editor bridge", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/chips.layout.coverflow.blp/background/new.png",
    });
    const deleteBoxAsset = vi.fn().mockResolvedValue(undefined);
    const readBoxAsset = vi.fn().mockResolvedValue({
      resourceUrl: "chips-render://asset/current",
      mimeType: "image/png",
    });
    const initialConfig = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.coverflow.blp/background/old.png",
        },
        topRegion: {
          mode: "none",
        },
      },
    });

    await renderEditor({
      container,
      initialConfig,
      onChange,
      readBoxAsset,
      importBoxAsset,
      deleteBoxAsset,
    });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    await uploadFile(input as HTMLInputElement, new File(["new"], "new.png", { type: "image/png" }));
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.coverflow.blp/background/old.png");

    await act(async () => {
      clickButtonByText(container, "清空");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.coverflow.blp/background/new.png");
    const lastConfig = onChange.mock.calls.at(-1)?.[0] as LayoutConfig;
    expect(lastConfig.props.background).toEqual({ mode: "none" });
    expect(lastConfig.assetRefs).toEqual([]);
  });

  it("shows missing asset bridge errors without writing unsafe fallbacks", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();

    await renderEditor({
      container,
      onChange,
    });

    await act(async () => {
      clickSegmentedItemByText(container, "图片");
      await Promise.resolve();
    });

    expect(container.textContent).toContain("箱子资源桥不可用");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      assetRefs: [],
      props: expect.objectContaining({
        background: {
          mode: "image",
        },
      }),
    }));
  });

  it("restores editor host styles and ignores pending asset previews after cleanup", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.style.display = "block";
    container.style.width = "20px";
    let resolveAsset: ((value: ResolvedRuntimeResource) => void) | undefined;
    const readBoxAsset = vi.fn(() => new Promise<ResolvedRuntimeResource>((resolve) => {
      resolveAsset = resolve;
    }));

    const cleanup = await renderEditor({
      container,
      initialConfig: layoutDefinition.normalizeConfig({
        schemaVersion: "1.0.0",
        props: {
          sortMode: "manual",
          background: {
            mode: "image",
            assetPath: "assets/layouts/chips.layout.coverflow.blp/background/slow.png",
          },
          topRegion: {
            mode: "none",
          },
        },
      }),
      readBoxAsset,
      importBoxAsset: vi.fn(),
      deleteBoxAsset: vi.fn(),
    });

    expect(container.style.display).toBe("flex");
    await act(async () => {
      cleanup();
    });
    expect(container.style.display).toBe("block");
    expect(container.style.width).toBe("20px");
    expect(container.textContent ?? "").toBe("");

    await act(async () => {
      resolveAsset?.({
        resourceUrl: "chips-render://asset/slow",
        mimeType: "image/png",
      });
      await Promise.resolve();
    });
    expect(container.textContent ?? "").toBe("");
  });
});
