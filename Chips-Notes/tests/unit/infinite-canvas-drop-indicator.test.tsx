// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/layouts/InfiniteCanvas/DesktopLayer', () => ({
  DesktopLayer: ({
    children,
    style,
  }: {
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }) => (
    <div className="mock-desktop-layer" style={style}>
      {children}
    </div>
  ),
}));

vi.mock('../../src/layouts/InfiniteCanvas/WindowLayer', () => ({
  WindowLayer: ({ children }: { children?: React.ReactNode }) => (
    <div className="mock-window-layer">{children}</div>
  ),
}));

vi.mock('../../src/layouts/InfiniteCanvas/ZoomControl', () => ({
  ZoomControl: () => null,
}));

import { InfiniteCanvas } from '../../src/layouts/InfiniteCanvas/InfiniteCanvas';

describe('InfiniteCanvas drop indicator overlay', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    delete document.body.dataset.chipsLibraryDragging;
    delete document.body.dataset.chipsLibraryDragType;
    delete document.body.dataset.chipsLibraryDragPayload;
  });

  it('renders the insert indicator above the canvas using viewport-relative coordinates even when dragover cannot read dataTransfer payload', async () => {
    await act(async () => {
      root.render(
        <div style={{ width: '800px', height: '600px' }}>
          <InfiniteCanvas
            resolveDropTarget={() => ({
              type: 'composite-card-insert',
              cardId: 'card-1',
              insertionIndex: 1,
              indicator: {
                left: 160,
                top: 210,
                width: 120,
              },
            })}
          />
        </div>,
      );
    });

    const canvas = container.querySelector('.infinite-canvas') as HTMLDivElement | null;
    expect(canvas).not.toBeNull();

    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 40,
        top: 60,
        right: 840,
        bottom: 660,
        width: 800,
        height: 600,
        x: 40,
        y: 60,
        toJSON: () => null,
      }),
    });

    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true }) as Event & {
      clientX: number;
      clientY: number;
      dataTransfer: DataTransfer;
    };
    Object.defineProperty(dragOverEvent, 'clientX', { value: 220 });
    Object.defineProperty(dragOverEvent, 'clientY', { value: 280 });
    Object.defineProperty(dragOverEvent, 'dataTransfer', {
      value: {
        dropEffect: 'none',
        getData: (_type: string) => '',
      },
    });

    document.body.dataset.chipsLibraryDragging = 'true';
    document.body.dataset.chipsLibraryDragType = 'card';
    document.body.dataset.chipsLibraryDragPayload = JSON.stringify({
      type: 'card',
      typeId: 'RichTextCard',
      name: 'Rich Text',
    });

    await act(async () => {
      canvas?.dispatchEvent(dragOverEvent);
    });

    const indicator = container.querySelector('.infinite-canvas__insert-indicator') as HTMLDivElement | null;
    expect(indicator).not.toBeNull();
    expect(indicator?.style.left).toBe('120px');
    expect(indicator?.style.top).toBe('150px');
    expect(indicator?.style.width).toBe('120px');
  });
});
