import { describe, expect, it } from 'vitest';
import {
  clampCropRect,
  moveCropRect,
  resizeCropRect,
  resolveContainedImageBounds,
  resolveInitialCropRect,
  type CropRect,
  type ImageBounds,
} from '../../src/components/CardSettings/panels/cover-crop-layout';

function expectPortraitRatio(rect: CropRect) {
  expect(Number((rect.width / rect.height).toFixed(2))).toBe(0.75);
}

describe('cover-crop-layout', () => {
  it('centers the initial crop rect inside the visible image while preserving ratio', () => {
    const imageBounds = resolveContainedImageBounds(
      { width: 640, height: 480 },
      { width: 1200, height: 1600 },
    );

    const rect = resolveInitialCropRect(imageBounds, '3:4');

    expectPortraitRatio(rect);
    expect(rect.x).toBeGreaterThanOrEqual(imageBounds.x);
    expect(rect.y).toBeGreaterThanOrEqual(imageBounds.y);
    expect(rect.x + rect.width).toBeLessThanOrEqual(imageBounds.x + imageBounds.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(imageBounds.y + imageBounds.height);
  });

  it('clamps moving the crop rect so it never leaves the image bounds', () => {
    const imageBounds: ImageBounds = {
      x: 100,
      y: 40,
      width: 300,
      height: 400,
      scale: 1,
    };
    const rect = clampCropRect(
      {
        x: 140,
        y: 80,
        width: 180,
        height: 240,
      },
      imageBounds,
      '3:4',
    );

    const moved = moveCropRect(rect, { x: 300, y: 260 }, imageBounds);

    expect(moved.x + moved.width).toBe(imageBounds.x + imageBounds.width);
    expect(moved.y + moved.height).toBe(imageBounds.y + imageBounds.height);
    expectPortraitRatio(moved);
  });

  it('resizes the crop rect from a corner while keeping the active ratio fixed', () => {
    const imageBounds: ImageBounds = {
      x: 80,
      y: 30,
      width: 360,
      height: 480,
      scale: 1,
    };
    const startRect: CropRect = {
      x: 140,
      y: 90,
      width: 180,
      height: 240,
    };

    const resized = resizeCropRect(startRect, { x: 380, y: 450 }, 'se', imageBounds, '3:4');

    expect(resized.width).toBeGreaterThan(startRect.width);
    expect(resized.height).toBeGreaterThan(startRect.height);
    expect(resized.x).toBe(startRect.x);
    expect(resized.y).toBe(startRect.y);
    expectPortraitRatio(resized);
    expect(resized.x + resized.width).toBeLessThanOrEqual(imageBounds.x + imageBounds.width);
    expect(resized.y + resized.height).toBeLessThanOrEqual(imageBounds.y + imageBounds.height);
  });
});
