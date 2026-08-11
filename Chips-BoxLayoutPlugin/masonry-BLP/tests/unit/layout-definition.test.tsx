import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { layoutDefinition } from "../../src/index";
import type { BoxEntryPage, BoxEntrySnapshot, BoxLayoutRuntime, ResolvedRuntimeResource } from "../../src/shared/types";
import { buildMasonryColumns } from "../../src/view/page";
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
      summary: "Summary",
      cover: {
        mode: "runtime",
      },
      contentType,
    },
  };
}

function createEntryWithRatio(entryId: string, title: string, aspectRatio: number): BoxEntrySnapshot {
  return {
    ...createEntry(entryId, title),
    layoutHints: {
      aspectRatio,
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
    renderEntryDocument: vi.fn(),
    releaseEntryDocument: vi.fn().mockResolvedValue(undefined),
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
        activeLayoutType: "chips.layout.masonry.blp",
        availableLayouts: ["chips.layout.masonry.blp"],
      },
      initialView,
      config,
      runtime,
      locale: "zh-CN",
    });
    cleanup = typeof maybeCleanup === "function" ? maybeCleanup : undefined;
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

function clickSegmentedByText(container: HTMLElement, text: string): void {
  const item = Array.from(container.querySelectorAll<HTMLElement>(".ant-segmented-item"))
    .find((candidate) => candidate.textContent === text);
  expect(item).toBeTruthy();
  item?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function clickButtonByText(container: HTMLElement, text: string): void {
  const button = Array.from(container.querySelectorAll("button"))
    .find((candidate) => candidate.textContent?.includes(text));
  expect(button).toBeTruthy();
  button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
  it("renders initial view, loads covers, prefetches and opens entries through runtime", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const cleanup = await renderView({
      container,
      runtime,
      initialView: {
        items: [createEntry("entry-1", "Demo Card")],
        total: 1,
      },
    });

    expect(container.textContent).toContain("Demo Card");
    expect(container.querySelector('[data-scope="chips-box-masonry-layout"]')).toBeTruthy();
    expect(container.querySelector('[data-layout-masonry]')).toBeTruthy();
    expect(container.querySelector('[data-chips-embedded-frame="embedded-document-frame"]')).toBeTruthy();
    expect(container.querySelector('[data-scope="card-cover-frame"]')).toBeNull();
    expect(container.textContent).toContain("Summary");
    expect(runtime.listEntries).not.toHaveBeenCalled();
    expect(runtime.renderEntryCover).toHaveBeenCalledWith("entry-1");
    expect(runtime.prefetchEntries).toHaveBeenCalledWith({
      entryIds: ["entry-1"],
      targets: ["cover"],
    });

    container
      .querySelector('[data-masonry-entry-title]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(runtime.openEntry).toHaveBeenCalledWith("entry-1");

    await act(async () => {
      cleanup?.();
    });
    expect(container.textContent ?? "").toBe("");
  });

  it("renders a masonry-shaped layout skeleton when the box is empty", async () => {
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
    expect(container.querySelector('[data-layout-masonry]')).toBeNull();
    expect(container.querySelectorAll('[data-layout-skeleton-column]')).toHaveLength(3);

    const coverHeights = Array.from(
      container.querySelectorAll('[data-layout-skeleton-column] > span:first-child')
    ).map((node) => (node as HTMLElement).style.height);
    expect(coverHeights).toEqual(["160px", "180px", "200px"]);
    expect(runtime.prefetchEntries).not.toHaveBeenCalled();
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
      limit: 120,
    });
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("Beta");

    await act(async () => {
      container
        .querySelector('[data-layout-load-more]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("Beta");
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
          assetPath: "assets/layouts/masonry/background.png",
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

    expect(runtime.readBoxAsset).toHaveBeenCalledWith("assets/layouts/masonry/background.png");
    expect(container.querySelector('[data-layout-background] img')).toBeTruthy();
    expect(container.querySelector('[data-layout-top-region] [data-chips-embedded-frame="embedded-document-frame"]')).toBeTruthy();
  });

  it("distributes varied aspect ratios across shortest masonry columns", () => {
    const config = layoutDefinition.normalizeConfig({
      props: {
        columnMode: "compact",
        gap: "regular",
        titleMode: "below-cover",
        showSummary: true,
        pageSize: 120,
      },
    }) as unknown as LayoutConfig;
    const columns = buildMasonryColumns([
      createEntryWithRatio("entry-1", "Tall", 0.5),
      createEntryWithRatio("entry-2", "Wide", 2),
      createEntryWithRatio("entry-3", "Square", 1),
      createEntryWithRatio("entry-4", "Poster", 0.75),
    ], config);

    expect(columns).toHaveLength(4);
    expect(columns.flat().map((entry) => entry.entryId)).toEqual([
      "entry-1",
      "entry-2",
      "entry-3",
      "entry-4",
    ]);
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
      cleanup?.();
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

  it("renders editor and imports box assets into config snapshots", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/masonry/background/hero.png",
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

    expect(container.querySelector('[data-scope="chips-masonry-layout-editor"]')).toBeTruthy();
    expect(container.textContent).toContain("当前箱子包含 2 个条目");
    expect(container.textContent).toContain("列宽模式");
    expect(container.textContent).toContain("标题显示");
    expect(container.querySelector(".ant-select")).toBeTruthy();
    expect(container.querySelector(".ant-input-number")).toBeTruthy();

    await act(async () => {
      clickSegmentedByText(container, "图片");
      await Promise.resolve();
    });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    const file = new File(["hero"], "hero.png", { type: "image/png" });
    await uploadFile(input as HTMLInputElement, file);

    expect(importBoxAsset).toHaveBeenCalledWith({
      file,
      preferredPath: expect.stringMatching(/^assets\/layouts\/masonry\/background\/\d+-hero\.png$/),
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      assetRefs: ["assets/layouts/masonry/background/hero.png"],
      props: expect.objectContaining({
        background: {
          mode: "image",
          assetPath: "assets/layouts/masonry/background/hero.png",
        },
      }),
    }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(readBoxAsset).toHaveBeenCalledWith("assets/layouts/masonry/background/hero.png");

    await act(async () => {
      cleanup?.();
    });
  });

  it("deletes replaced and cleared box assets from the editor bridge", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/masonry/background/new.png",
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
          assetPath: "assets/layouts/masonry/background/old.png",
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
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/masonry/background/old.png");

    await act(async () => {
      clickButtonByText(container, "移除");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/masonry/background/new.png");
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
      clickSegmentedByText(container, "图片");
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
            assetPath: "assets/layouts/masonry/background/slow.png",
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
