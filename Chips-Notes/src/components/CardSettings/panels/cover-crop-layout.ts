import { parseCoverRatio } from '../../../utils/card-cover';

export interface CropSize {
  width: number;
  height: number;
}

export interface CropPoint {
  x: number;
  y: number;
}

export interface CropRect extends CropPoint, CropSize {}

export interface ImageBounds extends CropRect {
  scale: number;
}

export type CropResizeHandle = 'nw' | 'ne' | 'se' | 'sw';

const INITIAL_CROP_FILL = 0.82;
const MIN_CROP_SHORT_EDGE = 96;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveAspectRatio(ratio: string): number {
  const parsed = parseCoverRatio(ratio);
  return parsed.width / parsed.height;
}

function resolveMinimumCropWidth(aspectRatio: number): number {
  return aspectRatio >= 1 ? MIN_CROP_SHORT_EDGE * aspectRatio : MIN_CROP_SHORT_EDGE;
}

function resolveMaximumCropWidth(imageBounds: ImageBounds, aspectRatio: number): number {
  return Math.min(imageBounds.width, imageBounds.height * aspectRatio);
}

export function resolveContainedImageBounds(stageSize: CropSize, naturalSize: CropSize): ImageBounds {
  if (!stageSize.width || !stageSize.height || !naturalSize.width || !naturalSize.height) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      scale: 1,
    };
  }

  const scale = Math.min(stageSize.width / naturalSize.width, stageSize.height / naturalSize.height);
  const width = naturalSize.width * scale;
  const height = naturalSize.height * scale;

  return {
    x: (stageSize.width - width) / 2,
    y: (stageSize.height - height) / 2,
    width,
    height,
    scale,
  };
}

export function resolveInitialCropRect(imageBounds: ImageBounds, ratio: string): CropRect {
  const aspectRatio = resolveAspectRatio(ratio);
  const preferredWidth = Math.min(
    imageBounds.width * INITIAL_CROP_FILL,
    imageBounds.height * INITIAL_CROP_FILL * aspectRatio,
  );
  const maxWidth = resolveMaximumCropWidth(imageBounds, aspectRatio);
  const width = clamp(preferredWidth, Math.min(resolveMinimumCropWidth(aspectRatio), maxWidth), maxWidth);
  const height = width / aspectRatio;

  return {
    x: imageBounds.x + (imageBounds.width - width) / 2,
    y: imageBounds.y + (imageBounds.height - height) / 2,
    width,
    height,
  };
}

export function clampCropRect(rect: CropRect, imageBounds: ImageBounds, ratio: string): CropRect {
  const aspectRatio = resolveAspectRatio(ratio);
  const maxWidth = resolveMaximumCropWidth(imageBounds, aspectRatio);
  const width = clamp(rect.width, Math.min(resolveMinimumCropWidth(aspectRatio), maxWidth), maxWidth);
  const height = width / aspectRatio;

  return {
    x: clamp(rect.x, imageBounds.x, imageBounds.x + imageBounds.width - width),
    y: clamp(rect.y, imageBounds.y, imageBounds.y + imageBounds.height - height),
    width,
    height,
  };
}

export function moveCropRect(rect: CropRect, delta: CropPoint, imageBounds: ImageBounds): CropRect {
  return {
    ...rect,
    x: clamp(rect.x + delta.x, imageBounds.x, imageBounds.x + imageBounds.width - rect.width),
    y: clamp(rect.y + delta.y, imageBounds.y, imageBounds.y + imageBounds.height - rect.height),
  };
}

export function resizeCropRect(
  startRect: CropRect,
  pointer: CropPoint,
  handle: CropResizeHandle,
  imageBounds: ImageBounds,
  ratio: string,
): CropRect {
  const aspectRatio = resolveAspectRatio(ratio);
  const imageRight = imageBounds.x + imageBounds.width;
  const imageBottom = imageBounds.y + imageBounds.height;

  let anchorX = 0;
  let anchorY = 0;
  let rawWidth = 0;
  let maxWidth = 0;

  switch (handle) {
    case 'se':
      anchorX = startRect.x;
      anchorY = startRect.y;
      rawWidth = Math.min(pointer.x - anchorX, (pointer.y - anchorY) * aspectRatio);
      maxWidth = Math.min(imageRight - anchorX, (imageBottom - anchorY) * aspectRatio);
      break;
    case 'sw':
      anchorX = startRect.x + startRect.width;
      anchorY = startRect.y;
      rawWidth = Math.min(anchorX - pointer.x, (pointer.y - anchorY) * aspectRatio);
      maxWidth = Math.min(anchorX - imageBounds.x, (imageBottom - anchorY) * aspectRatio);
      break;
    case 'ne':
      anchorX = startRect.x;
      anchorY = startRect.y + startRect.height;
      rawWidth = Math.min(pointer.x - anchorX, (anchorY - pointer.y) * aspectRatio);
      maxWidth = Math.min(imageRight - anchorX, (anchorY - imageBounds.y) * aspectRatio);
      break;
    case 'nw':
      anchorX = startRect.x + startRect.width;
      anchorY = startRect.y + startRect.height;
      rawWidth = Math.min(anchorX - pointer.x, (anchorY - pointer.y) * aspectRatio);
      maxWidth = Math.min(anchorX - imageBounds.x, (anchorY - imageBounds.y) * aspectRatio);
      break;
  }

  const width = clamp(rawWidth, Math.min(resolveMinimumCropWidth(aspectRatio), maxWidth), maxWidth);
  const height = width / aspectRatio;

  switch (handle) {
    case 'se':
      return { x: anchorX, y: anchorY, width, height };
    case 'sw':
      return { x: anchorX - width, y: anchorY, width, height };
    case 'ne':
      return { x: anchorX, y: anchorY - height, width, height };
    case 'nw':
      return { x: anchorX - width, y: anchorY - height, width, height };
  }
}
