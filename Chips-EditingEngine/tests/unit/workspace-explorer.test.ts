import { describe, expect, it } from "vitest";
import {
  buildWorkspaceExplorerRoots,
  buildWorkspaceExplorerTree,
  createWorkspaceExplorerEntry,
  getParentDirectoryPath,
  mergeExpandedDirectoryIds,
  sortWorkspaceExplorerEntries,
} from "../../src/domains/workspace-explorer/workspace-explorer-service";
import { getBuiltinSettingsPanelDefinitions } from "../../src/features/settings/settings-registry";

describe("workspace-explorer-service", () => {
  it("应计算去重后的根目录并保持顺序", () => {
    const roots = buildWorkspaceExplorerRoots({
      documents: [
        { id: "a", path: "/workspace/demo.card", kind: "card", title: "Demo", openedAt: "now", ast: { metadata: {}, structure: {}, contentFiles: [] }, validation: { valid: true, errors: [] }, preview: { title: "Demo", body: "", contentFiles: [], target: "card-iframe", semanticHash: "hash" } },
      ],
      recentTargets: [
        { path: "/workspace/next.box", kind: "box", title: "Next", openedAt: "now" },
        { path: "/workspace/demo.card", kind: "card", title: "Demo", openedAt: "now" },
      ],
      launchTargetPath: "/workspace/final.card",
    });

    expect(roots).toEqual(["/workspace"]);
    expect(getParentDirectoryPath("/workspace/demo.card")).toBe("/workspace");
  });

  it("应过滤非目录与非文档文件，并构造树节点", () => {
    const directoryEntry = createWorkspaceExplorerEntry("/workspace/assets", {
      path: "/workspace/assets",
      size: 0,
      isFile: false,
      isDirectory: true,
      mtimeMs: 1,
    });
    const cardEntry = createWorkspaceExplorerEntry("/workspace/demo.card", {
      path: "/workspace/demo.card",
      size: 0,
      isFile: true,
      isDirectory: false,
      mtimeMs: 1,
    });
    const ignoredEntry = createWorkspaceExplorerEntry("/workspace/readme.txt", {
      path: "/workspace/readme.txt",
      size: 0,
      isFile: true,
      isDirectory: false,
      mtimeMs: 1,
    });

    expect(directoryEntry?.kind).toBe("directory");
    expect(cardEntry?.kind).toBe("card");
    expect(ignoredEntry).toBeNull();

    const sorted = sortWorkspaceExplorerEntries([cardEntry!, directoryEntry!]);
    expect(sorted.map((entry) => entry.kind)).toEqual(["directory", "card"]);

    const tree = buildWorkspaceExplorerTree({
      roots: ["/workspace"],
      expandedIds: mergeExpandedDirectoryIds([], ["/workspace", "/workspace/assets"]),
      directoryEntries: {
        "/workspace": sorted,
        "/workspace/assets": [],
      },
    });

    expect(tree[0]?.children.map((item) => item.path)).toEqual(["/workspace/assets", "/workspace/demo.card"]);
  });
});

describe("settings-registry", () => {
  it("应暴露按顺序排列的内置设置面板定义", () => {
    const definitions = getBuiltinSettingsPanelDefinitions();
    expect(definitions.map((definition) => definition.category.id)).toEqual([
      "workspace",
      "editor",
      "layout",
      "theme",
      "locale",
      "runtime",
    ]);
  });
});
