// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxWindow } from '../../src/components/BoxWindow/BoxWindow';

const selectBox = vi.fn();
const onFocus = vi.fn();
const onUpdateConfig = vi.fn();

vi.mock('../../src/context/EditorSelectionContext', () => ({
  useEditorSelection: () => ({
    selectBox,
  }),
}));

vi.mock('../../src/layouts/InfiniteCanvas/CanvasContext', () => ({
  useCanvas: () => ({
    zoom: 1,
  }),
}));

vi.mock('../../src/hooks/useBoxDocumentSession', () => ({
  useBoxDocumentSession: () => ({
    session: {
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
      entries: [],
      assets: [],
      isDirty: false,
      isSaving: false,
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../../src/hooks/useBoxLayoutDefinition', () => ({
  useBoxLayoutDefinition: () => ({
    layoutDefinition: {
      layoutType: 'chips.layout.grid',
      displayName: 'Grid Layout',
    },
    error: null,
  }),
}));

vi.mock('../../src/components/CardWindowBase/CardWindowBase', () => ({
  CardWindowBase: ({
    children,
    headerSlot,
  }: {
    children: React.ReactNode;
    headerSlot?: React.ReactNode;
  }) => (
    <div>
      <div>{headerSlot}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('../../src/components/WindowMenu/WindowMenu', () => ({
  WindowMenu: ({
    onSettings,
  }: {
    onSettings?: () => void;
  }) => (
    <div>
      <button type="button" data-testid="window-settings" onClick={() => onSettings?.()}>settings</button>
    </div>
  ),
}));

vi.mock('../../src/components/BoxWindow/BoxPreviewSurface', () => ({
  BoxPreviewSurface: () => <div data-testid="box-preview-surface">preview</div>,
}));

vi.mock('../../src/components/BoxWindow/BoxCoverSurface', () => ({
  BoxCoverSurface: () => <div data-testid="box-cover-surface">cover</div>,
}));

vi.mock('../../src/components/BoxWindow/BoxSettingsDialog', () => ({
  BoxSettingsDialog: ({ visible }: { visible: boolean }) => (
    visible ? <div data-testid="box-settings-dialog">box-settings-dialog</div> : null
  ),
}));

vi.mock('../../src/services/workspace-service', () => ({
  workspaceService: {
    refresh: vi.fn(async () => undefined),
  },
}));

vi.mock('../../src/services/box-document-service', async () => {
  const actual = await vi.importActual('../../src/services/box-document-service');
  return {
    ...actual,
    boxDocumentService: {
      saveBox: vi.fn(async () => undefined),
      closeBox: vi.fn(async () => undefined),
    },
  };
});

describe('BoxWindow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    selectBox.mockClear();
    onFocus.mockClear();
    onUpdateConfig.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderBoxWindow() {
    await act(async () => {
      root.render(
        <BoxWindow
          config={{
            id: 'window-box-1',
            type: 'box',
            boxId: 'box-1',
            boxPath: '/workspace/demo.box',
            title: 'Demo Box',
            position: { x: 0, y: 0 },
            size: { width: 720, height: 540 },
            state: 'normal',
            zIndex: 1,
          }}
          onUpdateConfig={onUpdateConfig}
          onClose={() => undefined}
          onFocus={onFocus}
        />,
      );
      await Promise.resolve();
    });
  }

  it('opens the dedicated box settings dialog from the settings button', async () => {
    await renderBoxWindow();

    expect(container.querySelector('[data-testid="box-settings-dialog"]')).toBeNull();

    await act(async () => {
      (container.querySelector('[data-testid="window-settings"]') as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="box-settings-dialog"]')).not.toBeNull();
    expect(selectBox).toHaveBeenCalledWith('box-1');
    expect(onFocus).toHaveBeenCalled();
  });
});
