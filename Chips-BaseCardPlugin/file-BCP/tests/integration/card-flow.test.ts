import { describe, it, expect, vi } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import { mountBasecardEditor } from "../../src/editor/runtime";
import type { BasecardConfig } from "../../src/schema/card-config";

describe("file basecard integration flow", () => {
  it("updates the view when the editor emits a recognized file config", async () => {
    const container = document.createElement("div");
    const editorContainer = document.createElement("div");

    const initialConfig: BasecardConfig = {
      card_type: "base.file",
      theme: "",
      file_file: "",
      file_name: "",
      file_extension: "",
      cover_image: "",
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
      importResource: async () => ({ path: "docs/notes.md" }),
    });

    const dropzone = editorContainer.querySelector('[data-role="file-dropzone"]') as HTMLElement;
    expect(dropzone).toBeTruthy();
    expect(container.querySelector(".chips-file-card__empty")).toBeTruthy();

    const file = new File(["demo"], "项目笔记.md", { type: "text/markdown" });
    const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: {
        files: [file] as unknown as FileList,
      },
    });
    dropzone.dispatchEvent(dropEvent);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(currentConfig).toMatchObject({
      file_file: "docs/notes.md",
      file_name: "项目笔记",
      file_extension: "md",
    });

    const nameEl = container.querySelector(".chips-file-card__name");
    expect(nameEl?.textContent).toBe("项目笔记");
    expect(container.querySelector(".chips-file-card__extension")?.textContent).toBe("MD");
    expect(container.querySelector(".chips-file-card__empty")).toBeNull();
  });

  it("cleans editor container styles after unmount", () => {
    const editorContainer = document.createElement("div");
    editorContainer.style.display = "block";
    editorContainer.style.overflow = "visible";

    const initialConfig: BasecardConfig = {
      card_type: "base.file",
      theme: "",
      file_file: "docs/notes.md",
      file_name: "项目笔记",
      file_extension: "md",
      cover_image: "",
    };

    const dispose = mountBasecardEditor({
      container: editorContainer,
      initialConfig,
      onChange: () => undefined,
    });

    expect(editorContainer.querySelector("[data-chips-file-editor-root]")).toBeTruthy();

    dispose();
    expect(editorContainer.childElementCount).toBe(0);
    expect(editorContainer.style.display).toBe("block");
    expect(editorContainer.style.overflow).toBe("visible");
  });
});
