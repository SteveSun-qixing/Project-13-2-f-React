import type {
  CommandDefinitionInput,
  CommandInvokedEvent,
  CommandInvocationContext,
  CommandSetStateOptions,
  CommandSource,
  CommandState,
} from 'chips-sdk';
import type { ChipsCommandView } from '@chips/component-library';
import { appConfig } from '../../config/app-config';
import {
  ENGINE_ICONS,
  getLayoutSwitcherIcon,
  getThemeSwitcherIcon,
} from '../icons/descriptors';
import type { LayoutType } from '../types/editor';

export const EDITING_ENGINE_COMMAND_IDS = {
  fileNewCard: `${appConfig.appId}.file.new-card`,
  fileNewBox: `${appConfig.appId}.file.new-box`,
  fileOpen: `${appConfig.appId}.file.open`,
  fileRename: `${appConfig.appId}.file.rename`,
  fileDelete: `${appConfig.appId}.file.delete`,
  fileRefresh: `${appConfig.appId}.file.refresh`,
  searchWorkspace: `${appConfig.appId}.search.workspace`,
  editUndo: `${appConfig.appId}.edit.undo`,
  editRedo: `${appConfig.appId}.edit.redo`,
  viewToggleLayout: `${appConfig.appId}.view.toggle-layout`,
  viewToggleTheme: `${appConfig.appId}.view.toggle-theme`,
  settingsOpen: `${appConfig.appId}.settings.open`,
} as const;

export const EDITING_ENGINE_COMMAND_HANDLER_IDS = {
  fileNewCard: 'editing-engine:file.new-card',
  fileNewBox: 'editing-engine:file.new-box',
  fileOpen: 'editing-engine:file.open',
  fileRename: 'editing-engine:file.rename',
  fileDelete: 'editing-engine:file.delete',
  fileRefresh: 'editing-engine:file.refresh',
  searchWorkspace: 'editing-engine:search.workspace',
  editUndo: 'editing-engine:edit.undo',
  editRedo: 'editing-engine:edit.redo',
  viewToggleLayout: 'editing-engine:view.toggle-layout',
  viewToggleTheme: 'editing-engine:view.toggle-theme',
  settingsOpen: 'editing-engine:settings.open',
} as const;

export type EditingEngineCommandId =
  (typeof EDITING_ENGINE_COMMAND_IDS)[keyof typeof EDITING_ENGINE_COMMAND_IDS];
export type EditingEngineCommandHandlerId =
  (typeof EDITING_ENGINE_COMMAND_HANDLER_IDS)[keyof typeof EDITING_ENGINE_COMMAND_HANDLER_IDS];

export type EditingEngineCommandPhase = 'idle' | 'registering' | 'ready' | 'error';

export interface EditingEngineCommandStatus {
  commandId: EditingEngineCommandId;
  handlerId: EditingEngineCommandHandlerId;
  source: CommandSource;
  invocationId?: string;
  payload?: Record<string, unknown>;
  context?: CommandInvocationContext;
}

export interface EditingEngineCommandRuntimeState {
  appReady: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undoBusy?: boolean;
  redoBusy?: boolean;
  currentLayout: LayoutType;
  themeId: string;
}

const COMMAND_ID_SET = new Set<string>(Object.values(EDITING_ENGINE_COMMAND_IDS));
const HANDLER_ID_SET = new Set<string>(Object.values(EDITING_ENGINE_COMMAND_HANDLER_IDS));

const APP_SCOPE = { kind: 'app', appId: appConfig.appId } as const;

function shortcut(accelerator: string) {
  return {
    accelerator,
    platform: 'desktop' as const,
    preventDefault: true,
  };
}

export const editingEngineCommandDefinitions: CommandDefinitionInput[] = [
  {
    commandId: EDITING_ENGINE_COMMAND_IDS.fileNewCard,
    titleKey: 'commands.file.new_card.title',
    descriptionKey: 'commands.file.new_card.description',
    ariaLabelKey: 'commands.file.new_card.ariaLabel',
    icon: ENGINE_ICONS.card,
    scope: APP_SCOPE,
    permission: 'file.write',
    handlerId: EDITING_ENGINE_COMMAND_HANDLER_IDS.fileNewCard,
    shortcut: shortcut('Mod+N'),
    menuPlacement: [
      { menuId: 'file', groupId: 'create', order: 10 },
      { menuId: 'workspace-file', groupId: 'create', order: 10 },
    ],
    toolbarPlacement: [
      { toolbarId: 'file-manager', groupId: 'create', order: 10 },
    ],
    paletteKeywords: ['card', 'new', 'commands.file.new_card.title'],
    state: { enabled: true, visible: true },
  },
  {
    commandId: EDITING_ENGINE_COMMAND_IDS.fileNewBox,
    titleKey: 'commands.file.new_box.title',
    descriptionKey: 'commands.file.new_box.description',
    ariaLabelKey: 'commands.file.new_box.ariaLabel',
    icon: ENGINE_ICONS.box,
    scope: APP_SCOPE,
    permission: 'file.write',
    handlerId: EDITING_ENGINE_COMMAND_HANDLER_IDS.fileNewBox,
    shortcut: shortcut('Mod+Shift+N'),
    menuPlacement: [
      { menuId: 'file', groupId: 'create', order: 20 },
      { menuId: 'workspace-file', groupId: 'create', order: 20 },
    ],
    toolbarPlacement: [
      { toolbarId: 'file-manager', groupId: 'create', order: 20 },
    ],
    paletteKeywords: ['box', 'new', 'commands.file.new_box.title'],
    state: { enabled: true, visible: true },
  },
  {
    commandId: EDITING_ENGINE_COMMAND_IDS.fileOpen,
    titleKey: 'commands.file.open.title',
    descriptionKey: 'commands.file.open.description',
    ariaLabelKey: 'commands.file.open.ariaLabel',
    icon: ENGINE_ICONS.folderOpen,
    scope: APP_SCOPE,
    permission: 'file.read',
    handlerId: EDITING_ENGINE_COMMAND_HANDLER_IDS.fileOpen,
    shortcut: shortcut('Enter'),
    menuPlacement: [{ menuId: 'workspace-file', groupId: 'open', order: 10 }],
    paletteKeywords: ['open', 'commands.file.open.title'],
    state: { enabled: true, visible: true },
  },
  {
    commandId: EDITING_ENGINE_COMMAND_IDS.fileRename,
    titleKey: 'commands.file.rename.title',
    descriptionKey: 'commands.file.rename.description',
    ariaLabelKey: 'commands.file.rename.ariaLabel',
    icon: ENGINE_ICONS.edit,
    scope: APP_SCOPE,
    permission: 'file.write',
    handlerId: EDITING_ENGINE_COMMAND_HANDLER_IDS.fileRename,
    shortcut: shortcut('F2'),
    menuPlacement: [{ menuId: 'workspace-file', groupId: 'manage', order: 10 }],
    paletteKeywords: ['rename', 'commands.file.rename.title'],
    state: { enabled: true, visible: true },
  },
  {
    commandId: EDITING_ENGINE_COMMAND_IDS.fileDelete,
    titleKey: 'commands.file.delete.title',
    descriptionKey: 'commands.file.delete.description',
    ariaLabelKey: 'commands.file.delete.ariaLabel',
    icon: ENGINE_ICONS.delete,
    scope: APP_SCOPE,
    permission: 'file.write',
    handlerId: EDITING_ENGINE_COMMAND_HANDLER_IDS.fileDelete,
    shortcut: shortcut('Delete'),
    menuPlacement: [{ menuId: 'workspace-file', groupId: 'manage', order: 20 }],
    paletteKeywords: ['delete', 'commands.file.delete.title'],
    state: { enabled: true, visible: true },
  },
  {
    commandId: EDITING_ENGINE_COMMAND_IDS.fileRefresh,
    titleKey: 'commands.file.refresh.title',
    descriptionKey: 'commands.file.refresh.description',
    ariaLabelKey: 'commands.file.refresh.ariaLabel',
    icon: ENGINE_ICONS.refresh,
    scope: APP_SCOPE,
    permission: 'file.read',
    handlerId: EDITING_ENGINE_COMMAND_HANDLER_IDS.fileRefresh,
    menuPlacement: [
      { menuId: 'file', groupId: 'view', order: 10 },
      { menuId: 'workspace-file', groupId: 'view', order: 10 },
    ],
    toolbarPlacement: [{ toolbarId: 'file-manager', groupId: 'view', order: 10 }],
    paletteKeywords: ['refresh', 'commands.file.refresh.title'],
    state: { enabled: true, visible: true },
  },
  {
    commandId: EDITING_ENGINE_COMMAND_IDS.searchWorkspace,
    titleKey: 'commands.search.workspace.title',
    descriptionKey: 'commands.search.workspace.description',
    ariaLabelKey: 'commands.search.workspace.ariaLabel',
    icon: ENGINE_ICONS.search,
    scope: APP_SCOPE,
    permission: 'file.read',
    handlerId: EDITING_ENGINE_COMMAND_HANDLER_IDS.searchWorkspace,
    shortcut: shortcut('Mod+F'),
    menuPlacement: [{ menuId: 'edit', groupId: 'search', order: 10 }],
    toolbarPlacement: [
      { toolbarId: 'file-manager', groupId: 'view', order: 20 },
    ],
    paletteKeywords: ['search', 'commands.search.workspace.title'],
    state: { enabled: true, visible: true },
  },
  {
    commandId: EDITING_ENGINE_COMMAND_IDS.editUndo,
    titleKey: 'commands.edit.undo.title',
    descriptionKey: 'commands.edit.undo.description',
    ariaLabelKey: 'commands.edit.undo.ariaLabel',
    icon: ENGINE_ICONS.undo,
    scope: APP_SCOPE,
    permission: 'command.invoke',
    handlerId: EDITING_ENGINE_COMMAND_HANDLER_IDS.editUndo,
    shortcut: shortcut('Mod+Z'),
    menuPlacement: [{ menuId: 'edit', groupId: 'history', order: 10 }],
    paletteKeywords: ['undo', 'commands.edit.undo.title'],
    state: { enabled: false, visible: true, disabledReasonKey: 'commands.edit.undo.disabled' },
  },
  {
    commandId: EDITING_ENGINE_COMMAND_IDS.editRedo,
    titleKey: 'commands.edit.redo.title',
    descriptionKey: 'commands.edit.redo.description',
    ariaLabelKey: 'commands.edit.redo.ariaLabel',
    icon: ENGINE_ICONS.redo,
    scope: APP_SCOPE,
    permission: 'command.invoke',
    handlerId: EDITING_ENGINE_COMMAND_HANDLER_IDS.editRedo,
    shortcut: shortcut('Mod+Shift+Z'),
    menuPlacement: [{ menuId: 'edit', groupId: 'history', order: 20 }],
    paletteKeywords: ['redo', 'commands.edit.redo.title'],
    state: { enabled: false, visible: true, disabledReasonKey: 'commands.edit.redo.disabled' },
  },
  {
    commandId: EDITING_ENGINE_COMMAND_IDS.viewToggleLayout,
    titleKey: 'commands.view.toggle_layout.title',
    descriptionKey: 'commands.view.toggle_layout.description',
    ariaLabelKey: 'commands.view.toggle_layout.ariaLabel',
    icon: getLayoutSwitcherIcon('infinite-canvas'),
    scope: APP_SCOPE,
    permission: 'config.write',
    handlerId: EDITING_ENGINE_COMMAND_HANDLER_IDS.viewToggleLayout,
    menuPlacement: [{ menuId: 'view', groupId: 'layout', order: 10 }],
    paletteKeywords: ['layout', 'commands.view.toggle_layout.title'],
    state: { enabled: true, visible: true },
  },
  {
    commandId: EDITING_ENGINE_COMMAND_IDS.viewToggleTheme,
    titleKey: 'commands.view.toggle_theme.title',
    descriptionKey: 'commands.view.toggle_theme.description',
    ariaLabelKey: 'commands.view.toggle_theme.ariaLabel',
    icon: getThemeSwitcherIcon('chips-official.default-theme'),
    scope: APP_SCOPE,
    permission: 'theme.write',
    handlerId: EDITING_ENGINE_COMMAND_HANDLER_IDS.viewToggleTheme,
    menuPlacement: [{ menuId: 'view', groupId: 'theme', order: 20 }],
    paletteKeywords: ['theme', 'commands.view.toggle_theme.title'],
    state: { enabled: true, visible: true },
  },
  {
    commandId: EDITING_ENGINE_COMMAND_IDS.settingsOpen,
    titleKey: 'commands.settings.open.title',
    descriptionKey: 'commands.settings.open.description',
    ariaLabelKey: 'commands.settings.open.ariaLabel',
    icon: ENGINE_ICONS.settings,
    scope: APP_SCOPE,
    permission: 'config.read',
    handlerId: EDITING_ENGINE_COMMAND_HANDLER_IDS.settingsOpen,
    shortcut: shortcut('Mod+,'),
    menuPlacement: [{ menuId: 'app', groupId: 'settings', order: 10 }],
    paletteKeywords: ['settings', 'commands.settings.open.title'],
    state: { enabled: true, visible: true },
  },
];

export function resolveCommandHandlerId(commandId: string): EditingEngineCommandHandlerId | null {
  const definition = editingEngineCommandDefinitions.find((item) => item.commandId === commandId);
  return isEditingEngineCommandHandlerId(definition?.handlerId) ? definition.handlerId : null;
}

export function isEditingEngineCommandId(commandId: string): commandId is EditingEngineCommandId {
  return COMMAND_ID_SET.has(commandId);
}

export function isEditingEngineCommandHandlerId(handlerId: unknown): handlerId is EditingEngineCommandHandlerId {
  return typeof handlerId === 'string' && HANDLER_ID_SET.has(handlerId);
}

export function isEditingEngineCommandInvokedEvent(event: CommandInvokedEvent): boolean {
  if (!isEditingEngineCommandId(event.commandId)) {
    return false;
  }

  return event.ownerPluginId === undefined || event.ownerPluginId === appConfig.appId;
}

export function createEditingEngineCommandStatus(event: CommandInvokedEvent): EditingEngineCommandStatus | null {
  const handlerId = isEditingEngineCommandHandlerId(event.handlerId)
    ? event.handlerId
    : resolveCommandHandlerId(event.commandId);

  if (!handlerId || !isEditingEngineCommandId(event.commandId)) {
    return null;
  }

  return {
    commandId: event.commandId,
    handlerId,
    source: event.source ?? 'api',
    invocationId: event.invocationId,
    payload: event.payload,
    context: event.context,
  };
}

export function toErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.trim().length > 0) {
      return code;
    }
  }

  return 'EDITING_ENGINE_COMMAND_RUNTIME_ERROR';
}

export function resolveEditingEngineCommandState(
  definition: CommandDefinitionInput,
  runtime: EditingEngineCommandRuntimeState,
): CommandState {
  const baseState = {
    visible: definition.state?.visible ?? true,
    enabled: definition.state?.enabled ?? true,
    checked: definition.state?.checked,
    busy: definition.state?.busy,
    disabledReasonKey: definition.state?.disabledReasonKey,
  } satisfies CommandState;

  if (
    definition.commandId === EDITING_ENGINE_COMMAND_IDS.fileNewCard ||
    definition.commandId === EDITING_ENGINE_COMMAND_IDS.fileNewBox ||
    definition.commandId === EDITING_ENGINE_COMMAND_IDS.fileRefresh ||
    definition.commandId === EDITING_ENGINE_COMMAND_IDS.searchWorkspace
  ) {
    return {
      ...baseState,
      enabled: runtime.appReady,
      disabledReasonKey: runtime.appReady ? undefined : 'commands.workspace.not_ready',
    };
  }

  if (definition.commandId === EDITING_ENGINE_COMMAND_IDS.editUndo) {
    return {
      ...baseState,
      enabled: runtime.appReady && runtime.canUndo && !runtime.undoBusy,
      busy: runtime.undoBusy,
      disabledReasonKey:
        runtime.appReady && runtime.canUndo ? undefined : 'commands.edit.undo.disabled',
    };
  }

  if (definition.commandId === EDITING_ENGINE_COMMAND_IDS.editRedo) {
    return {
      ...baseState,
      enabled: runtime.appReady && runtime.canRedo && !runtime.redoBusy,
      busy: runtime.redoBusy,
      disabledReasonKey:
        runtime.appReady && runtime.canRedo ? undefined : 'commands.edit.redo.disabled',
    };
  }

  if (definition.commandId === EDITING_ENGINE_COMMAND_IDS.viewToggleLayout) {
    return {
      ...baseState,
      enabled: runtime.appReady,
      value: runtime.currentLayout,
      disabledReasonKey: runtime.appReady ? undefined : 'commands.workspace.not_ready',
    };
  }

  if (definition.commandId === EDITING_ENGINE_COMMAND_IDS.viewToggleTheme) {
    return {
      ...baseState,
      enabled: runtime.appReady,
      value: runtime.themeId,
      disabledReasonKey: runtime.appReady ? undefined : 'commands.workspace.not_ready',
    };
  }

  return baseState;
}

export function createEditingEngineCommandViews(runtime: EditingEngineCommandRuntimeState): ChipsCommandView[] {
  return editingEngineCommandDefinitions.map((definition) => {
    const state = resolveEditingEngineCommandState(definition, runtime);
    const icon =
      definition.commandId === EDITING_ENGINE_COMMAND_IDS.viewToggleLayout
        ? getLayoutSwitcherIcon(runtime.currentLayout)
        : definition.commandId === EDITING_ENGINE_COMMAND_IDS.viewToggleTheme
          ? getThemeSwitcherIcon(runtime.themeId)
          : definition.icon;

    return {
      ...definition,
      icon,
      state,
      diagnostic: {
        visible: state.visible !== false,
        enabled: state.enabled !== false,
        checked: state.checked === true,
        disabledReasonKey: state.disabledReasonKey,
      },
    } as ChipsCommandView;
  });
}

export function createCommandInvocationContext(params: {
  pluginId?: string;
  sceneId?: string;
  surfaceId?: string;
  documentId?: string;
  componentId?: string;
}): CommandInvocationContext {
  const context: CommandInvocationContext = {};

  if (params.pluginId) {
    context.pluginId = params.pluginId;
  }
  if (params.sceneId) {
    context.sceneId = params.sceneId;
  }
  if (params.surfaceId) {
    context.surfaceId = params.surfaceId;
  }
  if (params.documentId) {
    context.documentId = params.documentId;
  }
  if (params.componentId) {
    context.componentId = params.componentId;
  }

  return context;
}

export function createCommandSetStateOptions(context: CommandInvocationContext): CommandSetStateOptions {
  return {
    context,
  };
}

export function isApplicationChromeCommand(command: ChipsCommandView): boolean {
  return command.commandId !== EDITING_ENGINE_COMMAND_IDS.fileOpen &&
    command.commandId !== EDITING_ENGINE_COMMAND_IDS.fileRename &&
    command.commandId !== EDITING_ENGINE_COMMAND_IDS.fileDelete;
}
