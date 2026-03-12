import type { EditorRouteService } from "../../shared/runtime/editor-route-service";
import type { WorkspaceDocument, WorkspaceRepositoryNode, WorkspaceRepositoryRoot } from "./types";
import { detectWorkspaceDocumentKind, getFileName } from "./workspace-service";

const DIRECTORY_COLLATOR = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});

export function getParentDirectory(pathname: string): string {
  const normalized = pathname.replace(/[\\/]+$/, "");
  const segments = normalized.split(/[\\/]/);

  if (segments.length <= 1) {
    return normalized;
  }

  segments.pop();
  const candidate = segments.join("/");
  return candidate.length > 0 ? candidate : "/";
}

export function collectWorkspaceRootPaths(documents: WorkspaceDocument[]): string[] {
  const uniqueRoots = new Set<string>();

  for (const document of documents) {
    uniqueRoots.add(getParentDirectory(document.path));
  }

  return [...uniqueRoots].sort((left, right) => DIRECTORY_COLLATOR.compare(left, right));
}

export function sortWorkspaceRepositoryNodes(nodes: WorkspaceRepositoryNode[]): WorkspaceRepositoryNode[] {
  return [...nodes].sort((left, right) => {
    if (left.kind === "directory" && right.kind !== "directory") {
      return -1;
    }
    if (left.kind !== "directory" && right.kind === "directory") {
      return 1;
    }
    return DIRECTORY_COLLATOR.compare(left.name, right.name);
  });
}

export function findWorkspaceRepositoryNode(
  roots: WorkspaceRepositoryRoot[],
  nodeId: string,
): WorkspaceRepositoryNode | null {
  for (const root of roots) {
    const directMatch = root.nodes.find((node) => node.id === nodeId);
    if (directMatch) {
      return directMatch;
    }

    const nestedMatch = findWorkspaceRepositoryNodeById(root.nodes, nodeId);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

async function loadWorkspaceRepositoryNode(
  routeService: EditorRouteService,
  path: string,
): Promise<WorkspaceRepositoryNode | null> {
  const stat = await routeService.statPath(path);

  if (stat.isDirectory) {
    const entries = await routeService.listDirectory(path);
    const children = await Promise.all(entries.map((entry) => loadWorkspaceRepositoryNode(routeService, entry)));
    const visibleChildren = sortWorkspaceRepositoryNodes(children.filter(isRepositoryNode));

    if (visibleChildren.length === 0) {
      return null;
    }

    return {
      id: path,
      path,
      name: getFileName(path),
      kind: "directory",
      children: visibleChildren,
    };
  }

  const kind = detectWorkspaceDocumentKind(path);
  if (!kind) {
    return null;
  }

  return {
    id: path,
    path,
    name: getFileName(path),
    kind,
    children: [],
  };
}

function findWorkspaceRepositoryNodeById(
  nodes: WorkspaceRepositoryNode[],
  nodeId: string,
): WorkspaceRepositoryNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    if (node.children.length === 0) {
      continue;
    }

    const nestedMatch = findWorkspaceRepositoryNodeById(node.children, nodeId);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

function isRepositoryNode(node: WorkspaceRepositoryNode | null): node is WorkspaceRepositoryNode {
  return node !== null;
}

export async function loadWorkspaceRepositoryRoots(
  routeService: EditorRouteService,
  rootPaths: string[],
): Promise<WorkspaceRepositoryRoot[]> {
  const roots = await Promise.all(
    rootPaths.map(async (rootPath) => {
      const entries = await routeService.listDirectory(rootPath);
      const nodes = await Promise.all(entries.map((entry) => loadWorkspaceRepositoryNode(routeService, entry)));
      const visibleNodes = sortWorkspaceRepositoryNodes(nodes.filter(isRepositoryNode));

      return {
        id: rootPath,
        path: rootPath,
        name: getFileName(rootPath),
        nodes: visibleNodes,
      } satisfies WorkspaceRepositoryRoot;
    }),
  );

  return roots.filter((root) => root.nodes.length > 0);
}
