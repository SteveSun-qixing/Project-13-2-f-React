import React from "react";
import { ChipsCardShell, ChipsRadioGroup } from "@chips/component-library";
import { useEditorRuntime } from "../../../app/providers/editor-runtime-context";
import { useEditorTranslation } from "../../../shared/runtime/use-editor-translation";

export function LocaleSettingsPanel() {
  const { snapshot, busyAction, setLocale } = useEditorRuntime();
  const translate = useEditorTranslation(snapshot?.locale);

  if (!snapshot) {
    return null;
  }

  return (
    <ChipsCardShell title={translate("editingEngine.settings.categories.locale.title")}>
      <div className="settings-center__panel-stack">
        <p>{translate("editingEngine.settings.categories.locale.description")}</p>
        <ChipsRadioGroup
          value={snapshot.locale}
          disabled={busyAction === "locale" || snapshot.runtimeMode !== "host"}
          options={snapshot.locales.map((locale) => ({
            value: locale,
            label: locale,
          }))}
          onValueChange={(value) => {
            void setLocale(value);
          }}
        />
      </div>
    </ChipsCardShell>
  );
}
