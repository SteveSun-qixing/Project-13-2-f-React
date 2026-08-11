// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBasecardEditorRoot } from "../../src/editor/panel";
import { mountBasecardView } from "../../src/render/runtime";
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

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("webpage basecard integration flow", () => {
  let editorRoot: DisposableRoot | null = null;
  let viewCleanup: (() => void) | null = null;

  beforeEach(() => {
    (globalThis as typeof globalThis & { chips?: unknown }).chips = {
      invoke: async () => ({
        content: "<!doctype html><html><head></head><body><article>bundle-page</article></body></html>",
      }),
    };
  });

  afterEach(() => {
    editorRoot?.__chipsDispose?.();
    editorRoot?.remove();
    editorRoot = null;
    viewCleanup?.();
    viewCleanup = null;
    document.body.innerHTML = "";
    delete (globalThis as typeof globalThis & { chips?: unknown }).chips;
  });

  it("propagates imported bundle config from the editor to the rendered view", async () => {
    const viewContainer = document.createElement("div");
    const editorContainer = document.createElement("div");
    document.body.appendChild(viewContainer);
    document.body.appendChild(editorContainer);

    let currentConfig = createConfig();
    viewCleanup = mountBasecardView({
      container: viewContainer,
      config: currentConfig,
      resolveResourceUrl: async () => "chips-render://card-root/card-token/web-bundle/index.html",
    });

    editorRoot = createBasecardEditorRoot({
      initialConfig: currentConfig,
      onChange: (next) => {
        currentConfig = next;
        viewCleanup?.();
        viewCleanup = mountBasecardView({
          container: viewContainer,
          config: currentConfig,
          resolveResourceUrl: async () => "chips-render://card-root/card-token/webpage-bundle-abc123/index.html",
        });
      },
      importArchiveBundle: async () => ({
        rootDir: "webpage-bundle-abc123",
        entryFile: "index.html",
        resourcePaths: [
          "webpage-bundle-abc123/index.html",
          "webpage-bundle-abc123/assets/app.js",
        ],
        entries: [],
        discardedEntries: [],
      }),
      deleteResource: async () => undefined,
    }) as DisposableRoot;

    editorContainer.appendChild(editorRoot);

    const bundleModeButton = editorRoot.querySelector(
      '[data-source-mode="bundle"]',
    )?.closest(".ant-segmented-item") as HTMLElement | null;
    bundleModeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushAsyncWork();

    const fileInput = editorRoot.querySelector("input[type='file']") as HTMLInputElement | null;
    if (!fileInput) {
      throw new Error("未找到网页 ZIP 上传输入框");
    }

    const file = new File(["zip"], "site.zip", { type: "application/zip" });
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: [file],
    });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

    await flushAsyncWork();

    expect(currentConfig.bundle_root).toBe("webpage-bundle-abc123");
    expect(viewContainer.querySelector("iframe")?.getAttribute("src")).toBe(
      "chips-render://card-root/card-token/webpage-bundle-abc123/index.html",
    );
  });
});
