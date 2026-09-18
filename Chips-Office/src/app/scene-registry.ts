export const OFFICE_SCENE_IDS = {
  start: "office.scene.start",
  word: "office.scene.word",
  sheet: "office.scene.sheet",
  slide: "office.scene.slide",
  pdf: "office.scene.pdf",
} as const;

export type OfficeSceneId = (typeof OFFICE_SCENE_IDS)[keyof typeof OFFICE_SCENE_IDS];

export interface OfficeSceneDefinition {
  id: OfficeSceneId;
  title: string;
}

export const officeScenes: OfficeSceneDefinition[] = [
  {
    id: OFFICE_SCENE_IDS.start,
    title: "薯片办公起始页",
  },
  {
    id: OFFICE_SCENE_IDS.word,
    title: "Word 文档",
  },
  {
    id: OFFICE_SCENE_IDS.sheet,
    title: "表格工作簿",
  },
  {
    id: OFFICE_SCENE_IDS.slide,
    title: "演示文稿",
  },
  {
    id: OFFICE_SCENE_IDS.pdf,
    title: "PDF 文档",
  },
];

export function getSceneDefinition(sceneId: string | null | undefined): OfficeSceneDefinition {
  return officeScenes.find((scene) => scene.id === sceneId) ?? officeScenes[0];
}

/** 文档类别（由 file.detectType 归一化）到场景 id 的映射。 */
export function getSceneIdForDocumentType(documentType: string | null | undefined): OfficeSceneId {
  switch (documentType) {
    case "word":
      return OFFICE_SCENE_IDS.word;
    case "sheet":
      return OFFICE_SCENE_IDS.sheet;
    case "slide":
      return OFFICE_SCENE_IDS.slide;
    case "pdf":
      return OFFICE_SCENE_IDS.pdf;
    default:
      return OFFICE_SCENE_IDS.start;
  }
}
