import type { RuntimeFileStat } from "../../shared/runtime/editor-route-service";

export type WorkspaceExplorerNodeKind = "directory" | "card" | "box";

export interface WorkspaceExplorerEntry {
  id: string;
  path: string;
  name: string;
  kind: WorkspaceExplorerNodeKind;
  stat: RuntimeFileStat | null;
}

export interface WorkspaceExplorerNode {
  id: string;
  path: string;
  name: string;
  kind: WorkspaceExplorerNodeKind;
  children: WorkspaceExplorerNode[];
  expandable: boolean;
}
