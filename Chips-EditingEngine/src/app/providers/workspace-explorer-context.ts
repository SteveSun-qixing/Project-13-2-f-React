import { createContext, useContext } from "react";
import type { WorkspaceExplorerNode } from "../../domains/workspace-explorer/types";

export interface WorkspaceExplorerContextValue {
  tree: WorkspaceExplorerNode[];
  roots: string[];
  expandedIds: string[];
  selectedId: string | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  setExpandedIds(nextExpandedIds: string[]): Promise<void>;
  selectNode(nodeId: string | null): Promise<void>;
  refresh(): Promise<void>;
}

export const WorkspaceExplorerContext = createContext<WorkspaceExplorerContextValue | null>(null);

export function useWorkspaceExplorer() {
  const context = useContext(WorkspaceExplorerContext);
  if (!context) {
    throw new Error("useWorkspaceExplorer must be used within WorkspaceExplorerProvider.");
  }
  return context;
}
