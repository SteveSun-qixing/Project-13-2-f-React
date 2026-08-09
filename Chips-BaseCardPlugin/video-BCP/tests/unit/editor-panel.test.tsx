import { describe, expect, it, vi } from "vitest";
import { createBasecardEditorRoot } from "../../src/editor/panel";
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

function queryTextFieldInput(root: ParentNode, role: string): HTMLInputElement | null {
  return root.querySelector(`[data-role="${role}"]`);
}

function setTextFieldValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function waitForVideoPreviewSrc(root: ParentNode, expectedSrc: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const src = root.querySelector('[data-role="video-resource"] video')?.getAttribute("src");
    if (src === expectedSrc) {
      return;
    }
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  expect(root.querySelector('[data-role="video-resource"] video')?.getAttribute("src")).toBe(expectedSrc);
}

describe("createBasecardEditorRoot", () => {
  it("emits metadata changes only after the user leaves the metadata form", async () => {
    const initialConfig = createConfig({
      video_file: "demo.mp4",
      cover_image: "demo-cover.jpg",
      video_title: "Title",
    });

    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig,
      onChange: (next) => {
        lastConfig = next;
      },
    });
    document.body.appendChild(root);

    const titleInput = queryTextFieldInput(root, "video-title-input");

    if (!titleInput) {
      throw new Error("找不到视频标题输入框");
    }

    setTextFieldValue(titleInput, "New Title");

    expect(lastConfig).toBeUndefined();

    titleInput.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await Promise.resolve();

    expect(lastConfig?.video_title).toBe("New Title");
    expect(lastConfig?.card_type).toBe("VideoCard");

    root.remove();
  });

  it("imports the video without generating a cover when the host thumbnail capability is unavailable", async () => {
    const importResource = vi.fn(async (input: { preferredPath?: string }) => ({
      path: input.preferredPath ?? "resource.bin",
    }));

    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig: {
        ...createConfig(),
      },
      onChange(next) {
        lastConfig = next;
      },
      importResource,
    });

    const input = root.querySelector('[data-role="video-input"]') as HTMLInputElement | null;
    if (!input) {
      throw new Error("找不到视频上传输入框");
    }

    const videoFile = new File(["video"], "demo.mp4", { type: "video/mp4" });
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [videoFile],
    });

    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(importResource).toHaveBeenCalledTimes(1);
    expect(lastConfig).toMatchObject({
      card_type: "VideoCard",
      video_file: "demo.mp4",
      cover_image: "",
    });
    await waitForVideoPreviewSrc(root, "demo.mp4");
    expect(root.querySelector('[data-role="cover-resource"]')).toBeNull();
  });

  it("imports the video and stores the host generated thumbnail as the default cover", async () => {
    const importResource = vi.fn(async (input: { preferredPath?: string }) => ({
      path: input.preferredPath ?? "resource.bin",
    }));
    const extractVideoThumbnail = vi.fn(async (input: { outputPath: string }) => ({
      path: input.outputPath,
      mimeType: "image/png" as const,
      sourceMimeType: "video/mp4",
      width: 1280,
      height: 720,
      format: "png" as const,
      frameTimeSeconds: 0,
    }));

    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig: {
        ...createConfig(),
      },
      onChange(next) {
        lastConfig = next;
      },
      importResource,
      extractVideoThumbnail,
    });

    const input = root.querySelector('[data-role="video-input"]') as HTMLInputElement | null;
    if (!input) {
      throw new Error("找不到视频上传输入框");
    }

    const videoFile = new File(["video"], "demo.mp4", { type: "video/mp4" });
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [videoFile],
    });

    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(importResource).toHaveBeenCalledTimes(1);
    expect(extractVideoThumbnail).toHaveBeenCalledWith({
      resourcePath: "demo.mp4",
      outputPath: "demo-cover.png",
      overwrite: true,
      options: {
        timeSeconds: 0,
        format: "png",
        width: 1280,
        height: 720,
        fit: "cover",
      },
    });
    expect(lastConfig).toMatchObject({
      card_type: "VideoCard",
      video_file: "demo.mp4",
      cover_image: "demo-cover.png",
    });

    root.remove();
  });

  it("keeps the imported video when host thumbnail generation fails", async () => {
    const importResource = vi.fn(async (input: { preferredPath?: string }) => ({
      path: input.preferredPath ?? "resource.bin",
    }));
    const extractVideoThumbnail = vi.fn(async () => {
      throw new Error("host thumbnail unavailable");
    });

    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig: {
        ...createConfig(),
      },
      onChange(next) {
        lastConfig = next;
      },
      importResource,
      extractVideoThumbnail,
    });

    const input = root.querySelector('[data-role="video-input"]') as HTMLInputElement | null;
    if (!input) {
      throw new Error("找不到视频上传输入框");
    }

    const videoFile = new File(["video"], "demo.mp4", { type: "video/mp4" });
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [videoFile],
    });

    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(importResource).toHaveBeenCalledTimes(1);
    expect(extractVideoThumbnail).toHaveBeenCalledTimes(1);
    expect(lastConfig).toMatchObject({
      card_type: "VideoCard",
      video_file: "demo.mp4",
      cover_image: "",
    });
    expect(root.textContent).toContain("host thumbnail unavailable");

    root.remove();
  });

  it("imports a video resource from a URL input", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob(["video"], { type: "video/mp4" }),
      headers: new Headers(),
    }));

    vi.stubGlobal("fetch", fetchMock);

    const importResource = vi.fn(async (input: { preferredPath?: string }) => ({
      path: input.preferredPath ?? "resource.bin",
    }));

    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig: {
        ...createConfig(),
      },
      onChange(next) {
        lastConfig = next;
      },
      importResource,
    });

    const urlInput = queryTextFieldInput(root, "video-url-input");
    const submitButton = root.querySelector('[data-role="video-url-submit"] button, button[data-role="video-url-submit"]') as HTMLButtonElement | null;

    if (!urlInput || !submitButton) {
      throw new Error("找不到视频 URL 导入控件");
    }

    setTextFieldValue(urlInput, "https://example.com/demo.mp4");
    await Promise.resolve();
    submitButton.click();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/demo.mp4");
    expect(importResource).toHaveBeenCalledTimes(1);
    expect(lastConfig).toMatchObject({
      card_type: "VideoCard",
      video_file: "demo.mp4",
      cover_image: "",
    });

    root.remove();
    vi.unstubAllGlobals();
  });

  it("imports subtitle resources and edits playback parameters", async () => {
    const importResource = vi.fn(async (input: { preferredPath?: string }) => ({
      path: input.preferredPath ?? "resource.bin",
    }));

    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        video_file: "demo.mp4",
      }),
      onChange(next) {
        lastConfig = next;
      },
      importResource,
    });

    const subtitleInput = root.querySelector('[data-role="subtitle-input"]') as HTMLInputElement | null;
    if (!subtitleInput) {
      throw new Error("找不到字幕上传输入框");
    }

    const subtitleFile = new File(["WEBVTT"], "demo.zh.vtt", { type: "text/vtt" });
    Object.defineProperty(subtitleInput, "files", {
      configurable: true,
      value: [subtitleFile],
    });
    subtitleInput.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lastConfig?.subtitles).toHaveLength(1);
    expect(lastConfig?.subtitles[0]).toMatchObject({
      file_path: "demo.zh.vtt",
      default: true,
    });

    const switches = Array.from(root.querySelectorAll(".ant-switch")) as HTMLButtonElement[];
    const autoplaySwitch = switches[1] ?? null;
    if (!autoplaySwitch) {
      throw new Error("找不到播放参数开关");
    }

    autoplaySwitch.click();
    autoplaySwitch.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await Promise.resolve();

    expect(lastConfig?.playback.autoplay).toBe(true);
  });
});
