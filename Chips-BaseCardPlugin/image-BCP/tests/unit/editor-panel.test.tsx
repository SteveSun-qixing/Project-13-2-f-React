// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBasecardEditorRoot } from "../../src/editor/panel";
import type { BasecardConfig } from "../../src/schema/card-config";

type DisposableRoot = HTMLElement & {
  __chipsDispose?: () => void;
};

type PointerTarget = Element | Window;

type RectInput = {
  height: number;
  left: number;
  top: number;
  width: number;
};

function createConfig(overrides?: Partial<BasecardConfig>): BasecardConfig {
  return {
    card_type: "base.image",
    theme: "",
    images: [],
    layout_type: "single",
    layout_options: {
      grid_mode: "2x2",
      single_width_percent: 100,
      single_alignment: "center",
      spacing_mode: "comfortable",
    },
    ...overrides,
  };
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function setTextInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setRect(target: Element, rect: RectInput): void {
  Object.defineProperty(target, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      ...rect,
      bottom: rect.top + rect.height,
      right: rect.left + rect.width,
      x: rect.left,
      y: rect.top,
      toJSON: () => undefined,
    }),
  });
}

function dispatchPointerEvent(
  target: PointerTarget,
  type: string,
  init: { button?: number; clientX: number; clientY: number; pointerId?: number; pointerType?: string },
): void {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  });

  Object.defineProperties(event, {
    button: {
      configurable: true,
      value: init.button ?? 0,
    },
    clientX: {
      configurable: true,
      value: init.clientX,
    },
    clientY: {
      configurable: true,
      value: init.clientY,
    },
    pointerId: {
      configurable: true,
      value: init.pointerId ?? 1,
    },
    pointerType: {
      configurable: true,
      value: init.pointerType ?? "mouse",
    },
    preventDefault: {
      configurable: true,
      value: vi.fn(),
    },
  });

  target.dispatchEvent(event);
}

function queryImageTiles(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll(".chips-image-editor__image-tile")) as HTMLElement[];
}

function setupGridRects(root: HTMLElement): {
  addTile: HTMLButtonElement;
  deleteTray: HTMLElement;
  grid: HTMLElement;
  tiles: HTMLElement[];
} {
  const tiles = queryImageTiles(root);
  const addTile = root.querySelector(".chips-image-editor__add-tile") as HTMLButtonElement | null;
  const deleteTray = root.querySelector(".chips-image-editor__delete-tray") as HTMLElement | null;
  const grid = root.querySelector(".chips-image-editor__image-grid") as HTMLElement | null;
  if (!addTile || !deleteTray || !grid) {
    throw new Error("未找到网格拖拽测试所需控件");
  }

  setRect(grid, {
    height: 204,
    left: 12,
    top: 12,
    width: 312,
  });

  tiles.forEach((tile, index) => {
    setRect(tile, {
      height: 96,
      left: 12 + (index % 3) * 108,
      top: 12 + Math.floor(index / 3) * 108,
      width: 96,
    });
  });

  setRect(addTile, {
    height: 96,
    left: 12 + (tiles.length % 3) * 108,
    top: 12 + Math.floor(tiles.length / 3) * 108,
    width: 96,
  });

  setRect(deleteTray, {
    height: 56,
    left: 20,
    top: 220,
    width: 240,
  });

  return {
    addTile,
    deleteTray,
    grid,
    tiles,
  };
}

describe("createBasecardEditorRoot", () => {
  const mountedRoots: DisposableRoot[] = [];

  beforeEach(() => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "zh-CN",
    });
  });

  afterEach(() => {
    for (const root of mountedRoots) {
      root.__chipsDispose?.();
      root.remove();
    }
    mountedRoots.length = 0;
    document.body.innerHTML = "";
  });

  it("adds a remote image and emits normalized config", async () => {
    let lastConfig = createConfig();
    const root = createBasecardEditorRoot({
      initialConfig: createConfig(),
      onChange: (next) => {
        lastConfig = next;
      },
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    const urlInput = root.querySelector(
      ".chips-image-editor__url-field",
    ) as HTMLInputElement | null;
    const addButton = Array.from(root.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("通过链接添加"),
    ) as HTMLButtonElement | undefined;

    if (!urlInput || !addButton) {
      throw new Error("未找到 URL 输入区域");
    }

    setTextInputValue(urlInput, "https://example.com/photo.png");
    addButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await flushAsyncWork();

    expect(lastConfig.images).toHaveLength(1);
    expect(lastConfig.images[0]?.source).toBe("url");
    expect(lastConfig.images[0]?.url).toBe("https://example.com/photo.png");
    expect(lastConfig.layout_type).toBe("single");
    expect(lastConfig.layout_options?.single_width_percent).toBe(70);
  });

  it("imports file resources at the card root and removes them through the bottom delete tray", async () => {
    let lastConfig = createConfig();
    const importResource = vi.fn(async ({ preferredPath }: { preferredPath?: string }) => ({
      path: preferredPath ?? "image.png",
    }));
    const resolveResourceUrl = vi.fn(async (resourcePath: string) => `blob:${resourcePath}`);
    const deleteResource = vi.fn(async () => undefined);

    const root = createBasecardEditorRoot({
      initialConfig: createConfig(),
      onChange: (next) => {
        lastConfig = next;
      },
      importResource,
      resolveResourceUrl,
      deleteResource,
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    const addInput = root.querySelectorAll("input[type='file']")[0] as HTMLInputElement | undefined;
    if (!addInput) {
      throw new Error("未找到上传输入框");
    }

    const file = new File(["image-bytes"], "photo.png", { type: "image/png" });
    Object.defineProperty(addInput, "files", {
      configurable: true,
      value: [file],
    });
    addInput.dispatchEvent(new Event("change", { bubbles: true }));

    await flushAsyncWork();

    expect(importResource).toHaveBeenCalledTimes(1);
    expect(importResource.mock.calls[0]?.[0]).toMatchObject({
      preferredPath: "photo.png",
    });
    expect(resolveResourceUrl).toHaveBeenCalledWith("photo.png");
    expect(lastConfig.images[0]?.file_path).toBe("photo.png");

    const { deleteTray, tiles } = setupGridRects(root);
    const tile = tiles[0];
    if (!tile) {
      throw new Error("未找到拖拽删除测试所需图片");
    }

    dispatchPointerEvent(tile, "pointerdown", {
      clientX: 30,
      clientY: 30,
    });
    dispatchPointerEvent(window, "pointermove", {
      clientX: 48,
      clientY: 48,
    });
    await flushAsyncWork();
    const dragPreview = document.body.querySelector(
      '.chips-image-editor__drag-preview[data-active="true"]',
    ) as HTMLElement | null;
    expect(dragPreview).not.toBeNull();
    expect(dragPreview?.style.transform).toContain("translate3d");
    dispatchPointerEvent(window, "pointermove", {
      clientX: 60,
      clientY: 240,
    });
    dispatchPointerEvent(window, "pointerup", {
      clientX: 60,
      clientY: 240,
    });

    await flushAsyncWork();

    expect(lastConfig.images).toHaveLength(0);
    expect(deleteResource).toHaveBeenCalledWith("photo.png");
  });

  it("resolves existing file resources for thumbnail preview", async () => {
    const resolveResourceUrl = vi.fn(async (resourcePath: string) => `blob:${resourcePath}`);
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        images: [
          {
            id: "image-1",
            source: "file",
            file_path: "cover.png",
            title: "Cover",
            alt: "Cover",
          },
        ],
      }),
      onChange: () => undefined,
      resolveResourceUrl,
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    await flushAsyncWork();

    expect(resolveResourceUrl).toHaveBeenCalledWith("cover.png");
    const preview = root.querySelector(".chips-image-editor__tile-media img");
    expect(preview?.getAttribute("src")).toBe("blob:cover.png");
  });

  it("retries file preview resolution when the first resource lookup fails", async () => {
    const resolveResourceUrl = vi
      .fn(async (resourcePath: string) => `blob:${resourcePath}`)
      .mockRejectedValueOnce(new Error("temporary unavailable"))
      .mockResolvedValueOnce("blob:fresh-cover.png");

    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        images: [
          {
            id: "image-1",
            source: "file",
            file_path: "cover.png",
            title: "Cover",
            alt: "Cover",
          },
        ],
      }),
      onChange: () => undefined,
      resolveResourceUrl,
      releaseResourceUrl: vi.fn(),
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    await flushAsyncWork();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushAsyncWork();

    const preview = root.querySelector(".chips-image-editor__tile-media img") as HTMLImageElement | null;
    if (!preview) {
      throw new Error("未找到图片预览");
    }

    expect(resolveResourceUrl).toHaveBeenCalledTimes(2);
    expect(preview.getAttribute("src")).toBe("blob:fresh-cover.png");
  });

  it("supports undo and redo for structural image changes", async () => {
    let lastConfig = createConfig();
    const root = createBasecardEditorRoot({
      initialConfig: createConfig(),
      onChange: (next) => {
        lastConfig = next;
      },
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    const urlInput = root.querySelector(
      ".chips-image-editor__url-field",
    ) as HTMLInputElement | null;
    const addButton = Array.from(root.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("通过链接添加"),
    ) as HTMLButtonElement | undefined;
    const undoButton = root.querySelector(
      '[aria-label="撤销"]',
    ) as HTMLButtonElement | null;
    const redoButton = root.querySelector(
      '[aria-label="重做"]',
    ) as HTMLButtonElement | null;

    if (!urlInput || !addButton || !undoButton || !redoButton) {
      throw new Error("未找到撤销重做测试所需控件");
    }

    setTextInputValue(urlInput, "https://example.com/1.png");
    addButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushAsyncWork();
    expect(lastConfig.images).toHaveLength(1);

    undoButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushAsyncWork();
    expect(lastConfig.images).toHaveLength(0);

    redoButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushAsyncWork();
    expect(lastConfig.images).toHaveLength(1);
    expect(lastConfig.images[0]?.url).toBe("https://example.com/1.png");
  });

  it("keeps a trailing add tile and reveals the uploader below the image grid", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        images: [
          {
            id: "image-1",
            source: "url",
            url: "https://example.com/cover.png",
          },
        ],
      }),
      onChange: () => undefined,
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    await flushAsyncWork();

    expect(root.querySelector(".chips-image-editor__embedded-uploader")).toBeNull();

    const addTile = root.querySelector(".chips-image-editor__add-tile") as HTMLButtonElement | null;
    if (!addTile) {
      throw new Error("未找到末尾添加卡片");
    }

    addTile.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushAsyncWork();

    expect(root.querySelector(".chips-image-editor__embedded-uploader")).not.toBeNull();
  });

  it("switches to grid automatically when a single-image card becomes multi-image", async () => {
    let lastConfig = createConfig({
      images: [
        {
          id: "image-1",
          source: "url",
          url: "https://example.com/cover.png",
        },
      ],
      layout_type: "single",
      layout_options: {
        ...createConfig().layout_options,
        single_width_percent: 70,
        single_alignment: "center",
      },
    });

    const root = createBasecardEditorRoot({
      initialConfig: lastConfig,
      onChange: (next) => {
        lastConfig = next;
      },
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    const addTile = root.querySelector(".chips-image-editor__add-tile") as HTMLButtonElement | null;
    if (!addTile) {
      throw new Error("未找到添加图片卡片");
    }

    addTile.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushAsyncWork();

    const urlInput = root.querySelector(
      ".chips-image-editor__url-field",
    ) as HTMLInputElement | null;
    if (!urlInput) {
      throw new Error("未找到 URL 输入区域");
    }

    setTextInputValue(urlInput, "https://example.com/second.png");
    const confirmAddButton = Array.from(root.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("通过链接添加"),
    ) as HTMLButtonElement | undefined;

    if (!confirmAddButton) {
      throw new Error("未找到通过链接添加按钮");
    }

    confirmAddButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushAsyncWork();

    expect(lastConfig.images).toHaveLength(2);
    expect(lastConfig.layout_type).toBe("grid");
    expect(lastConfig.layout_options?.grid_mode).toBe("3x3");
  });

  it("reorders images by dragging between grid cells", async () => {
    let lastConfig = createConfig({
      images: [
        {
          id: "image-1",
          source: "url",
          url: "https://example.com/1.png",
        },
        {
          id: "image-2",
          source: "url",
          url: "https://example.com/2.png",
        },
      ],
      layout_type: "grid",
    });

    const root = createBasecardEditorRoot({
      initialConfig: lastConfig,
      onChange: (next) => {
        lastConfig = next;
      },
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    await flushAsyncWork();

    const { tiles } = setupGridRects(root);
    const firstTile = tiles[0];
    const secondTile = tiles[1];
    if (!firstTile || !secondTile) {
      throw new Error("未找到拖拽排序测试所需图片卡片");
    }

    dispatchPointerEvent(firstTile, "pointerdown", {
      clientX: 24,
      clientY: 24,
    });
    dispatchPointerEvent(window, "pointermove", {
      clientX: 40,
      clientY: 40,
    });
    await flushAsyncWork();
    dispatchPointerEvent(window, "pointermove", {
      clientX: 200,
      clientY: 48,
    });
    dispatchPointerEvent(window, "pointerup", {
      clientX: 200,
      clientY: 48,
    });

    await flushAsyncWork();

    expect(lastConfig.images[0]?.id).toBe("image-2");
    expect(lastConfig.images[1]?.id).toBe("image-1");
  });

  it("hides per-image metadata forms and keeps the formal spacing options", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        images: [
          {
            id: "image-1",
            source: "url",
            url: "https://example.com/1.png",
          },
          {
            id: "image-2",
            source: "url",
            url: "https://example.com/2.png",
          },
        ],
        layout_type: "grid",
      }),
      onChange: () => undefined,
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    await flushAsyncWork();

    expect(root.textContent).not.toContain("图片标题");
    expect(root.textContent).not.toContain("替代文本");
    expect(root.textContent).toContain("零间距");
    expect(root.querySelector(".chips-image-editor__toolbar")).toBeNull();
  });

  it("updates spacing mode using the two formal spacing choices", async () => {
    let lastConfig = createConfig({
      images: [
        {
          id: "image-1",
          source: "url",
          url: "https://example.com/1.png",
        },
        {
          id: "image-2",
          source: "url",
          url: "https://example.com/2.png",
        },
      ],
      layout_type: "grid",
    });

    const root = createBasecardEditorRoot({
      initialConfig: lastConfig,
      onChange: (next) => {
        lastConfig = next;
      },
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    await flushAsyncWork();

    const zeroSpacingButton = Array.from(root.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("零间距"),
    ) as HTMLButtonElement | undefined;

    if (!zeroSpacingButton) {
      throw new Error("未找到零间距按钮");
    }

    zeroSpacingButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushAsyncWork();

    expect(lastConfig.layout_options?.spacing_mode).toBe("none");
  });
});
