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
        activeLayoutType: "chips.layout.cardstack.blp",
        availableLayouts: ["chips.layout.cardstack.blp"],
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
  const normalized = text.replace(/\s+/g, "");
  const button = Array.from(container.querySelectorAll<HTMLElement>("button, .ant-segmented-item"))
    .find((candidate) => candidate.textContent?.replace(/\s+/g, "").includes(normalized));
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

function findCssRule(container: HTMLElement, selector: string): CSSStyleRule | undefined {
  const styleElement = container.querySelector(
    '[data-scope="chips-box-cardstack-layout"] style'
  ) as HTMLStyleElement | null;
  const rules = styleElement ? Array.from(styleElement.sheet?.cssRules ?? []) : [];
  return rules.find((rule) => rule instanceof CSSStyleRule && rule.selectorText === selector) as CSSStyleRule | undefined;
}

function dispatchPointer(target: Element, type: string, clientX: number): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX,
    button: 0,
  });
  Object.defineProperty(event, "pointerId", {
    configurable: true,
    value: 1,
  });
  target.dispatchEvent(event);
}

function currentTitle(container: HTMLElement): string | null | undefined {
  return container.querySelector("[data-stack-title]")?.textContent;
}

describe("layoutDefinition", () => {
  it("uses the official card stack layout identity", () => {
    expect(layoutDefinition.pluginId).toBe("chips.layout.cardstack.blp");
    expect(layoutDefinition.layoutType).toBe("chips.layout.cardstack.blp");
    expect(layoutDefinition.displayName).toBe("扑克牌布局插件");
    expect(layoutDefinition.icon).toMatchObject({
      name: "style",
      decorative: true,
    });
    expect(layoutDefinition.getInitialQuery?.(layoutDefinition.createDefaultConfig())).toEqual({
      limit: 64,
    });
  });

  it("renders the card stack layout skeleton when the box is empty", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const cleanup = await renderView({
      container,
      runtime,
      initialView: {
        items: [],
        total: 0,
      },
    });

    expect(container.querySelector('[data-scope="chips-box-cardstack-layout"]')).toBeTruthy();
    expect(container.querySelector("[data-layout-skeleton]")).toBeTruthy();
    expect(container.querySelectorAll("[data-layout-skeleton-card]")).toHaveLength(3);
    expect(container.querySelector("[data-layout-skeleton-card]")?.querySelector("[data-layout-empty-title]")).toBeNull();
    expect(container.querySelector("[data-layout-empty-title]")?.textContent).toContain("这里还没有内容");
    expect(container.querySelector("[data-layout-empty-text]")?.textContent).toContain("在编辑器中添加卡片或箱子");
    expect(runtime.renderEntryCover).not.toHaveBeenCalled();

    await act(async () => {
      cleanup();
    });
    expect(container.textContent ?? "").toBe("");
  });

  it("renders only the current real cover, prefetches the next two entries, and opens through runtime", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const cleanup = await renderView({
      container,
      runtime,
      initialView: {
        items: [
          createEntry("entry-1", "Alpha"),
          createEntry("entry-2", "Beta"),
          createEntry("entry-3", "Gamma"),
          createEntry("entry-4", "Delta"),
        ],
        total: 4,
      },
    });

    expect(container.querySelector('[data-scope="chips-box-cardstack-layout"]')).toBeTruthy();
    expect(container.querySelectorAll("[data-stack-placeholder]")).toHaveLength(3);
    expect(currentTitle(container)).toBe("Alpha");
    expect(container.textContent).toContain("Alpha summary");
    expect(runtime.renderEntryCover).toHaveBeenCalledTimes(1);
    expect(runtime.renderEntryCover).toHaveBeenCalledWith("entry-1");
    expect(runtime.prefetchEntries).toHaveBeenCalledWith({
      entryIds: ["entry-2", "entry-3"],
      targets: ["cover"],
    });

    container
      .querySelector("[data-stack-current-card]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(runtime.openEntry).toHaveBeenCalledWith("entry-1");

    await act(async () => {
      cleanup();
    });
    expect(container.textContent ?? "").toBe("");
  });

  it("switches cards with buttons, arrow keys, wheel, and drag", async () => {
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

    await act(async () => {
      container.querySelector("[data-stack-next]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(currentTitle(container)).toBe("Beta");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      await Promise.resolve();
    });
    expect(currentTitle(container)).toBe("Alpha");

    await act(async () => {
      container.querySelector("[data-stack-stage]")?.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true,
        deltaY: 80,
        cancelable: true,
      }));
      await Promise.resolve();
    });
    expect(currentTitle(container)).toBe("Beta");

    const card = container.querySelector("[data-stack-current-card]");
    expect(card).toBeTruthy();
    await act(async () => {
      if (card) {
        dispatchPointer(card, "pointerdown", 200);
        dispatchPointer(card, "pointermove", 40);
        dispatchPointer(card, "pointerup", 40);
      }
      await Promise.resolve();
    });
    expect(currentTitle(container)).toBe("Gamma");
  });

  it("supports review looping at the end of the stack", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const config = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
        reviewLoop: "loop",
      },
    });

    await renderView({
      container,
      runtime: createRuntime(),
      config,
      initialView: {
        items: [
          createEntry("entry-1", "Alpha"),
          createEntry("entry-2", "Beta"),
        ],
        total: 2,
      },
    });

    await act(async () => {
      container.querySelector("[data-stack-next]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(currentTitle(container)).toBe("Beta");

    await act(async () => {
      container.querySelector("[data-stack-next]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(currentTitle(container)).toBe("Alpha");
  });

  it("loads one additional page when advancing beyond loaded entries", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const listEntries = vi.fn().mockResolvedValue({
      items: [createEntry("entry-2", "Beta")],
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

    await act(async () => {
      container.querySelector("[data-stack-next]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(listEntries).toHaveBeenCalledWith({
      cursor: "cursor-1",
      limit: 64,
    });
    expect(currentTitle(container)).toBe("Beta");
  });

  it("keeps random order stable for the same seed", async () => {
    async function collectOrder(seed: string): Promise<string[]> {
      const container = document.createElement("div");
      document.body.appendChild(container);
      const config = layoutDefinition.normalizeConfig({
        schemaVersion: "1.0.0",
        props: {
          sortMode: "random",
          randomSeed: seed,
        },
      });
      const cleanup = await renderView({
        container,
        runtime: createRuntime({
          renderEntryCover: vi.fn().mockResolvedValue({
            title: "Cover",
            coverUrl: "chips-render://cover/random",
            mimeType: "text/html",
          }),
        }),
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
      const titles = [currentTitle(container) ?? ""];
      await act(async () => {
        container.querySelector("[data-stack-next]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve();
      });
      titles.push(currentTitle(container) ?? "");
      await act(async () => {
        container.querySelector("[data-stack-next]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve();
      });
      titles.push(currentTitle(container) ?? "");
      await act(async () => {
        cleanup();
      });
      return titles;
    }

    const firstOrder = await collectOrder("seed-a");
    const secondOrder = await collectOrder("seed-a");
    expect(firstOrder).toEqual(secondOrder);
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
          assetPath: "assets/layouts/chips.layout.cardstack.blp/background/background.png",
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

    expect(runtime.readBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.cardstack.blp/background/background.png");
    expect(container.querySelector("[data-layout-background] img")).toBeTruthy();
    expect(container.querySelector('[data-layout-top-region] [data-chips-embedded-frame]')).toBeTruthy();
  });

  it("renders the top region html frame with auto height reporting and no fixed sizing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const config = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "manual",
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
      '[data-scope="chips-box-cardstack-layout"] [data-layout-top-region]'
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
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.cardstack.blp/background/bg.png",
        },
        topRegion: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.cardstack.blp/top-region/banner.png",
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

    const topImage = container.querySelector("[data-layout-top-region] [data-frame-region-image]");
    expect(topImage).toBeTruthy();
    expect(topImage?.getAttribute("style")).toBeNull();
    expect(container.querySelector("[data-layout-background] [data-frame-region-image]")).toBeTruthy();

    const topRegionImageRule = findCssRule(
      container,
      '[data-scope="chips-box-cardstack-layout"] [data-layout-top-region] [data-frame-region-image]'
    );
    expect(topRegionImageRule?.style.width).toBe("100%");
    expect(topRegionImageRule?.style.height).toBe("auto");
    expect(topRegionImageRule?.style.objectFit).toBe("contain");

    const regionImageRule = findCssRule(
      container,
      '[data-scope="chips-box-cardstack-layout"] [data-frame-region-image]'
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

  it("renders editor and imports box assets into config snapshots", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/chips.layout.cardstack.blp/background/hero.png",
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
    expect(container.textContent).toContain("卡堆行为");
    expect(container.textContent).toContain("当前箱子包含 2 个条目");
    expect(container.textContent).toContain("堆叠层数");
    expect(container.querySelector(".ant-select")).toBeTruthy();
    expect(container.querySelector(".ant-input-number")).toBeTruthy();
    expect(container.querySelector('input[type="number"]')).toBeNull();

    await act(async () => {
      clickButtonByText(container, "图片");
      await Promise.resolve();
    });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    const file = new File(["hero"], "hero.png", { type: "image/png" });
    await uploadFile(input as HTMLInputElement, file);

    expect(importBoxAsset).toHaveBeenCalledWith({
      file,
      preferredPath: expect.stringMatching(/^assets\/layouts\/chips.layout.cardstack.blp\/background\/\d+-hero\.png$/),
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      assetRefs: ["assets/layouts/chips.layout.cardstack.blp/background/hero.png"],
      props: expect.objectContaining({
        stackDepth: 4,
        cardSize: "regular",
        background: {
          mode: "image",
          assetPath: "assets/layouts/chips.layout.cardstack.blp/background/hero.png",
        },
      }),
    }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(readBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.cardstack.blp/background/hero.png");

    await act(async () => {
      cleanup();
    });
  });

  it("deletes replaced and cleared box assets from the editor bridge", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/chips.layout.cardstack.blp/background/new.png",
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
          assetPath: "assets/layouts/chips.layout.cardstack.blp/background/old.png",
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
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.cardstack.blp/background/old.png");

    await act(async () => {
      clickButtonByText(container, "清空");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/chips.layout.cardstack.blp/background/new.png");
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
      clickButtonByText(container, "图片");
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
            assetPath: "assets/layouts/chips.layout.cardstack.blp/background/slow.png",
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
