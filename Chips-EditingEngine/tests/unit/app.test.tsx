import { describe, expect, it } from "vitest";
import { App } from "../../src/App";
import { createTranslator, normalizeLocale } from "../../src/shared/runtime/editor-i18n";
import {
  createBoxWorkspaceDocument,
  createCardWorkspaceDocument,
  detectWorkspaceDocumentKind,
  sanitizeRecentWorkspaceTargets,
  upsertWorkspaceDocument,
} from "../../src/domains/workspace/workspace-service";
import {
  createFallbackRuntimeSnapshot,
  getLaunchTargetPath,
  getVisibleThemes,
  hasTheme,
} from "../../src/shared/runtime/editor-runtime-service";

describe("App (编辑引擎应用壳层)", () => {
  it("应导出可用的 React 组件", () => {
    expect(App).toBeTypeOf("function");
  });
});

describe("editor-i18n", () => {
  it("应归一化 locale 并读取词典", () => {
    expect(normalizeLocale("en")).toBe("en-US");
    expect(normalizeLocale("zh-Hans-CN")).toBe("zh-CN");
    const t = createTranslator("en-US");
    expect(t("editingEngine.layout.workbench")).toBe("Workbench");
    expect(t("editingEngine.actions.openSettings")).toBe("Settings center");
  });
});

describe("workspace-service", () => {
  it("应识别文档类型并更新打开列表", () => {
    expect(detectWorkspaceDocumentKind("/tmp/demo.card")).toBe("card");
    expect(detectWorkspaceDocumentKind("/tmp/demo.box")).toBe("box");
    expect(detectWorkspaceDocumentKind("/tmp/demo.txt")).toBeNull();

    const cardDocument = createCardWorkspaceDocument({
      path: "/tmp/demo.card",
      ast: {
        metadata: { name: "Demo Card" },
        structure: {},
        contentFiles: ["content/a.yaml"],
      },
      validation: {
        valid: true,
        errors: [],
      },
      preview: {
        title: "Demo Card",
        body: "<html></html>",
        contentFiles: [],
        target: "card-iframe",
        semanticHash: "hash-1",
      },
    });

    const boxDocument = createBoxWorkspaceDocument({
      path: "/tmp/demo.box",
      inspection: {
        path: "/tmp/demo.box",
        type: "full",
        cards: [{ path: "a.card", type: "internal" }],
      },
    });

    const documents = upsertWorkspaceDocument([cardDocument], boxDocument);
    expect(documents[0].id).toBe(boxDocument.id);
    expect(sanitizeRecentWorkspaceTargets([{ path: "/tmp/demo.card", kind: "card", title: "Demo", openedAt: "now" }])).toHaveLength(1);
  });
});

describe("editor-runtime-service helpers", () => {
  it("应解析启动目标路径、主题可见性与预览快照", () => {
    expect(
      getLaunchTargetPath({
        launchContext: {
          launchParams: {
            targetPath: "/tmp/demo.card",
          },
        },
      }),
    ).toBe("/tmp/demo.card");

    const themes = getVisibleThemes([
      { id: "theme-b", displayName: "Beta", version: "1.0.0", isDefault: false },
      { id: "theme-a", displayName: "Alpha", version: "1.0.0", isDefault: true },
    ]);

    expect(themes.map((item) => item.id)).toEqual(["theme-a", "theme-b"]);
    expect(
      hasTheme(
        {
          theme: {
            themeId: "theme-a",
            displayName: "Alpha",
            version: "1.0.0",
          },
          availableThemes: themes,
        },
        "theme-a",
      ),
    ).toBe(true);

    const previewSnapshot = createFallbackRuntimeSnapshot({} as never);
    expect(previewSnapshot.runtimeMode).toBe("preview");
    expect(previewSnapshot.plugin.id).toBe("com.chips.editing-engine");
  });
});
