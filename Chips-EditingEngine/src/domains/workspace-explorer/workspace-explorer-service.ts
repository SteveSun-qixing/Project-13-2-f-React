import type { RecentWorkspaceTarget, RuntimeFileStat } from "../../shared/runtime/editor-route-service";
import type { WorkspaceDocument } from "../workspace/types";
import { detectWorkspaceDocumentKind, getFileName } from "../workspace/workspace-service";
import type { WorkspaceExplorerEntry, WorkspaceExplorerNode, WorkspaceExplorerNodeKind } from "./types";

function getPathSegments(pathname: string): string[] {
  return pathname.split(/[\\/]/).filter(Boolean);
}

export function getParentDirectoryPath(pathname: string): string | null {
  const normalized = pathname.trim();
  if (!normalized) {
    return null;
  }

  const segments = getPathSegments(normalized);
  if (segments.length <= 1) {
    return null;
  }

  const separator = normalized.includes("\\") ? "\\" : "/";
  const prefix = normalized.startsWith("/") ? "/" : "";
  return `${prefix}${segments.slice(0, -1).join(separator)}`;
}

function uniquePaths(paths: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const item of paths) {
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    ordered.push(item);
  }

  return ordered;
}

export function buildWorkspaceExplorerRoots(params: {
  documents: WorkspaceDocument[];
  recentTargets: RecentWorkspaceTarget[];
  launchTargetPath: string | null;
}): string[] {
  const documentRoots = params.documents.map((document) => getParentDirectoryPath(document.path));
  const recentRoots = params.recentTargets.map((target) => getParentDirectoryPath(target.path));
  const launchRoot = getParentDirectoryPath(params.launchTargetPath ?? "");

  return uniquePaths([...documentRoots, launchRoot, ...recentRoots]);
}

export function isWorkspaceExplorerDocumentPath(pathname: string): boolean {
  return detectWorkspaceDocumentKind(pathname) !== null;
}

function resolveEntryKind(pathname: string, stat: RuntimeFileStat | null): WorkspaceExplorerNodeKind | null {
  const documentKind = detectWorkspaceDocumentKind(pathname);
  if (documentKind) {
    return documentKind;
  }
  if (stat?.isDirectory) {
    return "directory";
  }
  return null;
}

export function createWorkspaceExplorerEntry(pathname: string, stat: RuntimeFileStat | null): WorkspaceExplorerEntry | null {
  const kind = resolveEntryKind(pathname, stat);
  if (!kind) {
    return null;
  }

  return {
    id: pathname,
    path: pathname,
    name: getFileName(pathname),
    kind,
    stat,
  };
}

export function sortWorkspaceExplorerEntries(entries: WorkspaceExplorerEntry[]): WorkspaceExplorerEntry[] {
  return [...entries].sort((left, right) => {
    if (left.kind === "directory" && right.kind !== "directory") {
      return -1;
    }
    if (left.kind !== "directory" && right.kind === "directory") {
      return 1;
    }
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

export function mergeExpandedDirectoryIds(current: string[], roots: string[]): string[] {
  return uniquePaths([...roots, ...current]);
}

function buildDirectoryNode(
  directoryPath: string,
  directoryEntries: Record<string, WorkspaceExplorerEntry[]>,
  expandedIds: Set<string>,
): WorkspaceExplorerNode {
  const children = expandedIds.has(directoryPath)
    ? (directoryEntries[directoryPath] ?? []).map((entry) => buildWorkspaceExplorerNode(entry, directoryEntries, expandedIds))
    : [];

  return {
    id: directoryPath,
    path: directoryPath,
    name: getFileName(directoryPath) || directoryPath,
    kind: "directory",
    children,
    expandable: true,
  };
}

function buildWorkspaceExplorerNode(
  entry: WorkspaceExplorerEntry,
  directoryEntries: Record<string, WorkspaceExplorerEntry[]>,
  expandedIds: Set<string>,
): WorkspaceExplorerNode {
  if (entry.kind === "directory") {
    return buildDirectoryNode(entry.path, directoryEntries, expandedIds);
  }

  return {
    id: entry.id,
    path: entry.path,
    name: entry.name,
    kind: entry.kind,
    children: [],
    expandable: false,
  };
}

export function buildWorkspaceExplorerTree(params: {
  roots: string[];
  directoryEntries: Record<string, WorkspaceExplorerEntry[]>;
  expandedIds: string[];
}): WorkspaceExplorerNode[] {
  const expandedSet = new Set(params.expandedIds);
  return params.roots.map((root) => buildDirectoryNode(root, params.directoryEntries, expandedSet));
}
