export type AppSceneId = "start" | "workbook";

export interface AppSceneDefinition {
  id: AppSceneId;
  title: string;
  description: string;
}

export const sceneDefinitions: AppSceneDefinition[] = [
  {
    id: "start",
    title: "起始页",
    description: "打开或拖入表格文件，也可新建空白工作簿",
  },
  {
    id: "workbook",
    title: "表格编辑",
    description: "Univer 表格编辑引擎承载编辑、公式与保存链路",
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

export function getSceneIdForWorkbookState(hasWorkbook: boolean): AppSceneId {
  return hasWorkbook ? "workbook" : "start";
}
