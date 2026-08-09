import { describe, it, expect, vi } from "vitest";
import { createBasecardEditorRoot } from "../../src/editor/panel";
import type { BasecardConfig } from "../../src/schema/card-config";

async function waitForEffects(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForAssertion(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await waitForEffects();
    }
  }
  throw lastError;
}

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | null {
  return Array.from(root.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  ) ?? null;
}

describe("createBasecardEditorRoot", () => {
  it("emits changes when fields are updated and valid", () => {
    const initialConfig: BasecardConfig = {
      card_type: "{{ CARD_TYPE }}",
      title: "Title",
      body: "Body",
      locale: "zh-CN",
      theme: "",
      resource_path: "assets/cover.png",
    };

    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig,
      onChange: (next) => {
        lastConfig = next;
      },
    });

    const titleInput = root.querySelector(
      '[data-chips-basecard-field="title"] input'
    ) as HTMLInputElement | null;

    if (!titleInput) {
      throw new Error("找不到标题输入框");
    }

    expect(root.querySelector(".chips-basecard-editor__form")).toBeTruthy();
    expect(root.querySelector('[data-chips-basecard-field="body"] textarea')).toBeTruthy();
    expect(root.querySelector('[data-chips-basecard-field="resource_path"] input')).toBeTruthy();
    expect(root.getAttribute("data-chips-basecard-editor-root")).toBe("true");
    expect(root.innerHTML).not.toContain("chips-basecard-editor__input");
    expect(root.innerHTML).not.toContain("box-shadow");
    expect(root.innerHTML).not.toContain("radial-gradient");

    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(titleInput, "New Title");
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));

    expect(lastConfig?.title).toBe("New Title");
    expect(lastConfig?.card_type).toBe("{{ CARD_TYPE }}");
    expect(lastConfig?.resource_path).toBe("assets/cover.png");
  });

  it("imports dropped resources and deletes resources through context callbacks", async () => {
    const initialConfig: BasecardConfig = {
      card_type: "{{ CARD_TYPE }}",
      title: "Title",
      body: "Body",
      locale: "zh-CN",
      theme: "",
      resource_path: "assets/cover.png",
    };
    const file = new File(["demo"], "cover.png", { type: "image/png" });
    const importResource = vi.fn(async () => ({ path: "assets/imported-cover.png" }));
    const deleteResource = vi.fn(async () => undefined);

    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig,
      onChange: (next) => {
        lastConfig = next;
      },
      importResource,
      deleteResource,
    });

    const dropzone = root.querySelector(
      '[data-chips-basecard-resource-dropzone="true"]'
    ) as HTMLElement | null;

    if (!dropzone) {
      throw new Error("找不到资源导入区域");
    }

    const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        files: {
          item: (index: number) => (index === 0 ? file : null),
          length: 1,
        },
      },
    });
    dropzone.dispatchEvent(dropEvent);
    await waitForEffects();

    expect(importResource).toHaveBeenCalledWith({
      file,
      preferredPath: "assets/cover.png",
    });
    await waitForAssertion(() => {
      expect(lastConfig?.resource_path).toBe("assets/imported-cover.png");
      expect(findButtonByText(root, "删除资源")).toBeTruthy();
    });

    const deleteButton = findButtonByText(root, "删除资源");

    if (!deleteButton) {
      throw new Error("找不到资源删除按钮");
    }

    deleteButton.click();
    await waitForEffects();

    expect(deleteResource).toHaveBeenCalledWith("assets/imported-cover.png");
    expect(lastConfig?.resource_path).toBeUndefined();
  });
});
