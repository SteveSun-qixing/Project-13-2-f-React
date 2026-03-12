import type { ComponentType } from "react";

export type SettingsPanelGroup = "appearance" | "workspace" | "system";

export interface SettingsCategoryMeta {
  id: string;
  labelKey: string;
  descriptionKey: string;
  order: number;
  group: SettingsPanelGroup;
}

export interface SettingsPanelDefinition {
  category: SettingsCategoryMeta;
  component: ComponentType;
}
