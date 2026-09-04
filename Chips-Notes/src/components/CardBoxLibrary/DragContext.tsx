import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { CHIPS_DRAG_DATA_TYPE, type DragData, type DragState } from './types';

interface DragContextType {
    dragState: DragState;
    startDrag: (data: DragData, event: React.DragEvent) => void;
    updatePreview: (x: number, y: number) => void;
    endDrag: () => void;
}

const DragContext = createContext<DragContextType | undefined>(undefined);

let transparentDragImage: HTMLImageElement | null = null;

function getTransparentDragImage(): HTMLImageElement {
    if (!transparentDragImage) {
        transparentDragImage = new Image(1, 1);
        transparentDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }
    return transparentDragImage;
}

export function DragProvider({ children }: { children: React.ReactNode }) {
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        data: null,
        previewPosition: null,
    });

    const dragStateRef = useRef(dragState);
    dragStateRef.current = dragState;

    const startDrag = (data: DragData, event: React.DragEvent) => {
        const initialPosition = {
            x: event.clientX,
            y: event.clientY,
        };

        setDragState({
            isDragging: true,
            data,
            previewPosition: initialPosition,
        });

        if (event.dataTransfer) {
            event.dataTransfer.setData(CHIPS_DRAG_DATA_TYPE, JSON.stringify(data));
            event.dataTransfer.setData('text/plain', data.name);
            event.dataTransfer.effectAllowed = 'copy';

            const img = getTransparentDragImage();
            event.dataTransfer.setDragImage(img, 0, 0);
        }
    };

    const updatePreview = (x: number, y: number) => {
        if (dragStateRef.current.isDragging) {
            setDragState(prev => ({ ...prev, previewPosition: { x, y } }));
        }
    };

    const endDrag = () => {
        setDragState({
            isDragging: false,
            data: null,
            previewPosition: null,
        });
    };

    useEffect(() => {
        const body = document.body;
        if (!body) {
            return;
        }

        if (dragState.isDragging && dragState.data) {
            body.dataset.chipsLibraryDragging = 'true';
            body.dataset.chipsLibraryDragType = dragState.data.type;
            body.dataset.chipsLibraryDragPayload = JSON.stringify(dragState.data);
        } else {
            delete body.dataset.chipsLibraryDragging;
            delete body.dataset.chipsLibraryDragType;
            delete body.dataset.chipsLibraryDragPayload;
        }

        return () => {
            delete body.dataset.chipsLibraryDragging;
            delete body.dataset.chipsLibraryDragType;
            delete body.dataset.chipsLibraryDragPayload;
        };
    }, [dragState.data, dragState.isDragging]);

    useEffect(() => {
        const handleDrag = (e: DragEvent) => {
            if (dragStateRef.current.isDragging && e.clientX !== 0 && e.clientY !== 0) {
                updatePreview(e.clientX, e.clientY);
            }
        };

        const handleDragEnd = () => {
            endDrag();
        };

        document.addEventListener('drag', handleDrag);
        document.addEventListener('dragend', handleDragEnd);

        return () => {
            document.removeEventListener('drag', handleDrag);
            document.removeEventListener('dragend', handleDragEnd);
        };
    }, []);

    return (
        <DragContext.Provider value={{ dragState, startDrag, updatePreview, endDrag }}>
            {children}
        </DragContext.Provider>
    );
}

export function useDrag() {
    const context = useContext(DragContext);
    if (!context) {
        throw new Error('useDrag must be used within a DragProvider');
    }
    return context;
}
