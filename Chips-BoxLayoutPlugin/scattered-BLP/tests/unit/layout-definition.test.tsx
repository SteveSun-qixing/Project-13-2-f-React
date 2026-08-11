import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { layoutDefinition } from "../../src/index";
import type { BoxEntryPage, BoxEntrySnapshot, BoxLayoutRuntime, ResolvedRuntimeResource } from "../../src/shared/types";
import type { LayoutConfig } from "../../src/schema/layout-config";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
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
        activeLayoutType: "chips.layout.scattered.blp",
        availableLayouts: ["chips.layout.scattered.blp"],
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

function clickSegmentOption(container: HTMLElement, regionId: string, label: string): void {
  const region = container.querySelector(`[data-frame-region-editor="${regionId}"]`);
  const option = Array.from(region?.querySelectorAll(".ant-segmented-item") ?? [])
    .find((candidate) => candidate.textContent === label);
  expect(option).toBeTruthy();
  option?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
  it("aligns identity and initial query with scattered config", () => {
    expect(layoutDefinition.pluginId).toBe("chips.layout.scattered.blp");
    expect(layoutDefinition.layoutType).toBe("chips.layout.scattered.blp");
    expect(layoutDefinition.displayName).toBe("散乱布局插件");
    expect(layoutDefinition.icon).toEqual({ name: "scatter_plot", decorative: true });
    expect(layoutDefinition.getInitialQuery?.(layoutDefinition.createDefaultConfig())).toEqual({ limit: 24 });
  });

  it("renders fake placeholders without loading their covers and opens only the top entry", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const config = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        visibleFakeCount: 2,
        motion: "reduced",
      },
    });
    const cleanup = await renderView({
      container,
      runtime,
      config,
      initialView: {
        items: [
          createEntry("entry-1", "Alpha"),
          createEntry("entry-2", "Beta"),
          createEntry("entry-3", "Gamma"),
        ],
        total: 3,
      },
    });

    expect(container.querySelector('[data-scope="chips-box-scattered-layout"]')).toBeTruthy();
    expect(container.querySelectorAll("[data-scattered-fake]")).toHaveLength(2);
    expect(container.textContent).toContain("Alpha");
    expect(container.textContent).not.toContain("Beta summary");
    expect(runtime.listEntries).not.toHaveBeenCalled();
    expect(runtime.renderEntryCover).toHaveBeenCalledTimes(1);
    expect(runtime.renderEntryCover).toHaveBeenCalledWith("entry-1");
    expect(runtime.prefetchEntries).toHaveBeenCalledWith({
      entryIds: ["entry-1", "entry-2", "entry-3"],
      targets: ["cover"],
    });

    container
      .querySelector('[data-scattered-title]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(runtime.openEntry).toHaveBeenCalledWith("entry-1");

    await act(async () => {
      cleanup();
    });
    expect(container.textContent ?? "").toBe("");
  });

  it("switches top entries by button, keyboard and wheel", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    await renderView({
      container,
      runtime,
      config: layoutDefinition.normalizeConfig({
        props: {
          motion: "reduced",
        },
      }),
      initialView: {
        items: [
          createEntry("entry-1", "Alpha"),
          createEntry("entry-2", "Beta"),
          createEntry("entry-3", "Gamma"),
        ],
        total: 3,
      },
    });

    await act(async () => {
      clickButtonByText(container, "下一张");
      await Promise.resolve();
    });
    expect(container.querySelector("[data-scattered-real]")?.getAttribute("data-entry-id")).toBe("entry-2");
    expect(runtime.renderEntryCover).toHaveBeenCalledWith("entry-2");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      await Promise.resolve();
    });
    expect(container.querySelector("[data-scattered-real]")?.getAttribute("data-entry-id")).toBe("entry-1");

    await act(async () => {
      container
        .querySelector("[data-scattered-stage]")
        ?.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true }));
      await Promise.resolve();
    });
    expect(container.querySelector("[data-scattered-real]")?.getAttribute("data-entry-id")).toBe("entry-2");
  });

  it("auto cycles in auto motion and stays still in reduced motion", async () => {
    vi.useFakeTimers();
    const autoContainer = document.createElement("div");
    document.body.appendChild(autoContainer);
    await renderView({
      container: autoContainer,
      runtime: createRuntime(),
      config: layoutDefinition.normalizeConfig({
        props: {
          cycleIntervalMs: 3000,
          motion: "auto",
        },
      }),
      initialView: {
        items: [createEntry("entry-1", "Alpha"), createEntry("entry-2", "Beta")],
        total: 2,
      },
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });
    expect(autoContainer.querySelector("[data-scattered-real]")?.getAttribute("data-entry-id")).toBe("entry-2");

    const reducedContainer = document.createElement("div");
    document.body.appendChild(reducedContainer);
    await renderView({
      container: reducedContainer,
      runtime: createRuntime(),
      config: layoutDefinition.normalizeConfig({
        props: {
          cycleIntervalMs: 3000,
          motion: "reduced",
        },
      }),
      initialView: {
        items: [createEntry("entry-1", "Alpha"), createEntry("entry-2", "Beta")],
        total: 2,
      },
    });
    await act(async () => {
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
    });
    expect(reducedContainer.querySelector("[data-scattered-real]")?.getAttribute("data-entry-id")).toBe("entry-1");
  });

  it("loads additional pages near the end and keeps current stack when pagination fails", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const listEntries = vi.fn()
      .mockResolvedValueOnce({
        items: [createEntry("entry-3", "Gamma")],
        total: 3,
      })
      .mockRejectedValueOnce(new Error("network"));
    const runtime = createRuntime({ listEntries });

    await renderView({
      container,
      runtime,
      config: layoutDefinition.normalizeConfig({
        props: {
          motion: "reduced",
        },
      }),
      initialView: {
        items: [createEntry("entry-1", "Alpha"), createEntry("entry-2", "Beta")],
        total: 3,
        nextCursor: "cursor-1",
      },
    });

    await act(async () => {
      clickButtonByText(container, "下一张");
      await Promise.resolve();
    });
    expect(listEntries).toHaveBeenCalledWith({
      cursor: "cursor-1",
      limit: 36,
    });
    expect(container.textContent).toContain("Beta");

    await act(async () => {
      clickButtonByText(container, "下一张");
      await Promise.resolve();
    });
    expect(listEntries).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Gamma");
  });

  it("renders the scattered layout skeleton empty state when the box has no entries", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await renderView({
      container,
      runtime: createRuntime(),
      config: layoutDefinition.normalizeConfig({
        props: {
          motion: "reduced",
        },
      }),
      initialView: {
        items: [],
        total: 0,
      },
    });

    const skeleton = container.querySelector("[data-layout-skeleton]");
    expect(skeleton).toBeTruthy();
    expect(skeleton?.querySelector("[data-layout-empty-title]")?.textContent).toBe("这里还没有内容");
    expect(skeleton?.querySelector("[data-layout-empty-text]")?.textContent).toBe("在编辑器中添加卡片或箱子，开始填充这个箱子");
    expect(skeleton?.querySelectorAll("[data-scattered-skeleton-card]")).toHaveLength(3);
    expect(container.textContent).not.toContain("Alpha");
  });

  it("reads box assets for configured frame regions", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const config = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.scattered.blp/background.png",
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

    expect(runtime.readBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.scattered.blp/background.png");
    expect(container.querySelector('[data-layout-background] iframe[data-chips-embedded-frame]')).toBeTruthy();
    expect(container.querySelector('[data-layout-top-region] iframe[data-chips-embedded-frame]')).toBeTruthy();
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

  it("renders editor controls and imports box assets into config snapshots", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/chips.layout.scattered.blp/background/hero.png",
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
    expect(container.textContent).toContain("随机种子");
    expect(container.textContent).toContain("散布程度");

    await act(async () => {
      clickSegmentOption(container, "background", "图片");
      await Promise.resolve();
    });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    const file = new File(["hero"], "hero.png", { type: "image/png" });
    await uploadFile(input as HTMLInputElement, file);

    expect(importBoxAsset).toHaveBeenCalledWith({
      file,
      preferredPath: expect.stringMatching(/^assets\/layouts\/chips.layout.scattered.blp\/background\/\d+-hero\.png$/),
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      assetRefs: ["assets/layouts/chips.layout.scattered.blp/background/hero.png"],
      props: expect.objectContaining({
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.scattered.blp/background/hero.png",
        },
      }),
    }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(readBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.scattered.blp/background/hero.png");

    await act(async () => {
      cleanup();
    });
  });

  it("deletes replaced and cleared box assets from the editor bridge", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/chips.layout.scattered.blp/background/new.png",
    });
    const deleteBoxAsset = vi.fn().mockResolvedValue(undefined);
    const readBoxAsset = vi.fn().mockResolvedValue({
      resourceUrl: "chips-render://asset/current",
      mimeType: "image/png",
    });
    const initialConfig = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.scattered.blp/background/old.png",
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
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.scattered.blp/background/old.png");

    await act(async () => {
      clickButtonByText(container, "清空");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.scattered.blp/background/new.png");
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
      clickSegmentOption(container, "background", "图片");
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
          background: {
            mode: "image",
            assetPath: "assets/layouts/chips.layout.scattered.blp/background/slow.png",
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
