// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

const mockState = vi.hoisted(() => {
  return {
    editorState: {
      state: 'idle' as string,
      currentLayout: 'infinite-canvas' as 'infinite-canvas' | 'workbench',
      setState: vi.fn(),
      setLayout: vi.fn(),
    },
    uiState: {
      windows: [] as Array<Record<string, unknown>>,
      theme: 'chips-official.default-theme',
      setTheme: vi.fn(),
      createToolWindow: vi.fn(),
      createCardWindow: vi.fn(),
      createBoxWindow: vi.fn(),
      updateWindow: vi.fn(),
      focusWindow: vi.fn(),
    },
    cardState: {
      addBasicCard: vi.fn(),
      openCard: vi.fn(async () => undefined),
      openCards: new Map<string, unknown>(),
      setActiveCard: vi.fn(),
      setSelectedBaseCard: vi.fn(),
    },
    workspaceServiceMock: {
      initialize: vi.fn(async () => undefined),
      getState: vi.fn(() => ({ rootPath: '/workspace' })),
      on: vi.fn(),
      off: vi.fn(),
      openFile: vi.fn(),
      createCard: vi.fn(),
      createBox: vi.fn(),
    },
    boxDocumentServiceMock: {
      openBox: vi.fn(async () => undefined),
      importDocumentFiles: vi.fn(async () => undefined),
    },
    bridgeClient: {
      platform: {
        getLaunchContext: vi.fn(() => ({
          pluginId: 'chips-official.editing-engine',
          sceneId: 'scene-workspace',
          surfaceId: 'surface-workspace',
          launchParams: {},
          surfaceContext: {
            sceneId: 'scene-workspace',
            surfaceId: 'surface-workspace',
            pluginId: 'chips-official.editing-engine',
            kind: 'window',
            presentation: {},
            launchParams: {},
          },
        })),
      },
      plugin: {
        query: vi.fn(async () => []),
      },
      theme: {
        getCurrent: vi.fn(async () => ({
          themeId: 'chips-official.default-theme',
          displayName: 'Default Theme',
          version: '1',
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
        register: vi.fn(async (definition: Record<string, unknown>) => ({
          ...definition,
          diagnostic: { visible: true, enabled: true, checked: false },
        })),
        unregister: vi.fn(async () => undefined),
        get: vi.fn(async () => undefined),
        list: vi.fn(async () => []),
        invoke: vi.fn(async () => undefined),
        setState: vi.fn(async () => undefined),
        onRegistered: vi.fn(() => () => undefined),
        onUnregistered: vi.fn(() => () => undefined),
        onChanged: vi.fn(() => () => undefined),
        onInvoked: vi.fn(() => () => undefined),
      },
      events: {
        on: vi.fn(() => () => undefined),
      },
    },
  };
});

vi.mock('../../src/context', () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../src/context/EditorContext', () => ({
  useEditor: () => mockState.editorState,
}));

vi.mock('../../src/context/UIContext', () => ({
  useUI: () => mockState.uiState,
}));

vi.mock('../../src/context/CardContext', () => ({
  useCard: () => mockState.cardState,
}));

vi.mock('../../src/services/bridge-client', () => ({
  getChipsClient: () => mockState.bridgeClient,
}));

vi.mock('../../src/runtime/chips-client', () => ({
  getEditingEngineClient: () => mockState.bridgeClient,
}));

vi.mock('../../src/services/workspace-service', () => ({
  workspaceService: mockState.workspaceServiceMock,
}));

vi.mock('../../src/services/box-document-service', () => ({
  DEFAULT_BOX_LAYOUT_TYPE: 'chips.layout.grid',
  boxDocumentService: mockState.boxDocumentServiceMock,
}));

vi.mock('../../src/runtime/boot-actions', () => ({
  bootEditingEngine: vi.fn(async () => undefined),
  subscribeInstalledBasecardRefresh: vi.fn(() => () => undefined),
}));

vi.mock('../../src/layouts/InfiniteCanvas', () => ({
  InfiniteCanvas: () => <div className="mock-infinite-canvas" />,
}));

vi.mock('../../src/layouts/Workbench', () => ({
  Workbench: () => <div className="mock-workbench" />,
}));

vi.mock('../../src/components/Dock/Dock', () => ({
  Dock: () => null,
}));

describe('WorkspaceScene boot loading state', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    mockState.editorState.state = 'idle';
    mockState.editorState.currentLayout = 'infinite-canvas';
    mockState.editorState.setState.mockReset();
    mockState.editorState.setState.mockImplementation((next: string) => {
      mockState.editorState.state = next;
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('shows a Spin loading state instead of the workspace while booting', async () => {
    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toContain('正在加载工作区');
    expect(container.querySelector('.ant-spin')).not.toBeNull();
    expect(container.querySelector('.mock-infinite-canvas')).toBeNull();
    expect(container.querySelector('.mock-workbench')).toBeNull();
  });

  it('renders the workspace scene once the editor reaches the ready state', async () => {
    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('.ant-spin')).not.toBeNull();

    await act(async () => {
      mockState.editorState.setState('ready');
      root.render(<App />);
    });

    expect(container.querySelector('.ant-spin')).toBeNull();
    expect(container.querySelector('.mock-infinite-canvas')).not.toBeNull();
  });

  it('renders the workbench layout with the boot loading gate still applied', async () => {
    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      mockState.editorState.currentLayout = 'workbench';
      mockState.editorState.setState('ready');
      root.render(<App />);
    });

    expect(container.querySelector('.mock-workbench')).not.toBeNull();
    expect(container.querySelector('.mock-infinite-canvas')).toBeNull();
  });
});
