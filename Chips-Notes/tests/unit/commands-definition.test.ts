import { describe, expect, it } from 'vitest';
import {
  EDITING_ENGINE_COMMAND_IDS,
  createEditingEngineCommands,
  isApplicationChromeCommand,
  isEditingEngineCommandId,
  type EditingEngineCommandHandlers,
  type EditingEngineCommandState,
} from '../../src/commands/editing-engine-commands';
import { appConfig } from '../../config/app-config';

const readyState: EditingEngineCommandState = {
  appReady: true,
  canUndo: true,
  canRedo: false,
  currentLayout: 'infinite-canvas',
};

const idleState: EditingEngineCommandState = {
  appReady: false,
  canUndo: false,
  canRedo: false,
  currentLayout: 'workbench',
};

function createHandlers(): EditingEngineCommandHandlers {
  return {
    fileNewCard: () => undefined,
    fileNewBox: () => undefined,
    fileOpen: () => undefined,
    fileRename: () => undefined,
    fileDelete: () => undefined,
    fileRefresh: () => undefined,
    searchWorkspace: () => undefined,
    editUndo: () => undefined,
    editRedo: () => undefined,
    viewToggleLayout: () => undefined,
    settingsOpen: () => undefined,
  };
}

describe('editing engine command definitions', () => {
  it('uses stable app-scoped command ids and drops the removed theme toggle', () => {
    expect(EDITING_ENGINE_COMMAND_IDS).toMatchObject({
      fileNewCard: 'chips-official.editing-engine.file.new-card',
      fileNewBox: 'chips-official.editing-engine.file.new-box',
      fileOpen: 'chips-official.editing-engine.file.open',
      fileRename: 'chips-official.editing-engine.file.rename',
      fileDelete: 'chips-official.editing-engine.file.delete',
      fileRefresh: 'chips-official.editing-engine.file.refresh',
      searchWorkspace: 'chips-official.editing-engine.search.workspace',
      editUndo: 'chips-official.editing-engine.edit.undo',
      editRedo: 'chips-official.editing-engine.edit.redo',
      viewToggleLayout: 'chips-official.editing-engine.view.toggle-layout',
      settingsOpen: 'chips-official.editing-engine.settings.open',
    });

    expect(Object.values(EDITING_ENGINE_COMMAND_IDS)).not.toContain(
      'chips-official.editing-engine.view.toggle-theme',
    );
  });

  it('keeps command metadata localized with stable ids and unique command items', () => {
    const commands = createEditingEngineCommands(createHandlers(), readyState);
    const ids = new Set<string>();

    for (const command of commands) {
      ids.add(command.id);

      expect(command.id.startsWith(`${appConfig.appId}.`)).toBe(true);
      expect(typeof command.title).toBe('string');
      expect(command.title.trim().length).toBeGreaterThan(0);
      expect(command.group).toBeTruthy();
      expect(command.menuId).toBeTruthy();
      expect(command.enabled === undefined || typeof command.enabled === 'boolean').toBe(true);
      expect(typeof command.run).toBe('function');
      expect(isEditingEngineCommandId(command.id)).toBe(true);
      expect(command).not.toHaveProperty('titleKey');
      expect(command).not.toHaveProperty('permission');
    }

    expect(ids.size).toBe(commands.length);
  });

  it('publishes menu, toolbar and shortcut placements from the same command items', () => {
    const byId = new Map(createEditingEngineCommands(createHandlers(), readyState).map((command) => [command.id, command]));

    expect(byId.get(EDITING_ENGINE_COMMAND_IDS.fileNewCard)?.menuId).toBe('file');
    expect(byId.get(EDITING_ENGINE_COMMAND_IDS.fileNewCard)?.toolbarId).toBe('workspace');
    expect(byId.get(EDITING_ENGINE_COMMAND_IDS.fileNewCard)?.shortcut).toBe('Mod+N');

    expect(byId.get(EDITING_ENGINE_COMMAND_IDS.fileOpen)?.menuId).toBe('workspace-file');
    expect(byId.get(EDITING_ENGINE_COMMAND_IDS.fileOpen)?.toolbarId).toBeUndefined();

    const workspaceToolbarCommands = createEditingEngineCommands(createHandlers(), readyState)
      .filter((command) => command.toolbarId === 'workspace')
      .map((command) => command.id);
    expect(workspaceToolbarCommands).toContain(EDITING_ENGINE_COMMAND_IDS.fileNewCard);
    expect(workspaceToolbarCommands).toContain(EDITING_ENGINE_COMMAND_IDS.editUndo);
    expect(workspaceToolbarCommands).not.toContain(EDITING_ENGINE_COMMAND_IDS.fileOpen);
  });

  it('derives runtime state from the app-ready and history-manager flags', () => {
    const readyCommands = new Map(
      createEditingEngineCommands(createHandlers(), readyState).map((command) => [command.id, command]),
    );
    expect(readyCommands.get(EDITING_ENGINE_COMMAND_IDS.editUndo)?.enabled).toBe(true);
    expect(readyCommands.get(EDITING_ENGINE_COMMAND_IDS.editRedo)?.enabled).toBe(false);
    expect(readyCommands.get(EDITING_ENGINE_COMMAND_IDS.fileNewCard)?.enabled).toBe(true);

    const idleCommands = new Map(
      createEditingEngineCommands(createHandlers(), idleState).map((command) => [command.id, command]),
    );
    expect(idleCommands.get(EDITING_ENGINE_COMMAND_IDS.editUndo)?.enabled).toBe(false);
    expect(idleCommands.get(EDITING_ENGINE_COMMAND_IDS.fileNewCard)?.enabled).toBe(false);
    expect(idleCommands.get(EDITING_ENGINE_COMMAND_IDS.settingsOpen)?.enabled).not.toBe(false);
  });

  it('keeps Enter/F2/Delete out of global shortcut dispatch so the file tree owns them locally', () => {
    const byId = new Map(
      createEditingEngineCommands(createHandlers(), readyState).map((command) => [command.id, command]),
    );

    expect(byId.get(EDITING_ENGINE_COMMAND_IDS.fileOpen)?.shortcut).toBeUndefined();
    expect(byId.get(EDITING_ENGINE_COMMAND_IDS.fileRename)?.shortcut).toBeUndefined();
    expect(byId.get(EDITING_ENGINE_COMMAND_IDS.fileDelete)?.shortcut).toBeUndefined();

    expect(byId.get(EDITING_ENGINE_COMMAND_IDS.fileNewCard)?.shortcut).toBe('Mod+N');
    expect(byId.get(EDITING_ENGINE_COMMAND_IDS.fileNewBox)?.shortcut).toBe('Mod+Shift+N');
    expect(byId.get(EDITING_ENGINE_COMMAND_IDS.searchWorkspace)?.shortcut).toBe('Mod+F');
  });

  it('filters file context commands out of application chrome', () => {
    const commands = createEditingEngineCommands(createHandlers(), readyState);
    const chromeIds = commands.filter(isApplicationChromeCommand).map((command) => command.id);

    expect(chromeIds).toContain(EDITING_ENGINE_COMMAND_IDS.fileNewCard);
    expect(chromeIds).toContain(EDITING_ENGINE_COMMAND_IDS.fileRefresh);
    expect(chromeIds).not.toContain(EDITING_ENGINE_COMMAND_IDS.fileOpen);
    expect(chromeIds).not.toContain(EDITING_ENGINE_COMMAND_IDS.fileRename);
    expect(chromeIds).not.toContain(EDITING_ENGINE_COMMAND_IDS.fileDelete);
  });
});
