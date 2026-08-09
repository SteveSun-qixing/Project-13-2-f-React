export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface InteractionPoint {
  x: number;
  y: number;
}

export const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg", ".avif"];
export const SUPPORTED_IMAGE_EXTENSION_LABEL = SUPPORTED_IMAGE_EXTENSIONS.join(" ");
export const MIN_ZOOM_SCALE = 0.1;
export const MAX_ZOOM_SCALE = 8;
export const ZOOM_STEP_RATIO = 1.25;
export const FIT_VIEWPORT_EDGE_RATIO = 1;

export type Rotation = 0 | 90 | 180 | 270;

export function normalizeImageExtension(filePath: string): string {
  const normalized = filePath.trim().toLowerCase();
  const slashIndex = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex <= slashIndex) {
    return "";
  }
  return normalized.slice(dotIndex);
}

export function isSupportedImagePath(filePath: string): boolean {
  return SUPPORTED_IMAGE_EXTENSIONS.includes(normalizeImageExtension(filePath));
}

export function clampScale(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, value));
}

export function getFitScale(
  natural: ImageDimensions | null,
  viewport: ViewportSize | null,
  rotation: Rotation = 0,
): number {
  if (!natural || !viewport) {
    return 1;
  }

  if (natural.width <= 0 || natural.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return 1;
  }

  const isSwappedRotation = rotation === 90 || rotation === 270;
  const fitWidth = isSwappedRotation ? natural.height : natural.width;
  const fitHeight = isSwappedRotation ? natural.width : natural.height;
  const widthBasedScale = (viewport.width * FIT_VIEWPORT_EDGE_RATIO) / fitWidth;
  const heightBasedScale = (viewport.height * FIT_VIEWPORT_EDGE_RATIO) / fitHeight;

  let scale: number;
  if (fitWidth > fitHeight) {
    scale = widthBasedScale;
  } else if (fitHeight > fitWidth) {
    scale = heightBasedScale;
  } else {
    scale = Math.min(widthBasedScale, heightBasedScale);
  }

  return Math.min(clampScale(scale), 1);
}

export function clampPan(pan: InteractionPoint, viewport: ViewportSize, content: ViewportSize): InteractionPoint {
  const clampAxis = (value: number, viewportLength: number, contentLength: number): number => {
    if (contentLength <= viewportLength) {
      return 0;
    }
    return Math.min(0, Math.max(viewportLength - contentLength, value));
  };

  return {
    x: clampAxis(pan.x, viewport.width, content.width),
    y: clampAxis(pan.y, viewport.height, content.height),
  };
}

export function getNextZoomScale(currentScale: number, direction: "in" | "out"): number {
  const baseScale = clampScale(currentScale);
  if (direction === "in") {
    return clampScale(baseScale * ZOOM_STEP_RATIO);
  }
  return clampScale(baseScale / ZOOM_STEP_RATIO);
}

export function shouldHandleWheelZoom(input: {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  if (input.ctrlKey || input.metaKey || input.deltaMode !== 0) {
    return true;
  }

  return Math.abs(input.deltaX) < 1 && Math.abs(input.deltaY) >= 24;
}

export function getScaleFromWheelDelta(currentScale: number, deltaY: number, deltaMode: number): number {
  const normalizedDelta = deltaMode === 1 ? deltaY * 14 : deltaMode === 2 ? deltaY * 160 : deltaY;
  return clampScale(currentScale * Math.exp(-normalizedDelta * 0.002));
}

export function getCenteredContentOffset(viewportLength: number, contentLength: number): number {
  if (viewportLength <= 0 || contentLength <= 0) {
    return 0;
  }

  return Math.max((viewportLength - contentLength) / 2, 0);
}

export function projectScrollOffsetForScale(input: {
  viewportLength: number;
  pointerOffset: number;
  currentScroll: number;
  contentLengthBefore: number;
  contentLengthAfter: number;
}): number {
  const beforeOffset = getCenteredContentOffset(input.viewportLength, input.contentLengthBefore);
  const afterOffset = getCenteredContentOffset(input.viewportLength, input.contentLengthAfter);
  const logicalOffset =
    (input.currentScroll + input.pointerOffset - beforeOffset) / Math.max(input.contentLengthBefore, 1);
  const nextScroll = afterOffset + logicalOffset * input.contentLengthAfter - input.pointerOffset;
  const maxScroll = Math.max(input.contentLengthAfter - input.viewportLength, 0);

  return Math.min(maxScroll, Math.max(0, nextScroll));
}

export function projectPanOffsetForScale(input: {
  viewportLength: number;
  pointerOffset: number;
  naturalLength: number;
  currentScale: number;
  nextScale: number;
  currentPan: number;
}): number {
  const contentLengthBefore = input.naturalLength * input.currentScale;
  const contentLengthAfter = input.naturalLength * input.nextScale;
  const beforeOffset = (input.viewportLength - contentLengthBefore) / 2 + input.currentPan;
  const logicalOffset = (input.pointerOffset - beforeOffset) / Math.max(input.currentScale, 0.0001);
  const afterOffset = (input.viewportLength - contentLengthAfter) / 2;

  return input.pointerOffset - logicalOffset * input.nextScale - afterOffset;
}

export function getPointerDistance(first: InteractionPoint, second: InteractionPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function getPointerMidpoint(first: InteractionPoint, second: InteractionPoint): InteractionPoint {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

export function formatZoomPercent(scale: number): string {
  return `${Math.round(clampScale(scale) * 100)}%`;
}

export function resolveFileName(filePath: string): string {
  const normalized = filePath.trim();
  if (!normalized) {
    return "";
  }
  const segments = normalized.split(/[\\/]/).filter((segment) => segment.length > 0);
  return segments[segments.length - 1] ?? normalized;
}

export function formatFileSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return "0 B";
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = sizeBytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = size >= 10 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}
