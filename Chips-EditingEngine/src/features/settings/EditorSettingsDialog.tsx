import React, { useMemo } from "react";
import { ChipsDialog, ChipsTabs } from "@chips/component-library";
import type { EditorLayoutMode } from "../../../config/app-config";
import type { EditorPanelState, EditorPanelWidthPreset } from "../../domains/editor-panel/types";
import type { WorkspaceDocument } from "../../domains/workspace/types";
import type { EditorRuntimeSnapshot } from "../../shared/types/runtime";
import { createEditorSettingsTabs } from "./editor-settings-registry";

interface EditorSettingsDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  translate(key: string): string;
  snapshot: EditorRuntimeSnapshot;
  visibleThemes: EditorRuntimeSnapshot["availableThemes"];
  busyAction: "theme" | "locale" | "layout" | "refresh" | null;
  activeDocument: WorkspaceDocument | null;
  recentTargetsCount: number;
  panelState: EditorPanelState;
  panelBusy: boolean;
  onSetTheme(themeId: string): Promise<void>;
  onSetLocale(locale: string): Promise<void>;
  onSetLayoutMode(layoutMode: EditorLayoutMode): Promise<void>;
  onClearRecentTargets(): Promise<void>;
  onSetPanelCollapsed(collapsed: boolean): Promise<void>;
  onSetPanelWidthPreset(widthPreset: EditorPanelWidthPreset): Promise<void>;
  onSetPanelAutoOpen(enabled: boolean): Promise<void>;
}

export function EditorSettingsDialog({
  open,
  onOpenChange,
  translate,
  snapshot,
  visibleThemes,
  busyAction,
  activeDocument,
  recentTargetsCount,
  panelState,
  panelBusy,
  onSetTheme,
  onSetLocale,
  onSetLayoutMode,
  onClearRecentTargets,
  onSetPanelCollapsed,
  onSetPanelWidthPreset,
  onSetPanelAutoOpen,
}: EditorSettingsDialogProps) {
  const items = useMemo(
    () =>
      createEditorSettingsTabs({
        translate,
        snapshot,
        visibleThemes,
        busyAction,
        activeDocument,
        recentTargetsCount,
        panelState,
        panelBusy,
        onSetTheme,
        onSetLocale,
        onSetLayoutMode,
        onClearRecentTargets,
        onSetPanelCollapsed,
        onSetPanelWidthPreset,
        onSetPanelAutoOpen,
      }),
    [
      activeDocument?.title,
      busyAction,
      onClearRecentTargets,
      onSetLayoutMode,
      onSetLocale,
      onSetPanelAutoOpen,
      onSetPanelCollapsed,
      onSetPanelWidthPreset,
      onSetTheme,
      panelBusy,
      panelState,
      recentTargetsCount,
      snapshot,
      translate,
      visibleThemes,
    ],
  );

  return (
    <ChipsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={translate("editingEngine.settings.title")}
      description={translate("editingEngine.settings.description")}
      closeButtonLabel={translate("editingEngine.settings.close")}
    >
      <div className="editor-settings">
        <ChipsTabs items={items} defaultValue="theme" />
      </div>
    </ChipsDialog>
  );
}
