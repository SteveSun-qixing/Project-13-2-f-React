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
      summary: `${title} summary`,
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
        activeLayoutType: "chips.layout.timeline.blp",
        availableLayouts: ["chips.layout.timeline.blp"],
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
  it("uses the official timeline layout identity", () => {
    expect(layoutDefinition.pluginId).toBe("chips.layout.timeline.blp");
    expect(layoutDefinition.layoutType).toBe("chips.layout.timeline.blp");
    expect(layoutDefinition.displayName).toBe("时间线布局插件");
    expect(layoutDefinition.icon).toMatchObject({
      name: "timeline",
      decorative: true,
    });
  });

  it("renders timeline points, loads covers, prefetches and opens single-entry points", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const config = layoutDefinition.normalizeConfig({
      props: {
        orientation: "horizontal",
        scaleMode: "date-distance",
        showCovers: true,
        cardDensity: "compact",
        points: [
          {
            id: "p1",
            label: "第一天",
            date: "2026-07-06",
            note: "抵达",
            entryIds: ["entry-1"],
          },
        ],
      },
    });
    const cleanup = await renderView({
      container,
      runtime,
      config,
      initialView: {
        items: [createEntry("entry-1", "Demo Card")],
        total: 1,
      },
    });

    expect(container.querySelector('[data-scope="chips-box-timeline-layout"]')).toBeTruthy();
    expect(container.querySelector('[data-timeline-root]')?.getAttribute("data-orientation")).toBe("horizontal");
    expect(container.querySelector('[data-timeline-root]')?.getAttribute("data-density")).toBe("compact");
    expect(container.textContent).toContain("第一天");
    expect(container.textContent).toContain("Demo Card");
    expect(container.textContent).toContain("抵达");
    expect(container.querySelector('[data-chips-embedded-frame="embedded-document-frame"]')).toBeTruthy();
    expect(runtime.renderEntryCover).toHaveBeenCalledWith("entry-1");
    expect(runtime.prefetchEntries).toHaveBeenCalledWith({
      entryIds: ["entry-1"],
      targets: ["cover"],
    });

    container
      .querySelector('[data-timeline-point-button]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(runtime.openEntry).toHaveBeenCalledWith("entry-1");

    await act(async () => {
      cleanup();
    });
    expect(container.textContent ?? "").toBe("");
  });

  it("shows unscheduled entries and respects cover-disabled mode", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const config = layoutDefinition.normalizeConfig({
      props: {
        showCovers: false,
        points: [],
      },
    });

    await renderView({
      container,
      runtime,
      config,
      initialView: {
        items: [createEntry("entry-1", "Loose Card")],
        total: 1,
      },
    });

    expect(container.textContent).toContain("未安排条目");
    expect(container.textContent).toContain("Loose Card");
    expect(runtime.renderEntryCover).not.toHaveBeenCalled();
    expect(runtime.prefetchEntries).not.toHaveBeenCalled();
  });

  it("loads additional pages and keeps existing entries on pagination error", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const listEntries = vi.fn()
      .mockResolvedValueOnce({
        items: [createEntry("entry-2", "Beta")],
        total: 2,
        nextCursor: "cursor-2",
      })
      .mockRejectedValueOnce(new Error("network"));
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

    await act(async () => {
      container.querySelector('[data-layout-load-more]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(listEntries).toHaveBeenCalledWith({
      cursor: "cursor-1",
      limit: 120,
    });
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).toContain("Beta");

    await act(async () => {
      container.querySelector('[data-layout-load-more]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain("后续条目加载失败");
  });

  it("shows a timeline-shaped skeleton when the box is empty", async () => {
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

    const skeleton = container.querySelector("[data-layout-skeleton]");
    expect(skeleton).toBeTruthy();
    expect(skeleton?.querySelectorAll("[data-timeline-skeleton-node]")).toHaveLength(5);
    expect(container.querySelector("[data-timeline-root]")).toBeNull();
    expect(container.querySelector("[data-layout-empty-title]")?.textContent).toBe("这里还没有内容");
  });

  it("reads box assets for configured frame regions", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const config = layoutDefinition.normalizeConfig({
      props: {
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.timeline.blp/background.png",
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

    expect(runtime.readBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.timeline.blp/background.png");
    expect(container.querySelector('[data-layout-background] img')).toBeTruthy();
    expect(container.querySelector('[data-layout-top-region] [data-chips-embedded-frame="embedded-document-frame"]')).toBeTruthy();
  });

  it("renders editor, adds points and imports box assets into config snapshots", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/chips.layout.timeline.blp/background/hero.png",
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
    expect(container.textContent).toContain("时间线显示");
    expect(container.textContent).toContain("当前箱子包含 2 个条目");

    await act(async () => {
      clickButtonByText(container, "新增时间点");
      await Promise.resolve();
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      props: expect.objectContaining({
        points: [expect.objectContaining({
          id: "point-1",
          label: "时间点 1",
          entryIds: [],
        })],
      }),
    }));

    const background = container.querySelector('[data-frame-region-editor="background"]') as HTMLElement | null;
    const segmentedItems = Array.from(background?.querySelectorAll(".ant-segmented-item") ?? []);
    const imageItem = segmentedItems.find((item) => item.textContent === "图片");
    expect(imageItem).toBeTruthy();
    await act(async () => {
      imageItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    const file = new File(["hero"], "hero.png", { type: "image/png" });
    await uploadFile(input as HTMLInputElement, file);

    expect(importBoxAsset).toHaveBeenCalledWith({
      file,
      preferredPath: expect.stringMatching(/^assets\/layouts\/chips.layout.timeline.blp\/background\/\d+-hero\.png$/),
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      assetRefs: ["assets/layouts/chips.layout.timeline.blp/background/hero.png"],
      props: expect.objectContaining({
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.timeline.blp/background/hero.png",
        },
      }),
    }));
    expect(readBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.timeline.blp/background/hero.png");

    await act(async () => {
      cleanup();
    });
  });

  it("deletes replaced and cleared box assets from the editor bridge", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/chips.layout.timeline.blp/background/new.png",
    });
    const deleteBoxAsset = vi.fn().mockResolvedValue(undefined);
    const readBoxAsset = vi.fn().mockResolvedValue({
      resourceUrl: "chips-render://asset/current",
      mimeType: "image/png",
    });
    const initialConfig = layoutDefinition.normalizeConfig({
      props: {
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.timeline.blp/background/old.png",
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
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.timeline.blp/background/old.png");

    await act(async () => {
      clickButtonByText(container, "清空");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.timeline.blp/background/new.png");
    const lastConfig = onChange.mock.calls.at(-1)?.[0] as LayoutConfig;
    expect(lastConfig.props.background).toEqual({ mode: "none" });
    expect(lastConfig.assetRefs).toEqual([]);
  });
});
