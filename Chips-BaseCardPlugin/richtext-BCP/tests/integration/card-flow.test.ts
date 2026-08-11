import { describe, expect, it, vi } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import { mountBasecardEditor } from "../../src/editor/runtime";
import type { BasecardConfig } from "../../src/schema/card-config";

function createConfig(overrides: Partial<BasecardConfig> = {}): BasecardConfig {
  return {
    card_type: "base.richtext",
    content_format: "markdown",
    content_source: "inline",
    content_text: "Body",
    locale: "zh-CN",
    theme: "",
    markdown_capabilities: {
      commonmark: true,
      gfm: true,
      math: true,
      highlight: true,
      underline: true,
      superscript: true,
      subscript: true,
    },
    ...overrides,
  };
}

async function waitFor(condition: () => boolean, timeout = 3000): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeout) {
      throw new Error("waitFor timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe("basecard integration flow (markdown richtext)", () => {
  it("mounts both readonly view and Milkdown editor on the same config model", async () => {
    const container = document.createElement("div");
    const editorContainer = document.createElement("div");

    const initialConfig = createConfig({
      content_text: `# 标题

集成测试正文`,
    });

    const disposeView = mountBasecardView({
      container,
      config: initialConfig,
    });

    const disposeEditor = mountBasecardEditor({
      container: editorContainer,
      initialConfig,
      onChange: vi.fn(),
    });

    await waitFor(() => Boolean(container.querySelector(".ProseMirror")));
    await waitFor(() => Boolean(editorContainer.querySelector(".ProseMirror")));

    expect(container.textContent).toContain("标题");
    expect(editorContainer.textContent).toContain("集成测试正文");
    expect(editorContainer.querySelector(".chips-basecard-editor__floating-toolbar")).not.toBeNull();

    disposeEditor();
    disposeView();
  });

  it("passes resolveResourceUrl through the editor runtime wrapper for file-backed markdown", async () => {
    const editorContainer = document.createElement("div");
    const resolveResourceUrl = vi.fn(async (resourcePath: string) => {
      expect(resourcePath).toBe("docs/runtime-wrapper.md");
      return "file:///workspace/docs/runtime-wrapper.md";
    });
    const chipsWindow = window as typeof window & { chips?: Window["chips"] };
    const previousChips = chipsWindow.chips;
    chipsWindow.chips = {
      invoke: vi.fn(async () => ({ content: "# Runtime Wrapper\n\n来自统一资源 URL" })),
      on: vi.fn(() => () => undefined),
      emit: vi.fn(async () => undefined),
    };

    try {
      const disposeEditor = mountBasecardEditor({
        container: editorContainer,
        initialConfig: createConfig({
          content_source: "file",
          content_file: "docs/runtime-wrapper.md",
          content_text: undefined,
        }),
        onChange: vi.fn(),
        resolveResourceUrl,
      });

      await waitFor(() => Boolean(editorContainer.querySelector(".ProseMirror")));

      expect(resolveResourceUrl).toHaveBeenCalledWith("docs/runtime-wrapper.md");
      expect(editorContainer.textContent).toContain("Runtime Wrapper");

      disposeEditor();
    } finally {
      chipsWindow.chips = previousChips;
    }
  });

  it("executes the previous cleanup before a repeated editor mount into the same container", async () => {
    const editorContainer = document.createElement("div");
    const mount = (contentText: string) => mountBasecardEditor({
      container: editorContainer,
      initialConfig: createConfig({ content_text: contentText }),
      onChange: vi.fn(),
    });

    mount("第一次编辑");
    await waitFor(() => Boolean(editorContainer.querySelector(".ProseMirror")));
    expect(editorContainer.querySelectorAll(".ProseMirror")).toHaveLength(1);
    expect(editorContainer.querySelectorAll(".chips-basecard-editor-root")).toHaveLength(1);

    mount("第二次编辑");
    await waitFor(() => Boolean(editorContainer.querySelector(".ProseMirror")));

    expect(editorContainer.querySelectorAll(".ProseMirror")).toHaveLength(1);
    expect(editorContainer.querySelectorAll(".chips-basecard-editor-root")).toHaveLength(1);
    expect(editorContainer.textContent).toContain("第二次编辑");
    expect(editorContainer.textContent).not.toContain("第一次编辑");
  });

  it("restores the container styles when the editor is disposed", () => {
    const editorContainer = document.createElement("div");
    editorContainer.style.height = "120px";
    editorContainer.style.width = "320px";

    const disposeEditor = mountBasecardEditor({
      container: editorContainer,
      initialConfig: createConfig(),
      onChange: vi.fn(),
    });

    expect(editorContainer.style.height).toBe("100%");
    expect(editorContainer.style.width).toBe("100%");

    disposeEditor();

    expect(editorContainer.style.height).toBe("120px");
    expect(editorContainer.style.width).toBe("320px");
    expect(editorContainer.childElementCount).toBe(0);
  });
});
