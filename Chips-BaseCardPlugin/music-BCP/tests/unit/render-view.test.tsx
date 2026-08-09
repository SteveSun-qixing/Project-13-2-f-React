import { describe, expect, it, vi } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import type { BasecardConfig } from "../../src/schema/card-config";

function flushViewEffects(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 20);
  });
}

function flushDelayedViewEffects(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 240);
  });
}

describe("mountBasecardView", () => {
  it("renders title, artist, metadata and opens the resolved audio resource", async () => {
    const container = document.createElement("div");
    const openResource = vi.fn();
    const config: BasecardConfig = {
      card_type: "MusicCard",
      theme: "",
      audio_file: "tracks/demo.mp3",
      music_name: "Evergreen",
      album_cover: "covers/demo.jpg",
      lyrics_file: "",
      production_team: [
        {
          id: "team-1",
          role: "歌手",
          people: ["Alice"],
        },
      ],
      release_date: "2026-04-18",
      album_name: "Aurora",
      language: "日语",
      genre: "流行",
    };

    const dispose = mountBasecardView({
      container,
      config,
      resolveResourceUrl: async (resourcePath) => `file:///tmp/${resourcePath}`,
      openResource,
    });

    await flushViewEffects();

    expect(container.querySelector(".chips-music-card__title")?.textContent).toBe("Evergreen");
    expect(container.querySelector(".chips-music-card__artist")?.textContent).toBe("Alice");
    expect(container.textContent).toContain("Aurora");
    expect(container.textContent).toContain("日语");
    expect(container.textContent).toContain("流行");

    const button = container.querySelector(".chips-music-card__surface-button") as HTMLButtonElement | null;
    if (!button) {
      throw new Error("找不到音乐基础卡片按钮");
    }

    button.click();

    expect(openResource).toHaveBeenCalledWith({
      resourceId: "file:///tmp/tracks/demo.mp3",
      mimeType: "audio/mpeg",
      title: "Evergreen",
      fileName: "demo.mp3",
      payload: {
        kind: "chips.music-card",
        version: "1.0.0",
        cardType: "base.music",
        config: expect.objectContaining({
          audio_file: "tracks/demo.mp3",
          album_cover: "covers/demo.jpg",
          album_name: "Aurora",
        }),
        resources: expect.objectContaining({
          audio: expect.objectContaining({
            resourceId: "file:///tmp/tracks/demo.mp3",
            relativePath: "tracks/demo.mp3",
          }),
          cover: expect.objectContaining({
            resourceId: "file:///tmp/covers/demo.jpg",
            relativePath: "covers/demo.jpg",
          }),
        }),
        display: {
          title: "Evergreen",
          artist: "Alice",
        },
      },
    });

    dispose();
  });

  it("falls back to the default placeholder cover when no album cover is configured", async () => {
    const container = document.createElement("div");
    const config: BasecardConfig = {
      card_type: "MusicCard",
      theme: "",
      audio_file: "tracks/demo.m4a",
      music_name: "Sea Glass",
      album_cover: "",
      lyrics_file: "",
      production_team: [],
      release_date: "",
      album_name: "",
      language: "",
      genre: "",
    };

    const dispose = mountBasecardView({
      container,
      config,
    });

    await flushViewEffects();

    const coverImage = container.querySelector(".chips-music-card__cover-image") as HTMLImageElement | null;
    expect(coverImage?.getAttribute("src")).toContain("music-cover-placeholder");

    dispose();
  });

  it("falls back to the audio file name when the music name is empty", async () => {
    const container = document.createElement("div");
    const dispose = mountBasecardView({
      container,
      config: {
        card_type: "MusicCard",
        theme: "",
        audio_file: "tracks/fallback-name.mp3",
        music_name: "",
        album_cover: "",
        lyrics_file: "",
        production_team: [],
        release_date: "",
        album_name: "",
        language: "",
        genre: "",
      },
    });

    await flushViewEffects();

    expect(container.querySelector(".chips-music-card__title")?.textContent).toBe("fallback-name");

    dispose();
  });

  it("retries resolving the audio resource before enabling the open action", async () => {
    const container = document.createElement("div");
    const openResource = vi.fn();
    let resolveCount = 0;

    const dispose = mountBasecardView({
      container,
      config: {
        card_type: "MusicCard",
        theme: "",
        audio_file: "tracks/retry.mp3",
        music_name: "Retry Song",
        album_cover: "",
        lyrics_file: "",
        production_team: [],
        release_date: "",
        album_name: "",
        language: "",
        genre: "",
      },
      resolveResourceUrl: async (resourcePath) => {
        if (resourcePath === "tracks/retry.mp3") {
          resolveCount += 1;
          if (resolveCount < 3) {
            throw new Error("资源尚未就绪");
          }
        }

        return `file:///tmp/${resourcePath}`;
      },
      openResource,
    });

    await flushDelayedViewEffects();

    const button = container.querySelector(".chips-music-card__surface-button") as HTMLButtonElement | null;
    if (!button) {
      throw new Error("找不到音乐基础卡片按钮");
    }

    button.click();

    expect(resolveCount).toBe(3);
    expect(openResource).toHaveBeenCalledWith({
      resourceId: "file:///tmp/tracks/retry.mp3",
      mimeType: "audio/mpeg",
      title: "Retry Song",
      fileName: "retry.mp3",
      payload: expect.objectContaining({
        kind: "chips.music-card",
        resources: expect.objectContaining({
          audio: expect.objectContaining({
            resourceId: "file:///tmp/tracks/retry.mp3",
            relativePath: "tracks/retry.mp3",
          }),
        }),
      }),
    });

    dispose();
  });

  it("releases bridge-backed resource urls on view cleanup", async () => {
    const container = document.createElement("div");
    const releaseResourceUrl = vi.fn();

    const dispose = mountBasecardView({
      container,
      config: {
        card_type: "MusicCard",
        theme: "",
        audio_file: "tracks/demo.mp3",
        music_name: "Blob Preview",
        album_cover: "cover.png",
        lyrics_file: "",
        production_team: [],
        release_date: "",
        album_name: "",
        language: "",
        genre: "",
      },
      resolveResourceUrl: async (resourcePath) => `blob:file:///${resourcePath}`,
      releaseResourceUrl,
    });

    await flushViewEffects();

    const coverImage = container.querySelector(".chips-music-card__cover-image") as HTMLImageElement | null;
    expect(coverImage?.getAttribute("src")).toBe("blob:file:///cover.png");
    expect(releaseResourceUrl).not.toHaveBeenCalled();

    dispose();

    expect(releaseResourceUrl).toHaveBeenCalledWith("tracks/demo.mp3");
    expect(releaseResourceUrl).toHaveBeenCalledWith("cover.png");
  });
});
