import React from "react";
import { ChipsButton, ChipsRadioGroup, ChipsSelect, ChipsSwitch, type TabsItem } from "@chips/component-library";
import type { EditorLayoutMode } from "../../../config/app-config";
import type { EditorPanelState, EditorPanelWidthPreset } from "../../domains/editor-panel/types";
import type { WorkspaceDocument } from "../../domains/workspace/types";
import type { EditorRuntimeSnapshot } from "../../shared/types/runtime";

interface SettingFieldProps {
  label: string;
  description: string;
  control: React.ReactNode;
}

function SettingField({ label, description, control }: SettingFieldProps) {
  return (
    <section className="editor-settings__field">
      <div className="editor-settings__field-copy">
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <div className="editor-settings__field-control">{control}</div>
    </section>
  );
}

function SettingMetaItem(props: { label: string; value: string }) {
  return (
    <div className="editor-settings__meta-item">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

export interface EditorSettingsRegistryContext {
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

export function createEditorSettingsTabs(context: EditorSettingsRegistryContext): TabsItem[] {
  const themeOptions = context.visibleThemes.map((theme) => ({
    value: theme.id,
    label: `${theme.displayName} (${theme.version})`,
  }));
  const localeOptions = context.snapshot.locales.map((locale) => ({
    value: locale,
    label: locale,
  }));

  return [
    {
      value: "theme",
      label: context.translate("editingEngine.settings.tabs.theme"),
      content: (
        <div className="editor-settings__section">
          <SettingField
            label={context.translate("editingEngine.settings.theme.label")}
            description={context.translate("editingEngine.settings.theme.description")}
            control={
              <ChipsSelect
                value={context.snapshot.theme.themeId}
                disabled={context.snapshot.runtimeMode !== "host" || context.busyAction === "theme"}
                options={themeOptions}
                onValueChange={(nextValue) => {
                  void context.onSetTheme(nextValue);
                }}
              />
            }
          />
          <SettingMetaItem
            label={context.translate("editingEngine.settings.common.currentValue")}
            value={context.snapshot.theme.displayName}
          />
        </div>
      ),
    },
    {
      value: "locale",
      label: context.translate("editingEngine.settings.tabs.locale"),
      content: (
        <div className="editor-settings__section">
          <SettingField
            label={context.translate("editingEngine.settings.locale.label")}
            description={context.translate("editingEngine.settings.locale.description")}
            control={
              <ChipsSelect
                value={context.snapshot.locale}
                disabled={context.snapshot.runtimeMode !== "host" || context.busyAction === "locale"}
                options={localeOptions}
                onValueChange={(nextValue) => {
                  void context.onSetLocale(nextValue);
                }}
              />
            }
          />
        </div>
      ),
    },
    {
      value: "layout",
      label: context.translate("editingEngine.settings.tabs.layout"),
      content: (
        <div className="editor-settings__section">
          <SettingField
            label={context.translate("editingEngine.settings.layout.label")}
            description={context.translate("editingEngine.settings.layout.description")}
            control={
              <ChipsRadioGroup
                value={context.snapshot.preferredLayout}
                disabled={context.busyAction === "layout"}
                options={[
                  { value: "workbench", label: context.translate("editingEngine.layout.workbench") },
                  { value: "infinite-canvas", label: context.translate("editingEngine.layout.infiniteCanvas") },
                ]}
                onValueChange={(nextValue) => {
                  void context.onSetLayoutMode(nextValue as EditorLayoutMode);
                }}
              />
            }
          />
        </div>
      ),
    },
    {
      value: "editor",
      label: context.translate("editingEngine.settings.tabs.editor"),
      content: (
        <div className="editor-settings__section">
          <SettingField
            label={context.translate("editingEngine.settings.editor.visibilityLabel")}
            description={context.translate("editingEngine.settings.editor.visibilityDescription")}
            control={
              <ChipsSwitch
                checked={!context.panelState.collapsed}
                disabled={context.panelBusy}
                label={context.translate(
                  context.panelState.collapsed
                    ? "editingEngine.actions.expandEditorPanel"
                    : "editingEngine.actions.collapseEditorPanel",
                )}
                onCheckedChange={(nextValue) => {
                  void context.onSetPanelCollapsed(!nextValue);
                }}
              />
            }
          />
          <SettingField
            label={context.translate("editingEngine.settings.editor.widthLabel")}
            description={context.translate("editingEngine.settings.editor.widthDescription")}
            control={
              <ChipsRadioGroup
                value={context.panelState.widthPreset}
                disabled={context.panelBusy}
                options={[
                  { value: "compact", label: context.translate("editingEngine.panelWidth.compact") },
                  { value: "standard", label: context.translate("editingEngine.panelWidth.standard") },
                  { value: "expanded", label: context.translate("editingEngine.panelWidth.expanded") },
                ]}
                onValueChange={(nextValue) => {
                  void context.onSetPanelWidthPreset(nextValue as EditorPanelWidthPreset);
                }}
              />
            }
          />
          <SettingField
            label={context.translate("editingEngine.settings.editor.autoOpenLabel")}
            description={context.translate("editingEngine.settings.editor.autoOpenDescription")}
            control={
              <ChipsSwitch
                checked={context.panelState.autoOpenOnSelection}
                disabled={context.panelBusy}
                label={context.translate("editingEngine.settings.editor.autoOpenLabel")}
                onCheckedChange={(nextValue) => {
                  void context.onSetPanelAutoOpen(nextValue);
                }}
              />
            }
          />
        </div>
      ),
    },
    {
      value: "workspace",
      label: context.translate("editingEngine.settings.tabs.workspace"),
      content: (
        <div className="editor-settings__section">
          <SettingMetaItem
            label={context.translate("editingEngine.settings.workspace.activeDocument")}
            value={context.activeDocument?.title ?? context.translate("editingEngine.values.notAvailable")}
          />
          <SettingMetaItem
            label={context.translate("editingEngine.settings.workspace.recentTargets")}
            value={String(context.recentTargetsCount)}
          />
          <div className="editor-settings__actions">
            <ChipsButton
              variant="secondary"
              disabled={context.recentTargetsCount === 0}
              onPress={() => {
                void context.onClearRecentTargets();
              }}
            >
              {context.translate("editingEngine.settings.workspace.clearRecentTargets")}
            </ChipsButton>
          </div>
        </div>
      ),
    },
    {
      value: "about",
      label: context.translate("editingEngine.settings.tabs.about"),
      content: (
        <div className="editor-settings__section">
          <SettingMetaItem
            label={context.translate("editingEngine.fields.pluginId")}
            value={context.snapshot.plugin.id}
          />
          <SettingMetaItem
            label={context.translate("editingEngine.fields.version")}
            value={context.snapshot.plugin.version}
          />
          <SettingMetaItem
            label={context.translate("editingEngine.fields.environment")}
            value={`${context.snapshot.platform.os} ${context.snapshot.platform.version}`}
          />
          <SettingMetaItem
            label={context.translate("editingEngine.fields.sessionId")}
            value={context.snapshot.launchContext.sessionId ?? context.translate("editingEngine.values.notAvailable")}
          />
        </div>
      ),
    },
  ];
}
