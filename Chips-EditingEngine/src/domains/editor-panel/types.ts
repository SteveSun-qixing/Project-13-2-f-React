export type EditorPanelWidthPreset = "compact" | "standard" | "expanded";

export interface EditorPanelState {
  collapsed: boolean;
  widthPreset: EditorPanelWidthPreset;
  autoOpenOnSelection: boolean;
}
