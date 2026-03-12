import React from "react";
import { ChipsCardShell, ChipsRadioGroup, ChipsSwitch } from "@chips/component-library";
import { useEditorPanel } from "../../../app/providers/editor-panel-context";
import { useEditorRuntime } from "../../../app/providers/editor-runtime-context";
import { useEditorTranslation } from "../../../shared/runtime/use-editor-translation";

export function EditorPanelSettingsPanel() {
  const { snapshot } = useEditorRuntime();
  const { state, busy, error, setCollapsed, setWidthPreset, setAutoOpenOnSelection } = useEditorPanel();
  const translate = useEditorTranslation(snapshot?.locale);

  return (
    <ChipsCardShell title={translate("editingEngine.settings.categories.editor.title")}>
      <div className="settings-center__panel-stack">
        <p>{translate("editingEngine.settings.categories.editor.description")}</p>
        {error ? <p className="editor-shell__error-banner">{error}</p> : null}
        <div className="settings-center__field-stack">
          <section className="settings-center__field-block">
            <strong>{translate("editingEngine.settings.editor.visibilityLabel")}</strong>
            <p>{translate("editingEngine.settings.editor.visibilityDescription")}</p>
            <ChipsSwitch
              checked={!state.collapsed}
              disabled={busy}
              label={translate(state.collapsed ? "editingEngine.values.panelCollapsed" : "editingEngine.values.panelExpanded")}
              onCheckedChange={(nextValue) => {
                void setCollapsed(!nextValue);
              }}
            />
          </section>

          <section className="settings-center__field-block">
            <strong>{translate("editingEngine.settings.editor.widthLabel")}</strong>
            <p>{translate("editingEngine.settings.editor.widthDescription")}</p>
            <ChipsRadioGroup
              value={state.widthPreset}
              disabled={busy}
              options={[
                { value: "compact", label: translate("editingEngine.panelWidth.compact") },
                { value: "standard", label: translate("editingEngine.panelWidth.standard") },
                { value: "expanded", label: translate("editingEngine.panelWidth.expanded") },
              ]}
              onValueChange={(nextValue) => {
                void setWidthPreset(nextValue as "compact" | "standard" | "expanded");
              }}
            />
          </section>

          <section className="settings-center__field-block">
            <strong>{translate("editingEngine.settings.editor.autoOpenLabel")}</strong>
            <p>{translate("editingEngine.settings.editor.autoOpenDescription")}</p>
            <ChipsSwitch
              checked={state.autoOpenOnSelection}
              disabled={busy}
              label={translate("editingEngine.settings.editor.autoOpenLabel")}
              onCheckedChange={(nextValue) => {
                void setAutoOpenOnSelection(nextValue);
              }}
            />
          </section>
        </div>
      </div>
    </ChipsCardShell>
  );
}
