import { describe, expect, it } from "vitest";
import {
  createInitialLegacyWindowShellState,
  ensureToolWindows,
  focusWindow,
  getDockWindows,
  getDocumentWindow,
  setWindowState,
  syncDocumentWindows,
} from "../../src/domains/legacy-shell/legacy-window-state";
import { createCardWorkspaceDocument } from "../../src/domains/workspace/workspace-service";

function createCardDocument(path: string, title: string) {
  return createCardWorkspaceDocument({
    path,
    ast: {
      metadata: { name: title },
      structure: {
        structure: [{ id: "node-1", type: "richtext-BCP" }],
      },
      contentFiles: [],
    },
    validation: {
      valid: true,
      errors: [],
    },
    preview: {
      title,
      body: "<html></html>",
      contentFiles: [],
      target: "card-iframe",
      semanticHash: `hash:${title}`,
    },
  });
}

describe("legacy-window-state", () => {
  it("应初始化并注册旧编辑器工具窗口", () => {
    const initial = createInitialLegacyWindowShellState("workbench");
    const next = ensureToolWindows(
      initial,
      { width: 1440, height: 900 },
      {
        fileManager: "文件管理器",
        editPanel: "编辑面板",
        cardLibrary: "卡箱库",
      },
    );

    expect(next.windowList).toHaveLength(3);
    expect(next.windowList.map((item) => item.id)).toEqual([
      "tool-window:FileManager",
      "tool-window:EditPanel",
      "tool-window:CardBoxLibrary",
    ]);
  });

  it("应根据打开文档同步卡片窗口并维护焦点", () => {
    const document = createCardDocument("/workspace/demo.card", "Demo");
    const withTools = ensureToolWindows(
      createInitialLegacyWindowShellState("workbench"),
      { width: 1440, height: 900 },
      {
        fileManager: "文件管理器",
        editPanel: "编辑面板",
        cardLibrary: "卡箱库",
      },
    );
    const synced = syncDocumentWindows(withTools, [document]);
    const cardWindow = getDocumentWindow(synced.windowList, document.id);

    expect(cardWindow?.title).toBe("Demo");

    const focused = focusWindow(synced, cardWindow!.id);
    expect(focused.focusedWindowId).toBe(cardWindow?.id);
    expect(focused.maxZIndex).toBeGreaterThan(synced.maxZIndex);
  });

  it("应识别最小化窗口并返回 dock 列表", () => {
    const document = createCardDocument("/workspace/demo.card", "Dock Demo");
    const synced = syncDocumentWindows(createInitialLegacyWindowShellState("infinite-canvas"), [document]);
    const cardWindow = getDocumentWindow(synced.windowList, document.id);
    const minimized = setWindowState(synced, cardWindow!.id, "minimized");

    expect(getDockWindows(minimized.windowList)).toHaveLength(1);
    expect(getDockWindows(minimized.windowList)[0]?.id).toBe(cardWindow?.id);
  });
});
