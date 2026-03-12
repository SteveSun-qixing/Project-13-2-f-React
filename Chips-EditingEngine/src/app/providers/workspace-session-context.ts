import { createContext, useContext } from "react";
import type { WorkspaceDocument, WorkspaceSessionState } from "../../domains/workspace/types";

export interface WorkspaceSessionContextValue extends WorkspaceSessionState {
  loading: boolean;
  busy: boolean;
  error: string | null;
  repositoryLoading: boolean;
  repositoryError: string | null;
  activeDocument: WorkspaceDocument | null;
  openDocument(path: string): Promise<void>;
  openDocumentFromDialog(): Promise<void>;
  activateDocument(documentId: string): void;
  closeDocument(documentId: string): void;
  refreshActiveDocument(): Promise<void>;
  refreshRepository(): Promise<void>;
  clearRecentTargets(): Promise<void>;
}

export const WorkspaceSessionContext = createContext<WorkspaceSessionContextValue | null>(null);

export function useWorkspaceSession() {
  const context = useContext(WorkspaceSessionContext);
  if (!context) {
    throw new Error("useWorkspaceSession must be used within WorkspaceSessionProvider.");
  }
  return context;
}
