// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxEditorPanel } from '../../src/components/EditPanel/BoxEditorPanel';

const sessionRef = vi.hoisted(() => ({
  current: {
    boxId: 'box-1',
    boxFile: '/workspace/demo.box',
    workspaceDir: '/workspace/.chips-editing-engine/box-sessions/session-box-1',
    metadata: {
      boxId: 'box-1',
      name: 'Demo Box',
      activeLayoutType: 'chips.layout.grid',
      coverRatio: '3:4',
      createdAt: '2026-04-09T00:00:00.000Z',
      modifiedAt: '2026-04-09T00:00:00.000Z',
    },
    coverHtml: '<html></html>',
    content: {
      activeLayoutType: 'chips.layout.grid',
      layoutConfigs: {},
    },
    entries: [
      {
        entryId: 'entry-1',
        url: 'file:///workspace/first.card',
        enabled: true,
        snapshot: {
          title: '第一张卡片',
          documentId: 'first.card',
          contentType: 'chips/card',
          cover: {
            mode: 'none',
          },
        },
      },
      {
        entryId: 'entry-2',
        url: 'file:///workspace/second.card',
        enabled: true,
        snapshot: {
          title: '第二张卡片',
          documentId: 'second.card',
          contentType: 'chips/card',
          cover: {
            mode: 'none',
          },
        },
      },
    ],
    assets: [],
    isDirty: false,
    isSaving: false,
  },
}));

const serviceMocks = vi.hoisted(() => ({
  moveEntryToIndex: vi.fn(),
  removeEntry: vi.fn(),
  importDocumentFiles: vi.fn(),
}));

const clientMocks = vi.hoisted(() => ({
  normalizeLayoutConfig: vi.fn(async (_layoutType: string, input: Record<string, unknown>) => input),
  editorPanelRender: vi.fn(async () => ({
    frame: document.createElement('iframe'),
    origin: 'file://',
    dispose: vi.fn(async () => undefined),
  })),
  editorPanelOnChange: vi.fn(),
  editorPanelOnError: vi.fn(() => () => undefined),
  openFile: vi.fn(async () => [] as string[]),
  changeHandler: null as null | ((payload: { config: Record<string, unknown> }) => void),
}));

vi.mock('../../src/hooks/useBoxDocumentSession', () => ({
  useBoxDocumentSession: () => ({
    session: sessionRef.current,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../../src/hooks/useBoxLayoutDefinition', () => ({
  useBoxLayoutDefinition: () => ({
    layoutDefinition: {
      layoutType: 'chips.layout.grid',
      displayName: 'Grid Layout',
      defaultConfig: {},
    },
    error: null,
  }),
}));

vi.mock('../../src/services/bridge-client', () => ({
  getChipsClient: () => ({
    box: {
      normalizeLayoutConfig: clientMocks.normalizeLayoutConfig,
      editorPanel: {
        render: clientMocks.editorPanelRender,
        onReady: vi.fn(() => () => undefined),
        onChange: clientMocks.editorPanelOnChange,
        onError: clientMocks.editorPanelOnError,
      },
    },
    platform: {
      openFile: clientMocks.openFile,
    },
  }),
}));

vi.mock('../../src/services/box-document-service', () => ({
  boxDocumentService: {
    updateLayoutConfig: vi.fn(),
    readBoxAsset: vi.fn(),
    importBoxAsset: vi.fn(),
    deleteBoxAsset: vi.fn(),
    moveEntryToIndex: serviceMocks.moveEntryToIndex,
    removeEntry: serviceMocks.removeEntry,
    importDocumentFiles: serviceMocks.importDocumentFiles,
  },
}));

describe('BoxEditorPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  let originalResizeObserver: typeof ResizeObserver | undefined;

  beforeEach(() => {
    originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class ResizeObserverMock {
      constructor(_callback: ResizeObserverCallback) {}

      observe(): void {}

      disconnect(): void {}

      unobserve(): void {}
    } as typeof ResizeObserver;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    sessionRef.current = {
      ...sessionRef.current,
      content: {
        activeLayoutType: 'chips.layout.grid',
        layoutConfigs: {},
      },
      isDirty: false,
    };
    serviceMocks.moveEntryToIndex.mockClear();
    serviceMocks.removeEntry.mockClear();
    serviceMocks.importDocumentFiles.mockClear();
    clientMocks.normalizeLayoutConfig.mockClear();
    clientMocks.editorPanelRender.mockClear();
    clientMocks.editorPanelOnChange.mockClear();
    clientMocks.editorPanelOnChange.mockImplementation((_frame: HTMLIFrameElement, handler: (payload: { config: Record<string, unknown> }) => void) => {
      clientMocks.changeHandler = handler;
      return () => undefined;
    });
    clientMocks.editorPanelOnError.mockClear();
    clientMocks.openFile.mockClear();
    clientMocks.changeHandler = null;
  });

  afterEach(async () => {
    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver;
    } else {
      Reflect.deleteProperty(globalThis, 'ResizeObserver');
    }
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderPanel(tab: 'config' | 'content' = 'content') {
    await act(async () => {
      root.render(
        <BoxEditorPanel
          boxId="box-1"
          boxPath="/workspace/demo.box"
        />,
      );
      await Promise.resolve();
    });

    if (tab === 'content') {
      await act(async () => {
        const tabButton = Array.from(container.querySelectorAll('[role="tab"]'))
          .find((tabNode) => tabNode.textContent === '内容列表');
        (tabButton as HTMLElement | undefined)?.click();
        await Promise.resolve();
      });
    }
  }

  it('mounts the layout editor in a dedicated fill container for the config tab', async () => {
    await renderPanel('config');

    expect(container.querySelector('.box-editor-panel__tab-content--layout')).not.toBeNull();
    expect(container.querySelector('.box-editor-panel__layout-slot')).not.toBeNull();
    const frame = container.querySelector('.box-editor-panel__layout-editor iframe') as HTMLIFrameElement | null;
    expect(frame).not.toBeNull();
    expect(frame?.style.width).toBe('100%');
    expect(frame?.style.height).toBe('100%');
  });

  it('keeps the layout editor frame mounted when the editor emits a config snapshot', async () => {
    await renderPanel('config');

    expect(clientMocks.editorPanelRender).toHaveBeenCalledTimes(1);
    expect(clientMocks.changeHandler).not.toBeNull();

    await act(async () => {
      clientMocks.changeHandler?.({
        config: {
          schemaVersion: '1.0.0',
          props: {
            gap: 24,
          },
          assetRefs: [],
        },
      });
      await Promise.resolve();
    });

    sessionRef.current = {
      ...sessionRef.current,
      content: {
        ...sessionRef.current.content,
        layoutConfigs: {
          'chips.layout.grid': {
            schemaVersion: '1.0.0',
            props: {
              gap: 24,
            },
            assetRefs: [],
          },
        },
      },
      isDirty: true,
    };

    await act(async () => {
      root.render(
        <BoxEditorPanel
          boxId="box-1"
          boxPath="/workspace/demo.box"
        />,
      );
      await Promise.resolve();
    });

    expect(clientMocks.normalizeLayoutConfig).toHaveBeenCalledWith('chips.layout.grid', {
      schemaVersion: '1.0.0',
      props: {
        gap: 24,
      },
      assetRefs: [],
    });
    expect(clientMocks.editorPanelRender).toHaveBeenCalledTimes(1);
  });

  it('keeps inactive tab panels hidden and renders only the active panel', async () => {
    await renderPanel('config');

    const tabButtons = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabButtons.map((tab) => tab.textContent)).toEqual(['配置', '内容列表']);

    const visiblePanels = Array.from(container.querySelectorAll('[role="tabpanel"]'))
      .filter((panel) => panel.getAttribute('aria-hidden') !== 'true');
    expect(visiblePanels).toHaveLength(1);
    expect(visiblePanels[0]?.querySelector('.box-editor-panel__layout-slot')).not.toBeNull();
  });

  it('shows entry titles only in the content list', async () => {
    await renderPanel();

    const titles = Array.from(container.querySelectorAll('.box-editor-panel__entry-title')).map((node) => node.textContent);
    expect(titles).toEqual(['第一张卡片', '第二张卡片']);
    expect(container.textContent).not.toContain('/workspace/first.card');
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent === '导入作品')).toBe(true);
    expect(container.querySelector('.box-editor-panel__entry-location')).toBeNull();
  });

  it('reorders entries by dragging the list handle', async () => {
    await renderPanel();

    const rows = Array.from(container.querySelectorAll('.box-editor-panel__entry')) as HTMLDivElement[];
    const handles = Array.from(container.querySelectorAll('.box-editor-panel__drag-handle')) as HTMLButtonElement[];
    if (rows.length < 2 || handles.length < 2) {
      throw new Error('未找到箱子内容列表拖拽测试所需条目');
    }

    rows[0].getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 320,
      height: 44,
      top: 0,
      left: 0,
      right: 320,
      bottom: 44,
      toJSON: () => ({}),
    });
    rows[1].getBoundingClientRect = () => ({
      x: 0,
      y: 56,
      width: 320,
      height: 44,
      top: 56,
      left: 0,
      right: 320,
      bottom: 100,
      toJSON: () => ({}),
    });

    const PointerCtor = window.PointerEvent ?? window.MouseEvent;

    await act(async () => {
      handles[0].dispatchEvent(new PointerCtor('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: 24,
        clientY: 18,
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
      }));

      window.dispatchEvent(new PointerCtor('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: 32,
        clientY: 92,
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
      }));

      window.dispatchEvent(new PointerCtor('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: 32,
        clientY: 92,
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
      }));

      await Promise.resolve();
    });

    expect(serviceMocks.moveEntryToIndex).toHaveBeenCalledWith('box-1', 'entry-1', 1);
  });
});
