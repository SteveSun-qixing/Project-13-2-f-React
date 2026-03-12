import type { BoxInspection, CardAst, CardRenderView, CardValidationResult, RecentWorkspaceTarget } from "../../shared/runtime/editor-route-service";
import type { BoxWorkspaceDocument, CardWorkspaceDocument, WorkspaceDocument, WorkspaceDocumentKind } from "./types";

const RECENT_TARGETS_LIMIT = 8;

export function detectWorkspaceDocumentKind(pathname: string): WorkspaceDocumentKind | null {
  const normalized = pathname.toLowerCase();
  if (normalized.endsWith(".card")) {
    return "card";
  }
  if (normalized.endsWith(".box")) {
    return "box";
  }
  return null;
}

export function createWorkspaceDocumentId(pathname: string): string {
  return pathname;
}

export function getFileName(pathname: string): string {
  const segments = pathname.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? pathname;
}

function readTitleFromCardAst(ast: CardAst, pathname: string): string {
  const metadataName = ast.metadata?.name;
  return typeof metadataName === "string" && metadataName.trim().length > 0 ? metadataName : getFileName(pathname);
}

function readTitleFromBoxInspection(inspection: BoxInspection, pathname: string): string {
  const metadataName = inspection.metadata?.name;
  return typeof metadataName === "string" && metadataName.trim().length > 0 ? metadataName : getFileName(pathname);
}

export function createCardWorkspaceDocument(params: {
  path: string;
  ast: CardAst;
  validation: CardValidationResult;
  preview: CardRenderView;
}): CardWorkspaceDocument {
  return {
    id: createWorkspaceDocumentId(params.path),
    path: params.path,
    kind: "card",
    title: readTitleFromCardAst(params.ast, params.path),
    openedAt: new Date().toISOString(),
    ast: params.ast,
    validation: params.validation,
    preview: params.preview,
  };
}

export function createBoxWorkspaceDocument(params: {
  path: string;
  inspection: BoxInspection;
}): BoxWorkspaceDocument {
  return {
    id: createWorkspaceDocumentId(params.path),
    path: params.path,
    kind: "box",
    title: readTitleFromBoxInspection(params.inspection, params.path),
    openedAt: new Date().toISOString(),
    inspection: params.inspection,
  };
}

export function upsertWorkspaceDocument(
  documents: WorkspaceDocument[],
  nextDocument: WorkspaceDocument,
): WorkspaceDocument[] {
  const filtered = documents.filter((item) => item.id !== nextDocument.id);
  return [nextDocument, ...filtered];
}

export function buildRecentWorkspaceTargets(
  current: RecentWorkspaceTarget[],
  document: WorkspaceDocument,
): RecentWorkspaceTarget[] {
  const nextRecord: RecentWorkspaceTarget = {
    path: document.path,
    kind: document.kind,
    title: document.title,
    openedAt: document.openedAt,
  };

  const filtered = current.filter((item) => item.path !== document.path);
  return [nextRecord, ...filtered].slice(0, RECENT_TARGETS_LIMIT);
}

export function sanitizeRecentWorkspaceTargets(input: unknown): RecentWorkspaceTarget[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is RecentWorkspaceTarget => {
      return (
        !!item &&
        typeof item === "object" &&
        typeof (item as RecentWorkspaceTarget).path === "string" &&
        ((item as RecentWorkspaceTarget).kind === "card" || (item as RecentWorkspaceTarget).kind === "box") &&
        typeof (item as RecentWorkspaceTarget).title === "string" &&
        typeof (item as RecentWorkspaceTarget).openedAt === "string"
      );
    })
    .slice(0, RECENT_TARGETS_LIMIT);
}
