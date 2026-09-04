export type EditingEngineSceneId =
  | 'workspace'
  | 'card-document'
  | 'box-document'
  | 'settings'
  | 'tool-window';

export interface EditingEngineSceneDefinition {
  id: EditingEngineSceneId;
  titleKey: string;
}

export const EDITING_ENGINE_SCENES: Record<EditingEngineSceneId, EditingEngineSceneDefinition> = {
  workspace: {
    id: 'workspace',
    titleKey: 'app.title',
  },
  'card-document': {
    id: 'card-document',
    titleKey: 'card_window.untitled',
  },
  'box-document': {
    id: 'box-document',
    titleKey: 'box_window.untitled',
  },
  settings: {
    id: 'settings',
    titleKey: 'engine_settings.title',
  },
  'tool-window': {
    id: 'tool-window',
    titleKey: 'app.tool_file_manager',
  },
};
