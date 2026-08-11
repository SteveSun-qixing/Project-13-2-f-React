import { describe, expect, it, vi } from "vitest";
import { createBasecardEditorRoot } from "../../src/editor/panel";
import { formatMessage } from "../../src/lib/messages";
import type { BasecardConfig } from "../../src/schema/card-config";

function createConfig(overrides: Partial<BasecardConfig> = {}): BasecardConfig {
  return {
    card_type: "base.richtext",
    content_format: "markdown",
    content_source: "inline",
    content_text: "初始内容",
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

describe("createBasecardEditorRoot (Milkdown)", () => {
  it("renders a compact icon-only floating toolbar", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig(),
      onChange: () => undefined,
    });

    await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

    const toolbar = root.querySelector(".chips-basecard-editor__floating-toolbar");
    const toolbarButtons = Array.from(root.querySelectorAll(".chips-basecard-editor__toolbar-button"));

    expect(toolbar).not.toBeNull();
    expect(root.querySelector(".chips-basecard-editor__toolbar-shell")).toBeNull();
    expect(root.querySelector(".chips-basecard-editor__toolbar-panel")).toBeNull();
    expect(root.querySelector(".chips-basecard-editor__surface")).not.toBeNull();
    expect(toolbarButtons).toHaveLength(5);
    toolbarButtons.forEach((button) => {
      expect(button.querySelector(".chips-basecard-editor__toolbar-button-icon")).not.toBeNull();
      expect(button.childElementCount).toBe(1);
    });
    expect(root.querySelector(".chips-basecard-editor__editor-host .ProseMirror")?.textContent).toContain("初始内容");
    expect(root.querySelector(".chips-basecard-editor__statusbar")).toBeNull();
    expect(root.querySelector(".chips-basecard-editor__react-icon")).not.toBeNull();
  });

  it("loads file-backed markdown into the editor runtime via fetch when runtime URL is network-like", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => `# 长文

来自文件` }));
    vi.stubGlobal("fetch", fetchMock);

    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        content_source: "file",
        content_file: "richtext-base-2.md",
        content_text: undefined,
      }),
      onChange: () => undefined,
      resolveResourceUrl: async (resourcePath) => `https://runtime.example/${resourcePath}`,
    });

    await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

    expect(fetchMock).toHaveBeenCalledWith("https://runtime.example/richtext-base-2.md");
    expect(root.textContent).toContain("长文");
    vi.unstubAllGlobals();
  });

  it("reads file-backed markdown through bridge file.read when runtime URL is file://", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const chipsWindow = window as typeof window & { chips?: Window["chips"] };
    const previousChips = chipsWindow.chips;
    try {
      chipsWindow.chips = {
        invoke: vi.fn(async (route: string, input?: Record<string, unknown>) => {
          expect(route).toBe("file.read");
          expect(input?.path).toBe("/card-root/richtext-base-3.md");
          return { content: "# Bridge 正文\n\n来自正式文件服务" };
        }),
        on: vi.fn(() => () => undefined),
        emit: vi.fn(async () => undefined),
      };

      const root = createBasecardEditorRoot({
        initialConfig: createConfig({
          content_source: "file",
          content_file: "richtext-base-3.md",
          content_text: undefined,
        }),
        onChange: () => undefined,
        resolveResourceUrl: async () => "file:///card-root/richtext-base-3.md",
      });

      await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

      expect(fetchMock).not.toHaveBeenCalled();
      expect(root.textContent).toContain("Bridge 正文");
    } finally {
      chipsWindow.chips = previousChips;
      vi.unstubAllGlobals();
    }
  });

  it("reads file-backed markdown from the resolved runtime resource url", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("blob:file:///pending-richtext-base-5");
      return {
        ok: true,
        text: async () => "# 待落盘正文\n\n来自运行时资源 URL",
      } as Response;
    });
    const resolveResourceUrl = vi.fn(async () => "blob:file:///pending-richtext-base-5");
    vi.stubGlobal("fetch", fetchMock);

    try {
      const root = createBasecardEditorRoot({
        initialConfig: createConfig({
          content_source: "file",
          content_file: "richtext-base-5.md",
          content_text: undefined,
        }),
        onChange: () => undefined,
        resolveResourceUrl,
      });

      await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

      expect(resolveResourceUrl).toHaveBeenCalledWith("richtext-base-5.md");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(root.textContent).toContain("待落盘正文");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows validation errors for empty inline markdown", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        content_text: "",
      }),
      onChange: () => undefined,
    });

    await waitFor(() => Boolean(root.querySelector(".ProseMirror")));
    await waitFor(() => Boolean(root.querySelector(".chips-basecard-editor__errors:not([hidden])")));

    expect(root.textContent).toContain("内容不能为空");
  });

  it("shows the empty placeholder before any content is entered", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        content_text: "",
      }),
      onChange: () => undefined,
    });

    await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

    expect(root.querySelector(".chips-basecard-editor__editor-host--empty")).not.toBeNull();
    expect(root.textContent).toContain("开始输入…");
  });

  it("hides the empty placeholder once the document has content", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        content_text: "有内容",
      }),
      onChange: () => undefined,
    });

    await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

    expect(root.querySelector(".chips-basecard-editor__editor-host--empty")).toBeNull();
  });

  it("surfaces markdown import failures instead of failing silently", async () => {
    const importResource = vi.fn(async () => {
      throw new Error("模拟导入失败");
    });
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        content_text: "字".repeat(201),
      }),
      onChange: () => undefined,
      importResource,
    });

    await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

    root.__chipsDispose?.();

    await waitFor(() => Boolean(root.querySelector(".chips-basecard-editor__errors:not([hidden])")));

    expect(importResource).toHaveBeenCalledTimes(1);
    expect(root.textContent).toContain("Markdown 文件保存失败");
    expect(root.textContent).toContain("模拟导入失败");
  });

  it("shows the link input popup from the toolbar link button instead of window.prompt", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig(),
      onChange: () => undefined,
    });

    await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

    const toolbarButtons = Array.from(root.querySelectorAll(".chips-basecard-editor__toolbar-button"));
    const linkButton = toolbarButtons.find((button) =>
      button.getAttribute("aria-label") === formatMessage("basecard.toolbar.link"));
    expect(linkButton).toBeDefined();

    linkButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const popup = root.querySelector(".chips-basecard-editor__link-popup") as HTMLDivElement | null;
    expect(popup).not.toBeNull();
    expect(popup?.hidden).toBe(false);
    const input = popup?.querySelector("input") as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.getAttribute("placeholder")).toBe(formatMessage("basecard.prompt.linkUrl"));

    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(popup?.hidden).toBe(true);

    linkButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(popup?.hidden).toBe(false);
    if (input) {
      input.value = "https://example.com";
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
    expect(popup?.hidden).toBe(true);

    linkButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const cancelButton = popup?.querySelector(
      ".chips-basecard-editor__link-popup-button--cancel",
    ) as HTMLButtonElement | null;
    cancelButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(popup?.hidden).toBe(true);

    linkButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(popup?.hidden).toBe(false);
    document.body.appendChild(root);
    const surface = root.querySelector(".chips-basecard-editor__surface") as HTMLDivElement | null;
    surface?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(popup?.hidden).toBe(true);
    document.body.removeChild(root);
  });

  it("shows tooltip on toolbar hover and opens the editor context menu on right click", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig(),
      onChange: () => undefined,
    });

    await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

    const firstToolbarButton = root.querySelector(".chips-basecard-editor__toolbar-button") as HTMLButtonElement | null;
    const tooltipLayer = root.querySelector(".chips-basecard-editor__tooltip-layer") as HTMLDivElement | null;
    const tooltipContent = root.querySelector('[data-scope="tooltip"][data-part="content"]') as HTMLDivElement | null;
    const editorDom = root.querySelector(".ProseMirror") as HTMLDivElement | null;

    expect(firstToolbarButton).not.toBeNull();
    expect(tooltipLayer).not.toBeNull();
    expect(tooltipContent).not.toBeNull();
    expect(editorDom).not.toBeNull();

    firstToolbarButton?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    expect(tooltipLayer?.hidden).toBe(false);
    expect(tooltipContent?.textContent).toBe("加粗");

    editorDom?.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true,
      clientX: 80,
      clientY: 64,
    }));

    await waitFor(() => Boolean(root.querySelector(".chips-basecard-editor__context-menu:not([hidden])")));
    expect(root.querySelector('[data-scope="menu"][data-part="content"]')).not.toBeNull();
    expect(root.textContent).toContain("标题 1");
  });

  it("parses pasted markdown into formatted nodes immediately", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        content_text: "前缀",
      }),
      onChange: () => undefined,
    });

    await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

    const editorDom = root.querySelector(".ProseMirror") as HTMLDivElement | null;
    expect(editorDom).not.toBeNull();

    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      configurable: true,
      value: {
        getData: (type: string) => (type === "text/plain" ? "\n\n**加粗内容**" : ""),
      },
    });

    editorDom?.dispatchEvent(pasteEvent);

    await waitFor(() => Boolean(root.querySelector(".ProseMirror strong")));

    expect(root.querySelector(".ProseMirror strong")?.textContent).toContain("加粗内容");
  });

  it("parses pasted heading markdown immediately", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        content_text: "",
      }),
      onChange: () => undefined,
    });

    await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

    const editorDom = root.querySelector(".ProseMirror") as HTMLDivElement | null;
    expect(editorDom).not.toBeNull();

    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      configurable: true,
      value: {
        getData: (type: string) => (type === "text/plain" ? "# 一级标题" : ""),
      },
    });

    editorDom?.dispatchEvent(pasteEvent);

    await waitFor(() => Boolean(root.querySelector(".ProseMirror h1")));

    expect(root.querySelector(".ProseMirror h1")?.textContent).toContain("一级标题");
  });

  it("parses pasted strong markdown immediately without requiring a second edit", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        content_text: "",
      }),
      onChange: () => undefined,
    });

    await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

    const editorDom = root.querySelector(".ProseMirror") as HTMLDivElement | null;
    expect(editorDom).not.toBeNull();

    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      configurable: true,
      value: {
        getData: (type: string) => (type === "text/plain" ? "**立即加粗**" : ""),
      },
    });

    editorDom?.dispatchEvent(pasteEvent);

    await waitFor(() => Boolean(root.querySelector(".ProseMirror strong")));

    expect(root.querySelector(".ProseMirror strong")?.textContent).toContain("立即加粗");
    expect(root.querySelector(".ProseMirror")?.textContent).not.toContain("**立即加粗**");
  });

  it("parses mixed block and inline markdown when pasting a markdown document", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        content_text: "",
      }),
      onChange: () => undefined,
    });

    await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

    const editorDom = root.querySelector(".ProseMirror") as HTMLDivElement | null;
    expect(editorDom).not.toBeNull();

    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      configurable: true,
      value: {
        getData: (type: string) => (type === "text/plain"
          ? "# 主标题\n\n> 引用段落\n\n- 列表项\n\n包含 **加粗** 文本"
          : ""),
      },
    });

    editorDom?.dispatchEvent(pasteEvent);

    await waitFor(() => Boolean(root.querySelector(".ProseMirror h1")));
    await waitFor(() => Boolean(root.querySelector(".ProseMirror blockquote")));
    await waitFor(() => Boolean(root.querySelector(".ProseMirror ul li")));
    await waitFor(() => Boolean(root.querySelector(".ProseMirror strong")));

    expect(root.querySelector(".ProseMirror h1")?.textContent).toContain("主标题");
    expect(root.querySelector(".ProseMirror blockquote")?.textContent).toContain("引用段落");
    expect(root.querySelector(".ProseMirror ul li")?.textContent).toContain("列表项");
    expect(root.querySelector(".ProseMirror strong")?.textContent).toContain("加粗");
  });

  it("parses extended markdown syntax immediately when pasting", async () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        content_text: "",
      }),
      onChange: () => undefined,
    });

    await waitFor(() => Boolean(root.querySelector(".ProseMirror")));

    const editorDom = root.querySelector(".ProseMirror") as HTMLDivElement | null;
    expect(editorDom).not.toBeNull();

    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      configurable: true,
      value: {
        getData: (type: string) => (type === "text/plain"
          ? "~~删除线~~\n\n==高亮==\n\n++下划线++\n\n2^10^\n\nH~2~O"
          : ""),
      },
    });

    editorDom?.dispatchEvent(pasteEvent);

    await waitFor(() => Boolean(root.querySelector(".ProseMirror del")));
    await waitFor(() => Boolean(root.querySelector(".ProseMirror mark")));
    await waitFor(() => Boolean(root.querySelector(".ProseMirror u, .ProseMirror ins")));
    await waitFor(() => Boolean(root.querySelector(".ProseMirror sup")));
    await waitFor(() => Boolean(root.querySelector(".ProseMirror sub")));

    expect(root.querySelector(".ProseMirror del")?.textContent).toContain("删除线");
    expect(root.querySelector(".ProseMirror mark")?.textContent).toContain("高亮");
    expect(root.querySelector(".ProseMirror u, .ProseMirror ins")?.textContent).toContain("下划线");
    expect(root.querySelector(".ProseMirror sup")?.textContent).toContain("10");
    expect(root.querySelector(".ProseMirror sub")?.textContent).toContain("2");
  });
});
