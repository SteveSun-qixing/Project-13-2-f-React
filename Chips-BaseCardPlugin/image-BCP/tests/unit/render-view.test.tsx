// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import type { BasecardConfig } from "../../src/schema/card-config";

function createConfig(overrides?: Partial<BasecardConfig>): BasecardConfig {
  return {
    card_type: "ImageCard",
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

describe("mountBasecardView", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "zh-CN",
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  async function flushAsyncWork(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("renders the localized empty state", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig(),
    });

    expect(container.querySelector(".chips-image-card__empty-text")?.textContent).toBe("暂无图片内容");

    cleanup();
  });

  it("uses single layout automatically when only one image is present", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        layout_type: "grid",
        images: [
          {
            id: "image-1",
            source: "url",
            url: "https://example.com/hero.png",
            title: "Hero",
            alt: "Hero",
          },
        ],
      }),
    });

    expect(container.querySelector(".chips-image-card__single")).not.toBeNull();
    expect(container.querySelector(".chips-image-card__grid")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://example.com/hero.png");

    cleanup();
  });

  it("shows the overflow badge for limited grid layouts", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        layout_type: "grid",
        images: Array.from({ length: 6 }, (_, index) => ({
          id: `image-${index + 1}`,
          source: "url" as const,
          url: `https://example.com/${index + 1}.png`,
        })),
      }),
    });

    const grid = container.querySelector(".chips-image-card__grid");
    const cells = Array.from(container.querySelectorAll(".chips-image-card__grid-cell"));
    const overflowBadge = container.querySelector(".chips-image-card__overflow-badge");

    expect(grid).not.toBeNull();
    expect(cells).toHaveLength(4);
    expect(overflowBadge?.textContent).toBe("+3");
    expect(cells.at(-1)?.contains(overflowBadge)).toBe(true);

    cleanup();
  });

  it("uses flush spacing without rounded corners when spacing mode is none", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        layout_type: "grid",
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
        layout_options: {
          ...createConfig().layout_options,
          spacing_mode: "none",
        },
      }),
    });

    const grid = container.querySelector(".chips-image-card__grid") as HTMLElement | null;
    const frame = container.querySelector(".chips-image-card__image-frame") as HTMLElement | null;
    expect(grid?.style.gap).toBe("0px");
    expect(frame?.style.borderRadius).toBe("0px");

    cleanup();
  });

  it("resolves file resources through the render context when available", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const resolveResourceUrl = async (resourcePath: string) => `blob:${resourcePath}`;
    const releaseResourceUrl = vi.fn();

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
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
      resolveResourceUrl,
      releaseResourceUrl,
    });

    await flushAsyncWork();

    expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:cover.png");

    cleanup();

    expect(releaseResourceUrl).toHaveBeenCalledWith("cover.png");
  });

  it("requests resource opening when the user clicks a resolved image resource", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const openResource = vi.fn();

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        images: [
          {
            id: "image-1",
            source: "file",
            file_path: "assets/cover.png",
            title: "Cover",
            alt: "Cover",
          },
        ],
      }),
      resolveResourceUrl: async (resourcePath: string) => `chips-render://card-root/test-token/${resourcePath}`,
      openResource,
    });

    await flushAsyncWork();

    const interactiveFrame = container.querySelector(".chips-image-card__image-frame") as HTMLDivElement | null;
    if (!interactiveFrame) {
      throw new Error("未找到可交互的图片容器");
    }

    interactiveFrame.click();

    expect(openResource).toHaveBeenCalledWith({
      resourceId: "assets/cover.png",
      mimeType: "image/png",
      title: "Cover",
      fileName: "cover.png",
    });

    cleanup();
  });

  it("does not forward an empty title when the image metadata is blank", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const openResource = vi.fn();

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        images: [
          {
            id: "image-1",
            source: "file",
            file_path: "assets/cover.png",
            title: "   ",
            alt: "",
          },
        ],
      }),
      resolveResourceUrl: async (resourcePath: string) => `chips-render://card-root/test-token/${resourcePath}`,
      openResource,
    });

    await flushAsyncWork();

    const interactiveFrame = container.querySelector(".chips-image-card__image-frame") as HTMLDivElement | null;
    if (!interactiveFrame) {
      throw new Error("未找到可交互的图片容器");
    }

    interactiveFrame.click();

    expect(openResource).toHaveBeenCalledWith({
      resourceId: "assets/cover.png",
      mimeType: "image/png",
      title: undefined,
      fileName: "cover.png",
    });

    cleanup();
  });

  it("renders long-scroll without nested fixed-height clipping", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        layout_type: "long-scroll",
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
      }),
    });

    const longScrollSurface = container.querySelector(".chips-image-card__long-scroll") as HTMLElement | null;
    expect(longScrollSurface).not.toBeNull();
    expect(longScrollSurface?.style.maxHeight).toBe("");

    cleanup();
  });

  it("retries resolving file resources after an image load failure", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const resolveResourceUrl = vi
      .fn(async (resourcePath: string) => `blob:${resourcePath}:stale`)
      .mockResolvedValueOnce("blob:cover.png:stale")
      .mockResolvedValueOnce("blob:cover.png:fresh");

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        images: [
          {
            id: "image-1",
            source: "file",
            file_path: "cover.png",
          },
        ],
      }),
      resolveResourceUrl,
      releaseResourceUrl: vi.fn(),
    });

    await flushAsyncWork();

    const image = container.querySelector("img") as HTMLImageElement | null;
    if (!image) {
      throw new Error("未找到渲染图片");
    }

    image.dispatchEvent(new Event("error"));
    await flushAsyncWork();

    const imageAfterRetry = container.querySelector("img") as HTMLImageElement | null;
    expect(resolveResourceUrl).toHaveBeenCalledTimes(2);
    expect(imageAfterRetry?.getAttribute("src")).toBe("blob:cover.png:fresh");

    cleanup();
  });

  it("shows the placeholder instead of a broken image for URL sources", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        images: [
          {
            id: "image-1",
            source: "url",
            url: "https://example.com/broken.png",
          },
        ],
      }),
    });

    const image = container.querySelector("img") as HTMLImageElement | null;
    if (!image) {
      throw new Error("未找到渲染图片");
    }

    image.dispatchEvent(new Event("error"));
    await flushAsyncWork();

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".chips-image-card__placeholder")?.textContent).toBe("图片暂时不可用");

    cleanup();
  });

  it("stops retrying and shows the placeholder after repeated load failures", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    let resolveCallCount = 0;
    const resolveResourceUrl = vi.fn(async (resourcePath: string) => {
      resolveCallCount += 1;
      return `blob:${resourcePath}:stale-${resolveCallCount}`;
    });

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        images: [
          {
            id: "image-1",
            source: "file",
            file_path: "cover.png",
          },
        ],
      }),
      resolveResourceUrl,
      releaseResourceUrl: vi.fn(),
    });

    await flushAsyncWork();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const image = container.querySelector("img") as HTMLImageElement | null;
      if (!image) {
        throw new Error(`第 ${attempt + 1} 次加载失败时未找到渲染图片`);
      }
      image.dispatchEvent(new Event("error"));
      await flushAsyncWork();
    }

    expect(resolveResourceUrl).toHaveBeenCalledTimes(4);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".chips-image-card__placeholder")?.textContent).toBe("图片暂时不可用");

    cleanup();
  });

  it("releases an in-flight retried URL when the view unmounts", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const releaseResourceUrl = vi.fn();
    let callIndex = 0;
    let pendingResolve: ((value: string) => void) | undefined;
    const resolveResourceUrl = vi.fn(async (resourcePath: string) => {
      callIndex += 1;
      if (callIndex === 2) {
        return new Promise<string>((resolve) => {
          pendingResolve = resolve;
        });
      }
      return `blob:${resourcePath}:stale`;
    });

    const cleanup = mountBasecardView({
      container,
      config: createConfig({
        images: [
          {
            id: "image-1",
            source: "file",
            file_path: "cover.png",
          },
        ],
      }),
      resolveResourceUrl,
      releaseResourceUrl,
    });

    await flushAsyncWork();

    const image = container.querySelector("img") as HTMLImageElement | null;
    if (!image) {
      throw new Error("未找到渲染图片");
    }

    image.dispatchEvent(new Event("error"));
    await flushAsyncWork();

    cleanup();

    pendingResolve?.("blob:cover.png:fresh");
    await flushAsyncWork();

    expect(releaseResourceUrl).toHaveBeenCalledTimes(3);
    expect(releaseResourceUrl).toHaveBeenCalledWith("cover.png");

    cleanup();
  });
});
