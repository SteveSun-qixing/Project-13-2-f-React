// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import type { BasecardConfig } from "../../src/schema/card-config";

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

    expect(resolveResourceUrl).toHaveBeenCalledTimes(2);
    expect(image.getAttribute("src")).toBe("blob:cover.png:fresh");

    cleanup();
  });
});
