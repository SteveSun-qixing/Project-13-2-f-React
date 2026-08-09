// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxWindow } from '../../src/components/BoxWindow/BoxWindow';
import { BoxEditorPanel } from '../../src/components/EditPanel/BoxEditorPanel';

const mockState = vi.hoisted(() => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const session = {
    boxId: 'box1234567',
    boxFile: '/workspace/demo.box',
    workspaceDir: '/workspace/.chips-editing-engine/box-sessions/session-box',
    metadata: {
      chipStandardsVersion: '1.0.0',
      boxId: 'box1234567',
      name: 'Demo Box',
      createdAt: '2026-03-24T00:00:00.000Z',
      modifiedAt: '2026-03-24T00:00:00.000Z',
      activeLayoutType: 'chips.layout.grid',
    },
    content: {
      activeLayoutType: 'chips.layout.grid',
      layoutConfigs: {
        'chips.layout.grid': {
          schemaVersion: '1.0.0',
          props: {
            columnCount: 4,
            gap: 16,
          },
          assetRefs: [],
        },
      },
    },
    entries: [
      {
        entryId: 'entry000001',
        url: 'file:///workspace/demo.card',
        enabled: true,
        snapshot: {
          title: 'Demo Card',
          summary: 'Demo Summary',
          cover: {
            mode: 'none',
          },
        },
        layoutHints: {},
      },
    ],
    assets: [],
    isDirty: false,
    isSaving: false,
    lastSavedAt: '2026-03-24T00:00:00.000Z',
  };

  const emit = () => {
    for (const handler of listeners.get(`session:${session.boxId}`) ?? []) {
      handler({ ...session, entries: [...session.entries] });
    }
  };

  const previewDispose = vi.fn(async () => undefined);
  const editorDispose = vi.fn(async () => undefined);

  return {
    listeners,
    session,
    emit,
    previewDispose,
    editorDispose,
    onClose: vi.fn(),
    onFocus: vi.fn(),
    onUpdateConfig: vi.fn(),
    saveBox: vi.fn(async () => {
      session.isDirty = false;
      session.isSaving = false;
      emit();
      return { ...session, entries: [...session.entries] };
    }),
    client: {
      platform: {
        openFile: vi.fn(async () => null),
      },
      document: {
        window: {
          render: vi.fn(async () => ({
            frame: document.createElement('iframe'),
            origin: 'file://',
            dispose: previewDispose,
            documentType: 'box' as const,
          })),
          onReady: vi.fn((_frame: HTMLIFrameElement, handler: () => void) => {
            handler();
            return () => undefined;
          }),
          onError: vi.fn(() => () => undefined),
          onResourceOpen: vi.fn(() => () => undefined),
        },
      },
      box: {
        readLayoutDescriptor: vi.fn(async () => ({
          pluginId: 'chips.layout.grid',
          layoutType: 'chips.layout.grid',
          displayName: '网格布局',
          defaultConfig: {
            schemaVersion: '1.0.0',
            props: {
              columnCount: 4,
              gap: 16,
            },
            assetRefs: [],
          },
        })),
        normalizeLayoutConfig: vi.fn(async (_layoutType: string, input: Record<string, unknown>) => input),
        editorPanel: {
          render: vi.fn(async () => ({
            frame: document.createElement('iframe'),
            origin: 'file://',
            dispose: editorDispose,
          })),
          onReady: vi.fn(() => () => undefined),
          onChange: vi.fn(() => () => undefined),
          onError: vi.fn(() => () => undefined),
        },
      },
    },
  };
});


vi.mock('../../src/services/bridge-client', () => ({
  getChipsClient: () => mockState.client,
}));

vi.mock('../../src/services/workspace-service', () => ({
  workspaceService: {
    getState: () => ({
      rootPath: '/workspace',
    }),
    refresh: vi.fn(async () => undefined),
    getFileByPath: vi.fn(() => undefined),
    openFile: vi.fn(),
  },
}));

vi.mock('../../src/components/CardWindowBase/CardWindowBase', () => ({
  CardWindowBase: ({ children, headerSlot }: { children: React.ReactNode; headerSlot?: React.ReactNode }) => (
    <div>
      <div>{headerSlot}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('../../src/layouts/InfiniteCanvas/CanvasContext', () => ({
  useCanvas: () => ({
    zoom: 1,
    panX: 0,
    panY: 0,
    panByInput: vi.fn(),
    panByScreenDelta: vi.fn(),
    zoomByFactorAtPoint: vi.fn(),
    markInteractionSequence: vi.fn(),
    clearInteractionSequence: vi.fn(),
    isDesktopZoomSuppressed: vi.fn(() => false),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    zoomTo: vi.fn(),
    resetView: vi.fn(),
    fitToContent: vi.fn(),
    screenToWorld: vi.fn(() => ({ x: 0, y: 0 })),
    worldToScreen: vi.fn(() => ({ x: 0, y: 0 })),
  }),
}));

vi.mock('../../src/services/box-document-service', () => ({
  boxDocumentService: {
    getSession: vi.fn(() => ({ ...mockState.session, entries: [...mockState.session.entries] })),
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      const handlers = mockState.listeners.get(event) ?? new Set<(payload: unknown) => void>();
      handlers.add(handler);
      mockState.listeners.set(event, handlers);
    }),
    off: vi.fn((event: string, handler: (payload: unknown) => void) => {
      mockState.listeners.get(event)?.delete(handler);
    }),
    openBox: vi.fn(async () => ({ ...mockState.session, entries: [...mockState.session.entries] })),
    closeBox: vi.fn(async () => undefined),
    saveBox: mockState.saveBox,
    readBoxAsset: vi.fn(async (assetPath: string) => ({
      resourceUrl: `file:///workspace/${assetPath}`,
      mimeType: 'image/webp',
    })),
    importBoxAsset: vi.fn(async () => ({ assetPath: 'assets/layouts/grid/bg.webp' })),
    deleteBoxAsset: vi.fn(async () => undefined),
    updateLayoutConfig: vi.fn((_boxId: string, _layoutType: string, next: Record<string, unknown>) => {
      mockState.session.content.layoutConfigs['chips.layout.grid'] = next as never;
      mockState.session.isDirty = true;
      mockState.emit();
      return { ...mockState.session, entries: [...mockState.session.entries] };
    }),
    importDocumentFiles: vi.fn(async () => ({ ...mockState.session, entries: [...mockState.session.entries] })),
    moveEntryToIndex: vi.fn(),
    updateMetadata: vi.fn((_boxId: string, patch: Record<string, unknown>) => {
      mockState.session.metadata = {
        ...mockState.session.metadata,
        ...patch,
      };
      mockState.session.isDirty = true;
      mockState.emit();
      return { ...mockState.session, entries: [...mockState.session.entries] };
    }),
    updateCover: vi.fn(async () => ({ ...mockState.session, entries: [...mockState.session.entries] })),
    moveEntry: vi.fn(),
    removeEntry: vi.fn(),
  },
}));

describe('编辑引擎箱子编辑链路基础流程', () => {
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
    vi.clearAllMocks();
    mockState.listeners.clear();
    mockState.session.isDirty = false;
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

  it('会分别通过统一文档窗口和 Host 布局编辑面板渲染箱子预览与编辑界面', async () => {
    await act(async () => {
      root.render(
        <>
          <BoxWindow
            config={{
              id: 'box-window-1',
              type: 'box',
              title: 'Demo Box',
              boxId: 'box1234567',
              boxPath: '/workspace/demo.box',
              position: { x: 0, y: 0 },
              size: { width: 1200, height: 800 },
              state: 'normal',
              zIndex: 1,
            }}
            onUpdateConfig={mockState.onUpdateConfig}
            onClose={mockState.onClose}
            onFocus={mockState.onFocus}
          />
          <BoxEditorPanel
            boxId="box1234567"
            boxPath="/workspace/demo.box"
          />
        </>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockState.client.document.window.render).toHaveBeenCalledWith({
      filePath: '/workspace/demo.box',
      documentType: 'box',
      locale: 'zh-CN',
    });
    expect(mockState.client.box.readLayoutDescriptor).toHaveBeenCalledWith('chips.layout.grid');
    expect(mockState.client.box.editorPanel.render).toHaveBeenCalled();
    expect(container.querySelector('.window-menu')).not.toBeNull();
    expect(container.textContent).toContain('布局配置');
  });
});
