// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const updateBasicCard = vi.fn();

vi.mock('../../src/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../src/components/EditPanel/PluginHost', () => ({
  PluginHost: ({ cardType, baseCardId }: { cardType: string; baseCardId: string }) => (
    <div data-testid="plugin-host-stub" data-card-type={cardType} data-base-card-id={baseCardId} />
  ),
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
                type: 'base.richtext',
                data: { id: 'base-1', title: 'Intro' },
              },
            ],
          },
        }),
        updateBasicCard,
      }),
    }));

    const { default: TestedEditPanel } = await import('../../src/components/EditPanel/EditPanel');

    await act(async () => {
      root.render(<TestedEditPanel />);
    });

    expect(container.querySelector('.edit-panel__header')).toBeNull();
    expect(container.querySelector('.edit-panel__content')).not.toBeNull();
    expect((container.querySelector('.edit-panel') as HTMLDivElement | null)?.style.width).toBe('320px');

    const pluginHost = container.querySelector('[data-testid="plugin-host-stub"]') as HTMLDivElement | null;
    expect(pluginHost?.dataset.cardType).toBe('base.richtext');
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
        updateBasicCard,
      }),
    }));

    const { default: TestedEditPanel } = await import('../../src/components/EditPanel/EditPanel');

    await act(async () => {
      root.render(<TestedEditPanel />);
    });

    expect(container.querySelector('[data-testid="plugin-host-stub"]')).toBeNull();
    expect(container.querySelector('.edit-panel__empty-text')?.textContent).toBe('edit_panel.empty_hint');
  });
});
