// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const updateBasicCard = vi.fn();
const mockTarget = vi.hoisted(() => ({ current: null as null | { kind: 'box'; boxId: string } | { kind: 'card'; cardId: string; baseCardId: string | null } }));
const mockWindows = vi.hoisted(() => ({ current: [] as Array<Record<string, unknown>> }));

vi.mock('../../src/components/EditPanel/PluginHost', () => ({
  PluginHost: ({ cardType, baseCardId }: { cardType: string; baseCardId: string }) => (
    <div data-testid="plugin-host-stub" data-card-type={cardType} data-base-card-id={baseCardId} />
  ),
}));

vi.mock('../../src/components/EditPanel/BoxEditorPanel', () => ({
  BoxEditorPanel: ({ boxId, boxPath }: { boxId: string; boxPath: string }) => (
    <div data-testid="box-editor-panel-stub" data-box-id={boxId} data-box-path={boxPath} />
  ),
}));

vi.mock('../../src/context/UIContext', () => ({
  useUI: () => ({
    windows: mockWindows.current,
  }),
}));

vi.mock('../../src/context/EditorSelectionContext', () => ({
  useEditorSelection: () => ({
    target: mockTarget.current,
  }),
}));

vi.mock('../../src/services/workspace-service', () => ({
  workspaceService: {
    refresh: vi.fn(async () => undefined),
  },
}));

describe('EditPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    updateBasicCard.mockClear();
    mockTarget.current = null;
    mockWindows.current = [];
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.resetModules();
  });

  it('renders the plugin container without an inner title bar', async () => {
    vi.doMock('../../src/context/CardContext', () => ({
      useCard: () => ({
        activeCardId: 'card-1',
        selectedBaseCardId: 'base-1',
        getCard: () => ({
          id: 'card-1',
          structure: {
            basicCards: [
              {
                id: 'base-1',
                type: 'RichTextCard',
                data: { id: 'base-1', title: 'Intro' },
              },
            ],
          },
        }),
        saveCard: vi.fn(async () => undefined),
        updateBasicCard,
      }),
    }));

    const { default: TestedEditPanel } = await import('../../src/components/EditPanel/EditPanel');

    await act(async () => {
      root.render(<TestedEditPanel />);
    });

    expect(container.querySelector('.edit-panel__header')).toBeNull();
    expect(container.querySelector('.edit-panel__content')).not.toBeNull();
    expect((container.querySelector('.edit-panel') as HTMLDivElement | null)?.style.width).toBe('');

    const pluginHost = container.querySelector('[data-testid="plugin-host-stub"]') as HTMLDivElement | null;
    expect(pluginHost?.dataset.cardType).toBe('RichTextCard');
    expect(pluginHost?.dataset.baseCardId).toBe('base-1');
  });

  it('shows the empty container state when no base card is selected', async () => {
    vi.doMock('../../src/context/CardContext', () => ({
      useCard: () => ({
        activeCardId: 'card-1',
        selectedBaseCardId: null,
        getCard: () => ({
          id: 'card-1',
          structure: {
            basicCards: [],
          },
        }),
        saveCard: vi.fn(async () => undefined),
        updateBasicCard,
      }),
    }));

    const { default: TestedEditPanel } = await import('../../src/components/EditPanel/EditPanel');

    await act(async () => {
      root.render(<TestedEditPanel />);
    });

    expect(container.querySelector('[data-testid="plugin-host-stub"]')).toBeNull();
    expect(container.querySelector('.edit-panel__empty-text')?.textContent).toBe('请在左侧选择要编辑的内容');
  });

  it('routes selected box editing into the dedicated box editor panel', async () => {
    mockTarget.current = {
      kind: 'box',
      boxId: 'box-1',
    };
    mockWindows.current = [
      {
        id: 'window-box-1',
        type: 'box',
        boxId: 'box-1',
        boxPath: '/workspace/demo.box',
      },
    ];

    vi.doMock('../../src/context/CardContext', () => ({
      useCard: () => ({
        activeCardId: null,
        selectedBaseCardId: null,
        getCard: () => null,
        saveCard: vi.fn(async () => undefined),
        updateBasicCard,
      }),
    }));

    const { default: TestedEditPanel } = await import('../../src/components/EditPanel/EditPanel');

    await act(async () => {
      root.render(<TestedEditPanel />);
    });

    const boxEditorPanel = container.querySelector('[data-testid="box-editor-panel-stub"]') as HTMLDivElement | null;
    expect(boxEditorPanel?.dataset.boxId).toBe('box-1');
    expect(boxEditorPanel?.dataset.boxPath).toBe('/workspace/demo.box');
    expect(container.querySelector('[data-testid="plugin-host-stub"]')).toBeNull();
  });
});
