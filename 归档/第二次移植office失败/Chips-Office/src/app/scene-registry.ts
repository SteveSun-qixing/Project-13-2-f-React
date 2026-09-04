export type AppSceneId = "main" | "settings" | "word-editor" | "document" | "slide" | "sheet";

export interface AppSceneDefinition {
  id: AppSceneId;
  title: string;
  description: string;
}

export const sceneDefinitions: AppSceneDefinition[] = [
  {
    id: "main",
    title: "工作区",
    description: "当前应用场景与视图状态",
  },
  {
    id: "word-editor",
    title: "Word 编辑器",
    description: "文档编辑与查看",
  },
  {
    id: "document",
    title: "文档查看",
    description: "PDF/Office 文档查看与批注",
  },
  {
    id: "slide",
    title: "幻灯片编辑",
    description: "PowerPoint 演示文稿编辑器",
  },
  {
    id: "sheet",
    title: "表格编辑",
    description: "Excel 电子表格编辑器",
  },
  {
    id: "settings",
    title: "设置",
    description: "应用偏好与环境状态",
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
