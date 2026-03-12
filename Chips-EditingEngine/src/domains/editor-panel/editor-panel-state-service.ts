import type { EditorPanelState, EditorPanelWidthPreset } from "./types";

export const DEFAULT_EDITOR_PANEL_STATE: EditorPanelState = {
  collapsed: false,
  widthPreset: "standard",
  autoOpenOnSelection: true,
};

const PANEL_WIDTH_PRESET_PX: Record<EditorPanelWidthPreset, number> = {
  compact: 360,
  standard: 440,
  expanded: 540,
};

function isWidthPreset(value: unknown): value is EditorPanelWidthPreset {
  return value === "compact" || value === "standard" || value === "expanded";
}

export function sanitizeEditorPanelState(input: unknown): EditorPanelState {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ...DEFAULT_EDITOR_PANEL_STATE };
  }

  const candidate = input as Partial<EditorPanelState>;
  return {
    collapsed: candidate.collapsed === true,
    widthPreset: isWidthPreset(candidate.widthPreset)
      ? candidate.widthPreset
      : DEFAULT_EDITOR_PANEL_STATE.widthPreset,
    autoOpenOnSelection:
      typeof candidate.autoOpenOnSelection === "boolean"
        ? candidate.autoOpenOnSelection
        : DEFAULT_EDITOR_PANEL_STATE.autoOpenOnSelection,
  };
}

export function getEditorPanelWidthPx(widthPreset: EditorPanelWidthPreset): number {
  return PANEL_WIDTH_PRESET_PX[widthPreset];
}
