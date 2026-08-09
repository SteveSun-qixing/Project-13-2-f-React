import { describe, expect, it } from "vitest";
import { mountBasecardEditor } from "../../src/editor/runtime";
import { mountBasecardView } from "../../src/render/runtime";
import type { BasecardConfig } from "../../src/schema/card-config";

function changeTextInput(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (valueSetter) {
    valueSetter.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("book basecard integration flow", () => {
  it("updates the rendered title when the editor emits a config change", async () => {
    const viewContainer = document.createElement("div");
    const editorContainer = document.createElement("div");

    const initialConfig: BasecardConfig = {
      card_type: "base.book",
      theme: "",
      source_type: "ebook",
      book_file: "books/demo.epub",
      book_format: "epub",
      book_name: "Initial",
      book_author: "Alice",
      cover_image: "",
      image_sequence: [],
      image_sort_basis: "filename",
      resource_paths: ["books/demo.epub"],
    };

    let currentConfig: BasecardConfig = initialConfig;

    mountBasecardView({
      container: viewContainer,
      config: currentConfig,
      resolveResourceUrl: async (resourcePath) => `file:///tmp/${resourcePath}`,
    });

    mountBasecardEditor({
      container: editorContainer,
      initialConfig,
      onChange: (next) => {
        currentConfig = next;
        mountBasecardView({
          container: viewContainer,
          config: currentConfig,
          resolveResourceUrl: async (resourcePath) => `file:///tmp/${resourcePath}`,
        });
      },
    });

    const bookNameInput = editorContainer.querySelector('[data-role="book-name-input"]') as HTMLInputElement | null;
    if (!bookNameInput) {
      throw new Error("找不到书名输入框");
    }

    changeTextInput(bookNameInput, "Updated Book");

    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });

    expect(viewContainer.querySelector(".chips-book-card__title")?.textContent).toBe("Updated Book");
  });
});
