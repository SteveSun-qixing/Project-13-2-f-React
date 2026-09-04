import React, { useRef, useEffect, ReactNode, useState } from 'react';
import { useCanvasControls } from './use-canvas';
import { CanvasProvider } from './CanvasContext';
import { DesktopLayer } from './DesktopLayer';
import { WindowLayer } from './WindowLayer';
import { ZoomControl } from './ZoomControl';
import { resolveCanvasInteractionSurface } from './interaction-routing';
import {
    type CanvasDropPoint,
    type CanvasDropTarget,
} from './canvas-drop-target';
import {
    CHIPS_DRAG_DATA_TYPE,
    type DragData,
} from '../../components/CardBoxLibrary/types';
import './InfiniteCanvas.css';

interface InfiniteCanvasProps {
    showGrid?: boolean;
    gridSize?: number;
    desktopContent?: ReactNode;
    windowContent?: ReactNode;
    onDropCreate?: (
        data: DragData,
        worldPosition: { x: number; y: number },
        target?: CanvasDropTarget | null,
    ) => void;
    resolveDropTarget?: (options: {
        dragData: DragData | null;
        eventTarget: EventTarget | null;
        screenPosition: CanvasDropPoint;
        worldPosition: { x: number; y: number };
    }) => CanvasDropTarget | null;
    onOpenSettings?: () => void;
}

interface TouchGestureState {
    surface: 'desktop-background' | 'composite-delegate';
    lastPoint: { x: number; y: number } | null;
    lastCenter: { x: number; y: number } | null;
    lastDistance: number | null;
}

const getTouchPoint = (touch: Touch) => ({
    x: Number(touch.clientX) || 0,
    y: Number(touch.clientY) || 0,
});

const getTouchCenter = (first: Touch, second: Touch) => ({
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
});

const getTouchDistance = (first: Touch, second: Touch) => {
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
};

function parseDragData(dataTransfer: DataTransfer | null): DragData | null {
    if (!dataTransfer) {
        return parseGlobalLibraryDragData();
    }

    try {
        const raw = dataTransfer.getData(CHIPS_DRAG_DATA_TYPE);
        if (!raw) {
            return parseGlobalLibraryDragData();
        }

        return JSON.parse(raw) as DragData;
    } catch (error) {
        console.warn('Failed to parse drop drag data', error);
        return parseGlobalLibraryDragData();
    }
}

function parseGlobalLibraryDragData(): DragData | null {
    const body = document.body;
    if (!body || body.dataset.chipsLibraryDragging !== 'true') {
        return null;
    }

    const rawPayload = body.dataset.chipsLibraryDragPayload;
    if (!rawPayload) {
        return null;
    }

    try {
        return JSON.parse(rawPayload) as DragData;
    } catch (error) {
        console.warn('Failed to parse global library drag data', error);
        return null;
    }
}

export function InfiniteCanvas({
    showGrid = true,
    gridSize = 20,
    desktopContent,
    windowContent,
    onDropCreate,
    resolveDropTarget,
    onOpenSettings,
}: InfiniteCanvasProps) {
    const canvasRef = useRef<HTMLDivElement>(null);
    const touchGestureRef = useRef<TouchGestureState | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [insertIndicator, setInsertIndicator] = useState<{ left: number; top: number; width: number } | null>(null);

    const canvasControls = useCanvasControls({ viewportRef: canvasRef });
    const {
        zoom,
        panX,
        panY,
        isPanning,
        buildNativeWheelHandler,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        panByInput,
        panByScreenDelta,
        zoomByFactorAtPoint,
        markInteractionSequence,
        clearInteractionSequence,
        isDesktopZoomSuppressed,
        zoomIn,
        zoomOut,
        zoomTo,
        resetView,
        fitToContent,
        screenToWorld,
    } = canvasControls;
    void onOpenSettings;

    const resolveDragTarget = (event: React.DragEvent) => {
        const dragData = parseDragData(event.dataTransfer);
        const screenPosition = {
            x: event.clientX,
            y: event.clientY,
        };
        const worldPosition = screenToWorld(screenPosition.x, screenPosition.y);
        const target = resolveDropTarget?.({
            dragData,
            eventTarget: event.target,
            screenPosition,
            worldPosition,
        }) ?? null;

        return {
            dragData,
            target,
            worldPosition,
        };
    };

    // Register the wheel handler as a native (non-passive) event listener.
    // React 17+ makes synthetic onWheel passive, so e.preventDefault() would be
    // silently ignored. By using addEventListener with { passive: false } we can
    // actually prevent the page from scrolling while zooming the canvas.
    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;

        const handler = buildNativeWheelHandler(el);

        const onWheel = (e: WheelEvent) => {
            const surface = resolveCanvasInteractionSurface(e.target, el);

            if (surface === 'local-window' || surface === 'ignore') {
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                if (surface === 'desktop-background' && isDesktopZoomSuppressed()) {
                    e.preventDefault();
                    return;
                }

                if (surface === 'composite-delegate') {
                    markInteractionSequence({ suppressDesktopZoom: true });
                }

                handler(e);
                return;
            }

            if (surface === 'desktop-background') {
                if (isDesktopZoomSuppressed()) {
                    e.preventDefault();
                    return;
                }

                handler(e);
                return;
            }

            if (surface === 'composite-delegate') {
                markInteractionSequence({ suppressDesktopZoom: true });
                panByInput(e.deltaX, e.deltaY);
                e.preventDefault();
                return;
            }
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', onWheel);
        };
    }, [
        buildNativeWheelHandler,
        isDesktopZoomSuppressed,
        markInteractionSequence,
        panByInput,
    ]);

    useEffect(() => {
        const el = canvasRef.current;
        if (!el) {
            return;
        }

        const onTouchStart = (event: TouchEvent) => {
            const surface = resolveCanvasInteractionSurface(event.target, el);
            if (surface !== 'desktop-background' && surface !== 'composite-delegate') {
                touchGestureRef.current = null;
                return;
            }

            if (surface === 'composite-delegate') {
                markInteractionSequence({ suppressDesktopZoom: true });
            }

            if (event.touches.length === 1) {
                touchGestureRef.current = {
                    surface,
                    lastPoint: getTouchPoint(event.touches[0] as Touch),
                    lastCenter: null,
                    lastDistance: null,
                };
                return;
            }

            if (event.touches.length >= 2) {
                const first = event.touches[0] as Touch;
                const second = event.touches[1] as Touch;
                touchGestureRef.current = {
                    surface,
                    lastPoint: null,
                    lastCenter: getTouchCenter(first, second),
                    lastDistance: getTouchDistance(first, second),
                };
            }
        };

        const onTouchMove = (event: TouchEvent) => {
            const gesture = touchGestureRef.current;
            if (!gesture) {
                return;
            }

            if (gesture.surface === 'composite-delegate') {
                markInteractionSequence({ suppressDesktopZoom: true });
            }

            if (event.touches.length === 1) {
                const nextPoint = getTouchPoint(event.touches[0] as Touch);
                if (gesture.lastPoint) {
                    panByScreenDelta(
                        nextPoint.x - gesture.lastPoint.x,
                        nextPoint.y - gesture.lastPoint.y,
                    );
                }

                gesture.lastPoint = nextPoint;
                gesture.lastCenter = null;
                gesture.lastDistance = null;
                event.preventDefault();
                return;
            }

            if (event.touches.length >= 2) {
                const first = event.touches[0] as Touch;
                const second = event.touches[1] as Touch;
                const center = getTouchCenter(first, second);
                const distance = getTouchDistance(first, second);

                if (gesture.lastCenter && gesture.lastDistance && gesture.lastDistance > 0) {
                    const zoomFactor = Math.max(0.67, Math.min(1.5, distance / gesture.lastDistance));
                    if (Math.abs(zoomFactor - 1) > 0.015) {
                        zoomByFactorAtPoint(zoomFactor, center.x, center.y);
                    } else {
                        panByScreenDelta(
                            center.x - gesture.lastCenter.x,
                            center.y - gesture.lastCenter.y,
                        );
                    }
                }

                gesture.lastPoint = null;
                gesture.lastCenter = center;
                gesture.lastDistance = distance;
                event.preventDefault();
            }
        };

        const onTouchEnd = (event: TouchEvent) => {
            const gesture = touchGestureRef.current;
            if (!gesture) {
                return;
            }

            if (event.touches.length === 0) {
                if (gesture.surface === 'composite-delegate') {
                    clearInteractionSequence();
                }
                touchGestureRef.current = null;
                return;
            }

            if (event.touches.length === 1) {
                gesture.lastPoint = getTouchPoint(event.touches[0] as Touch);
                gesture.lastCenter = null;
                gesture.lastDistance = null;
                return;
            }

            if (event.touches.length >= 2) {
                const first = event.touches[0] as Touch;
                const second = event.touches[1] as Touch;
                gesture.lastPoint = null;
                gesture.lastCenter = getTouchCenter(first, second);
                gesture.lastDistance = getTouchDistance(first, second);
            }
        };

        const onTouchCancel = () => {
            if (touchGestureRef.current?.surface === 'composite-delegate') {
                clearInteractionSequence();
            }
            touchGestureRef.current = null;
        };

        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: false });
        el.addEventListener('touchcancel', onTouchCancel, { passive: false });

        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('touchcancel', onTouchCancel);
        };
    }, [
        clearInteractionSequence,
        markInteractionSequence,
        panByScreenDelta,
        zoomByFactorAtPoint,
    ]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                resetView();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                zoomIn();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                zoomOut();
            }
        };

        const clearDragVisualState = () => {
            setIsDragOver(false);
            setInsertIndicator(null);
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('dragend', clearDragVisualState);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('dragend', clearDragVisualState);
        };
    }, [resetView, zoomIn, zoomOut]);

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';

        const { target } = resolveDragTarget(e);
        setInsertIndicator(target?.type === 'composite-card-insert' ? target.indicator : null);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            if (
                e.clientX <= rect.left ||
                e.clientX >= rect.right ||
                e.clientY <= rect.top ||
                e.clientY >= rect.bottom
            ) {
                setIsDragOver(false);
                setInsertIndicator(null);
            }
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const { dragData, target, worldPosition } = resolveDragTarget(e);
        setIsDragOver(false);
        setInsertIndicator(null);

        if (onDropCreate && dragData) {
            onDropCreate(dragData, worldPosition, target);
        }
    };

    const desktopStyle = {
        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
        transformOrigin: '0 0',
    };

    const gridStyle = {
        backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
        backgroundPosition: `${panX % (gridSize * zoom)}px ${panY % (gridSize * zoom)}px`,
    };

    const canvasCursor = isPanning ? 'grabbing' : 'grab';

    const indicatorStyle = (() => {
        if (!insertIndicator || !canvasRef.current) {
            return undefined;
        }

        const canvasRect = canvasRef.current.getBoundingClientRect();
        return {
            left: `${insertIndicator.left - canvasRect.left}px`,
            top: `${insertIndicator.top - canvasRect.top}px`,
            width: `${insertIndicator.width}px`,
        } as React.CSSProperties;
    })();

    return (
        <CanvasProvider value={canvasControls}>
            <div
                ref={canvasRef}
                className={`infinite-canvas ${isDragOver ? 'infinite-canvas--drag-over' : ''}`}
                style={{ cursor: canvasCursor }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {showGrid && (
                    <div className="infinite-canvas__grid" style={gridStyle} />
                )}

                <DesktopLayer style={desktopStyle}>
                    {desktopContent}
                </DesktopLayer>

                <WindowLayer>
                    {windowContent}
                </WindowLayer>

                {indicatorStyle && (
                    <div
                        className="infinite-canvas__insert-indicator"
                        style={indicatorStyle}
                    />
                )}

                <ZoomControl
                    zoom={zoom}
                    onZoomIn={zoomIn}
                    onZoomOut={zoomOut}
                    onZoomTo={zoomTo}
                    onReset={resetView}
                    onFit={fitToContent}
                />
            </div>
        </CanvasProvider>
    );
}
