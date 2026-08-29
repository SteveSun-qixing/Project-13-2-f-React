export const UNIVERSAL_VIEWER_SCENE_IDS = {
  empty: "universal-viewer.scene.empty",
  viewer: "universal-viewer.scene.viewer",
} as const;

export type UniversalViewerSceneId = (typeof UNIVERSAL_VIEWER_SCENE_IDS)[keyof typeof UNIVERSAL_VIEWER_SCENE_IDS];

export interface UniversalViewerSceneDefinition {
  id: UniversalViewerSceneId;
  title: string;
}

export const universalViewerScenes: UniversalViewerSceneDefinition[] = [
  {
    id: UNIVERSAL_VIEWER_SCENE_IDS.empty,
    title: "未打开任何文件",
  },
  {
    id: UNIVERSAL_VIEWER_SCENE_IDS.viewer,
    title: "文件查看场景",
  },
];

export function getSceneDefinition(sceneId: UniversalViewerSceneId): UniversalViewerSceneDefinition {
  return universalViewerScenes.find((scene) => scene.id === sceneId) ?? universalViewerScenes[0];
}

export function getSceneIdForFile(hasViewerTarget: boolean): UniversalViewerSceneId {
  return hasViewerTarget ? UNIVERSAL_VIEWER_SCENE_IDS.viewer : UNIVERSAL_VIEWER_SCENE_IDS.empty;
}
