// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BasecardFrameHost } from '../../src/basecard-runtime/frame-host';

const mockOpenSession = vi.fn();
const mockCloseSession = vi.fn();
const mockRenderView = vi.fn();
let readyHandler: ((payload: Record<string, unknown>) => void) | null = null;
let heightHandler: ((payload: Record<string, unknown>) => void) | null = null;
let selectHandler: ((payload: Record<string, unknown>) => void) | null = null;

vi.mock('../../src/services/bridge-client', () => ({
  getChipsClient: () => ({
    card: {
      basecard: {
        openSession: mockOpenSession,
        closeSession: mockCloseSession,
        renderView: mockRenderView,
        onReady: (_frame: HTMLIFrameElement, handler: (payload: Record<string, unknown>) => void) => {
          readyHandler = handler;
          return () => {
            readyHandler = null;
          };
        },
        onHeight: (_frame: HTMLIFrameElement, handler: (payload: Record<string, unknown>) => void) => {
          heightHandler = handler;
          return () => {
            heightHandler = null;
          };
        },
        onSelect: (_frame: HTMLIFrameElement, handler: (payload: Record<string, unknown>) => void) => {
          selectHandler = handler;
          return () => {
            selectHandler = null;
          };
        },
        onInteraction: () => () => undefined,
        onError: () => () => undefined,
      },
    },
  }),
}));

function ParentHarness() {
  const [readyRevision, setReadyRevision] = useState(0);

  return (
    <div data-ready-revision={String(readyRevision)}>
      <BasecardFrameHost
        cardId="card-1"
        cardPath="/workspace/demo.card"
        baseCardId="base-1"
        cardType="base.mock"
        config={{ id: 'base-1', body: '<p>demo</p>' }}
        selectable
        interactionPolicy="delegate"
        themeCacheKey="theme-1"
        onSelect={() => undefined}
        onInteraction={() => undefined}
        onStatusChange={(status) => {
          if (status.state === 'ready') {
            setReadyRevision((current) => current === 0 ? 1 : current);
          }
        }}
      />
    </div>
  );
}

let updateConfigBody: ((body: string) => void) | null = null;

function RefreshHarness() {
  const [config, setConfig] = useState({ id: 'base-1', body: '<p>demo</p>' });

  updateConfigBody = (body: string) => {
    setConfig({ id: 'base-1', body });
  };

  return (
    <BasecardFrameHost
      cardId="card-1"
      cardPath="/workspace/demo.card"
      baseCardId="base-1"
      cardType="base.mock"
      config={config}
      selectable
      interactionPolicy="delegate"
      themeCacheKey="theme-1"
      onSelect={() => undefined}
      onInteraction={() => undefined}
    />
  );
}

describe('BasecardFrameHost', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    readyHandler = null;
    heightHandler = null;
    selectHandler = null;
    updateConfigBody = null;
    mockOpenSession.mockReset();
    mockCloseSession.mockReset();
    mockRenderView.mockReset();

    mockOpenSession.mockResolvedValue({
      sessionId: 'session-1',
      pluginId: 'mock.basecard',
      cardType: 'base.mock',
      baseCardId: 'base-1',
      displayName: 'Mock Basecard',
      normalizedConfig: { id: 'base-1', body: '<p>demo</p>' },
      validation: { valid: true, issues: [] },
      referencedResources: [],
      commitDebounceMs: 260,
      supportsEditor: true,
    });
    mockCloseSession.mockResolvedValue({ closed: true });
    mockRenderView.mockImplementation(async () => ({
      frame: document.createElement('iframe'),
      origin: window.location.origin,
    }));
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps the iframe mounted after ready-driven parent rerenders', async () => {
    await act(async () => {
      root.render(<ParentHarness />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('iframe')).not.toBeNull();

    await act(async () => {
      readyHandler?.({ cardType: 'base.mock' });
      heightHandler?.({ height: 148 });
      await Promise.resolve();
    });

    expect(mockRenderView).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.basecard-frame-host__overlay[data-state="loading"]')).toBeNull();
    expect(container.querySelector('.basecard-frame-host__overlay[data-state="error"]')).toBeNull();
    expect(container.querySelector('[data-ready-revision="1"]')).not.toBeNull();
    expect(container.querySelector('iframe')).not.toBeNull();

    await act(async () => {
      selectHandler?.({ nodeId: 'base-1' });
      await Promise.resolve();
    });
  });

  it('preserves preview height and avoids loading overlay flashes during config refresh', async () => {
    await act(async () => {
      root.render(<RefreshHarness />);
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      readyHandler?.({ cardType: 'base.mock' });
      heightHandler?.({ height: 148 });
      await Promise.resolve();
    });

    const initialFrame = container.querySelector('iframe') as HTMLIFrameElement | null;
    expect(initialFrame?.style.height).toBe('148px');
    expect(container.querySelector('.basecard-frame-host__overlay[data-state="loading"]')).toBeNull();

    await act(async () => {
      updateConfigBody?.('<p>updated</p>');
      await Promise.resolve();
      await Promise.resolve();
    });

    const refreshedFrame = container.querySelector('iframe') as HTMLIFrameElement | null;
    expect(mockRenderView).toHaveBeenCalledTimes(2);
    expect(refreshedFrame?.style.height).toBe('148px');
    expect(container.querySelector('.basecard-frame-host__overlay[data-state="loading"]')).toBeNull();
  });
});
