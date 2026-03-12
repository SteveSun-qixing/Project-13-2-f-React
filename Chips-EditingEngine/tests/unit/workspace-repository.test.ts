import { describe, expect, it } from "vitest";
import type { EditorRouteService } from "../../src/shared/runtime/editor-route-service";
import {
  collectWorkspaceRootPaths,
  findWorkspaceRepositoryNode,
  loadWorkspaceRepositoryRoots,
  sortWorkspaceRepositoryNodes,
} from "../../src/domains/workspace/workspace-repository-service";
import { createCardWorkspaceDocument } from "../../src/domains/workspace/workspace-service";

function createRouteServiceFixture(): EditorRouteService {
  const entriesByDir: Record<string, string[]> = {
    "/workspace": ["/workspace/notes", "/workspace/cover.png", "/workspace/demo.card"],
    "/workspace/notes": ["/workspace/notes/sub.box", "/workspace/notes/readme.md"],
  };

  const statsByPath: Record<
    string,
    {
      isFile: boolean;
      isDirectory: boolean;
      size: number;
      mtimeMs: number;
    }
  > = {
    "/workspace/notes": { isFile: false, isDirectory: true, size: 0, mtimeMs: 1 },
    "/workspace/cover.png": { isFile: true, isDirectory: false, size: 120, mtimeMs: 1 },
    "/workspace/demo.card": { isFile: true, isDirectory: false, size: 320, mtimeMs: 1 },
    "/workspace/notes/sub.box": { isFile: true, isDirectory: false, size: 640, mtimeMs: 1 },
    "/workspace/notes/readme.md": { isFile: true, isDirectory: false, size: 48, mtimeMs: 1 },
  };

  return {
    getConfig: async () => undefined,
    setConfig: async () => undefined,
    openFileDialog: async () => null,
    listDirectory: async (dir) => entriesByDir[dir] ?? [],
    statPath: async (path) => statsByPath[path],
    parseCard: async () => {
      throw new Error("not implemented");
    },
    validateCard: async () => {
      throw new Error("not implemented");
    },
    renderCardPreview: async () => {
      throw new Error("not implemented");
    },
    inspectBox: async () => {
      throw new Error("not implemented");
    },
  };
}

describe("workspace-repository-service", () => {
  it("应根据已打开文档收集唯一根目录", () => {
    const documents = [
      createCardWorkspaceDocument({
        path: "/workspace/demo.card",
        ast: {
          metadata: { name: "Demo Card" },
          structure: {},
          contentFiles: [],
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
          semanticHash: "hash-demo",
        },
      }),
      createCardWorkspaceDocument({
        path: "/workspace/demo.card",
        ast: {
          metadata: { name: "Demo Card" },
          structure: {},
          contentFiles: [],
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
          semanticHash: "hash-demo",
        },
      }),
    ];

    expect(collectWorkspaceRootPaths(documents)).toEqual(["/workspace"]);
  });

  it("应优先目录并过滤非卡片/箱子文件", async () => {
    const roots = await loadWorkspaceRepositoryRoots(createRouteServiceFixture(), ["/workspace"]);
    expect(roots).toHaveLength(1);
    expect(roots[0].nodes.map((node) => node.path)).toEqual([
      "/workspace/notes",
      "/workspace/demo.card",
    ]);

    const nestedNode = findWorkspaceRepositoryNode(roots, "/workspace/notes/sub.box");
    expect(nestedNode?.kind).toBe("box");
  });

  it("应保持目录优先的稳定排序", () => {
    const sorted = sortWorkspaceRepositoryNodes([
      { id: "b.card", path: "b.card", name: "b.card", kind: "card", children: [] },
      { id: "a", path: "a", name: "a", kind: "directory", children: [] },
      { id: "a.card", path: "a.card", name: "a.card", kind: "card", children: [] },
    ]);

    expect(sorted.map((node) => node.id)).toEqual(["a", "a.card", "b.card"]);
  });
});
