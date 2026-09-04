// @vitest-environment jsdom

import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DragProvider, useDrag } from '../../src/components/CardBoxLibrary/DragContext';

function DragContextProbe() {
  const { startDrag, endDrag } = useDrag();

  return (
    <div>
      <button
        type="button"
        data-testid="start-card-drag"
        onClick={() => {
          const event = {
            clientX: 120,
            clientY: 240,
            dataTransfer: {
              setData: () => undefined,
              effectAllowed: 'none',
              setDragImage: () => undefined,
            },
          } as unknown as React.DragEvent;

          startDrag({
            type: 'card',
            typeId: 'RichTextCard',
            name: 'Rich Text',
          }, event);
        }}
      >
        start-card-drag
      </button>
      <button
        type="button"
        data-testid="end-drag"
        onClick={() => {
          endDrag();
        }}
      >
        end-drag
      </button>
    </div>
  );
}

describe('DragContext global drag markers', () => {
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
  });

  it('publishes and clears the global library drag markers for base-card drags', async () => {
    await act(async () => {
      root.render(
        <DragProvider>
          <DragContextProbe />
        </DragProvider>,
      );
    });

    await act(async () => {
      (container.querySelector('[data-testid="start-card-drag"]') as HTMLButtonElement).click();
    });

    expect(document.body.dataset.chipsLibraryDragging).toBe('true');
    expect(document.body.dataset.chipsLibraryDragType).toBe('card');
    expect(document.body.dataset.chipsLibraryDragPayload).toBe(JSON.stringify({
      type: 'card',
      typeId: 'RichTextCard',
      name: 'Rich Text',
    }));

    await act(async () => {
      (container.querySelector('[data-testid="end-drag"]') as HTMLButtonElement).click();
    });

    expect(document.body.dataset.chipsLibraryDragging).toBeUndefined();
    expect(document.body.dataset.chipsLibraryDragType).toBeUndefined();
    expect(document.body.dataset.chipsLibraryDragPayload).toBeUndefined();
  });
});
