import { describe, it, expect } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import { mountBasecardEditor } from "../../src/editor/runtime";
import type { BasecardConfig } from "../../src/schema/card-config";

function createConfig(patch: Partial<BasecardConfig> = {}): BasecardConfig {
  return {
    card_type: "HyperlinkCard",
    anchor_text: "Initial",
    url: "https://example.com",
    description: "",
    icon_url: "",
    open_mode: "external-browser",
    display_density: "comfortable",
    show_security_hint: true,
    locale: "zh-CN",
    theme: "",
    ...patch,
  };
}

function getInputByLabel(root: HTMLElement, text: string): HTMLInputElement {
  const labels = Array.from(root.querySelectorAll(".chips-basecard-editor__field-label"));
  const label = labels.find((item) => item.textContent?.includes(text));
  const input = label?.parentElement?.querySelector("input");
  if (!input) {
    throw new Error(`找不到字段输入框：${text}`);
  }
  return input;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("basecard integration flow", () => {
  it("updates the rendered hyperlink when editor emits valid config", () => {
    const container = document.createElement("div");
    const editorContainer = document.createElement("div");
    const openResource = () => undefined;

    const initialConfig = createConfig();
    let currentConfig: BasecardConfig = initialConfig;

    mountBasecardView({
      container,
      config: currentConfig,
      openResource,
    });

    mountBasecardEditor({
      container: editorContainer,
      initialConfig,
      onChange: (next) => {
        currentConfig = next;
        mountBasecardView({
          container,
          config: currentConfig,
          openResource,
        });
      },
    });

    const anchorInput = getInputByLabel(editorContainer, "锚文本");
    const urlInput = getInputByLabel(editorContainer, "链接");

    setInputValue(anchorInput, "Updated");
    setInputValue(urlInput, "https://example.com/updated");

    const buttonEl = container.querySelector("button") as HTMLButtonElement | null;
    expect(buttonEl?.textContent).toContain("Updated");
    expect(currentConfig.url).toBe("https://example.com/updated");
    expect(currentConfig.show_security_hint).toBe(true);
  });
});
