import { describe, expect, it } from "vitest";
import {
  DEFAULT_EDITOR_PANEL_STATE,
  getEditorPanelWidthPx,
  sanitizeEditorPanelState,
} from "../../src/domains/editor-panel/editor-panel-state-service";

describe("editor-panel-state-service", () => {
  it("returns defaults for invalid state payloads", () => {
    expect(sanitizeEditorPanelState(null)).toEqual(DEFAULT_EDITOR_PANEL_STATE);
    expect(sanitizeEditorPanelState("invalid")).toEqual(DEFAULT_EDITOR_PANEL_STATE);
  });

  it("sanitizes persisted state and drops unsupported values", () => {
    expect(
      sanitizeEditorPanelState({
        collapsed: true,
        widthPreset: "expanded",
        autoOpenOnSelection: false,
      }),
    ).toEqual({
      collapsed: true,
      widthPreset: "expanded",
      autoOpenOnSelection: false,
    });

    expect(
      sanitizeEditorPanelState({
        collapsed: false,
        widthPreset: "giant",
        autoOpenOnSelection: "yes",
      }),
    ).toEqual({
      collapsed: false,
      widthPreset: "standard",
      autoOpenOnSelection: true,
    });
  });

  it("maps width presets to stable panel widths", () => {
    expect(getEditorPanelWidthPx("compact")).toBe(360);
    expect(getEditorPanelWidthPx("standard")).toBe(440);
    expect(getEditorPanelWidthPx("expanded")).toBe(540);
  });
});
