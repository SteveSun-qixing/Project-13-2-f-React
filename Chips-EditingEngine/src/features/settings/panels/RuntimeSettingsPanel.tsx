import React from "react";
import { ChipsCardShell } from "@chips/component-library";
import { useEditorRuntime } from "../../../app/providers/editor-runtime-context";
import { useEditorTranslation } from "../../../shared/runtime/use-editor-translation";

export function RuntimeSettingsPanel() {
  const { snapshot } = useEditorRuntime();
  const translate = useEditorTranslation(snapshot?.locale);

  if (!snapshot) {
    return null;
  }

  return (
    <ChipsCardShell title={translate("editingEngine.settings.categories.runtime.title")}>
      <div className="settings-center__panel-stack">
        <p>{translate("editingEngine.settings.categories.runtime.description")}</p>
        <div className="settings-center__detail-list">
          <div>
            <span>{translate("editingEngine.fields.pluginId")}</span>
            <strong>{snapshot.plugin.id}</strong>
          </div>
          <div>
            <span>{translate("editingEngine.fields.version")}</span>
            <strong>{snapshot.plugin.version}</strong>
          </div>
          <div>
            <span>{translate("editingEngine.fields.sessionId")}</span>
            <strong>{snapshot.launchContext.sessionId ?? translate("editingEngine.values.notAvailable")}</strong>
          </div>
          <div>
            <span>{translate("editingEngine.fields.platform")}</span>
            <strong>{`${snapshot.platform.os} / ${snapshot.platform.arch}`}</strong>
          </div>
        </div>
      </div>
    </ChipsCardShell>
  );
}
