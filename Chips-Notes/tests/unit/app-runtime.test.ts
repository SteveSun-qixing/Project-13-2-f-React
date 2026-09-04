import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client, PlatformLaunchContext } from 'chips-sdk';
import { ensureDefaultToolWindows, bootEditingEngine, subscribeInstalledBasecardRefresh } from '../../src/runtime/boot-actions';
import { readLaunchContext } from '../../src/runtime/launch-context';

const syncInstalledBasecardDescriptors = vi.hoisted(() => vi.fn(async () => undefined));
const initializeWorkspace = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../../src/basecard-runtime/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/basecard-runtime/registry')>();
  return {
    ...actual,
    syncInstalledBasecardDescriptors,
  };
});

vi.mock('../../src/services/workspace-service', () => ({
  workspaceService: {
    initialize: initializeWorkspace,
  },
}));

function createClientStub(launchContext?: PlatformLaunchContext): Client {
  return {
    platform: {
      getLaunchContext: vi.fn(() => launchContext ?? {
        pluginId: 'chips-official.editing-engine',
        sceneId: 'fallback-scene',
        surfaceId: 'fallback-surface',
        launchParams: {},
      }),
    },
    theme: {
      getCurrent: vi.fn(async () => ({
        themeId: 'chips-official.default-theme',
        displayName: 'Default Theme',
        version: '1.0.0',
      })),
      apply: vi.fn(async () => undefined),
      onChanged: vi.fn(() => () => undefined),
    },
    i18n: {
      getCurrent: vi.fn(async () => 'zh-CN'),
      setCurrent: vi.fn(async () => undefined),
      translate: vi.fn(async (key: string) => key),
      listLocales: vi.fn(async () => ['zh-CN', 'en-US']),
      onChanged: vi.fn(() => () => undefined),
    },
    command: {
      register: vi.fn(),
      unregister: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      invoke: vi.fn(),
      setState: vi.fn(),
      onRegistered: vi.fn(),
      onUnregistered: vi.fn(),
      onChanged: vi.fn(),
      onInvoked: vi.fn(),
    },
    events: {
      on: vi.fn(() => () => undefined),
      once: vi.fn(() => () => undefined),
      emit: vi.fn(async () => undefined),
    },
  } as unknown as Client;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('editing engine runtime launch context', () => {
  it('merges launch params from surface and top-level launch context', () => {
    const launchContext: PlatformLaunchContext = {
      pluginId: 'chips-official.editing-engine',
      sceneId: 'top-scene',
      surfaceId: 'top-surface',
      kind: 'window',
      launchParams: {
        workspacePath: '/workspace/from-launch',
        trigger: 'app-shortcut',
      },
      surfaceContext: {
        sceneId: 'surface-scene',
        surfaceId: 'surface-id',
        pluginId: 'chips-official.editing-engine',
        kind: 'window',
        presentation: {},
        launchParams: {
          workspace: '/workspace/from-surface',
          trigger: 'file-association',
        },
      },
    };
    const snapshot = readLaunchContext(createClientStub(launchContext));

    expect(snapshot.sceneId).toBe('surface-scene');
    expect(snapshot.surfaceId).toBe('surface-id');
    expect(snapshot.workspacePath).toBe('/workspace/from-launch');
    expect(snapshot.launchParams).toEqual({
      workspace: '/workspace/from-surface',
      workspacePath: '/workspace/from-launch',
      trigger: 'app-shortcut',
    });
  });
});

describe('editing engine boot actions', () => {
  it('creates the frozen default tool windows with localized titles and positions', () => {
    const createToolWindow = vi.fn();

    ensureDefaultToolWindows({
      windows: [],
      createToolWindow,
      t: (key) => `i18n:${key}`,
      viewport: { width: 1440, height: 900 },
    });

    expect(createToolWindow).toHaveBeenCalledTimes(3);
    expect(createToolWindow).toHaveBeenNthCalledWith(1, 'FileManager', expect.objectContaining({
      component: 'FileManager',
      title: 'i18n:app.tool_file_manager',
      position: { x: 20, y: 20 },
      size: { width: 280, height: 500 },
      closable: false,
    }));
    expect(createToolWindow).toHaveBeenNthCalledWith(2, 'EditPanel', expect.objectContaining({
      component: 'EditPanel',
      title: 'i18n:app.tool_edit_panel',
      position: { x: 1100, y: 20 },
      size: { width: 320, height: 500 },
      closable: false,
    }));
    expect(createToolWindow).toHaveBeenNthCalledWith(3, 'CardBoxLibrary', expect.objectContaining({
      component: 'CardBoxLibrary',
      title: 'i18n:app.tool_card_box_library',
      position: { x: 20, y: 550 },
      size: { width: 400, height: 300 },
      closable: false,
    }));
  });

  it('does not recreate default tool windows when a window already exists', () => {
    const createToolWindow = vi.fn();

    ensureDefaultToolWindows({
      windows: [{
        id: 'tool-1',
        type: 'tool',
        component: 'FileManager',
        title: 'Files',
        position: { x: 20, y: 20 },
        size: { width: 280, height: 500 },
        state: 'normal',
        zIndex: 100,
      }],
      createToolWindow,
      t: (key) => key,
      viewport: { width: 1440, height: 900 },
    });

    expect(createToolWindow).not.toHaveBeenCalled();
  });

  it('boots the runtime in the expected order', async () => {
    const stateChanges: string[] = [];
    const createToolWindow = vi.fn();
    const client = createClientStub();

    await bootEditingEngine({
      client,
      windows: [],
      createToolWindow,
      setState: (state) => stateChanges.push(state),
      t: (key) => key,
      viewport: { width: 1440, height: 900 },
    });

    expect(stateChanges).toEqual(['loading', 'ready']);
    expect(syncInstalledBasecardDescriptors).toHaveBeenCalledWith(client);
    expect(initializeWorkspace).toHaveBeenCalledTimes(1);
    expect(createToolWindow).toHaveBeenCalledTimes(3);
  });

  it('subscribes plugin lifecycle events to refresh basecard descriptors', async () => {
    const listeners = new Map<string, (payload: unknown) => void>();
    const client = createClientStub();
    client.events.on = vi.fn((event: string, handler: (payload: unknown) => void) => {
      listeners.set(event, handler);
      return () => listeners.delete(event);
    }) as Client['events']['on'];

    const unsubscribe = subscribeInstalledBasecardRefresh(client);
    listeners.get('plugin.installed')?.({});

    await Promise.resolve();

    expect(client.events.on).toHaveBeenCalledTimes(4);
    expect(syncInstalledBasecardDescriptors).toHaveBeenCalledWith(client);
    unsubscribe();
    expect(listeners.size).toBe(0);
  });
});
