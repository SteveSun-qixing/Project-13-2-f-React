export type AppSceneId = "start" | "deck";

export interface AppSceneDefinition {
  id: AppSceneId;
  title: string;
  description: string;
}

export const sceneDefinitions: AppSceneDefinition[] = [
  {
    id: "start",
    title: "起始页",
    description: "打开或拖入 PowerPoint 演示文稿",
  },
  {
    id: "deck",
    title: "编辑",
    description: "幻灯片编辑视图",
  },
];

export const defaultSceneDefinition = sceneDefinitions[0];

export function isAppSceneId(sceneId: string): sceneId is AppSceneId {
  return sceneDefinitions.some((scene) => scene.id === sceneId);
}

export function getSceneDefinition(sceneId: string | null | undefined): AppSceneDefinition {
  if (sceneId && isAppSceneId(sceneId)) {
    return sceneDefinitions.find((scene) => scene.id === sceneId) ?? defaultSceneDefinition;
  }
  return defaultSceneDefinition;
}
