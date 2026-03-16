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
}

describe("image basecard integration flow", () => {
  let editorRoot: DisposableRoot | null = null;
  let viewCleanup: (() => void) | null = null;

  beforeEach(() => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "zh-CN",
    });
  });

  afterEach(() => {
    editorRoot?.__chipsDispose?.();
    editorRoot?.remove();
    editorRoot = null;
    viewCleanup?.();
    viewCleanup = null;
    document.body.innerHTML = "";
  });

  it("propagates imported root-level resource paths from the editor to the rendered view", async () => {
    const viewContainer = document.createElement("div");
    const editorContainer = document.createElement("div");
    document.body.appendChild(viewContainer);
    document.body.appendChild(editorContainer);

    let currentConfig = createConfig();
    viewCleanup = mountBasecardView({
      container: viewContainer,
      config: currentConfig,
    });

    editorRoot = createBasecardEditorRoot({
      initialConfig: currentConfig,
      onChange: (next) => {
        currentConfig = next;
        viewCleanup?.();
        viewCleanup = mountBasecardView({
          container: viewContainer,
          config: currentConfig,
        });
      },
      importResource: async ({ preferredPath }) => ({
        path: preferredPath ?? "asset.png",
      }),
      resolveResourceUrl: async (resourcePath) => `blob:${resourcePath}`,
      deleteResource: async () => undefined,
    }) as DisposableRoot;

    editorContainer.appendChild(editorRoot);

    const addInput = editorRoot.querySelectorAll(
      "input[type='file']",
    )[0] as HTMLInputElement | undefined;
    if (!addInput) {
      throw new Error("未找到上传输入框");
    }

    const file = new File(["image-bytes"], "gallery-shot.webp", {
      type: "image/webp",
    });
    Object.defineProperty(addInput, "files", {
      configurable: true,
      value: [file],
    });
    addInput.dispatchEvent(new Event("change", { bubbles: true }));

    await flushAsyncWork();

    expect(currentConfig.images).toHaveLength(1);
    expect(currentConfig.images[0]?.file_path).toBe("gallery-shot.webp");
    expect(viewContainer.querySelector("img")?.getAttribute("src")).toBe("gallery-shot.webp");
  });
});
