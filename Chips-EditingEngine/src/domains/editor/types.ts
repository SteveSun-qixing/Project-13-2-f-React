import type { BaseCardRecord, CompositeNodeSelection } from "chips-sdk";

export interface CommandHistorySnapshot<T> {
  past: T[];
  present: T | null;
  future: T[];
}

export type EditorSaveState = "idle" | "pending" | "saving" | "saved" | "error";
export type EditorCommandKind = "initialize" | "change" | "undo" | "redo" | "sync";

export interface EditorCommandMeta {
  kind: EditorCommandKind;
  timestamp: string;
}

export interface BaseCardEditSession {
  selectedNode: CompositeNodeSelection;
  baseCard: BaseCardRecord;
  history: CommandHistorySnapshot<Record<string, unknown>>;
  historyLimit: number;
  lastCommand: EditorCommandMeta;
  lastSavedConfig: Record<string, unknown>;
  pendingSaveConfig: Record<string, unknown> | null;
  dirty: boolean;
  saveState: EditorSaveState;
  error: string | null;
}

export interface BaseCardEditorSessionSnapshot {
  selectedNode: CompositeNodeSelection | null;
  baseCardTitle: string | null;
  saveState: EditorSaveState;
  dirty: boolean;
  undoDepth: number;
  redoDepth: number;
  editorLoading: boolean;
  editorError: string | null;
  lastCommandKind: EditorCommandKind | null;
  lastCommandAt: string | null;
}
