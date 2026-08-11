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
      summary: "Summary",
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
    renderEntryDocument: vi.fn((entryId: string) => Promise.resolve({
      entryId,
      documentType: "card" as const,
      title: `Document ${entryId}`,
      documentUrl: `chips-render://document/${entryId}`,
      renderSessionId: `render-${entryId}`,
    })),
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
        activeLayoutType: "chips.layout.documentlibrary.blp",
        availableLayouts: ["chips.layout.documentlibrary.blp"],
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

function clickButtonByText(container: HTMLElement, text: string): void {
  const needle = text.replace(/\s+/g, "");
  const button = Array.from(container.querySelectorAll("button"))
    .find((candidate) => candidate.textContent?.replace(/\s+/g, "").includes(needle));
  expect(button).toBeTruthy();
  button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

async function clickSegmentedOption(container: HTMLElement, regionId: string, text: string): Promise<void> {
  const region = container.querySelector(`[data-frame-region-editor="${regionId}"]`);
  const option = Array.from(region?.querySelectorAll(".ant-segmented-item") ?? [])
    .find((candidate) => candidate.textContent === text);
  expect(option).toBeTruthy();
  await act(async () => {
    option?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
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

function findCssRule(container: HTMLElement, selector: string): CSSStyleRule | undefined {
  const styleElement = container.querySelector(
    '[data-scope="chips-document-library-layout"] style'
  ) as HTMLStyleElement | null;
  const rules = styleElement ? Array.from(styleElement.sheet?.cssRules ?? []) : [];
  return rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === selector) as CSSStyleRule | undefined;
}

describe("layoutDefinition", () => {
  it("renders only the selected card document in the content pane by default", async () => {
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
    expect(container.querySelector('[data-scope="chips-document-library-layout"]')).toBeTruthy();
    expect(container.querySelector('[data-document-tree]')).toBeTruthy();
    expect(container.querySelector('[data-document-preview]')).toBeTruthy();
    expect(container.querySelector('[data-layout-skeleton]')).toBeNull();
    expect(container.querySelector('[data-entry-document-frame]')).toBeTruthy();
    expect(container.querySelector('[data-scope="card-cover-frame"]')).toBeNull();
    expect(container.querySelector('[data-document-preview]')?.getAttribute("data-presentation")).toBe("content");
    expect(container.querySelector('[data-document-title]')).toBeNull();
    expect(container.querySelector('[data-document-meta]')).toBeNull();
    expect(container.querySelector('[data-document-summary]')).toBeNull();
    expect(container.querySelector('[data-document-tags]')).toBeNull();
    expect(container.querySelector('[data-document-open-button]')).toBeNull();
    expect(runtime.listEntries).not.toHaveBeenCalled();
    expect(runtime.renderEntryDocument).toHaveBeenCalledWith("entry-1", {
      mode: "view",
      interactionPolicy: "native",
    });
    expect(runtime.renderEntryCover).not.toHaveBeenCalled();
    expect(runtime.prefetchEntries).toHaveBeenCalledWith({
      entryIds: ["entry-1"],
      targets: ["cover"],
    });

    const sidebarToggle = container.querySelector('[data-document-sidebar-toggle]') as HTMLButtonElement | null;
    expect(sidebarToggle?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector('[data-document-tree]')).toBeTruthy();
    await act(async () => {
      sidebarToggle?.click();
      await Promise.resolve();
    });
    expect(sidebarToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[data-document-tree]')).toBeNull();
    expect(container.querySelector('[data-document-library-main]')?.getAttribute("data-sidebar-hidden")).toBe("true");
    await act(async () => {
      sidebarToggle?.click();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-document-tree]')).toBeTruthy();

    await act(async () => {
      container
        .querySelector('[data-document-tree-title]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(runtime.openEntry).not.toHaveBeenCalled();

    await act(async () => {
      cleanup?.();
      await Promise.resolve();
    });
    expect(runtime.releaseEntryDocument).toHaveBeenCalledWith("render-entry-1");
    expect(container.textContent ?? "").toBe("");
  });

  it("renders a document-library-shaped layout skeleton when the box is empty", async () => {
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
    expect(container.querySelector('[data-document-tree]')).toBeTruthy();
    expect(container.querySelector('[data-document-preview]')).toBeTruthy();
    expect(container.querySelectorAll('[data-document-library-skeleton-row]')).toHaveLength(6);

    const indents = Array.from(
      container.querySelectorAll('[data-document-library-skeleton-row]')
    ).map((node) => (node as HTMLElement).style.paddingInlineStart);
    expect(indents).toEqual(["0px", "0px", "24px", "24px", "48px", "48px"]);
    expect(runtime.prefetchEntries).not.toHaveBeenCalled();
  });

  it("uses configured cover presentation and releases the previous card session when selection changes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    await renderView({
      container,
      runtime,
      config: layoutDefinition.normalizeConfig({
        schemaVersion: "1.0.0",
        props: {
          sortMode: "manual",
          treeNodes: [
            {
              id: "entry-1-node",
              entryId: "entry-1",
              presentation: "content",
              collapsed: false,
              children: [],
            },
            {
              id: "entry-2-node",
              entryId: "entry-2",
              presentation: "cover",
              collapsed: false,
              children: [],
            },
          ],
          sidebarWidth: "regular",
          showSummary: true,
          background: { mode: "none" },
          topRegion: { mode: "none" },
        },
      }),
      initialView: {
        items: [createEntry("entry-1", "Alpha"), createEntry("entry-2", "Beta")],
        total: 2,
      },
    });

    expect(container.querySelector('[data-entry-document-frame]')).toBeTruthy();
    const beta = Array.from(container.querySelectorAll('[data-document-tree-title]'))
      .find((candidate) => candidate.textContent === "Beta");
    await act(async () => {
      beta?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(runtime.releaseEntryDocument).toHaveBeenCalledWith("render-entry-1");
    expect(runtime.renderEntryCover).toHaveBeenCalledWith("entry-2");
    expect(container.querySelector('[data-document-cover-shell]')).toBeTruthy();
    expect(container.querySelector('[data-document-preview]')?.getAttribute("data-presentation")).toBe("cover");
    expect(container.querySelector('[data-document-open-button]')).toBeTruthy();
  });

  it("keeps the main grid and preview at content height instead of stretching to the directory", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderView({
      container,
      runtime: createRuntime(),
      initialView: {
        items: [createEntry("entry-1", "Alpha")],
        total: 1,
      },
    });

    const mainRule = findCssRule(
      container,
      '[data-scope="chips-document-library-layout"] [data-document-library-main]'
    );
    expect(mainRule?.style.gridAutoRows).toBe("max-content");
    expect(mainRule?.style.alignContent).toBe("start");
    expect(mainRule?.style.alignSelf).toBe("start");
    expect(mainRule?.style.height).toBe("fit-content");
    const previewRule = findCssRule(
      container,
      '[data-scope="chips-document-library-layout"] [data-document-preview]'
    );
    expect(previewRule?.style.alignSelf).toBe("start");
    expect(previewRule?.style.height).toBe("fit-content");
  });

  it("applies composite resize messages to the inline card frame", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    await renderView({
      container,
      runtime,
      initialView: {
        items: [createEntry("entry-1", "Alpha")],
        total: 1,
      },
    });

    const frame = container.querySelector('[data-entry-document-frame]') as HTMLIFrameElement | null;
    expect(frame?.contentWindow).toBeTruthy();
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        source: frame?.contentWindow,
        origin: "null",
        data: {
          type: "chips.composite:resize",
          payload: { height: 720 },
        },
      }));
      await Promise.resolve();
    });
    expect(frame?.style.height).toBe("720px");
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
      limit: 240,
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
    expect(runtime.renderEntryDocument).not.toHaveBeenCalled();
    expect(container.querySelector('[data-scope="card-cover-frame"]')).toBeNull();
  });

  it("renders configured tree nodes, missing entries and hides summary when configured", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    await renderView({
      container,
      runtime,
      config: layoutDefinition.normalizeConfig({
        schemaVersion: "1.0.0",
        props: {
          sortMode: "manual",
          treeNodes: [
            {
              id: "chapter-1",
              entryId: "entry-1",
              titleOverride: "Getting Started",
              collapsed: false,
              children: [
                {
                  id: "missing",
                  entryId: "entry-missing",
                  titleOverride: "Archived",
                  collapsed: false,
                  children: [],
                },
              ],
            },
          ],
          sidebarWidth: "wide",
          showSummary: false,
          background: { mode: "none" },
          topRegion: { mode: "none" },
        },
      }),
      initialView: {
        items: [
          createEntry("entry-1", "Alpha"),
          createEntry("entry-2", "Beta"),
        ],
        total: 2,
      },
    });

    expect(container.textContent).toContain("Getting Started");
    expect(container.textContent).toContain("Archived");
    expect(container.textContent).toContain("Beta");

    const archivedButton = Array.from(container.querySelectorAll('[data-document-tree-title]'))
      .find((candidate) => candidate.textContent === "Archived");
    await act(async () => {
      archivedButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain("此目录节点引用的条目当前不在箱子摘要中");
    expect(container.querySelector('[data-document-library-main]')?.getAttribute("data-sidebar-width")).toBe("wide");
    expect(container.querySelector('[data-document-summary]')).toBeNull();
  });

  it("reads box assets for configured frame regions", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const config = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        treeNodes: [],
        sidebarWidth: "regular",
        showSummary: true,
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.documentlibrary.blp/background/background.png",
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

    expect(runtime.readBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.documentlibrary.blp/background/background.png");
    expect(container.querySelector('[data-layout-background] img')).toBeTruthy();
    expect(container.querySelector('[data-layout-top-region] [data-chips-embedded-frame="embedded-document-frame"]')).toBeTruthy();
  });

  it("renders the top region html frame with auto height reporting and no fixed sizing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const config = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        treeNodes: [],
        sidebarWidth: "regular",
        showSummary: true,
        background: { mode: "none" },
        topRegion: {
          mode: "html",
          html: "<section>Top Banner</section>",
        },
      },
    });

    const cleanup = await renderView({
      container,
      runtime,
      config,
      initialView: {
        items: [],
        total: 0,
      },
    });

    const frame = container.querySelector(
      '[data-layout-top-region] [data-chips-embedded-frame="embedded-document-frame"]'
    );
    expect(frame).toBeTruthy();
    expect(frame?.getAttribute("srcdoc")).toContain("chips.embedded-frame:height");
    expect(frame?.getAttribute("srcdoc")).toContain("<section>Top Banner</section>");

    const topRegionRule = findCssRule(
      container,
      '[data-scope="chips-document-library-layout"] [data-layout-top-region]'
    );
    expect(topRegionRule?.style.minBlockSize).toBe("");
    expect(topRegionRule?.style.backgroundColor).toBe("");
    expect(topRegionRule?.style.borderRadius).toBe("12px");
    expect(topRegionRule?.style.overflow).toBe("hidden");

    await act(async () => {
      cleanup();
    });
  });

  it("renders the top region image naturally while the background keeps cover fit", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const config = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        treeNodes: [],
        sidebarWidth: "regular",
        showSummary: true,
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.documentlibrary.blp/background/bg.png",
        },
        topRegion: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.documentlibrary.blp/top-region/banner.png",
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

    const topImage = container.querySelector('[data-layout-top-region] [data-frame-region-image]');
    expect(topImage).toBeTruthy();
    expect(topImage?.getAttribute("style")).toBeNull();
    expect(container.querySelector('[data-layout-background] [data-frame-region-image]')).toBeTruthy();

    const topRegionImageRule = findCssRule(
      container,
      '[data-scope="chips-document-library-layout"] [data-layout-top-region] [data-frame-region-image]'
    );
    expect(topRegionImageRule?.style.width).toBe("100%");
    expect(topRegionImageRule?.style.height).toBe("auto");
    expect(topRegionImageRule?.style.objectFit).toBe("contain");

    const regionImageRule = findCssRule(
      container,
      '[data-scope="chips-document-library-layout"] [data-frame-region-image]'
    );
    expect(regionImageRule?.style.height).toBe("100%");
    expect(regionImageRule?.style.objectFit).toBe("cover");
  });

  it("edits the top region with an auto-height preview while the background preview keeps its ratio", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const initialConfig = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        treeNodes: [],
        sidebarWidth: "regular",
        showSummary: true,
        background: {
          mode: "html",
          html: "<section>Background</section>",
        },
        topRegion: {
          mode: "html",
          html: "<section>Top</section>",
        },
      },
    });

    const cleanup = await renderEditor({
      container,
      initialConfig,
      onChange,
    });

    const topPreview = container.querySelector(
      '[data-frame-region-editor="topRegion"] [data-frame-region-preview]'
    );
    expect(topPreview).toBeTruthy();
    expect(topPreview?.getAttribute("style")).toBeNull();
    const topFrame = topPreview?.querySelector(
      '[data-chips-embedded-frame="embedded-document-frame"]'
    );
    expect(topFrame?.getAttribute("srcdoc")).toContain("chips.embedded-frame:height");

    const backgroundPreview = container.querySelector(
      '[data-frame-region-editor="background"] [data-frame-region-preview]'
    );
    expect(backgroundPreview?.getAttribute("style")).toContain("aspect-ratio: 16 / 9");
    const backgroundFrame = backgroundPreview?.querySelector(
      '[data-chips-embedded-frame="embedded-document-frame"]'
    );
    expect(backgroundFrame?.getAttribute("srcdoc")).not.toContain("chips.embedded-frame:height");

    await act(async () => {
      cleanup();
    });
  });

  it("releases late entry document sessions after cleanup without updating the DOM", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let resolveDocument: ((value: {
      entryId: string;
      documentType: "card";
      title: string;
      documentUrl: string;
      renderSessionId: string;
    }) => void) | undefined;
    const renderEntryDocument = vi.fn(() => new Promise<{
      entryId: string;
      documentType: "card";
      title: string;
      documentUrl: string;
      renderSessionId: string;
    }>((resolve) => {
      resolveDocument = resolve;
    }));
    const runtime = createRuntime({ renderEntryDocument });

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
      resolveDocument?.({
        entryId: "entry-1",
        documentType: "card",
        title: "Late Document",
        documentUrl: "chips-render://late",
        renderSessionId: "late-render-session",
      });
      await Promise.resolve();
    });
    expect(container.textContent ?? "").toBe("");
    expect(runtime.releaseEntryDocument).toHaveBeenCalledWith("late-render-session");
  });

  it("renders editor and imports box assets into config snapshots", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/chips.layout.documentlibrary.blp/background/hero.png",
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

    expect(container.querySelector('[data-scope="chips-box-layout-editor"]')).toBeTruthy();
    expect(container.textContent).toContain("当前箱子包含 2 个条目");
    expect(container.querySelector(".ant-select")).toBeTruthy();
    expect(container.querySelector('input[type="number"]')).toBeNull();

    await clickSegmentedOption(container, "background", "图片");

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    const file = new File(["hero"], "hero.png", { type: "image/png" });
    await uploadFile(input as HTMLInputElement, file);

    expect(importBoxAsset).toHaveBeenCalledWith({
      file,
      preferredPath: expect.stringMatching(/^assets\/layouts\/chips.layout.documentlibrary.blp\/background\/\d+-hero\.png$/),
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      assetRefs: ["assets/layouts/chips.layout.documentlibrary.blp/background/hero.png"],
      props: expect.objectContaining({
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.documentlibrary.blp/background/hero.png",
        },
      }),
    }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(readBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.documentlibrary.blp/background/hero.png");

    await act(async () => {
      cleanup?.();
    });
  });

  it("edits per-entry content or cover presentation and locks box entries to covers", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    await renderEditor({ container, onChange });

    await act(async () => {
      clickButtonByText(container, "加入：Alpha");
      await Promise.resolve();
    });
    let lastConfig = onChange.mock.calls.at(-1)?.[0] as LayoutConfig;
    expect(lastConfig.props.treeNodes[0]?.presentation).toBe("content");

    const presentation = container.querySelector('[data-node-presentation="entry-entry-1"]');
    const coverOption = Array.from(presentation?.querySelectorAll(".ant-segmented-item") ?? [])
      .find((candidate) => candidate.textContent === "卡片封面");
    await act(async () => {
      coverOption?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    lastConfig = onChange.mock.calls.at(-1)?.[0] as LayoutConfig;
    expect(lastConfig.props.treeNodes[0]?.presentation).toBe("cover");

    await act(async () => {
      clickButtonByText(container, "加入：Beta");
      await Promise.resolve();
    });
    lastConfig = onChange.mock.calls.at(-1)?.[0] as LayoutConfig;
    expect(lastConfig.props.treeNodes[1]?.presentation).toBe("cover");
    expect(container.querySelector('[data-node-presentation="entry-entry-2"] .ant-segmented-disabled')).toBeTruthy();
  });

  it("deletes replaced and cleared box assets from the editor bridge", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/chips.layout.documentlibrary.blp/background/new.png",
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
        treeNodes: [],
        sidebarWidth: "regular",
        showSummary: true,
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.documentlibrary.blp/background/old.png",
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
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.documentlibrary.blp/background/old.png");

    await act(async () => {
      clickButtonByText(container, "清空");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.documentlibrary.blp/background/new.png");
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

    await clickSegmentedOption(container, "background", "图片");

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
          treeNodes: [],
          sidebarWidth: "regular",
          showSummary: true,
          background: {
            mode: "image",
            assetPath: "assets/layouts/chips.layout.documentlibrary.blp/background/slow.png",
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
