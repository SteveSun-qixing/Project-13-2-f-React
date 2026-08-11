// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBasecardEditorRoot } from "../../src/editor/panel";
import type { BasecardConfig } from "../../src/schema/card-config";

type DisposableRoot = HTMLElement & {
  __chipsDispose?: () => void;
};

function createConfig(overrides?: Partial<BasecardConfig>): BasecardConfig {
  return {
    card_type: "WebPageCard",
    theme: "",
    source_type: "url",
    source_url: "",
    bundle_root: "",
    entry_file: "index.html",
    resource_paths: [],
    display_mode: "fixed",
    fixed_ratio: "7:16",
    max_height_ratio: 20,
    ...overrides,
  };
}

async function flushAsyncWork(waitMs = 0): Promise<void> {
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function clickSegmentedOption(root: HTMLElement, selector: string): void {
  const marker = root.querySelector(selector);
  const item = marker?.closest(".ant-segmented-item") as HTMLElement | null;
  if (!item) {
    throw new Error(`未找到分段控件选项：${selector}`);
  }

  item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("createBasecardEditorRoot", () => {
  const mountedRoots: DisposableRoot[] = [];

  afterEach(() => {
    for (const root of mountedRoots) {
      root.__chipsDispose?.();
      root.remove();
    }
    mountedRoots.length = 0;
    document.body.innerHTML = "";
  });

  it("auto refreshes a remote webpage URL and clears previous bundle resources", async () => {
    let lastConfig = createConfig({
      source_type: "bundle",
      bundle_root: "old-bundle",
      entry_file: "index.html",
      resource_paths: [
        "old-bundle/index.html",
        "old-bundle/assets/app.js",
      ],
    });
    const deleteResource = vi.fn(async () => undefined);

    const root = createBasecardEditorRoot({
      initialConfig: lastConfig,
      onChange: (next) => {
        lastConfig = next;
      },
      deleteResource,
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    clickSegmentedOption(root, '[data-source-mode="url"]');
    await flushAsyncWork();

    const urlInput = root.querySelector(".chips-webpage-editor__url-field input") as HTMLInputElement | null;
    if (!urlInput) {
      throw new Error("未找到网页地址输入区域");
    }

    setInputValue(urlInput, "https://example.com/demo");
    await flushAsyncWork(430);

    expect(deleteResource).toHaveBeenCalledTimes(2);
    expect(lastConfig.source_type).toBe("url");
    expect(lastConfig.source_url).toBe("https://example.com/demo");
    expect(lastConfig.resource_paths).toEqual([]);
  });

  it("shows only the matching input area for the selected source mode", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig(),
      onChange: () => undefined,
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    expect(root.querySelector(".chips-webpage-editor__url-field")).not.toBeNull();
    expect(root.querySelector(".chips-webpage-editor__dropzone")).toBeNull();

    clickSegmentedOption(root, '[data-source-mode="bundle"]');
    await flushAsyncWork();

    expect(root.querySelector(".chips-webpage-editor__url-field")).toBeNull();
    expect(root.querySelector(".chips-webpage-editor__dropzone")).not.toBeNull();

    clickSegmentedOption(root, '[data-source-mode="url"]');
    await flushAsyncWork();

    expect(root.querySelector(".chips-webpage-editor__url-field")).not.toBeNull();
    expect(root.querySelector(".chips-webpage-editor__dropzone")).toBeNull();
  });

  it("switches between fixed ratio and free expand display modes", async () => {
    let lastConfig = createConfig();
    const root = createBasecardEditorRoot({
      initialConfig: lastConfig,
      onChange: (next) => {
        lastConfig = next;
      },
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    clickSegmentedOption(root, '[data-display-mode="free"]');
    await flushAsyncWork();

    expect(lastConfig.display_mode).toBe("free");
    expect(lastConfig.fixed_ratio).toBe("7:16");

    clickSegmentedOption(root, '[data-display-mode="fixed"]');
    await flushAsyncWork();

    expect(lastConfig.display_mode).toBe("fixed");
  });

  it("clears the source and syncs the segmented mode back to url", async () => {
    let lastConfig = createConfig({
      source_type: "bundle",
      bundle_root: "old-bundle",
      entry_file: "index.html",
      resource_paths: ["old-bundle/index.html", "old-bundle/assets/app.js"],
    });
    const deleteResource = vi.fn(async () => undefined);

    const root = createBasecardEditorRoot({
      initialConfig: lastConfig,
      onChange: (next) => {
        lastConfig = next;
      },
      deleteResource,
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    clickSegmentedOption(root, '[data-source-mode="bundle"]');
    await flushAsyncWork();

    const clearButton = Array.from(root.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("清除来源"));
    if (!clearButton) {
      throw new Error("未找到清除来源按钮");
    }

    clearButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushAsyncWork();

    expect(deleteResource).toHaveBeenCalledTimes(2);
    expect(lastConfig.source_type).toBe("url");
    expect(lastConfig.source_url).toBe("");
    expect(lastConfig.resource_paths).toEqual([]);
    expect(root.querySelector(".chips-webpage-editor__url-field")).not.toBeNull();
    expect(root.querySelector(".chips-webpage-editor__dropzone")).toBeNull();
  });

  it("imports a webpage bundle in file mode and replaces previous bundle resources", async () => {
    let lastConfig = createConfig({
      source_type: "bundle",
      bundle_root: "old-bundle",
      entry_file: "index.html",
      resource_paths: [
        "old-bundle/index.html",
        "old-bundle/assets/app.js",
      ],
    });
    const importArchiveBundle = vi.fn(async () => ({
      rootDir: "webpage-bundle-abc123",
      entryFile: "index.html",
      resourcePaths: [
        "webpage-bundle-abc123/index.html",
        "webpage-bundle-abc123/assets/app.js",
      ],
      entries: [],
      discardedEntries: [],
    }));
    const deleteResource = vi.fn(async () => undefined);

    const root = createBasecardEditorRoot({
      initialConfig: lastConfig,
      onChange: (next) => {
        lastConfig = next;
      },
      importArchiveBundle,
      deleteResource,
    }) as DisposableRoot;
    mountedRoots.push(root);
    document.body.appendChild(root);

    const fileInput = root.querySelector("input[type='file']") as HTMLInputElement | null;
    if (!fileInput) {
      throw new Error("未找到网页 ZIP 上传输入框");
    }

    const file = new File(["zip"], "website.zip", { type: "application/zip" });
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: [file],
    });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

    await flushAsyncWork();

    expect(importArchiveBundle).toHaveBeenCalledWith({
      file,
      preferredRootDir: "webpage-bundle",
      entryFile: "index.html",
      include: {
        mimeTypes: expect.arrayContaining([
          "text/html",
          "text/css",
          "application/javascript",
          "image/png",
          "font/woff2",
          "font/ttf",
          "video/mp4",
          "audio/mpeg",
          "application/wasm",
          "application/pdf",
        ]),
        extensions: expect.arrayContaining([
          ".html",
          ".css",
          ".js",
          ".png",
          ".woff2",
          ".ttf",
          ".otf",
          ".eot",
          ".mp4",
          ".webm",
          ".mp3",
          ".ogg",
          ".wav",
          ".wasm",
          ".pdf",
          ".map",
        ]),
      },
      stripSingleRootDir: true,
      excludeSystemArtifacts: true,
    });
    expect(deleteResource).toHaveBeenCalledTimes(2);
    expect(lastConfig.source_type).toBe("bundle");
    expect(lastConfig.bundle_root).toBe("webpage-bundle-abc123");
    expect(lastConfig.resource_paths).toEqual([
      "webpage-bundle-abc123/index.html",
      "webpage-bundle-abc123/assets/app.js",
    ]);
  });
});
