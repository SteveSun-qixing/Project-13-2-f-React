import type { SettingsPanelDefinition } from "../../domains/settings/types";
import { EditorPanelSettingsPanel } from "./panels/EditorPanelSettingsPanel";
import { LayoutSettingsPanel } from "./panels/LayoutSettingsPanel";
import { LocaleSettingsPanel } from "./panels/LocaleSettingsPanel";
import { RuntimeSettingsPanel } from "./panels/RuntimeSettingsPanel";
import { ThemeSettingsPanel } from "./panels/ThemeSettingsPanel";
import { WorkspaceSettingsPanel } from "./panels/WorkspaceSettingsPanel";

const builtinSettingsPanelDefinitions: SettingsPanelDefinition[] = [
  {
    category: {
      id: "workspace",
      labelKey: "editingEngine.settings.categories.workspace.title",
      descriptionKey: "editingEngine.settings.categories.workspace.description",
      order: 100,
      group: "workspace",
    },
    component: WorkspaceSettingsPanel,
  },
  {
    category: {
      id: "editor",
      labelKey: "editingEngine.settings.categories.editor.title",
      descriptionKey: "editingEngine.settings.categories.editor.description",
      order: 150,
      group: "workspace",
    },
    component: EditorPanelSettingsPanel,
  },
  {
    category: {
      id: "layout",
      labelKey: "editingEngine.settings.categories.layout.title",
      descriptionKey: "editingEngine.settings.categories.layout.description",
      order: 200,
      group: "appearance",
    },
    component: LayoutSettingsPanel,
  },
  {
    category: {
      id: "theme",
      labelKey: "editingEngine.settings.categories.theme.title",
      descriptionKey: "editingEngine.settings.categories.theme.description",
      order: 300,
      group: "appearance",
    },
    component: ThemeSettingsPanel,
  },
  {
    category: {
      id: "locale",
      labelKey: "editingEngine.settings.categories.locale.title",
      descriptionKey: "editingEngine.settings.categories.locale.description",
      order: 400,
      group: "appearance",
    },
    component: LocaleSettingsPanel,
  },
  {
    category: {
      id: "runtime",
      labelKey: "editingEngine.settings.categories.runtime.title",
      descriptionKey: "editingEngine.settings.categories.runtime.description",
      order: 500,
      group: "system",
    },
    component: RuntimeSettingsPanel,
  },
];

export function getBuiltinSettingsPanelDefinitions(): SettingsPanelDefinition[] {
  return [...builtinSettingsPanelDefinitions].sort((left, right) => left.category.order - right.category.order);
}
