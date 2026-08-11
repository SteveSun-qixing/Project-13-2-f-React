import { describe, expect, it, vi } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import type { BasecardConfig } from "../../src/schema/card-config";

function createConfig(patch: Partial<BasecardConfig> = {}): BasecardConfig {
  return {
    card_type: "VideoCard",
    theme: "",
    video_file: "",
    cover_image: "",
    subtitles: [],
    playback: {
      autoplay: false,
      loop: false,
      muted: false,
      playback_rate: 1,
      start_time: 0,
    },
    video_title: "",
    publish_time: "",
    creator: "",
    ...patch,
  };
}

describe("mountBasecardView", () => {
  it("renders cover metadata and delegates open requests", async () => {
    const container = document.createElement("div");
    const openResource = vi.fn();
    const config = createConfig({
      video_file: "demo.mp4",
      cover_image: "demo-cover.jpg",
      subtitles: [
        {
          id: "zh",
          label: "简体中文",
          language: "zh-CN",
          kind: "subtitles",
          file_path: "demo.zh.vtt",
          default: true,
        },
      ],
      playback: {
        autoplay: true,
        loop: true,
        muted: true,
        playback_rate: 1.25,
        start_time: 8,
      },
      video_title: "旅行日志",
      publish_time: "2026-04-18",
      creator: "薯片工作室",
    });

    const dispose = mountBasecardView({
      container,
      config,
      openResource,
    });
    await Promise.resolve();
    const titleEl = container.querySelector(".chips-video-card__title");
    const metaEl = container.querySelector(".chips-video-card__meta");
    const buttonEl = container.querySelector(".chips-video-card__surface-button") as HTMLButtonElement | null;
    const posterEl = container.querySelector(
      ".chips-video-card__poster",
    ) as HTMLImageElement | null;

    expect(titleEl?.textContent).toBe("旅行日志");
    expect(metaEl?.textContent).toBe("薯片工作室 · 2026-04-18");
    expect(posterEl?.getAttribute("src")).toBe("demo-cover.jpg");

    buttonEl?.click();

    expect(openResource).toHaveBeenCalledWith({
      resourceId: "demo.mp4",
      mimeType: "video/mp4",
      title: "旅行日志",
      fileName: "demo.mp4",
      payload: expect.objectContaining({
        kind: "chips.video-card",
        cardType: "base.video",
        resources: expect.objectContaining({
          video: expect.objectContaining({
            resourceId: "demo.mp4",
            relativePath: "demo.mp4",
          }),
          cover: expect.objectContaining({
            resourceId: "demo-cover.jpg",
            relativePath: "demo-cover.jpg",
          }),
          subtitles: [
            expect.objectContaining({
              id: "zh",
              resourceId: "demo.zh.vtt",
              relativePath: "demo.zh.vtt",
            }),
          ],
        }),
        playback: expect.objectContaining({
          autoplay: true,
          loop: true,
          muted: true,
          playbackRate: 1.25,
          startTime: 8,
        }),
      }),
    });

    dispose();
  });

  it("resolves and releases internal resources without persisting temporary urls into the payload", async () => {
    const container = document.createElement("div");
    const openResource = vi.fn();
    const releaseResourceUrl = vi.fn();
    const resolveResourceUrl = vi.fn(async (resourcePath: string) => `blob:resolved/${resourcePath}`);
    const config = createConfig({
      video_file: "videos/demo.mp4",
      cover_image: "videos/demo-cover.jpg",
      subtitles: [
        {
          id: "en",
          label: "English",
          language: "en-US",
          kind: "captions",
          file_path: "videos/demo.en.vtt",
          default: true,
        },
      ],
      video_title: "Demo",
    });

    const dispose = mountBasecardView({
      container,
      config,
      resolveResourceUrl,
      releaseResourceUrl,
      openResource,
    });

    await Promise.resolve();
    await Promise.resolve();

    const buttonEl = container.querySelector(".chips-video-card__surface-button") as HTMLButtonElement | null;
    buttonEl?.click();

    expect(resolveResourceUrl).toHaveBeenCalledWith("videos/demo.mp4");
    expect(resolveResourceUrl).toHaveBeenCalledWith("videos/demo-cover.jpg");
    expect(resolveResourceUrl).not.toHaveBeenCalledWith("videos/demo.en.vtt");
    expect(openResource).toHaveBeenCalledWith(expect.objectContaining({
      resourceId: "videos/demo.mp4",
      payload: expect.objectContaining({
        resources: expect.objectContaining({
          video: expect.objectContaining({
            resourceId: "videos/demo.mp4",
            relativePath: "videos/demo.mp4",
          }),
          cover: expect.objectContaining({
            resourceId: "videos/demo-cover.jpg",
            relativePath: "videos/demo-cover.jpg",
          }),
          subtitles: [
            expect.objectContaining({
              resourceId: "videos/demo.en.vtt",
              relativePath: "videos/demo.en.vtt",
            }),
          ],
        }),
      }),
    }));

    dispose();
    expect(releaseResourceUrl).toHaveBeenCalledWith("videos/demo.mp4");
    expect(releaseResourceUrl).toHaveBeenCalledWith("videos/demo-cover.jpg");
    expect(releaseResourceUrl).not.toHaveBeenCalledWith("videos/demo.en.vtt");
  });

  it("shows a skeleton placeholder while the poster is being resolved", async () => {
    const container = document.createElement("div");
    const resolveResourceUrl = vi.fn(() => new Promise<string>(() => undefined));
    const config = createConfig({
      video_file: "demo.mp4",
      cover_image: "demo-cover.jpg",
    });

    const dispose = mountBasecardView({
      container,
      config,
      resolveResourceUrl,
    });
    await Promise.resolve();

    const skeletonEl = container.querySelector(".chips-video-card__poster-skeleton");
    expect(skeletonEl).not.toBeNull();
    expect(container.querySelector(".chips-video-card__empty")).toBeNull();

    dispose();
  });

  it("renders the empty state when no video is configured", () => {
    const container = document.createElement("div");

    const dispose = mountBasecardView({
      container,
      config: createConfig(),
    });

    const emptyEl = container.querySelector(".chips-video-card__empty");
    expect(emptyEl?.textContent).toContain("还没有视频内容，请先上传一个视频文件。");

    dispose();
  });
});
