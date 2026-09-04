import { useState, useCallback, useMemo, useRef, useEffect, type RefObject } from 'react';

export interface CanvasControlsOptions {
    minZoom?: number;
    maxZoom?: number;
    zoomStep?: number;
    smoothZoom?: boolean;
    viewportRef?: RefObject<HTMLElement | null>;
}

export interface ContentBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Point {
    x: number;
    y: number;
}

const WHEEL_INTERRUPT_EMPTY_FRAMES = 12;

const clampNumber = (value: number, min: number, max: number) => {
    return Math.max(min, Math.min(max, value));
};

const getViewportOffset = (viewportRef?: RefObject<HTMLElement | null>) => {
    const rect = viewportRef?.current?.getBoundingClientRect();
    return {
        left: rect?.left ?? 0,
        top: rect?.top ?? 0,
    };
};

const resolveWheelZoomDelta = (event: WheelEvent) => {
    const sensitivity = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 0.06
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? 0.14
            : 0.0025;

    return clampNumber(Number(event.deltaY) * -sensitivity, -0.45, 0.45);
};

export function useCanvasControls(options: CanvasControlsOptions = {}) {
    const {
        minZoom = 0.1,
        maxZoom = 5,
        zoomStep = 0.1,
        smoothZoom = true,
        viewportRef,
    } = options;

    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [isPanning, setIsPanning] = useState(false);

    // Use refs to keep the latest state values accessible in the native wheel handler
    // without re-registering the event listener every time (which would be expensive).
    const zoomRef = useRef(zoom);
    const panXRef = useRef(panX);
    const panYRef = useRef(panY);
    zoomRef.current = zoom;
    panXRef.current = panX;
    panYRef.current = panY;

    const interactionSequenceActiveRef = useRef(false);
    const interactionSequenceFrameRef = useRef<number | null>(null);
    const interactionSeenInFrameRef = useRef(false);
    const emptyInteractionFramesRef = useRef(0);
    const desktopZoomSuppressedRef = useRef(false);

    const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
    const [panOrigin, setPanOrigin] = useState<Point>({ x: 0, y: 0 });

    const zoomPercent = useMemo(() => Math.round(zoom * 100), [zoom]);

    const clampZoom = useCallback((value: number) => {
        return clampNumber(value, minZoom, maxZoom);
    }, [maxZoom, minZoom]);

    const toViewportPoint = useCallback((screenX: number, screenY: number): Point => {
        const offset = getViewportOffset(viewportRef);
        return {
            x: screenX - offset.left,
            y: screenY - offset.top,
        };
    }, [viewportRef]);

    const applyAnchoredZoom = useCallback((nextZoom: number, viewportX: number, viewportY: number) => {
        const currentZoom = zoomRef.current;
        const currentPanX = panXRef.current;
        const currentPanY = panYRef.current;
        const clampedZoom = clampZoom(nextZoom);

        if (!Number.isFinite(clampedZoom) || clampedZoom <= 0 || clampedZoom === currentZoom) {
            return;
        }

        const worldX = (viewportX - currentPanX) / currentZoom;
        const worldY = (viewportY - currentPanY) / currentZoom;

        setZoom(clampedZoom);
        setPanX(viewportX - worldX * clampedZoom);
        setPanY(viewportY - worldY * clampedZoom);
    }, [clampZoom]);

    const clearInteractionSequence = useCallback(() => {
        interactionSequenceActiveRef.current = false;
        interactionSeenInFrameRef.current = false;
        emptyInteractionFramesRef.current = 0;
        desktopZoomSuppressedRef.current = false;

        if (interactionSequenceFrameRef.current !== null) {
            globalThis.cancelAnimationFrame(interactionSequenceFrameRef.current);
            interactionSequenceFrameRef.current = null;
        }
    }, []);

    const startInteractionSequenceMonitor = useCallback(() => {
        const tick = () => {
            if (!interactionSequenceActiveRef.current) {
                interactionSequenceFrameRef.current = null;
                return;
            }

            if (interactionSeenInFrameRef.current) {
                interactionSeenInFrameRef.current = false;
                emptyInteractionFramesRef.current = 0;
                interactionSequenceFrameRef.current = globalThis.requestAnimationFrame(tick);
                return;
            }

            emptyInteractionFramesRef.current += 1;
            if (emptyInteractionFramesRef.current < WHEEL_INTERRUPT_EMPTY_FRAMES) {
                interactionSequenceFrameRef.current = globalThis.requestAnimationFrame(tick);
                return;
            }

            clearInteractionSequence();
        };

        interactionSequenceFrameRef.current = globalThis.requestAnimationFrame(tick);
    }, [clearInteractionSequence]);

    const markInteractionSequence = useCallback((options: { suppressDesktopZoom?: boolean } = {}) => {
        interactionSeenInFrameRef.current = true;

        if (options.suppressDesktopZoom) {
            desktopZoomSuppressedRef.current = true;
        }

        if (interactionSequenceActiveRef.current) {
            return;
        }

        interactionSequenceActiveRef.current = true;
        emptyInteractionFramesRef.current = 0;
        startInteractionSequenceMonitor();
    }, [startInteractionSequenceMonitor]);

    useEffect(() => {
        return () => {
            clearInteractionSequence();
        };
    }, [clearInteractionSequence]);

    const panByInput = useCallback((deltaX: number, deltaY: number) => {
        if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
            return;
        }

        const zoomFactor = zoomRef.current || 1;
        if (deltaX !== 0) {
            setPanX((current) => current - deltaX / zoomFactor);
        }
        if (deltaY !== 0) {
            setPanY((current) => current - deltaY / zoomFactor);
        }
    }, []);

    const panByScreenDelta = useCallback((deltaX: number, deltaY: number) => {
        if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) || (deltaX === 0 && deltaY === 0)) {
            return;
        }

        setPanX((current) => current + deltaX);
        setPanY((current) => current + deltaY);
    }, []);

    const zoomByFactorAtPoint = useCallback((factor: number, screenX: number, screenY: number) => {
        if (!Number.isFinite(factor) || factor <= 0) {
            return;
        }

        const currentZoom = zoomRef.current;
        const viewportPoint = toViewportPoint(screenX, screenY);
        applyAnchoredZoom(currentZoom * factor, viewportPoint.x, viewportPoint.y);
    }, [applyAnchoredZoom, toViewportPoint]);

    /**
     * Returns a native wheel event handler (not a React synthetic one).
     * Must be registered with addEventListener(el, 'wheel', handler, { passive: false })
     * to allow e.preventDefault() — React's synthetic onWheel is passive in React 17+
     * and calling preventDefault() inside it throws a warning that is suppressed but
     * the default scroll behavior is NOT actually prevented.
     */
    const buildNativeWheelHandler = useCallback((el: HTMLElement) => {
        return (e: WheelEvent) => {
            e.preventDefault();

            if (!smoothZoom) {
                const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
                setZoom((current) => clampZoom(current + delta));
                return;
            }

            const zoomDelta = resolveWheelZoomDelta(e);
            if (zoomDelta === 0) {
                return;
            }

            const rect = el.getBoundingClientRect();
            const viewportX = e.clientX - rect.left;
            const viewportY = e.clientY - rect.top;
            applyAnchoredZoom(zoomRef.current * (1 + zoomDelta), viewportX, viewportY);
        };
    }, [applyAnchoredZoom, clampZoom, smoothZoom, zoomStep]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.target === e.currentTarget)) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
            setPanOrigin({ x: panX, y: panY });
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
        }
    }, [panX, panY]);

    const handleMouseMove = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (!isPanning) return;
        const deltaX = e.clientX - panStart.x;
        const deltaY = e.clientY - panStart.y;
        setPanX(panOrigin.x + deltaX);
        setPanY(panOrigin.y + deltaY);
    }, [isPanning, panStart, panOrigin]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    const zoomIn = useCallback(() => setZoom((current) => clampZoom(current + zoomStep)), [clampZoom, zoomStep]);
    const zoomOut = useCallback(() => setZoom((current) => clampZoom(current - zoomStep)), [clampZoom, zoomStep]);
    const zoomTo = useCallback((value: number) => setZoom(clampZoom(value)), [clampZoom]);

    const screenToWorld = useCallback((screenX: number, screenY: number): Point => {
        const viewportPoint = toViewportPoint(screenX, screenY);
        return {
            x: (viewportPoint.x - panX) / zoom,
            y: (viewportPoint.y - panY) / zoom,
        };
    }, [panX, panY, toViewportPoint, zoom]);

    const worldToScreen = useCallback((worldX: number, worldY: number): Point => {
        const offset = getViewportOffset(viewportRef);
        return {
            x: worldX * zoom + panX + offset.left,
            y: worldY * zoom + panY + offset.top,
        };
    }, [panX, panY, viewportRef, zoom]);

    const resetView = useCallback(() => {
        setZoom(1);
        setPanX(0);
        setPanY(0);
    }, []);

    const fitToContent = useCallback((bounds?: ContentBounds) => {
        if (!bounds) {
            resetView();
            return;
        }
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 80;

        const scaleX = (viewportWidth - padding * 2) / bounds.width;
        const scaleY = (viewportHeight - padding * 2) / bounds.height;
        let newZoom = Math.min(scaleX, scaleY);
        const maxFitZoom = Math.min(1, maxZoom);
        newZoom = Math.max(0.25, Math.min(maxFitZoom, newZoom));

        setZoom(newZoom);

        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;

        setPanX(viewportWidth / 2 - centerX * newZoom);
        setPanY(viewportHeight / 2 - centerY * newZoom);
    }, [maxZoom, resetView]);

    return {
        zoom,
        panX,
        panY,
        isPanning,
        zoomPercent,
        buildNativeWheelHandler,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        panByInput,
        panByScreenDelta,
        zoomByFactorAtPoint,
        markInteractionSequence,
        clearInteractionSequence,
        isDesktopZoomSuppressed: () => desktopZoomSuppressedRef.current,
        zoomIn,
        zoomOut,
        zoomTo,
        resetView,
        fitToContent,
        screenToWorld,
        worldToScreen,
    };
}
