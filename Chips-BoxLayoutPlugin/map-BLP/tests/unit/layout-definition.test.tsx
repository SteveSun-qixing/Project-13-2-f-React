import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
      resourceUrl: "chips-render://asset/map",
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

function createMapConfig(): Record<string, unknown> {
  return layoutDefinition.normalizeConfig({
    schemaVersion: "1.0.0",
    props: {
      mapSource: {
        mode: "image",
        projection: "linear-bounds",
        assetPath: "assets/layouts/map/base-map/tokyo.png",
        bounds: {
          west: 139.5,
          south: 35.5,
          east: 139.9,
          north: 35.9,
        },
      },
      defaultView: {
        latitude: 35.6812,
        longitude: 139.7671,
        zoom: 1,
      },
      markerStyle: "dot-title",
      showCoverOnSelect: true,
      entries: {
        "entry-1": {
          latitude: 35.6812,
          longitude: 139.7671,
          labelOverride: "Tokyo Station",
        },
      },
      topRegion: {
        mode: "none",
      },
    },
  });
}

async function renderView({
  container,
  initialView,
  runtime,
  config = createMapConfig(),
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
        activeLayoutType: "chips.layout.map.blp",
        availableLayouts: ["chips.layout.map.blp"],
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
  const normalizedText = text.replace(/\s+/g, "");
  const button = Array.from(container.querySelectorAll("button"))
    .find((candidate) => candidate.textContent?.replace(/\s+/g, "") === normalizedText);
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

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("layoutDefinition", () => {
  it("aligns identity with manifest", () => {
    const manifest = readFileSync(resolve(__dirname, "../../manifest.yaml"), "utf8");
    expect(layoutDefinition.pluginId).toBe("chips.layout.map.blp");
    expect(layoutDefinition.layoutType).toBe("chips.layout.map.blp");
    expect(layoutDefinition.displayName).toBe("地图布局插件");
    expect(layoutDefinition.icon).toEqual({
      name: "map",
      decorative: true,
    });
    expect(manifest).toContain("id: chips.layout.map.blp");
    expect(manifest).toContain("layoutType: chips.layout.map.blp");
    expect(manifest).toContain("displayName: 地图布局插件");
    expect(layoutDefinition.getInitialQuery?.(layoutDefinition.createDefaultConfig())).toEqual({
      limit: 120,
    });
  });

  it("renders map markers, reads static map assets and loads covers only after selection", async () => {
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
        ],
        total: 2,
      },
    });

    expect(container.querySelector('[data-scope="chips-box-map-layout"]')).toBeTruthy();
    expect(container.querySelector('[data-layout-skeleton]')).toBeNull();
    expect(container.querySelector('[data-map-marker][data-entry-id="entry-1"]')).toBeTruthy();
    expect(container.textContent).toContain("Tokyo Station");
    expect(container.textContent).toContain("未定位条目");
    expect(container.textContent).toContain("Beta");
    expect(runtime.readBoxAsset).toHaveBeenCalledWith("assets/layouts/map/base-map/tokyo.png");
    expect(runtime.renderEntryCover).not.toHaveBeenCalled();

    await act(async () => {
      container
        .querySelector('[data-map-marker][data-entry-id="entry-1"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(runtime.renderEntryCover).toHaveBeenCalledWith("entry-1");
    expect(container.querySelector('[data-map-selected]')).toBeTruthy();
    expect(container.querySelector('[data-chips-embedded-frame="embedded-document-frame"]')).toBeTruthy();
    expect(runtime.openEntry).not.toHaveBeenCalled();

    await act(async () => {
      container
        .querySelector('[data-map-marker][data-entry-id="entry-1"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(runtime.openEntry).toHaveBeenCalledWith("entry-1");
  });

  it("shows a map-form skeleton with an empty hint when the box has no entries", async () => {
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
    expect(container.querySelector('[data-map-skeleton]')).toBeTruthy();
    expect(container.querySelector('[data-layout-empty-hint]')).toBeTruthy();
    expect(container.querySelector('[data-layout-empty-title]')?.textContent).toContain("这里还没有内容");
    expect(container.querySelector('[data-map-marker]')).toBeNull();
    expect(container.querySelector('[data-map-world]')).toBeNull();
    expect(container.querySelector('[data-map-controls]')).toBeNull();
    expect(runtime.readBoxAsset).not.toHaveBeenCalled();
    expect(runtime.listEntries).not.toHaveBeenCalled();
  });

  it("uses built-in static map when no map image is configured", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();

    await renderView({
      container,
      runtime,
      config: layoutDefinition.normalizeConfig({
        props: {
          entries: {
            "entry-1": {
              latitude: 0,
              longitude: 0,
            },
          },
        },
      }),
      initialView: {
        items: [createEntry("entry-1", "Alpha")],
        total: 1,
      },
    });

    expect(container.querySelector("[data-map-default-image]")).toBeTruthy();
    expect(runtime.readBoxAsset).not.toHaveBeenCalled();
  });

  it("renders host-map reserved mode without calling map assets or network-like resource APIs", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const runtime = createRuntime();

    await renderView({
      container,
      runtime,
      config: layoutDefinition.normalizeConfig({
        props: {
          mapSource: {
            mode: "host-map",
            projection: "web-mercator",
            bounds: {
              west: -180,
              south: -80,
              east: 180,
              north: 80,
            },
          },
          entries: {
            "entry-1": {
              latitude: 0,
              longitude: 0,
            },
          },
        },
      }),
      initialView: {
        items: [createEntry("entry-1", "Alpha")],
        total: 1,
      },
    });

    expect(container.textContent).toContain("Host 地图能力尚未提供");
    expect(runtime.readBoxAsset).not.toHaveBeenCalled();
    expect(runtime.resolveEntryResource).not.toHaveBeenCalled();
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

    const loadMore = container.querySelector("[data-layout-load-more]");
    expect(loadMore).toBeTruthy();
    await act(async () => {
      loadMore?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(listEntries).toHaveBeenCalledWith({
      cursor: "cursor-1",
      limit: 120,
    });
    expect(container.textContent).toContain("Tokyo Station");
    expect(container.textContent).toContain("Beta");

    await act(async () => {
      container
        .querySelector("[data-layout-load-more]")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain("后续条目加载失败");

    await act(async () => {
      container
        .querySelector("[data-layout-retry]")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(listEntries).toHaveBeenCalledTimes(3);
  });

  it("does not update selected cover after cleanup while runtime promise is pending", async () => {
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
    }>((resolvePromise) => {
      resolveCover = resolvePromise;
    }));
    const runtime = createRuntime({ renderEntryCover });

    const cleanup = await renderView({
      container,
      runtime,
      initialView: {
        items: [createEntry("entry-1", "Alpha")],
        total: 1,
      },
    });

    await act(async () => {
      container
        .querySelector('[data-map-marker][data-entry-id="entry-1"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
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

  it("renders editor and imports map image assets into config snapshots", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/map/base-map/hero.png",
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
    expect(container.textContent).toContain("已定位 0 个，未定位 2 个");

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    const file = new File(["hero"], "hero.png", { type: "image/png" });
    await uploadFile(input as HTMLInputElement, file);

    expect(importBoxAsset).toHaveBeenCalledWith({
      file,
      preferredPath: expect.stringMatching(/^assets\/layouts\/map\/base-map\/\d+-hero\.png$/),
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      assetRefs: ["assets/layouts/map/base-map/hero.png"],
      props: expect.objectContaining({
        mapSource: expect.objectContaining({
          mode: "image",
          projection: "linear-bounds",
          assetPath: "assets/layouts/map/base-map/hero.png",
        }),
      }),
    }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(readBoxAsset).toHaveBeenCalledWith("assets/layouts/map/base-map/hero.png");

    await act(async () => {
      cleanup();
    });
  });

  it("updates entry coordinates and reports validation errors", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();

    await renderEditor({
      container,
      onChange,
    });

    const latitude = container.querySelector('input[data-entry-latitude="entry-1"]') as HTMLInputElement | null;
    const longitude = container.querySelector('input[data-entry-longitude="entry-1"]') as HTMLInputElement | null;
    expect(latitude).toBeTruthy();
    expect(longitude).toBeTruthy();

    await act(async () => {
      latitude?.focus();
      if (latitude) {
        setInputValue(latitude, "91");
      }
      await Promise.resolve();
    });
    expect(onChange).toHaveBeenCalled();
    let lastConfig = onChange.mock.calls.at(-1)?.[0] as LayoutConfig | undefined;
    expect(lastConfig).toBeTruthy();
    if (!lastConfig) {
      throw new Error("Missing emitted config.");
    }
    expect(lastConfig.props.entries["entry-1"]?.latitude).toBe(91);
    expect(container.textContent).toContain("entry latitude must be between -90 and 90.");

    await act(async () => {
      longitude?.focus();
      if (longitude) {
        setInputValue(longitude, "139.7");
      }
      await Promise.resolve();
    });
    lastConfig = onChange.mock.calls.at(-1)?.[0] as LayoutConfig | undefined;
    expect(lastConfig).toBeTruthy();
    if (!lastConfig) {
      throw new Error("Missing emitted config.");
    }
    expect(lastConfig.props.entries["entry-1"]?.longitude).toBe(139.7);

    await act(async () => {
      clickButtonByText(container, "清除定位");
      await Promise.resolve();
    });
    lastConfig = onChange.mock.calls.at(-1)?.[0] as LayoutConfig;
    expect(lastConfig.props.entries["entry-1"]).toBeUndefined();
  });

  it("deletes replaced and cleared map image assets through the editor bridge", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/map/base-map/new.png",
    });
    const deleteBoxAsset = vi.fn().mockResolvedValue(undefined);
    const readBoxAsset = vi.fn().mockResolvedValue({
      resourceUrl: "chips-render://asset/current",
      mimeType: "image/png",
    });
    const initialConfig = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        mapSource: {
          mode: "image",
          projection: "linear-bounds",
          assetPath: "assets/layouts/map/base-map/old.png",
          bounds: {
            west: -180,
            south: -85,
            east: 180,
            north: 85,
          },
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
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/map/base-map/old.png");

    await act(async () => {
      clickButtonByText(container, "清空");
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/map/base-map/new.png");
    const lastConfig = onChange.mock.calls.at(-1)?.[0] as LayoutConfig;
    expect(lastConfig.props.mapSource.assetPath).toBeUndefined();
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

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    await uploadFile(input as HTMLInputElement, new File(["map"], "map.png", { type: "image/png" }));

    expect(container.textContent).toContain("箱子资源桥不可用");
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({
      assetRefs: expect.arrayContaining(["map.png"]),
    }));
  });
});
