import type { BoxInspection, CardAst, CardRenderView, CardValidationResult, RecentWorkspaceTarget } from "../../shared/runtime/editor-route-service";

export type WorkspaceDocumentKind = "card" | "box";

export interface WorkspaceDocumentBase {
  id: string;
  path: string;
  kind: WorkspaceDocumentKind;
  title: string;
  openedAt: string;
}

export interface CardWorkspaceDocument extends WorkspaceDocumentBase {
  kind: "card";
  ast: CardAst;
  validation: CardValidationResult;
  preview: CardRenderView;
}

export interface BoxWorkspaceDocument extends WorkspaceDocumentBase {
  kind: "box";
  inspection: BoxInspection;
}

export type WorkspaceDocument = CardWorkspaceDocument | BoxWorkspaceDocument;

export type WorkspaceRepositoryNodeKind = "directory" | "card" | "box";

export interface WorkspaceRepositoryNode {
  id: string;
  path: string;
  name: string;
  kind: WorkspaceRepositoryNodeKind;
  children: WorkspaceRepositoryNode[];
}

export interface WorkspaceRepositoryRoot {
  id: string;
  path: string;
  name: string;
  nodes: WorkspaceRepositoryNode[];
}

export interface WorkspaceSessionState {
  documents: WorkspaceDocument[];
  activeDocumentId: string | null;
  recentTargets: RecentWorkspaceTarget[];
  repositoryRoots: WorkspaceRepositoryRoot[];
}
