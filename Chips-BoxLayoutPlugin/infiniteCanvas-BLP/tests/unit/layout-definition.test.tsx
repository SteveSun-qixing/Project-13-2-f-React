import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { layoutDefinition } from "../../src/index";
import { BACKGROUND_ASSET_PREFIX } from "../../src/schema/layout-config";
import type { BoxEntryPage, BoxEntrySnapshot, BoxLayoutRuntime, ResolvedRuntimeResource } from "../../src/shared/types";

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
    listEntries: vi.fn().mockResolvedValue({ items: [], total: 0 }),
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
        activeLayoutType: "chips.layout.infinitecanvas.blp",
        availableLayouts: ["chips.layout.infinitecanvas.blp"],
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

function clickButtonByText(container: HTMLElement, text: string): void {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(text));
  expect(button).toBeTruthy();
  button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("layoutDefinition", () => {
  it("uses the official infinite canvas identity", () => {
    expect(layoutDefinition.pluginId).toBe("chips.layout.infinitecanvas.blp");
    expect(layoutDefinition.layoutType).toBe("chips.layout.infinitecanvas.blp");
    expect(layoutDefinition.displayName).toBe("无限画布布局插件");
    expect(layoutDefinition.icon).toMatchObject({
      name: "hub",
      decorative: true,
    });
    expect(layoutDefinition.getInitialQuery?.(layoutDefinition.createDefaultConfig())).toEqual({ limit: 240 });
  });

  it("renders placed point entries and opens them through runtime", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const config = layoutDefinition.normalizeConfig({
      props: {
        items: {
          "entry-1": {
            x: 128,
            y: 96,
            mode: "point",
          },
        },
      },
    });

    const cleanup = await renderView({
      container,
      runtime,
      config,
      initialView: {
        items: [createEntry("entry-1", "Alpha")],
        total: 1,
      },
    });

    expect(container.querySelector('[data-scope="chips-box-infinite-canvas-layout"]')).toBeTruthy();
    expect(container.querySelector('[data-entry-id="entry-1"]')).toBeTruthy();
    expect(container.textContent).toContain("Alpha");
    expect(runtime.renderEntryCover).not.toHaveBeenCalled();
    expect(runtime.prefetchEntries).toHaveBeenCalledWith({
      entryIds: ["entry-1"],
      targets: ["cover"],
    });

    container.querySelector("[data-canvas-point]")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(runtime.openEntry).toHaveBeenCalledWith("entry-1");

    await act(async () => cleanup());
    expect(container.textContent ?? "").toBe("");
  });

  it("renders cover entries with renderEntryCover and reads background assets", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();
    const config = layoutDefinition.normalizeConfig({
      props: {
        displayMode: "cover",
        background: {
          mode: "image",
          assetPath: `${BACKGROUND_ASSET_PREFIX}hero.png`,
          opacity: 0.8,
        },
        items: {
          "entry-1": {
            x: 0,
            y: 0,
          },
        },
      },
    });

    await renderView({
      container,
      runtime,
      config,
      initialView: {
        items: [createEntry("entry-1", "Alpha")],
        total: 1,
      },
    });

    expect(runtime.readBoxAsset).toHaveBeenCalledWith(`${BACKGROUND_ASSET_PREFIX}hero.png`);
    expect(runtime.renderEntryCover).toHaveBeenCalledWith("entry-1");
    expect(container.querySelector('[data-chips-embedded-frame="embedded-document-frame"]')).toBeTruthy();
    expect(container.querySelector("[data-infinite-canvas-background] img")).toBeTruthy();
  });

  it("keeps unplaced entries out of view empty state", async () => {
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

    expect(container.querySelector('[data-entry-id="entry-1"]')).toBeNull();
    expect(container.querySelector('[data-infinite-canvas-empty]')).toBeTruthy();
    expect(container.querySelector('[data-layout-skeleton]')).toBeTruthy();
    expect(container.querySelector('[data-layout-empty-title]')?.textContent).toBe("这里还没有内容");
    expect(container.querySelector('[data-layout-empty-text]')?.textContent).toBe(
      "在编辑器中添加卡片或箱子，开始填充这个箱子",
    );
  });

  it("places an unplaced entry from the editor and emits a full normalized config", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();

    await renderEditor({ container, onChange });

    expect(container.querySelector('[data-scope="chips-infinite-canvas-layout-editor"]')).toBeTruthy();
    expect(container.textContent).toContain("还有 2 个条目未放置");
    await act(async () => {
      clickButtonByText(container, "选择");
    });

    const canvas = container.querySelector("[data-editor-canvas]") as HTMLElement;
    canvas.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 640,
      height: 480,
      top: 0,
      left: 0,
      right: 640,
      bottom: 480,
      toJSON: () => undefined,
    });

    await act(async () => {
      canvas.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        clientX: 65,
        clientY: 65,
      }));
    });

    expect(onChange).toHaveBeenCalled();
    const config = onChange.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(config).toMatchObject({
      props: {
        items: {
          "entry-1": {
            x: 64,
            y: 64,
            mode: "point",
          },
        },
      },
      assetRefs: [],
    });
  });

  it("updates coordinates and entry display mode from editor controls", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const initialConfig = layoutDefinition.normalizeConfig({
      props: {
        items: {
          "entry-1": {
            x: 10,
            y: 20,
            mode: "point",
          },
        },
      },
    });

    await renderEditor({ container, initialConfig, onChange });
    const node = container.querySelector('[data-editor-entry-id="entry-1"]') as HTMLElement;
    await act(async () => {
      node.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 0, clientY: 0 }));
      await Promise.resolve();
    });

    const xInput = Array.from(container.querySelectorAll("input[type='number']")).find((input) => {
      const label = input.closest("label");
      return label?.textContent?.includes("X 坐标");
    }) as HTMLInputElement | undefined;
    expect(xInput).toBeTruthy();

    await act(async () => {
      if (xInput) {
        setInputValue(xInput, "96");
      }
    });

    const modeSelect = Array.from(container.querySelectorAll("select")).find((select) => {
      const label = select.closest("label");
      return label?.textContent?.includes("条目模式");
    }) as HTMLSelectElement | undefined;
    expect(modeSelect).toBeTruthy();

    await act(async () => {
      if (modeSelect) {
        modeSelect.value = "cover";
        modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
      props: {
        items: {
          "entry-1": {
            x: 96,
            y: 20,
            mode: "cover",
          },
        },
      },
    });
  });

  it("imports and clears background assets through editor bridge", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: `${BACKGROUND_ASSET_PREFIX}hero.png`,
    });
    const deleteBoxAsset = vi.fn().mockResolvedValue(undefined);
    const readBoxAsset = vi.fn().mockResolvedValue({
      resourceUrl: "chips-render://asset/hero",
      mimeType: "image/png",
    });

    await renderEditor({
      container,
      onChange,
      importBoxAsset,
      deleteBoxAsset,
      readBoxAsset,
    });

    clickButtonByText(container, "上传背景");
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    const file = new File(["hero"], "hero.png", { type: "image/png" });
    await uploadFile(input as HTMLInputElement, file);

    expect(importBoxAsset).toHaveBeenCalledWith({
      file,
      preferredPath: expect.stringMatching(/^assets\/layouts\/infinitecanvas\/background\/\d+-hero\.png$/),
    });
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
      assetRefs: [`${BACKGROUND_ASSET_PREFIX}hero.png`],
      props: {
        background: {
          mode: "image",
          assetPath: `${BACKGROUND_ASSET_PREFIX}hero.png`,
        },
      },
    });

    await act(async () => {
      clickButtonByText(container, "清空背景");
      await Promise.resolve();
    });
    expect(deleteBoxAsset).toHaveBeenCalledWith(`${BACKGROUND_ASSET_PREFIX}hero.png`);
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
      assetRefs: [],
      props: {
        background: {
          mode: "none",
        },
      },
    });
  });

  it("restores editor host styles on cleanup", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.style.display = "block";
    container.style.width = "20px";

    const cleanup = await renderEditor({ container });
    expect(container.style.display).toBe("flex");
    await act(async () => cleanup());
    expect(container.style.display).toBe("block");
    expect(container.style.width).toBe("20px");
    expect(container.textContent ?? "").toBe("");
  });
});
