import React from "react";
import { ChipsCardShell, ChipsRadioGroup } from "@chips/component-library";
import type { EditorLayoutMode } from "../../../../config/app-config";
import { useEditorRuntime } from "../../../app/providers/editor-runtime-context";
import { useEditorTranslation } from "../../../shared/runtime/use-editor-translation";

export function LayoutSettingsPanel() {
  const { snapshot, busyAction, setLayoutMode } = useEditorRuntime();
  const translate = useEditorTranslation(snapshot?.locale);

  if (!snapshot) {
    return null;
  }

  const options: Array<{ value: EditorLayoutMode; label: string }> = [
    { value: "workbench", label: translate("editingEngine.layout.workbench") },
    { value: "infinite-canvas", label: translate("editingEngine.layout.infiniteCanvas") },
  ];

  return (
    <ChipsCardShell title={translate("editingEngine.settings.categories.layout.title")}>
      <div className="settings-center__panel-stack">
        <p>{translate("editingEngine.settings.categories.layout.description")}</p>
        <ChipsRadioGroup
          value={snapshot.preferredLayout}
          disabled={busyAction === "layout"}
          options={options}
          onValueChange={(value) => {
            void setLayoutMode(value as EditorLayoutMode);
          }}
        />
        <div className="settings-center__note-list">
          <div>
            <strong>{translate("editingEngine.layout.workbench")}</strong>
            <span>{translate("editingEngine.layoutDescriptions.workbench")}</span>
          </div>
          <div>
            <strong>{translate("editingEngine.layout.infiniteCanvas")}</strong>
            <span>{translate("editingEngine.layoutDescriptions.infiniteCanvas")}</span>
          </div>
        </div>
      </div>
    </ChipsCardShell>
  );
}
