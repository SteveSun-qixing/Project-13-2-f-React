// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompositeCardAssembler } from '../../src/basecard-runtime/CompositeCardAssembler';

const basecardFrameHostMock = vi.fn();

vi.mock('../../src/basecard-runtime/frame-host', () => ({
  BasecardFrameHost: (props: Record<string, unknown>) => {
    basecardFrameHostMock(props);
    return <div data-testid={`basecard-frame-${String(props.baseCardId)}`} />;
  },
}));

describe('CompositeCardAssembler', () => {
  let container: HTMLDivElement;
  let root: Root;
  let resizeObserverCallback: ResizeObserverCallback | null;
  let originalResizeObserver: typeof ResizeObserver | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    resizeObserverCallback = null;
    basecardFrameHostMock.mockClear();
    originalResizeObserver = globalThis.ResizeObserver;

    globalThis.ResizeObserver = class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }

      observe(): void {}

      disconnect(): void {}

      unobserve(): void {}
    } as typeof ResizeObserver;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver;
    } else {
      Reflect.deleteProperty(globalThis, 'ResizeObserver');
    }
  });

  it('measures unscaled layout height instead of transformed visual height', async () => {
    const onHeightChange = vi.fn();
    const resolveResourceUrl = vi.fn(async (resourcePath: string) => (
      `chips-render://card-root/card-token/${resourcePath}`
    ));

    await act(async () => {
      root.render(
        <CompositeCardAssembler
          cardId="card-1"
          baseCards={[
            {
              id: 'base-1',
              type: 'base.richtext',
              data: { id: 'base-1', content_text: 'demo' },
              createdAt: '2026-03-14T00:00:00.000Z',
              modifiedAt: '2026-03-14T00:00:00.000Z',
            },
          ]}
          resolveResourceUrl={resolveResourceUrl}
          layout={{ gap: 12, padding: 16 }}
          mode="preview"
          interactionPolicy="delegate"
          themeCacheKey="theme"
          onHeightChange={onHeightChange}
        />,
      );
      await Promise.resolve();
    });

    const assembler = container.querySelector('.composite-card-assembler');
    expect(assembler).not.toBeNull();
    expect(resizeObserverCallback).not.toBeNull();
    expect(basecardFrameHostMock).toHaveBeenCalledWith(expect.objectContaining({
      resolveResourceUrl,
    }));
    if (!(assembler instanceof HTMLDivElement)) {
      throw new Error('Expected composite card assembler container.');
    }

    Object.defineProperty(assembler, 'scrollHeight', {
      configurable: true,
      get: () => 240,
    });
    Object.defineProperty(assembler, 'offsetHeight', {
      configurable: true,
      get: () => 240,
    });
    Object.defineProperty(assembler, 'clientHeight', {
      configurable: true,
      get: () => 240,
    });
    assembler.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 320,
      bottom: 480,
      width: 320,
      height: 480,
      toJSON: () => ({}),
    })) as unknown as typeof assembler.getBoundingClientRect;

    await act(async () => {
      resizeObserverCallback?.(
        [{ target: assembler } as unknown as ResizeObserverEntry],
        {} as ResizeObserver,
      );
      await Promise.resolve();
    });

    expect(onHeightChange).toHaveBeenLastCalledWith(240);
    expect(onHeightChange).not.toHaveBeenLastCalledWith(480);
  });

  it('forwards basecard resource open events with composite node context', async () => {
    const onResourceOpen = vi.fn();

    await act(async () => {
      root.render(
        <CompositeCardAssembler
          cardId="card-1"
          baseCards={[
            {
              id: 'base-1',
              type: 'base.image',
              data: { id: 'base-1', images: [] },
              createdAt: '2026-03-14T00:00:00.000Z',
              modifiedAt: '2026-03-14T00:00:00.000Z',
            },
          ]}
          mode="view"
          interactionPolicy="native"
          onResourceOpen={onResourceOpen}
        />,
      );
      await Promise.resolve();
    });

    const firstCall = basecardFrameHostMock.mock.calls[0]?.[0] as {
      onResourceOpen?: (input: {
        resourceId: string;
        mimeType?: string;
        title?: string;
        fileName?: string;
      }) => void;
    };

    firstCall.onResourceOpen?.({
      resourceId: 'file:///workspace/demo.card/image.png',
      mimeType: 'image/png',
      title: 'Preview',
      fileName: 'image.png',
    });

    expect(onResourceOpen).toHaveBeenCalledWith({
      cardId: 'card-1',
      baseCardId: 'base-1',
      cardType: 'base.image',
      resource: {
        resourceId: 'file:///workspace/demo.card/image.png',
        mimeType: 'image/png',
        title: 'Preview',
        fileName: 'image.png',
      },
    });
  });
});
