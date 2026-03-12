import React from "react";
import { ChipsButton, ChipsCardShell } from "@chips/component-library";
import { useWorkspaceSession } from "../../../app/providers/workspace-session-context";
import { useEditorRuntime } from "../../../app/providers/editor-runtime-context";
import { useEditorTranslation } from "../../../shared/runtime/use-editor-translation";

export function WorkspaceSettingsPanel() {
  const { snapshot } = useEditorRuntime();
  const {
    activeDocument,
    documents,
    recentTargets,
    busy,
    openDocumentFromDialog,
    refreshActiveDocument,
  } = useWorkspaceSession();
  const translate = useEditorTranslation(snapshot?.locale);

  return (
    <ChipsCardShell
      title={translate("editingEngine.settings.categories.workspace.title")}
      toolbar={
        <div className="settings-center__toolbar">
          <ChipsButton
            variant="primary"
            disabled={snapshot?.runtimeMode !== "host" || busy}
            onPress={() => {
              void openDocumentFromDialog();
            }}
          >
            {translate("editingEngine.actions.openDocument")}
          </ChipsButton>
          <ChipsButton
            variant="secondary"
            disabled={!activeDocument || busy}
            onPress={() => {
              void refreshActiveDocument();
            }}
          >
            {translate("editingEngine.actions.refreshDocument")}
          </ChipsButton>
        </div>
      }
    >
      <div className="settings-center__panel-stack">
        <p>{translate("editingEngine.settings.categories.workspace.description")}</p>
        <div className="settings-center__detail-list">
          <div>
            <span>{translate("editingEngine.fields.openDocumentCount")}</span>
            <strong>{documents.length}</strong>
          </div>
          <div>
            <span>{translate("editingEngine.fields.recentTargetCount")}</span>
            <strong>{recentTargets.length}</strong>
          </div>
          <div>
            <span>{translate("editingEngine.fields.activeDocument")}</span>
            <strong>{activeDocument?.title ?? translate("editingEngine.values.notAvailable")}</strong>
          </div>
        </div>
      </div>
    </ChipsCardShell>
  );
}
