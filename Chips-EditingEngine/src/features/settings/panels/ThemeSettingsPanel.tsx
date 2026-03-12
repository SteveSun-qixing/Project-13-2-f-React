import React, { useMemo } from "react";
import { ChipsCardShell, ChipsSelect } from "@chips/component-library";
import { useEditorRuntime } from "../../../app/providers/editor-runtime-context";
import { getVisibleThemes } from "../../../shared/runtime/editor-runtime-service";
import { useEditorTranslation } from "../../../shared/runtime/use-editor-translation";

export function ThemeSettingsPanel() {
  const { snapshot, busyAction, setTheme } = useEditorRuntime();
  const translate = useEditorTranslation(snapshot?.locale);

  const options = useMemo(
    () =>
      snapshot
        ? getVisibleThemes(snapshot.availableThemes).map((theme) => ({
            value: theme.id,
            label: theme.displayName,
          }))
        : [],
    [snapshot],
  );

  if (!snapshot) {
    return null;
  }

  return (
    <ChipsCardShell title={translate("editingEngine.settings.categories.theme.title")}>
      <div className="settings-center__panel-stack">
        <p>{translate("editingEngine.settings.categories.theme.description")}</p>
        <ChipsSelect
          value={snapshot.theme.themeId}
          disabled={busyAction === "theme" || snapshot.runtimeMode !== "host"}
          options={options}
          onValueChange={(value) => {
            void setTheme(value);
          }}
        />
        <div className="settings-center__detail-list">
          <div>
            <span>{translate("editingEngine.fields.themeName")}</span>
            <strong>{snapshot.theme.displayName}</strong>
          </div>
          <div>
            <span>{translate("editingEngine.fields.themeId")}</span>
            <strong>{snapshot.theme.themeId}</strong>
          </div>
        </div>
      </div>
    </ChipsCardShell>
  );
}
