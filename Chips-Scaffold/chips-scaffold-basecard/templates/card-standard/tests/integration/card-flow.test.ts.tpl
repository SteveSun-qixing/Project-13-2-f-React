import { describe, it, expect } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import { mountBasecardEditor } from "../../src/editor/runtime";
import type { BasecardConfig } from "../../src/schema/card-config";

describe("basecard integration flow", () => {
  it("updates view when editor emits valid config", () => {
    const container = document.createElement("div");
    const editorContainer = document.createElement("div");

    const initialConfig: BasecardConfig = {
      card_type: "{{ CARD_TYPE }}",
      title: "Initial",
      body: "Body",
      locale: "zh-CN",
      theme: "",
      resource_path: "assets/cover.png",
    };

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
      '[data-chips-basecard-field="title"] input'
    ) as HTMLInputElement | null;

    if (!titleInput) {
      throw new Error("找不到标题输入框");
    }

    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(titleInput, "Updated");
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));

    const titleEl = container.querySelector(".chips-basecard__title");
    expect(titleEl?.textContent).toBe("Updated");
    expect(container.querySelector(".chips-basecard__surface")).toBeNull();
  });

  it("cleans editor container styles after unmount", () => {
    const editorContainer = document.createElement("div");
    editorContainer.style.display = "block";
    editorContainer.style.overflow = "visible";

    const initialConfig: BasecardConfig = {
      card_type: "{{ CARD_TYPE }}",
      title: "Initial",
      body: "Body",
      locale: "zh-CN",
      theme: "",
    };

    const dispose = mountBasecardEditor({
      container: editorContainer,
      initialConfig,
      onChange: () => undefined,
    });

    expect(editorContainer.querySelector("[data-chips-basecard-editor-root]")).toBeTruthy();

    dispose();
    expect(editorContainer.childElementCount).toBe(0);
    expect(editorContainer.style.display).toBe("block");
    expect(editorContainer.style.overflow).toBe("visible");
  });
});
