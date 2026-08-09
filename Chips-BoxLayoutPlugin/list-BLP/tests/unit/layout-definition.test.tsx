import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { layoutDefinition } from "../../src/index";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("layoutDefinition", () => {
  it("uses the official list layout identity", () => {
    expect(layoutDefinition.pluginId).toBe("chips.layout.list");
    expect(layoutDefinition.layoutType).toBe("chips.layout.list");
    expect(layoutDefinition.displayName).toBe("列表布局插件");
    expect(layoutDefinition.icon).toMatchObject({
      name: "view_list",
      decorative: true,
    });
  });

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
    const readEntryDetail = vi.fn().mockResolvedValue([
      {
        entryId: "entry-1",
        detail: {
          documentInfo: {
            metadata: {
              createdAt: "2026-03-23T09:30:00.000Z",
            },
          },
        },
      },
    ]);

    let cleanup: (() => void) | void;
    await act(async () => {
      cleanup = layoutDefinition.renderView({
        container,
        sessionId: "session-1",
        box: {
          boxId: "box-1",
          boxFile: "/tmp/demo.box",
          name: "Demo",
          activeLayoutType: "chips.layout.list",
          availableLayouts: ["chips.layout.list"],
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
          nextCursor: "cursor-2",
        },
        config: layoutDefinition.createDefaultConfig(),
        runtime: {
          listEntries: vi.fn(),
          readEntryDetail,
          renderEntryCover,
          resolveEntryResource: vi.fn(),
          readBoxAsset: vi.fn(),
          prefetchEntries: vi.fn().mockResolvedValue(undefined),
          openEntry,
        },
        locale: "zh-CN",
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Demo Card");
    expect(container.querySelector('[role="listbox"]')).toBeTruthy();
    expect(container.querySelector('[data-layout-toolbar]')).toBeTruthy();
    const tile = container.querySelector('[data-entry-id="entry-1"]');
    expect(tile).toBeTruthy();
    expect(tile?.querySelector('[data-list-entry-title]')?.textContent).toBe("Demo Card");
    expect(tile?.querySelector('[data-list-entry-date]')?.textContent).toContain("创建日期");
    expect(container.querySelector('style')?.textContent).toContain("--chips-list-row-height: 132px");
    expect(container.querySelector('[data-chips-embedded-frame="embedded-document-frame"]')).toBeTruthy();
    expect(readEntryDetail).toHaveBeenCalledWith({
      entryIds: ["entry-1"],
      fields: ["documentInfo"],
    });
    expect(renderEntryCover).toHaveBeenCalledWith("entry-1");
    expect(container.textContent).toContain("已选择 0 个条目");
    tile?.querySelector('[data-list-entry-title]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
          activeLayoutType: "chips.layout.list",
          availableLayouts: ["chips.layout.list"],
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
          readEntryDetail: vi.fn().mockResolvedValue([
            {
              entryId: "entry-a",
              detail: {
                documentInfo: {
                  metadata: {
                    createdAt: "2026-03-21T09:30:00.000Z",
                  },
                },
              },
            },
            {
              entryId: "entry-b",
              detail: {
                documentInfo: {
                  metadata: {
                    createdAt: "2026-03-22T09:30:00.000Z",
                  },
                },
              },
            },
          ]),
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

    const titles = Array.from(container.querySelectorAll('[data-list-entry-title]')).map((node) => node.textContent);
    expect(titles).toEqual(["Alpha", "Beta"]);
  });

  it("renders editor with antd controls and complete list options", async () => {
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
    expect(container.querySelector(".ant-segmented")).toBeTruthy();
    expect(container.querySelector(".ant-checkbox-wrapper")).toBeTruthy();
    expect(container.querySelector(".ant-input-number")).toBeTruthy();
    expect(container.querySelector('input[type="number"]')).toBeNull();
    expect(container.textContent).toContain("等高行");
    expect(container.textContent).toContain("行密度");
    expect(container.textContent).toContain("封面尺寸");
    expect(container.textContent).toContain("显示字段");
    expect(container.textContent).toContain("分页数量");
    expect(container.style.display).toBe("flex");
    expect(container.style.overflow).toBe("hidden");
    expect(container.querySelector('[data-chips-list-layout-editor-root="true"]')).toBeTruthy();
    const editorRoot = container.querySelector('[data-chips-list-layout-editor-root="true"]') as HTMLElement | null;
    expect(editorRoot?.style.height).toBe("100%");
    expect(container.querySelector('[data-scope="chips-list-layout-editor"]')).toBeTruthy();
    expect(container.querySelector('[data-part="body"]')).toBeTruthy();
    expect(container.querySelector('[data-frame-region-editor="background"]')).toBeTruthy();
    expect(container.querySelector('[data-frame-region-editor="topRegion"]')).toBeTruthy();

    await act(async () => {
      cleanup?.();
    });
    expect(container.style.overflow).toBe("visible");
  });

  it("supports keyboard selection and paginated runtime loading", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const listEntries = vi.fn().mockResolvedValue({
      items: [
        {
          entryId: "entry-3",
          url: "file:///tmp/c.card",
          enabled: true,
          snapshot: {
            title: "Gamma",
            cover: {
              mode: "none",
            },
            contentType: "chips/card",
          },
        },
      ],
      total: 3,
    });
    const openEntry = vi.fn().mockResolvedValue({
      mode: "document-window",
      documentType: "card",
      windowId: "window-3",
    });

    await act(async () => {
      layoutDefinition.renderView({
        container,
        sessionId: "session-page",
        box: {
          boxId: "box-page",
          boxFile: "/tmp/page.box",
          name: "Page Box",
          activeLayoutType: "chips.layout.list",
          availableLayouts: ["chips.layout.list"],
        },
        initialView: {
          items: [
            {
              entryId: "entry-1",
              url: "file:///tmp/a.card",
              enabled: true,
              snapshot: {
                title: "Alpha",
                summary: "First summary",
                tags: ["Design"],
                cover: {
                  mode: "none",
                },
                contentType: "chips/card",
              },
            },
            {
              entryId: "entry-2",
              url: "file:///tmp/b.box",
              enabled: true,
              snapshot: {
                title: "Beta",
                tags: ["Design"],
                cover: {
                  mode: "none",
                },
                contentType: "chips/box",
              },
            },
          ],
          total: 3,
          nextCursor: "cursor-2",
        },
        config: layoutDefinition.normalizeConfig({
          props: {
            rowDensity: "compact",
            coverSize: "large",
            visibleFields: ["type", "summary", "tags"],
            groupMode: "tag",
            pageSize: 20,
          },
        }),
        runtime: {
          listEntries,
          readEntryDetail: vi.fn().mockResolvedValue([]),
          renderEntryCover: vi.fn(),
          resolveEntryResource: vi.fn(),
          readBoxAsset: vi.fn(),
          prefetchEntries: vi.fn().mockResolvedValue(undefined),
          openEntry,
        },
        locale: "zh-CN",
      });
      await Promise.resolve();
    });

    expect(container.querySelector('[data-scope="chips-box-list-layout"]')?.getAttribute("data-density")).toBe("compact");
    expect(container.querySelector('[data-scope="chips-box-list-layout"]')?.getAttribute("data-cover-size")).toBe("large");
    expect(container.textContent).toContain("Design");
    expect(container.textContent).toContain("First summary");

    const list = container.querySelector('[role="listbox"]');
    await act(async () => {
      list?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      list?.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    });
    expect(container.textContent).toContain("已选择 1 个条目");

    await act(async () => {
      list?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await Promise.resolve();
    });
    expect(openEntry).toHaveBeenCalledWith("entry-2");

    const loadMoreButton = container.querySelector('[data-layout-pagination] button');
    await act(async () => {
      loadMoreButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(listEntries).toHaveBeenCalledWith({
      cursor: "cursor-2",
      limit: 20,
    });
    expect(container.textContent).toContain("Gamma");
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
          activeLayoutType: "chips.layout.list",
          availableLayouts: ["chips.layout.list"],
        },
        initialView: {
          items: [],
          total: 0,
        },
        config: layoutDefinition.createDefaultConfig(),
        runtime: {
          listEntries: vi.fn(),
          readEntryDetail: vi.fn().mockResolvedValue([]),
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

    expect(container.querySelector('[data-scope="chips-box-list-layout"]')).toBeTruthy();
    expect(container.querySelector('[data-layout-list]')).toBeTruthy();
    expect(container.textContent).toContain("暂无条目");
  });
});
