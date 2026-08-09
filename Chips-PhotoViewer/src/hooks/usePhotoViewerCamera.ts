import { useEffect, useRef, useState, type MouseEvent, type MutableRefObject, type PointerEvent } from "react";
import {
  clampPan,
  clampScale,
  getFitScale,
  getNextZoomScale,
  getPointerDistance,
  getPointerMidpoint,
  getScaleFromWheelDelta,
  projectPanOffsetForScale,
  shouldHandleWheelZoom,
  type ImageDimensions,
  type InteractionPoint,
  type Rotation,
  type ViewportSize,
} from "../utils/image-viewer";

type ZoomMode = "fit" | "manual";

type WheelPanDirection = "prev" | "next";

interface DragPanState {
  pointerId: number;
  startX: number;
  startY: number;
  startPanX: number;
  startPanY: number;
}

interface PinchState {
  pointerIds: [number, number];
  startDistance: number;
  baseScale: number;
}

interface UsePhotoViewerCameraOptions {
  imageDimensions: ImageDimensions | null;
  isImageLoaded: boolean;
  sessionKey: string | null;
  onNavigateRequest?: (direction: WheelPanDirection) => void;
}

interface PhotoViewerCamera {
  viewportRef: MutableRefObject<HTMLDivElement | null>;
  zoomMode: ZoomMode;
  manualScale: number;
  effectiveScale: number;
  fitScale: number;
  imageWidth: number | undefined;
  imageHeight: number | undefined;
  panOffset: InteractionPoint;
  isPanningImage: boolean;
  isInteractive: boolean;
  isGesturing: boolean;
  transitionEnabled: boolean;
  rotation: Rotation;
  imageTransform: string | undefined;
  setFitMode: () => void;
  setActualSize: () => void;
  handleZoom: (direction: "in" | "out") => void;
  handleDoubleClick: (event: MouseEvent<HTMLDivElement>) => void;
  rotateClockwise: () => void;
  rotateCounterclockwise: () => void;
  handlePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  handlePointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
}

const DOUBLE_CLICK_ZOOM_SCALE = 2;
const DOUBLE_CLICK_FIT_THRESHOLD = 1.9;
const ELASTIC_OVERSHOOT_DAMPING = 0.5;
const WHEEL_GESTURE_SETTLE_MS = 150;
const HORIZONTAL_NAV_ACCUMULATE_THRESHOLD = 40;
const HORIZONTAL_NAV_TRIGGER_THRESHOLD = 80;

function normalizeWheelDelta(value: number, deltaMode: number): number {
  if (deltaMode === 1) {
    return value * 14;
  }

  if (deltaMode === 2) {
    return value * 160;
  }

  return value;
}

function getNextRotation(current: Rotation, direction: "clockwise" | "counterclockwise"): Rotation {
  if (direction === "clockwise") {
    switch (current) {
      case 0:
        return 90;
      case 90:
        return 180;
      case 180:
        return 270;
      default:
        return 0;
    }
  }

  switch (current) {
    case 0:
      return 270;
    case 90:
      return 0;
    case 180:
      return 90;
    default:
      return 180;
  }
}

export function usePhotoViewerCamera(options: UsePhotoViewerCameraOptions): PhotoViewerCamera {
  const { imageDimensions, isImageLoaded, sessionKey, onNavigateRequest } = options;
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit");
  const [manualScale, setManualScale] = useState(1);
  const [viewportSize, setViewportSize] = useState<ViewportSize | null>(null);
  const [panOffset, setPanOffset] = useState<InteractionPoint>({ x: 0, y: 0 });
  const [isPanningImage, setIsPanningImage] = useState(false);
  const [isGesturing, setIsGesturing] = useState(false);
  const [rotation, setRotation] = useState<Rotation>(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragPanRef = useRef<DragPanState | null>(null);
  const activeTouchPointsRef = useRef<Map<number, InteractionPoint>>(new Map());
  const pinchStateRef = useRef<PinchState | null>(null);
  const panUpdateFrameRef = useRef<number | null>(null);
  const pendingPanUpdateRef = useRef<(() => void) | null>(null);
  const wheelGestureTimerRef = useRef<number | null>(null);
  const horizontalNavAccumRef = useRef(0);
  const cameraRef = useRef<{ handleWheelEvent: (event: WheelEvent, element: HTMLDivElement) => void }>({
    handleWheelEvent: () => {},
  });

  const isSwappedRotation = rotation === 90 || rotation === 270;
  const fitScale = getFitScale(imageDimensions, viewportSize, rotation);
  const effectiveScale = zoomMode === "fit" ? fitScale : manualScale;
  const imageWidth = imageDimensions
    ? Math.max(1, Math.round((isSwappedRotation ? imageDimensions.height : imageDimensions.width) * effectiveScale))
    : undefined;
  const imageHeight = imageDimensions
    ? Math.max(1, Math.round((isSwappedRotation ? imageDimensions.width : imageDimensions.height) * effectiveScale))
    : undefined;
  const contentSize = imageWidth !== undefined && imageHeight !== undefined ? { width: imageWidth, height: imageHeight } : null;
  const isInteractive = Boolean(imageDimensions && isImageLoaded);

  let displayPan = panOffset;
  if (contentSize && viewportSize) {
    const clampedPan = clampPan(panOffset, viewportSize, contentSize);
    displayPan = isPanningImage
      ? {
          x: clampedPan.x + (panOffset.x - clampedPan.x) * ELASTIC_OVERSHOOT_DAMPING,
          y: clampedPan.y + (panOffset.y - clampedPan.y) * ELASTIC_OVERSHOOT_DAMPING,
        }
      : clampedPan;
  }
  const imageTransform = contentSize
    ? `translate(-50%, -50%) translate(${displayPan.x}px, ${displayPan.y}px) scale(${effectiveScale})${
        rotation === 0 ? "" : ` rotate(${rotation}deg)`
      }`
    : undefined;

  cameraRef.current = {
    handleWheelEvent: (event: WheelEvent, element: HTMLDivElement) => {
      handleWheelEvent(event, element);
    },
  };

  function clearGestureState(): void {
    dragPanRef.current = null;
    pinchStateRef.current = null;
    activeTouchPointsRef.current.clear();
    cancelPendingPanUpdate();
    cancelWheelGestureTimer();
    horizontalNavAccumRef.current = 0;
    setIsPanningImage(false);
    setIsGesturing(false);
  }

  function resetCamera(nextZoomMode: ZoomMode): void {
    clearGestureState();
    setPanOffset({ x: 0, y: 0 });
    setZoomMode(nextZoomMode);
  }

  function requestPanUpdate(update: () => void): void {
    pendingPanUpdateRef.current = update;
    if (panUpdateFrameRef.current !== null) {
      return;
    }

    panUpdateFrameRef.current = window.requestAnimationFrame(() => {
      panUpdateFrameRef.current = null;
      const pending = pendingPanUpdateRef.current;
      pendingPanUpdateRef.current = null;
      if (pending) {
        pending();
      }
    });
  }

  function flushPendingPanUpdate(): void {
    if (panUpdateFrameRef.current !== null) {
      window.cancelAnimationFrame(panUpdateFrameRef.current);
      panUpdateFrameRef.current = null;
    }

    const pending = pendingPanUpdateRef.current;
    pendingPanUpdateRef.current = null;
    if (pending) {
      pending();
    }
  }

  function cancelPendingPanUpdate(): void {
    if (panUpdateFrameRef.current !== null) {
      window.cancelAnimationFrame(panUpdateFrameRef.current);
      panUpdateFrameRef.current = null;
    }
    pendingPanUpdateRef.current = null;
  }

  function markWheelGestureActive(): void {
    setIsGesturing(true);
    if (wheelGestureTimerRef.current !== null) {
      window.clearTimeout(wheelGestureTimerRef.current);
    }

    wheelGestureTimerRef.current = window.setTimeout(() => {
      wheelGestureTimerRef.current = null;
      setIsGesturing(false);
    }, WHEEL_GESTURE_SETTLE_MS);
  }

  function cancelWheelGestureTimer(): void {
    if (wheelGestureTimerRef.current !== null) {
      window.clearTimeout(wheelGestureTimerRef.current);
      wheelGestureTimerRef.current = null;
    }
  }

  function applyAnchoredScale(nextScaleValue: number, anchorX: number, anchorY: number): void {
    const nextScale = clampScale(nextScaleValue);
    if (imageDimensions && viewportSize) {
      setPanOffset((currentPan) => ({
        x: projectPanOffsetForScale({
          viewportLength: viewportSize.width,
          pointerOffset: anchorX,
          naturalLength: imageDimensions.width,
          currentScale: effectiveScale,
          nextScale,
          currentPan: currentPan.x,
        }),
        y: projectPanOffsetForScale({
          viewportLength: viewportSize.height,
          pointerOffset: anchorY,
          naturalLength: imageDimensions.height,
          currentScale: effectiveScale,
          nextScale,
          currentPan: currentPan.y,
        }),
      }));
    }

    setZoomMode("manual");
    setManualScale(nextScale);
  }

  function setFitMode(): void {
    resetCamera("fit");
    setManualScale(1);
  }

  function setActualSize(): void {
    resetCamera("manual");
    setManualScale(1);
  }

  function handleZoom(direction: "in" | "out"): void {
    const baseScale = zoomMode === "fit" ? fitScale : manualScale;
    const nextScale = getNextZoomScale(baseScale, direction);

    if (!viewportSize) {
      setZoomMode("manual");
      setManualScale(nextScale);
      return;
    }

    applyAnchoredScale(nextScale, viewportSize.width / 2, viewportSize.height / 2);
  }

  function handleDoubleClick(event: MouseEvent<HTMLDivElement>): void {
    if (!imageDimensions || !isImageLoaded) {
      return;
    }

    if (event.altKey || effectiveScale >= DOUBLE_CLICK_FIT_THRESHOLD) {
      setFitMode();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    applyAnchoredScale(DOUBLE_CLICK_ZOOM_SCALE, event.clientX - rect.left, event.clientY - rect.top);
  }

  function rotateClockwise(): void {
    setRotation((current) => getNextRotation(current, "clockwise"));
  }

  function rotateCounterclockwise(): void {
    setRotation((current) => getNextRotation(current, "counterclockwise"));
  }

  function handleWheelEvent(event: WheelEvent, element: HTMLDivElement): void {
    if (!imageDimensions || !isImageLoaded) {
      return;
    }

    if (
      shouldHandleWheelZoom({
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
      })
    ) {
      event.preventDefault();
      markWheelGestureActive();
      const rect = element.getBoundingClientRect();
      const nextScale = getScaleFromWheelDelta(effectiveScale, event.deltaY, event.deltaMode);
      applyAnchoredScale(nextScale, event.clientX - rect.left, event.clientY - rect.top);
      return;
    }

    event.preventDefault();
    markWheelGestureActive();

    if (!viewportSize) {
      return;
    }

    const isSwapped = rotation === 90 || rotation === 270;
    const contentWidth = (isSwapped ? imageDimensions.height : imageDimensions.width) * effectiveScale;
    const contentHeight = (isSwapped ? imageDimensions.width : imageDimensions.height) * effectiveScale;

    const canNavigateHorizontally =
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey &&
      contentWidth <= viewportSize.width &&
      Math.abs(event.deltaX) >= HORIZONTAL_NAV_ACCUMULATE_THRESHOLD;

    if (canNavigateHorizontally) {
      horizontalNavAccumRef.current += normalizeWheelDelta(event.deltaX, event.deltaMode);
      if (Math.abs(horizontalNavAccumRef.current) >= HORIZONTAL_NAV_TRIGGER_THRESHOLD) {
        const direction: WheelPanDirection = horizontalNavAccumRef.current > 0 ? "next" : "prev";
        horizontalNavAccumRef.current = 0;
        onNavigateRequest?.(direction);
      }
      return;
    }

    setPanOffset((currentPan) =>
      clampPan(
        {
          x: currentPan.x - normalizeWheelDelta(event.deltaX, event.deltaMode),
          y: currentPan.y - normalizeWheelDelta(event.deltaY, event.deltaMode),
        },
        viewportSize,
        { width: contentWidth, height: contentHeight },
      ),
    );
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (!imageDimensions || !isImageLoaded) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    if (event.pointerType === "mouse" && event.detail === 2) {
      return;
    }

    const viewport = event.currentTarget;
    viewport.setPointerCapture(event.pointerId);

    if (event.pointerType === "touch") {
      activeTouchPointsRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (activeTouchPointsRef.current.size === 2) {
        const [first, second] = Array.from(activeTouchPointsRef.current.values());
        if (first && second) {
          pinchStateRef.current = {
            pointerIds: Array.from(activeTouchPointsRef.current.keys()) as [number, number],
            startDistance: getPointerDistance(first, second),
            baseScale: effectiveScale,
          };
          dragPanRef.current = null;
          setIsPanningImage(false);
          setIsGesturing(true);
          return;
        }
      }
    }

    let startPan = panOffset;
    if (contentSize && viewportSize) {
      startPan = clampPan(panOffset, viewportSize, contentSize);
      setPanOffset(startPan);
    }

    dragPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: startPan.x,
      startPanY: startPan.y,
    };
    setIsPanningImage(true);
    setIsGesturing(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (event.pointerType === "touch") {
      activeTouchPointsRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    const pinchState = pinchStateRef.current;
    if (pinchState && pinchState.pointerIds.includes(event.pointerId)) {
      const first = activeTouchPointsRef.current.get(pinchState.pointerIds[0]);
      const second = activeTouchPointsRef.current.get(pinchState.pointerIds[1]);
      if (first && second && imageDimensions) {
        event.preventDefault();
        const midpoint = getPointerMidpoint(first, second);
        const rect = event.currentTarget.getBoundingClientRect();
        const nextScale = pinchState.baseScale * (getPointerDistance(first, second) / Math.max(pinchState.startDistance, 1));
        applyAnchoredScale(nextScale, midpoint.x - rect.left, midpoint.y - rect.top);
        return;
      }
    }

    const dragPan = dragPanRef.current;
    if (!dragPan || dragPan.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    requestPanUpdate(() => {
      setPanOffset({
        x: dragPan.startPanX + (event.clientX - dragPan.startX),
        y: dragPan.startPanY + (event.clientY - dragPan.startY),
      });
    });
    setIsPanningImage(true);
  }

  function endPointerInteraction(event: PointerEvent<HTMLDivElement>): void {
    const wasDragging = dragPanRef.current?.pointerId === event.pointerId;

    if (event.pointerType === "touch") {
      activeTouchPointsRef.current.delete(event.pointerId);
    }

    if (wasDragging) {
      flushPendingPanUpdate();
      dragPanRef.current = null;
    }

    const pinchState = pinchStateRef.current;
    if (pinchState?.pointerIds.includes(event.pointerId)) {
      pinchStateRef.current = null;
      const remainingTouch = Array.from(activeTouchPointsRef.current.entries())[0];
      if (remainingTouch) {
        let startPan = panOffset;
        if (contentSize && viewportSize) {
          startPan = clampPan(panOffset, viewportSize, contentSize);
          setPanOffset(startPan);
        }
        dragPanRef.current = {
          pointerId: remainingTouch[0],
          startX: remainingTouch[1].x,
          startY: remainingTouch[1].y,
          startPanX: startPan.x,
          startPanY: startPan.y,
        };
      }
    }

    if (wasDragging && contentSize && viewportSize) {
      setPanOffset((currentPan) => clampPan(currentPan, viewportSize, contentSize));
    }

    setIsPanningImage(false);
    cancelWheelGestureTimer();
    if (!dragPanRef.current && !pinchStateRef.current) {
      setIsGesturing(false);
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    endPointerInteraction(event);
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>): void {
    endPointerInteraction(event);
  }

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver !== "function") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setViewportSize({
        width: Math.max(1, entry.contentRect.width),
        height: Math.max(1, entry.contentRect.height),
      });
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [sessionKey]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const handleNativeWheel = (event: WheelEvent) => {
      cameraRef.current.handleWheelEvent(event, element);
    };

    const handleGestureEvent = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node) || !element.contains(target)) {
        return;
      }
      event.preventDefault();
    };

    element.addEventListener("wheel", handleNativeWheel, { passive: false });
    document.addEventListener("gesturestart", handleGestureEvent, { passive: false });
    document.addEventListener("gesturechange", handleGestureEvent, { passive: false });
    document.addEventListener("gestureend", handleGestureEvent, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleNativeWheel);
      document.removeEventListener("gesturestart", handleGestureEvent);
      document.removeEventListener("gesturechange", handleGestureEvent);
      document.removeEventListener("gestureend", handleGestureEvent);
      cancelWheelGestureTimer();
    };
  }, [sessionKey, onNavigateRequest]);

  useEffect(() => {
    clearGestureState();
    setPanOffset({ x: 0, y: 0 });
    setZoomMode("fit");
    setManualScale(1);
    setRotation(0);
  }, [sessionKey]);

  useEffect(() => {
    if (!isImageLoaded || zoomMode !== "fit") {
      return;
    }

    setPanOffset({ x: 0, y: 0 });
  }, [isImageLoaded, zoomMode, imageDimensions, rotation]);

  return {
    viewportRef,
    zoomMode,
    manualScale,
    effectiveScale,
    fitScale,
    imageWidth,
    imageHeight,
    panOffset: displayPan,
    isPanningImage,
    isInteractive,
    isGesturing,
    transitionEnabled: !isGesturing,
    rotation,
    imageTransform,
    setFitMode,
    setActualSize,
    handleZoom,
    handleDoubleClick,
    rotateClockwise,
    rotateCounterclockwise,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  };
}
