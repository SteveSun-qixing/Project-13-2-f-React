// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  resolveBoxEntryImportDropTarget,
  resolveCompositeCardDropTarget,
} from '../../src/layouts/InfiniteCanvas/canvas-drop-target';
import type { CompositeCard } from '../../src/core/card-service';

interface RectInput {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface NodeRectInput {
  id: string;
  left?: number;
  top: number;
  width?: number;
  height: number;
}

function createOpenCards(
  cardId: string,
  baseCardIds: string[],
  layout: NonNullable<CompositeCard['structure']['layout']> = { padding: 16, gap: 12 },
): Map<string, CompositeCard> {
  const basicCards = baseCardIds.map((id) => ({
    id,
    type: 'RichTextCard',
    data: {},
    createdAt: '2026-03-14T00:00:00.000Z',
    modifiedAt: '2026-03-14T00:00:00.000Z',
  }));

  return new Map([
    [cardId, {
      id: cardId,
      path: `/workspace/${cardId}.card`,
      metadata: {
        name: cardId,
        createdAt: '2026-03-14T00:00:00.000Z',
        modifiedAt: '2026-03-14T00:00:00.000Z',
      },
      structure: {
        basicCards,
        layout,
      },
      isDirty: false,
      isEditing: true,
    } as CompositeCard],
  ]);
}

function defineElementRect(element: HTMLElement, rect: RectInput): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => null,
    }),
  });
}

function attachPreviewSurface(options: {
  cardId: string;
  rect: RectInput;
  nodes?: NodeRectInput[];
  acceptDrop?: boolean;
}) {
  const preview = document.createElement('div');
  preview.dataset.chipsDropSurface = 'composite-preview';
  preview.dataset.chipsCardId = options.cardId;
  preview.dataset.chipsDropAccept = options.acceptDrop === false ? 'false' : 'true';
  document.body.appendChild(preview);

  defineElementRect(preview, options.rect);

  const nodeHandles = new Map<string, HTMLElement>();

  for (const nodeConfig of options.nodes ?? []) {
    const node = document.createElement('div');
    node.dataset.baseCardId = nodeConfig.id;

    const handle = document.createElement('div');
    node.appendChild(handle);
    preview.appendChild(node);

    defineElementRect(node, {
      left: nodeConfig.left ?? options.rect.left + 16,
      top: nodeConfig.top,
      width: nodeConfig.width ?? options.rect.width - 32,
      height: nodeConfig.height,
    });

    nodeHandles.set(nodeConfig.id, handle);
  }

  const fallbackChild = document.createElement('div');
  preview.appendChild(fallbackChild);

  return {
    preview,
    fallbackChild,
    nodeHandles,
  };
}

function attachBoxPreviewSurface(options: {
  boxId: string;
  rect: RectInput;
  acceptDrop?: boolean;
}) {
  const preview = document.createElement('div');
  preview.dataset.chipsDropSurface = 'box-preview';
  preview.dataset.chipsBoxId = options.boxId;
  preview.dataset.chipsDropAccept = options.acceptDrop === false ? 'false' : 'true';
  document.body.appendChild(preview);

  defineElementRect(preview, options.rect);

  const child = document.createElement('div');
  preview.appendChild(child);

  return {
    preview,
    child,
  };
}

describe('resolveCompositeCardDropTarget', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns null when the dragged payload is not a base card from the library', () => {
    const { fallbackChild } = attachPreviewSurface({
      cardId: 'card-1',
      rect: { left: 40, top: 60, width: 300, height: 360 },
      nodes: [
        { id: 'base-1', top: 76, height: 60 },
        { id: 'base-2', top: 148, height: 120 },
      ],
    });

    const target = resolveCompositeCardDropTarget({
      dragData: {
        type: 'workspace-file',
        fileId: 'card-1',
        fileType: 'card',
        filePath: '/workspace/card-1.card',
        name: 'card-1.card',
      },
      eventTarget: fallbackChild,
      screenPosition: { x: 120, y: 140 },
      openCards: createOpenCards('card-1', ['base-1', 'base-2']),
    });

    expect(target).toBeNull();
  });

  it('returns null when the composite preview is not accepting insert drops', () => {
    const { fallbackChild } = attachPreviewSurface({
      cardId: 'card-1',
      rect: { left: 40, top: 60, width: 300, height: 360 },
      acceptDrop: false,
      nodes: [
        { id: 'base-1', top: 76, height: 60 },
      ],
    });

    const target = resolveCompositeCardDropTarget({
      dragData: {
        type: 'card',
        typeId: 'RichTextCard',
        name: 'Rich Text',
      },
      eventTarget: fallbackChild,
      screenPosition: { x: 180, y: 90 },
      openCards: createOpenCards('card-1', ['base-1']),
    });

    expect(target).toBeNull();
  });

  it('projects the upper half of a real base-card node to the slot before that node', () => {
    const { nodeHandles } = attachPreviewSurface({
      cardId: 'card-1',
      rect: { left: 40, top: 60, width: 300, height: 360 },
      nodes: [
        { id: 'base-1', top: 76, height: 60 },
        { id: 'base-2', top: 148, height: 120 },
        { id: 'base-3', top: 280, height: 92 },
      ],
    });

    const target = resolveCompositeCardDropTarget({
      dragData: {
        type: 'card',
        typeId: 'RichTextCard',
        name: 'Rich Text',
      },
      eventTarget: nodeHandles.get('base-2') ?? null,
      screenPosition: { x: 180, y: 170 },
      openCards: createOpenCards('card-1', ['base-1', 'base-2', 'base-3']),
    });

    expect(target).toEqual({
      type: 'composite-card-insert',
      cardId: 'card-1',
      insertionIndex: 1,
      indicator: {
        left: 56,
        top: 142,
        width: 268,
      },
    });
  });

  it('projects the lower half of a middle base-card node to the slot after that node', () => {
    const { nodeHandles } = attachPreviewSurface({
      cardId: 'card-1',
      rect: { left: 40, top: 60, width: 300, height: 360 },
      nodes: [
        { id: 'base-1', top: 76, height: 60 },
        { id: 'base-2', top: 148, height: 120 },
        { id: 'base-3', top: 280, height: 92 },
      ],
    });

    const target = resolveCompositeCardDropTarget({
      dragData: {
        type: 'card',
        typeId: 'RichTextCard',
        name: 'Rich Text',
      },
      eventTarget: nodeHandles.get('base-2') ?? null,
      screenPosition: { x: 180, y: 240 },
      openCards: createOpenCards('card-1', ['base-1', 'base-2', 'base-3']),
    });

    expect(target).toEqual({
      type: 'composite-card-insert',
      cardId: 'card-1',
      insertionIndex: 2,
      indicator: {
        left: 56,
        top: 274,
        width: 268,
      },
    });
  });

  it('projects the lower half of the last base-card node to the composite tail slot', () => {
    const { nodeHandles } = attachPreviewSurface({
      cardId: 'card-2',
      rect: { left: 10, top: 20, width: 260, height: 360 },
      nodes: [
        { id: 'base-1', top: 36, height: 80 },
        { id: 'base-2', top: 128, height: 120 },
        { id: 'base-3', top: 260, height: 92 },
      ],
    });

    const target = resolveCompositeCardDropTarget({
      dragData: {
        type: 'card',
        typeId: 'RichTextCard',
        name: 'Rich Text',
      },
      eventTarget: nodeHandles.get('base-3') ?? null,
      screenPosition: { x: 180, y: 330 },
      openCards: createOpenCards('card-2', ['base-1', 'base-2', 'base-3']),
    });

    expect(target).toEqual({
      type: 'composite-card-insert',
      cardId: 'card-2',
      insertionIndex: 3,
      indicator: {
        left: 26,
        top: 366,
        width: 228,
      },
    });
  });

  it('treats an empty composite surface as the first insertion slot', () => {
    const { fallbackChild } = attachPreviewSurface({
      cardId: 'card-3',
      rect: { left: 40, top: 60, width: 300, height: 360 },
      nodes: [],
    });

    const target = resolveCompositeCardDropTarget({
      dragData: {
        type: 'card',
        typeId: 'RichTextCard',
        name: 'Rich Text',
      },
      eventTarget: fallbackChild,
      screenPosition: { x: 180, y: 220 },
      openCards: createOpenCards('card-3', []),
    });

    expect(target).toEqual({
      type: 'composite-card-insert',
      cardId: 'card-3',
      insertionIndex: 0,
      indicator: {
        left: 56,
        top: 240,
        width: 268,
      },
    });
  });
});

describe('resolveBoxEntryImportDropTarget', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('accepts workspace card and box files on a box preview surface', () => {
    const { child } = attachBoxPreviewSurface({
      boxId: 'box-1',
      rect: { left: 40, top: 60, width: 300, height: 360 },
    });

    expect(resolveBoxEntryImportDropTarget({
      dragData: {
        type: 'workspace-file',
        fileId: 'card-1',
        fileType: 'card',
        filePath: '/workspace/card-1.card',
        name: 'card-1.card',
      },
      eventTarget: child,
      screenPosition: { x: 120, y: 140 },
    })).toEqual({
      type: 'box-entry-import',
      boxId: 'box-1',
    });

    expect(resolveBoxEntryImportDropTarget({
      dragData: {
        type: 'workspace-file',
        fileId: 'box-2',
        fileType: 'box',
        filePath: '/workspace/box-2.box',
        name: 'box-2.box',
      },
      eventTarget: child,
      screenPosition: { x: 120, y: 140 },
    })).toEqual({
      type: 'box-entry-import',
      boxId: 'box-1',
    });
  });

  it('does not treat disabled box preview surfaces as import targets', () => {
    const { child } = attachBoxPreviewSurface({
      boxId: 'box-1',
      rect: { left: 40, top: 60, width: 300, height: 360 },
      acceptDrop: false,
    });

    const target = resolveBoxEntryImportDropTarget({
      dragData: {
        type: 'workspace-file',
        fileId: 'card-1',
        fileType: 'card',
        filePath: '/workspace/card-1.card',
        name: 'card-1.card',
      },
      eventTarget: child,
      screenPosition: { x: 120, y: 140 },
    });

    expect(target).toBeNull();
  });
});
