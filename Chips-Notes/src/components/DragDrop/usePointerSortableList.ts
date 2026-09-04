import { useCallback, useEffect, useRef, useState } from 'react';

interface PointerSortableItem {
  id: string;
  label: string;
}

interface PointerSortableListOptions {
  items: PointerSortableItem[];
  onSort: (itemId: string, targetIndex: number) => void;
}

interface PointerDragSession {
  itemId: string;
  originIndex: number;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
  started: boolean;
}

export interface PointerSortableOverlayState {
  label: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export function usePointerSortableList({
  items,
  onSort,
}: PointerSortableListOptions) {
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<PointerSortableOverlayState | null>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const dragSessionRef = useRef<PointerDragSession | null>(null);
  const draggingItemIdRef = useRef<string | null>(null);
  const previewIndexRef = useRef<number | null>(null);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const onSortRef = useRef(onSort);
  useEffect(() => {
    onSortRef.current = onSort;
  });

  const setItemRef = useCallback((itemId: string, node: HTMLElement | null) => {
    if (node) {
      itemRefs.current.set(itemId, node);
      return;
    }
    itemRefs.current.delete(itemId);
  }, []);

  const getPreviewIndexFromPointer = useCallback((clientY: number) => {
    const draggingId = draggingItemIdRef.current ?? dragSessionRef.current?.itemId ?? null;
    if (!draggingId) {
      return null;
    }

    const visibleItems = itemsRef.current.filter((item) => item.id !== draggingId);
    if (visibleItems.length === 0) {
      return 0;
    }

    for (let index = 0; index < visibleItems.length; index += 1) {
      const item = visibleItems[index];
      if (!item) {
        continue;
      }

      const node = itemRefs.current.get(item.id);
      if (!node) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (clientY < midpoint) {
        return index;
      }
    }

    return visibleItems.length;
  }, []);

  const updateOverlayPosition = useCallback((clientX: number, clientY: number) => {
    const session = dragSessionRef.current;
    if (!session) {
      return;
    }

    const item = itemsRef.current.find((candidate) => candidate.id === session.itemId);
    if (!item) {
      return;
    }

    setOverlay({
      label: item.label,
      width: session.width,
      height: session.height,
      x: clientX - session.offsetX,
      y: clientY - session.offsetY,
    });
  }, []);

  const finishDrag = useCallback((clientY: number) => {
    const session = dragSessionRef.current;
    const nextIndex = previewIndexRef.current ?? getPreviewIndexFromPointer(clientY);

    dragSessionRef.current = null;
    draggingItemIdRef.current = null;
    previewIndexRef.current = null;
    setDraggingItemId(null);
    setPreviewIndex(null);
    setOverlay(null);

    if (!session || !session.started || nextIndex === null) {
      return;
    }

    if (nextIndex !== session.originIndex) {
      onSortRef.current(session.itemId, nextIndex);
    }
  }, [getPreviewIndexFromPointer]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const session = dragSessionRef.current;
    if (!session) {
      return;
    }

    const deltaX = event.clientX - session.startX;
    const deltaY = event.clientY - session.startY;

    if (!session.started) {
      if (Math.hypot(deltaX, deltaY) < 6) {
        return;
      }

      session.started = true;
      draggingItemIdRef.current = session.itemId;
      previewIndexRef.current = session.originIndex;
      setDraggingItemId(session.itemId);
      setPreviewIndex(session.originIndex);
    }

    event.preventDefault();
    updateOverlayPosition(event.clientX, event.clientY);

    const nextIndex = getPreviewIndexFromPointer(event.clientY);
    if (nextIndex !== null && nextIndex !== previewIndexRef.current) {
      previewIndexRef.current = nextIndex;
      setPreviewIndex(nextIndex);
    }
  }, [getPreviewIndexFromPointer, updateOverlayPosition]);

  const handlePointerUp = useCallback((event: PointerEvent) => {
    finishDrag(event.clientY);
  }, [finishDrag]);

  const handlePointerCancel = useCallback(() => {
    finishDrag(-1);
  }, [finishDrag]);

  const startDrag = useCallback((itemId: string, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || event.pointerType === 'touch') {
      return;
    }

    const itemNode = itemRefs.current.get(itemId);
    const originIndex = itemsRef.current.findIndex((item) => item.id === itemId);
    if (!itemNode || originIndex === -1) {
      return;
    }

    const rect = itemNode.getBoundingClientRect();
    dragSessionRef.current = {
      itemId,
      originIndex,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
      height: rect.height,
      started: false,
    };

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
  }, [handlePointerCancel, handlePointerMove, handlePointerUp]);

  const removeGlobalListeners = useCallback(() => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerCancel);
  }, [handlePointerCancel, handlePointerMove, handlePointerUp]);

  useEffect(() => () => {
    removeGlobalListeners();
  }, [removeGlobalListeners]);

  return {
    draggingItemId,
    overlay,
    previewIndex,
    setItemRef,
    startDrag,
  };
}
