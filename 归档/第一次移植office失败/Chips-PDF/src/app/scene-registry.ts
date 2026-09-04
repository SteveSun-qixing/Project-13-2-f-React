export type AppSceneId = "start" | "document";

export interface AppSceneDefinition {
  id: AppSceneId;
  title: string;
  description: string;
}

export const sceneDefinitions: AppSceneDefinition[] = [
  {
    id: "start",
    title: "起始页",
    description: "打开或拖入 PDF 文档",
  },
  {
    id: "document",
    title: "文档",
    description: "查看、批注并保存 PDF 文档",
  },
];

export const defaultSceneDefinition = sceneDefinitions[0];

export function isAppSceneId(sceneId: string): sceneId is AppSceneId {
  return sceneDefinitions.some((scene) => scene.id === sceneId);
}

export function getSceneDefinition(sceneId: string | null | undefined): AppSceneDefinition {
  if (sceneId && isAppSceneId(sceneId)) {
    return sceneDefinitions.find((scene) => scene.id === sceneId) ?? (defaultSceneDefinition as AppSceneDefinition);
  }
  return defaultSceneDefinition as AppSceneDefinition;
}
