import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { layoutDefinition } from "../../src/index";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("layoutDefinition", () => {
  it("renders view, loads cover and cleans up", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const renderEntryCover = vi.fn().mockResolvedValue({
      title: "Demo Card",
      coverUrl: "file:///tmp/demo-cover.png",
      mimeType: "image/png",
    });
    const openEntry = vi.fn().mockResolvedValue({
      mode: "document-window",
      documentType: "card",
      windowId: "window-1",
    });

    let cleanup: (() => void) | void;
    await act(async () => {
      cleanup = layoutDefinition.renderView({
        container,
        sessionId: "session-1",
        box: {
          boxId: "box-1",
          boxFile: "/tmp/demo.box",
          name: "Demo",
          activeLayoutType: "chips.layout.grid",
          availableLayouts: ["chips.layout.grid"],
          capabilities: {
            listEntries: true,
            readEntryDetail: true,
            renderEntryCover: true,
            resolveEntryResource: true,
            readBoxAsset: true,
            prefetchEntries: true,
            openEntry: true,
          },
        },
        initialView: {
          items: [
            {
              entryId: "entry-1",
              url: "file:///tmp/demo.card",
              enabled: true,
              snapshot: {
                title: "Demo Card",
                summary: "Summary",
                cover: {
                  mode: "runtime",
                },
                contentType: "chips/card",
              },
            },
          ],
          total: 1,
        },
        config: layoutDefinition.createDefaultConfig(),
        runtime: {
          listEntries: vi.fn(),
          readEntryDetail: vi.fn(),
          renderEntryCover,
          resolveEntryResource: vi.fn(),
          readBoxAsset: vi.fn(),
          prefetchEntries: vi.fn().mockResolvedValue(undefined),
          openEntry,
        },
        locale: "zh-CN",
      });
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Demo Card");
    const tile = container.querySelector('[data-entry-id="entry-1"]');
    expect(tile).toBeTruthy();
    expect(tile?.querySelector('[data-grid-entry-title]')?.textContent).toBe("Demo Card");
    expect(tile?.querySelector('[data-grid-entry-kind]')).toBeNull();
    expect(tile?.querySelector('[data-grid-entry-summary]')).toBeNull();
    expect(container.querySelector('[data-chips-embedded-frame="embedded-document-frame"]')).toBeTruthy();
    expect(renderEntryCover).toHaveBeenCalledWith("entry-1");
    expect(renderEntryCover).toHaveBeenCalledTimes(1);
    tile?.querySelector('[data-grid-entry-title]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(openEntry).toHaveBeenCalledWith("entry-1");
    await act(async () => {
      cleanup?.();
    });
    expect(container.textContent ?? "").toBe("");
  });

  it("sorts entries by title when ascending mode is enabled", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const config = layoutDefinition.normalizeConfig({
      schemaVersion: "1.0.0",
      props: {
        sortMode: "name-asc",
        background: {
          mode: "none",
        },
        topRegion: {
          mode: "none",
        },
      },
    });

    await act(async () => {
      layoutDefinition.renderView({
        container,
        sessionId: "session-sort",
        box: {
          boxId: "box-sort",
          boxFile: "/tmp/sort.box",
          name: "Sort Box",
          activeLayoutType: "chips.layout.grid",
          availableLayouts: ["chips.layout.grid"],
          capabilities: {
            listEntries: true,
            readEntryDetail: true,
            renderEntryCover: true,
            resolveEntryResource: true,
            readBoxAsset: true,
            prefetchEntries: true,
            openEntry: true,
          },
        },
        initialView: {
          items: [
            {
              entryId: "entry-b",
              url: "file:///tmp/b.card",
              enabled: true,
              snapshot: {
                title: "Beta",
                cover: {
                  mode: "none",
                },
                contentType: "chips/card",
              },
            },
            {
              entryId: "entry-a",
              url: "file:///tmp/a.card",
              enabled: true,
              snapshot: {
                title: "Alpha",
                cover: {
                  mode: "none",
                },
                contentType: "chips/card",
              },
            },
          ],
          total: 2,
        },
        config,
        runtime: {
          listEntries: vi.fn(),
          readEntryDetail: vi.fn(),
          renderEntryCover: vi.fn(),
          resolveEntryResource: vi.fn(),
          readBoxAsset: vi.fn(),
          prefetchEntries: vi.fn().mockResolvedValue(undefined),
          openEntry: vi.fn(),
        },
        locale: "zh-CN",
      });
      await Promise.resolve();
    });

    const titles = Array.from(container.querySelectorAll('[data-grid-entry-title]')).map((node) => node.textContent);
    expect(titles).toEqual(["Alpha", "Beta"]);
  });

  it("renders editor without exposing numeric column controls", async () => {
    const container = document.createElement("div");
    container.style.overflow = "visible";
    document.body.appendChild(container);
    const onChange = vi.fn();

    let cleanup: (() => void) | void;
    await act(async () => {
      cleanup = layoutDefinition.renderEditor?.({
        container,
        entries: [],
        initialConfig: layoutDefinition.createDefaultConfig(),
        onChange,
        locale: "zh-CN",
      });
    });

    expect(container.querySelector(".ant-select")).toBeTruthy();
    expect(container.querySelector('input[type="number"]')).toBeNull();
    expect(container.textContent).toContain("移动端固定为两列");
    expect(container.style.display).toBe("flex");
    expect(container.style.overflow).toBe("hidden");
    expect(container.querySelector('[data-chips-grid-layout-editor-root="true"]')).toBeTruthy();
    expect(container.querySelector('[data-scope="chips-grid-layout-editor"]')).toBeTruthy();
    const editorRoot = container.querySelector('[data-chips-grid-layout-editor-root="true"]') as HTMLElement | null;
    expect(editorRoot?.style.height).toBe("100%");
    expect(container.querySelector(".chips-grid-layout-editor__form")).toBeTruthy();
    expect(container.querySelector(".ant-select")).toBeTruthy();
    expect(container.querySelector('[data-frame-region-editor="topRegion"]')).toBeTruthy();
    expect(container.querySelector('[data-frame-region-editor="background"]')).toBeTruthy();

    await act(async () => {
      cleanup?.();
    });
    expect(container.style.overflow).toBe("visible");
  });

  it("switches sort mode through the row select", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();

    let cleanup: (() => void) | void;
    await act(async () => {
      cleanup = layoutDefinition.renderEditor?.({
        container,
        entries: [],
        initialConfig: layoutDefinition.createDefaultConfig(),
        onChange,
        locale: "zh-CN",
      });
    });

    const sortRow = container.querySelector(".ant-select") as HTMLElement | null;
    const trigger = sortRow?.querySelector("input.ant-select-input") as HTMLInputElement | null;
    expect(trigger).toBeTruthy();

    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    const options = Array.from(document.body.querySelectorAll(".ant-select-item-option"));
    const nameAsc = options.find((option) => option.textContent?.includes("按名称升序"));
    expect(nameAsc).toBeTruthy();

    await act(async () => {
      nameAsc?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      props: expect.objectContaining({
        sortMode: "name-asc",
      }),
    }));

    await act(async () => {
      cleanup?.();
    });
  });

  it("switches frame region modes through the inline segmented control", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();

    let cleanup: (() => void) | void;
    await act(async () => {
      cleanup = layoutDefinition.renderEditor?.({
        container,
        entries: [],
        initialConfig: layoutDefinition.createDefaultConfig(),
        onChange,
        locale: "zh-CN",
      });
    });

    const background = container.querySelector('[data-frame-region-editor="background"]') as HTMLElement | null;
    const items = Array.from(background?.querySelectorAll(".ant-segmented-item") ?? []);
    const imageItem = items.find((item) => item.textContent === "图片");
    expect(imageItem).toBeTruthy();

    await act(async () => {
      imageItem?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      props: expect.objectContaining({
        background: {
          mode: "image",
        },
      }),
    }));

    await act(async () => {
      cleanup?.();
    });
  });

  it("uploads an image by dropping it onto the drop zone", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/grid/background/dropped.webp",
    });

    await act(async () => {
      layoutDefinition.renderEditor?.({
        container,
        entries: [],
        initialConfig: layoutDefinition.normalizeConfig({
          props: {
            background: {
              mode: "image",
            },
          },
        }),
        onChange,
        readBoxAsset: vi.fn().mockResolvedValue({
          resourceUrl: "chips-render://box-assets/dropped.webp",
          mimeType: "image/webp",
        }),
        importBoxAsset,
        deleteBoxAsset: vi.fn(),
        locale: "zh-CN",
      });
      await Promise.resolve();
    });

    const background = container.querySelector('[data-frame-region-editor="background"]') as HTMLElement | null;
    const dropZone = background?.querySelector('[data-drop-zone]') as HTMLElement | null;
    expect(dropZone).toBeTruthy();
    expect(dropZone?.textContent).toContain("点击选择图片，或拖拽图片到此处");

    const file = new File(["dropped"], "dropped.webp", { type: "image/webp" });
    const dataTransfer = { files: [file] };
    const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", {
      configurable: true,
      value: dataTransfer,
    });

    await act(async () => {
      dropZone?.dispatchEvent(dropEvent);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(importBoxAsset).toHaveBeenCalledWith(expect.objectContaining({
      file,
      preferredPath: expect.stringMatching(/^assets\/layouts\/grid\/background\/[0-9]+-dropped\.webp$/),
    }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      props: expect.objectContaining({
        background: {
          mode: "image",
          assetPath: "assets/layouts/grid/background/dropped.webp",
        },
      }),
      assetRefs: ["assets/layouts/grid/background/dropped.webp"],
    }));
  });

  it("removes an existing image and falls back to the empty drop zone", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const deleteBoxAsset = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      layoutDefinition.renderEditor?.({
        container,
        entries: [],
        initialConfig: layoutDefinition.normalizeConfig({
          props: {
            topRegion: {
              mode: "image",
              assetPath: "assets/layouts/grid/top-region/banner.webp",
            },
          },
        }),
        onChange,
        readBoxAsset: vi.fn().mockResolvedValue({
          resourceUrl: "chips-render://box-assets/banner.webp",
          mimeType: "image/webp",
        }),
        importBoxAsset: vi.fn(),
        deleteBoxAsset,
        locale: "zh-CN",
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    const topRegion = container.querySelector('[data-frame-region-editor="topRegion"]') as HTMLElement | null;
    const filledZone = topRegion?.querySelector('[data-drop-zone][data-state="filled"]') as HTMLElement | null;
    expect(filledZone).toBeTruthy();
    expect(topRegion?.textContent).toContain("移除");

    const removeButton = Array.from(topRegion?.querySelectorAll("button") ?? [])
      .find((button) => button.textContent === "移除");

    await act(async () => {
      removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(deleteBoxAsset).toHaveBeenCalledWith("assets/layouts/grid/top-region/banner.webp");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      props: expect.objectContaining({
        topRegion: {
          mode: "none",
        },
      }),
      assetRefs: [],
    }));
  });

  it("keeps the layout shell visible when the box has no entries", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      layoutDefinition.renderView({
        container,
        sessionId: "session-empty",
        box: {
          boxId: "box-empty",
          boxFile: "/tmp/empty.box",
          name: "Empty Box",
          activeLayoutType: "chips.layout.grid",
          availableLayouts: ["chips.layout.grid"],
          capabilities: {
            listEntries: true,
            readEntryDetail: true,
            renderEntryCover: true,
            resolveEntryResource: true,
            readBoxAsset: true,
            prefetchEntries: true,
            openEntry: true,
          },
        },
        initialView: {
          items: [],
          total: 0,
        },
        config: layoutDefinition.createDefaultConfig(),
        runtime: {
          listEntries: vi.fn(),
          readEntryDetail: vi.fn(),
          renderEntryCover: vi.fn(),
          resolveEntryResource: vi.fn(),
          readBoxAsset: vi.fn(),
          prefetchEntries: vi.fn().mockResolvedValue(undefined),
          openEntry: vi.fn(),
        },
        locale: "zh-CN",
      });
      await Promise.resolve();
    });

    expect(container.querySelector('[data-scope="chips-box-grid-layout"]')).toBeTruthy();
    expect(container.querySelector('[data-layout-grid]')).toBeTruthy();
    expect(container.querySelector('[data-layout-skeleton]')).toBeTruthy();
    expect(container.querySelector('[data-layout-skeleton-grid]')).toBeTruthy();
    expect(container.querySelectorAll('[data-layout-skeleton-cell]')).toHaveLength(6);
    expect(container.querySelector('[data-layout-empty-title]')?.textContent).toContain("这里还没有内容");
    expect(container.querySelector('[data-layout-empty-text]')?.textContent).toContain("在编辑器中添加卡片或箱子");
  });

  it("loads additional entry pages and prefetches visible covers", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const listEntries = vi.fn().mockResolvedValue({
      items: [
        {
          entryId: "entry-2",
          url: "file:///tmp/2.card",
          enabled: true,
          snapshot: {
            title: "Second",
            cover: {
              mode: "none",
            },
            contentType: "chips/card",
          },
        },
      ],
      total: 2,
    });
    const prefetchEntries = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      layoutDefinition.renderView({
        container,
        sessionId: "session-pages",
        box: {
          boxId: "box-pages",
          boxFile: "/tmp/pages.box",
          name: "Pages Box",
          activeLayoutType: "chips.layout.grid",
          availableLayouts: ["chips.layout.grid"],
          capabilities: {
            listEntries: true,
            readEntryDetail: true,
            renderEntryCover: true,
            resolveEntryResource: true,
            readBoxAsset: true,
            prefetchEntries: true,
            openEntry: true,
          },
        },
        initialView: {
          items: [
            {
              entryId: "entry-1",
              url: "file:///tmp/1.card",
              enabled: true,
              snapshot: {
                title: "First",
                cover: {
                  mode: "none",
                },
                contentType: "chips/card",
              },
            },
          ],
          total: 2,
          nextCursor: "cursor-2",
        },
        config: layoutDefinition.createDefaultConfig(),
        runtime: {
          listEntries,
          readEntryDetail: vi.fn(),
          renderEntryCover: vi.fn(),
          resolveEntryResource: vi.fn(),
          readBoxAsset: vi.fn(),
          prefetchEntries,
          openEntry: vi.fn(),
        },
        locale: "zh-CN",
      });
      await Promise.resolve();
    });

    expect(container.textContent).toContain("加载更多");
    expect(prefetchEntries).toHaveBeenCalledWith({
      entryIds: ["entry-1"],
      targets: ["cover"],
    });

    await act(async () => {
      container.querySelector('[data-layout-load-more]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(listEntries).toHaveBeenCalledWith({
      cursor: "cursor-2",
      limit: 48,
    });
    expect(container.textContent).toContain("Second");
  });

  it("imports editor assets through the box asset bridge", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onChange = vi.fn();
    const importBoxAsset = vi.fn().mockResolvedValue({
      assetPath: "assets/layouts/grid/background/hero.webp",
    });
    const readBoxAsset = vi.fn().mockResolvedValue({
      resourceUrl: "chips-render://box-assets/hero.webp",
      mimeType: "image/webp",
    });
    const deleteBoxAsset = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      layoutDefinition.renderEditor?.({
        container,
        entries: [],
        initialConfig: layoutDefinition.normalizeConfig({
          props: {
            background: {
              mode: "image",
            },
          },
        }),
        onChange,
        readBoxAsset,
        importBoxAsset,
        deleteBoxAsset,
        locale: "zh-CN",
      });
      await Promise.resolve();
    });

    const background = container.querySelector('[data-frame-region-editor="background"]') as HTMLElement | null;
    const input = background?.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    const file = new File(["hero"], "hero.webp", { type: "image/webp" });
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });

    await act(async () => {
      input?.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(importBoxAsset).toHaveBeenCalledWith(expect.objectContaining({
      file,
      preferredPath: expect.stringMatching(/^assets\/layouts\/grid\/background\/[0-9]+-hero\.webp$/),
    }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      props: expect.objectContaining({
        background: {
          mode: "image",
          assetPath: "assets/layouts/grid/background/hero.webp",
        },
      }),
      assetRefs: ["assets/layouts/grid/background/hero.webp"],
    }));
  });
});
