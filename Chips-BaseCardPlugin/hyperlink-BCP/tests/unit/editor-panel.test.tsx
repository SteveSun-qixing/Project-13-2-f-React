import { describe, it, expect } from "vitest";
import { createBasecardEditorRoot } from "../../src/editor/panel";
import type { BasecardConfig } from "../../src/schema/card-config";

function createConfig(patch: Partial<BasecardConfig> = {}): BasecardConfig {
  return {
    card_type: "HyperlinkCard",
    anchor_text: "Chips",
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
  if (!label) {
    throw new Error(`找不到字段标签：${text}`);
  }

  const fieldRoot = label.parentElement;
  const input = fieldRoot?.querySelector("input");
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

function setTextAreaValue(textArea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(textArea, value);
  textArea.dispatchEvent(new Event("input", { bubbles: true }));
  textArea.dispatchEvent(new Event("change", { bubbles: true }));
}

function getTextAreaByLabel(root: HTMLElement, text: string): HTMLTextAreaElement {
  const labels = Array.from(root.querySelectorAll(".chips-basecard-editor__field-label"));
  const label = labels.find((item) => item.textContent?.includes(text));
  if (!label) {
    throw new Error(`找不到文本域标签：${text}`);
  }

  const fieldRoot = label.parentElement;
  const textArea = fieldRoot?.querySelector("textarea");
  if (!textArea) {
    throw new Error(`找不到文本域：${text}`);
  }

  return textArea;
}

describe("createBasecardEditorRoot", () => {
  it("emits full config changes when link fields are valid", () => {
    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig: createConfig(),
      onChange: (next) => {
        lastConfig = next;
      },
    });

    const anchorInput = getInputByLabel(root, "锚文本");
    const urlInput = getInputByLabel(root, "链接");
    const descriptionInput = getTextAreaByLabel(root, "描述");
    const iconInput = getInputByLabel(root, "图标 URL");

    setInputValue(anchorInput, "Chips Docs");
    setInputValue(urlInput, "https://example.com/docs");
    setTextAreaValue(descriptionInput, "Developer docs\n");
    setInputValue(iconInput, "https://example.com/favicon.png");

    expect(lastConfig).toMatchObject({
      card_type: "HyperlinkCard",
      anchor_text: "Chips Docs",
      url: "https://example.com/docs",
      description: "Developer docs\n",
      icon_url: "https://example.com/favicon.png",
      open_mode: "external-browser",
      display_density: "comfortable",
      show_security_hint: true,
    });
  });

  it("keeps invalid URLs local and displays a validation message", async () => {
    let changeCount = 0;
    const root = createBasecardEditorRoot({
      initialConfig: createConfig(),
      onChange: () => {
        changeCount += 1;
      },
    });

    const urlInput = getInputByLabel(root, "链接");

    setInputValue(urlInput, "ftp://example.com/file");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(changeCount).toBe(0);
    expect(root.textContent).toContain("链接必须是有效的 http 或 https 地址。");
  });

  it("marks required fields and announces invalid input state", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig(),
      onChange: () => undefined,
    });

    const anchorLabel = Array.from(root.querySelectorAll(".chips-basecard-editor__field-label")).find(
      (label) => label.textContent?.includes("锚文本"),
    );
    const urlLabel = Array.from(root.querySelectorAll(".chips-basecard-editor__field-label")).find(
      (label) => label.textContent?.includes("链接") && !label.textContent?.includes("图标"),
    );

    expect(anchorLabel?.textContent).toContain("*");
    expect(urlLabel?.textContent).toContain("*");

    const urlInput = getInputByLabel(root, "链接");
    expect(urlInput.hasAttribute("aria-invalid")).toBe(false);

    setInputValue(urlInput, "ftp://example.com/file");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(urlInput.getAttribute("aria-invalid")).toBe("true");
  });

  it("renders security controls with antd components", () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({ url: "http://example.com" }),
      onChange: () => undefined,
    });

    expect(root.querySelector(".ant-segmented")).not.toBeNull();
    expect(root.querySelector(".ant-switch")).not.toBeNull();
    expect(root.querySelector(".chips-basecard-editor__security-title")?.textContent).toContain("非加密链接");
    expect(root.querySelector(".chips-basecard-editor__security-row")?.textContent?.match(/非加密链接/g)).toHaveLength(1);
    expect(root.querySelector(".chips-basecard-editor__badge")).toBeNull();
    const helpButton = root.querySelector(".chips-basecard-editor__help-button");
    expect(helpButton).not.toBeNull();
    expect(helpButton?.getAttribute("role")).toBe("button");
    expect(helpButton?.getAttribute("tabindex")).toBe("0");
  });

  it("activates the help button with keyboard", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig(),
      onChange: () => undefined,
    });
    document.body.appendChild(root);

    const helpButton = root.querySelector(".chips-basecard-editor__help-button") as HTMLElement | null;

    const keyEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    helpButton?.dispatchEvent(keyEvent);
    expect(keyEvent.defaultPrevented).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.querySelector(".ant-tooltip")).not.toBeNull();

    root.remove();
  });
});
