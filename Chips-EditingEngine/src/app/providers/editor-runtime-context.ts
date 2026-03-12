import { createContext, useContext } from "react";
import type { EditorLayoutMode } from "../../../config/app-config";
import type { EditorRuntimeSnapshot } from "../../shared/types/runtime";

export interface EditorRuntimeContextValue {
  snapshot: EditorRuntimeSnapshot | null;
  loading: boolean;
  busyAction: "theme" | "locale" | "layout" | "refresh" | null;
  error: string | null;
  refresh(): Promise<void>;
  setTheme(themeId: string): Promise<void>;
  setLocale(locale: string): Promise<void>;
  setLayoutMode(layoutMode: EditorLayoutMode): Promise<void>;
}

export const EditorRuntimeContext = createContext<EditorRuntimeContextValue | null>(null);

export function useEditorRuntime() {
  const context = useContext(EditorRuntimeContext);
  if (!context) {
    throw new Error("useEditorRuntime must be used within EditorRuntimeProvider.");
  }
  return context;
}
