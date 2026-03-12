import React, { useEffect, useMemo, useState } from "react";
import { ChipsTabs } from "@chips/component-library";
import { useEditorRuntime } from "../../app/providers/editor-runtime-context";
import { useEditorTranslation } from "../../shared/runtime/use-editor-translation";
import { getBuiltinSettingsPanelDefinitions } from "./settings-registry";
import "./settings-center.css";

export function SettingsCenter() {
  const { snapshot } = useEditorRuntime();
  const translate = useEditorTranslation(snapshot?.locale);
  const panelDefinitions = useMemo(() => getBuiltinSettingsPanelDefinitions(), []);
  const [activePanelId, setActivePanelId] = useState(panelDefinitions[0]?.category.id ?? "workspace");

  useEffect(() => {
    if (!panelDefinitions.some((panel) => panel.category.id === activePanelId)) {
      setActivePanelId(panelDefinitions[0]?.category.id ?? "workspace");
    }
  }, [activePanelId, panelDefinitions]);

  return (
    <ChipsTabs
      orientation="vertical"
      value={activePanelId}
      onValueChange={setActivePanelId}
      items={panelDefinitions.map((panel) => ({
        value: panel.category.id,
        label: (
          <div className="settings-center__tab-label">
            <strong>{translate(panel.category.labelKey)}</strong>
            <span>{translate(panel.category.descriptionKey)}</span>
          </div>
        ),
        content: <panel.component />,
      }))}
    />
  );
}
