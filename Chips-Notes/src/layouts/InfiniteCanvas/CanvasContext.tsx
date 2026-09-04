import React, { createContext, useContext, ReactNode } from 'react';
import type { Point, ContentBounds } from './use-canvas';

export interface CanvasContextType {
    zoom: number;
    panX: number;
    panY: number;
    panByInput: (deltaX: number, deltaY: number) => void;
    panByScreenDelta: (deltaX: number, deltaY: number) => void;
    zoomByFactorAtPoint: (factor: number, screenX: number, screenY: number) => void;
    markInteractionSequence: (options?: { suppressDesktopZoom?: boolean }) => void;
    clearInteractionSequence: () => void;
    isDesktopZoomSuppressed: () => boolean;
    zoomIn: () => void;
    zoomOut: () => void;
    zoomTo: (value: number) => void;
    resetView: () => void;
    fitToContent: (bounds?: ContentBounds) => void;
    screenToWorld: (screenX: number, screenY: number) => Point;
    worldToScreen: (worldX: number, worldY: number) => Point;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export function CanvasProvider({ value, children }: { value: CanvasContextType; children: ReactNode }) {
    return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}

export function useCanvas() {
    const context = useContext(CanvasContext);
    if (context === undefined) {
        throw new Error('useCanvas must be used within CanvasProvider');
    }
    return context;
}
