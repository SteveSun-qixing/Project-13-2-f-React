import { createContext, useContext } from "react";
import type { EditorPanelState, EditorPanelWidthPreset } from "../../domains/editor-panel/types";

export interface EditorPanelContextValue {
  state: EditorPanelState;
  loading: boolean;
  busy: boolean;
  error: string | null;
  setCollapsed(collapsed: boolean): Promise<void>;
  toggleCollapsed(): Promise<void>;
  setWidthPreset(widthPreset: EditorPanelWidthPreset): Promise<void>;
  setAutoOpenOnSelection(enabled: boolean): Promise<void>;
  openForSelection(): Promise<void>;
}

export const EditorPanelContext = createContext<EditorPanelContextValue | null>(null);

export function useEditorPanel() {
  const context = useContext(EditorPanelContext);
  if (!context) {
    throw new Error("useEditorPanel must be used within EditorPanelProvider.");
  }
  return context;
}
