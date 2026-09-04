import type { DragData } from '../../components/CardBoxLibrary/types';
import type { CompositeCard } from '../../core/card-service';

const COMPOSITE_DROP_SURFACE_SELECTOR = '[data-chips-drop-surface="composite-preview"]';
const BOX_DROP_SURFACE_SELECTOR = '[data-chips-drop-surface="box-preview"]';
const BASECARD_NODE_SELECTOR = '[data-base-card-id]';
const DEFAULT_COMPOSITE_PADDING_PX = 16;
const MIN_INDICATOR_WIDTH_PX = 24;

export interface CanvasDropPoint {
    x: number;
    y: number;
}

export interface CanvasInsertIndicator {
    left: number;
    top: number;
    width: number;
}

export interface CompositeCardInsertDropTarget {
    type: 'composite-card-insert';
    cardId: string;
    insertionIndex: number;
    indicator: CanvasInsertIndicator;
}

export interface BoxEntryImportDropTarget {
    type: 'box-entry-import';
    boxId: string;
}

export type CanvasDropTarget = CompositeCardInsertDropTarget | BoxEntryImportDropTarget;

export interface ResolveCompositeCardDropTargetOptions {
    dragData: DragData | null;
    eventTarget: EventTarget | null;
    screenPosition: CanvasDropPoint;
    openCards: Map<string, CompositeCard>;
}

export interface ResolveBoxEntryImportDropTargetOptions {
    dragData: DragData | null;
    eventTarget: EventTarget | null;
    screenPosition: CanvasDropPoint;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}

function resolveCompositePadding(card: CompositeCard | undefined): number {
    return typeof card?.structure.layout?.padding === 'number'
        ? card.structure.layout.padding
        : DEFAULT_COMPOSITE_PADDING_PX;
}

function asElement(target: EventTarget | null): Element | null {
    return target instanceof Element ? target : null;
}

function resolvePreviewSurface(
    eventTarget: EventTarget | null,
    screenPosition: CanvasDropPoint,
): HTMLElement | null {
    const directTarget = asElement(eventTarget)?.closest<HTMLElement>(COMPOSITE_DROP_SURFACE_SELECTOR);
    if (directTarget) {
        return directTarget;
    }

    if (typeof document.elementFromPoint !== 'function') {
        return null;
    }

    return document
        .elementFromPoint(screenPosition.x, screenPosition.y)
        ?.closest<HTMLElement>(COMPOSITE_DROP_SURFACE_SELECTOR) ?? null;
}

function resolveBoxPreviewSurface(
    eventTarget: EventTarget | null,
    screenPosition: CanvasDropPoint,
): HTMLElement | null {
    const directTarget = asElement(eventTarget)?.closest<HTMLElement>(BOX_DROP_SURFACE_SELECTOR);
    if (directTarget) {
        return directTarget;
    }

    if (typeof document.elementFromPoint !== 'function') {
        return null;
    }

    return document
        .elementFromPoint(screenPosition.x, screenPosition.y)
        ?.closest<HTMLElement>(BOX_DROP_SURFACE_SELECTOR) ?? null;
}

function getBaseCardNodes(previewSurface: HTMLElement): HTMLElement[] {
    return Array.from(previewSurface.querySelectorAll<HTMLElement>(BASECARD_NODE_SELECTOR))
        .filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
}

function buildInsertIndicator(options: {
    previewRect: DOMRect;
    insertionIndex: number;
    baseCardNodes: HTMLElement[];
    padding: number;
}): CanvasInsertIndicator {
    const { previewRect, insertionIndex, baseCardNodes, padding } = options;
    const indicatorWidth = Math.max(
        MIN_INDICATOR_WIDTH_PX,
        previewRect.width - padding * 2,
    );
    const indicatorLeft = previewRect.left + (previewRect.width - indicatorWidth) / 2;

    if (baseCardNodes.length === 0) {
        return {
            left: indicatorLeft,
            top: previewRect.top + previewRect.height / 2,
            width: indicatorWidth,
        };
    }

    const firstRect = baseCardNodes[0]?.getBoundingClientRect();
    const lastRect = baseCardNodes[baseCardNodes.length - 1]?.getBoundingClientRect();

    let indicatorTop = previewRect.top + previewRect.height / 2;

    if (insertionIndex <= 0 && firstRect) {
        indicatorTop = previewRect.top + (firstRect.top - previewRect.top) / 2;
    } else if (insertionIndex >= baseCardNodes.length && lastRect) {
        indicatorTop = lastRect.bottom + (previewRect.bottom - lastRect.bottom) / 2;
    } else {
        const previousRect = baseCardNodes[insertionIndex - 1]?.getBoundingClientRect();
        const nextRect = baseCardNodes[insertionIndex]?.getBoundingClientRect();
        if (previousRect && nextRect) {
            indicatorTop = previousRect.bottom + (nextRect.top - previousRect.bottom) / 2;
        }
    }

    return {
        left: indicatorLeft,
        top: clamp(indicatorTop, previewRect.top, previewRect.bottom),
        width: indicatorWidth,
    };
}

export function resolveCompositeCardDropTarget({
    dragData,
    eventTarget,
    screenPosition,
    openCards,
}: ResolveCompositeCardDropTargetOptions): CanvasDropTarget | null {
    if (!dragData || dragData.type !== 'card') {
        return null;
    }

    const previewSurface = resolvePreviewSurface(eventTarget, screenPosition);
    const cardId = previewSurface?.dataset.chipsCardId;
    if (!previewSurface || !cardId) {
        return null;
    }

    if (previewSurface.dataset.chipsDropAccept !== 'true') {
        return null;
    }

    const targetCard = openCards.get(cardId);
    const previewRect = previewSurface.getBoundingClientRect();
    if (previewRect.width <= 0 || previewRect.height <= 0) {
        return null;
    }

    const baseCardNodes = getBaseCardNodes(previewSurface);
    const clampedPointerY = clamp(
        screenPosition.y,
        previewRect.top,
        previewRect.bottom,
    );

    const insertionIndex = (() => {
        if (baseCardNodes.length === 0) {
            return 0;
        }

        const targetNodeIndex = baseCardNodes.findIndex((node) => {
            const rect = node.getBoundingClientRect();
            const nodeMidpoint = rect.top + rect.height / 2;
            return clampedPointerY < nodeMidpoint;
        });

        return targetNodeIndex === -1 ? baseCardNodes.length : targetNodeIndex;
    })();

    const indicator = buildInsertIndicator({
        previewRect,
        insertionIndex,
        baseCardNodes,
        padding: resolveCompositePadding(targetCard),
    });

    return {
        type: 'composite-card-insert',
        cardId,
        insertionIndex,
        indicator,
    };
}

export function resolveBoxEntryImportDropTarget({
    dragData,
    eventTarget,
    screenPosition,
}: ResolveBoxEntryImportDropTargetOptions): CanvasDropTarget | null {
    if (!dragData || dragData.type !== 'workspace-file') {
        return null;
    }

    if (dragData.fileType !== 'card' && dragData.fileType !== 'box') {
        return null;
    }

    const previewSurface = resolveBoxPreviewSurface(eventTarget, screenPosition);
    const boxId = previewSurface?.dataset.chipsBoxId;
    if (!previewSurface || !boxId) {
        return null;
    }

    if (previewSurface.dataset.chipsDropAccept !== 'true') {
        return null;
    }

    return {
        type: 'box-entry-import',
        boxId,
    };
}
