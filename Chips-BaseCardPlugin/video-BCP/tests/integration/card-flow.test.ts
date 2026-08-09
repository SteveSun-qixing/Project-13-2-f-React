import { describe, it, expect } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import { mountBasecardEditor } from "../../src/editor/runtime";
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

function setTextFieldValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("basecard integration flow", () => {
  it("updates view when the metadata form loses focus", async () => {
    const container = document.createElement("div");
    const editorContainer = document.createElement("div");
    document.body.appendChild(editorContainer);

    const initialConfig = createConfig({
      video_file: "demo.mp4",
      cover_image: "",
      video_title: "Initial",
    });

    let currentConfig: BasecardConfig = initialConfig;

    mountBasecardView({
      container,
      config: currentConfig,
    });

    mountBasecardEditor({
      container: editorContainer,
      initialConfig,
      onChange: (next) => {
        currentConfig = next;
        mountBasecardView({
          container,
          config: currentConfig,
        });
      },
    });

    const titleInput = editorContainer.querySelector(
      '[data-role="video-title-input"]'
    ) as HTMLInputElement | null;

    if (!titleInput) {
      throw new Error("找不到标题输入框");
    }

    setTextFieldValue(titleInput, "Updated");
    titleInput.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await Promise.resolve();

    const titleEl = container.querySelector(".chips-video-card__title");
    expect(titleEl?.textContent).toBe("Updated");

    editorContainer.remove();
  });
});
