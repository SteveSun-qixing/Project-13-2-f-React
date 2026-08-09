import { MENU_REGISTRY, type MenuId } from "./menu-registry";

export type SettingsSceneId = MenuId;

export interface SettingsSceneDefinition {
  id: SettingsSceneId;
  title: string;
  description: string;
  summary: string;
  category: string;
  render: () => React.ReactElement;
}

export const sceneDefinitions: SettingsSceneDefinition[] = MENU_REGISTRY.map((entry) => ({
  id: entry.id,
  title: entry.title,
  description: entry.summary,
  summary: entry.summary,
  category: entry.category,
  render: entry.render,
}));

export const defaultSceneDefinition = sceneDefinitions[0];

export function isSettingsSceneId(sceneId: string): sceneId is SettingsSceneId {
  return sceneDefinitions.some((scene) => scene.id === sceneId);
}

export function getSceneDefinition(sceneId: string | null | undefined): SettingsSceneDefinition {
  if (sceneId && isSettingsSceneId(sceneId)) {
    return sceneDefinitions.find((scene) => scene.id === sceneId) ?? defaultSceneDefinition;
  }
  return defaultSceneDefinition;
}
