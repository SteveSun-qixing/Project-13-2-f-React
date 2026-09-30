import { describe, expect, it } from 'vitest';
import {
  clampPan,
  formatFileSize,
  formatZoomPercent,
  getCenteredContentOffset,
  getFitScale,
  getNextZoomScale,
  getPointerDistance,
  getPointerMidpoint,
  getScaleFromWheelDelta,
  isSupportedImagePath,
  projectPanOffsetForScale,
  projectScrollOffsetForScale,
  resolveFileName,
  shouldHandleWheelZoom,
} from '../src/viewer/image-viewer';

/**
 * 迁移自旧仓 Chips-PhotoViewer tests/unit/image-viewer.test.ts（矩阵裁决「测试随迁」）：
 * 纯函数断言逐条保留，仅随包内路径调整导入位置。
 */
describe('image viewer utilities', () => {
  it('detects supported image paths across case variants', () => {
    expect(isSupportedImagePath('/tmp/demo.PNG')).toBe(true);
    expect(isSupportedImagePath('C:\\Users\\chips\\photo.JpEg')).toBe(true);
    expect(isSupportedImagePath('/tmp/demo.txt')).toBe(false);
  });

  it('calculates fit scale from viewport and image size', () => {
    expect(getFitScale({ width: 2400, height: 1600 }, { width: 1200, height: 800 })).toBe(0.5);
    expect(getFitScale({ width: 900, height: 1600 }, { width: 1200, height: 1000 })).toBe(0.625);
  });

  it('never enlarges images smaller than the viewport to fit', () => {
    expect(getFitScale({ width: 400, height: 300 }, { width: 1600, height: 1200 })).toBe(1);
    expect(getFitScale({ width: 100, height: 100 }, { width: 1600, height: 1200 })).toBe(1);
    expect(getFitScale({ width: 1600, height: 1200 }, { width: 1600, height: 1200 })).toBe(1);
  });

  it('swaps natural dimensions when fitting a rotated image', () => {
    const natural = { width: 900, height: 1600 };
    const viewport = { width: 1200, height: 800 };
    expect(getFitScale(natural, viewport)).toBe(0.5);
    expect(getFitScale(natural, viewport, 90)).toBe(0.75);
    expect(getFitScale(natural, viewport, 270)).toBe(0.75);
    expect(getFitScale(natural, viewport, 180)).toBe(0.5);
  });

  it('swaps fit axes only for 90/270 rotations and never enlarges small images', () => {
    const natural = { width: 300, height: 100 };
    const viewport = { width: 300, height: 150 };
    expect(getFitScale(natural, viewport, 0)).toBe(1);
    expect(getFitScale(natural, viewport, 180)).toBe(1);
    expect(getFitScale(natural, viewport, 90)).toBe(0.5);
    expect(getFitScale(natural, viewport, 270)).toBe(0.5);
    expect(getFitScale({ width: 200, height: 100 }, { width: 1600, height: 1200 }, 90)).toBe(1);
    expect(getFitScale({ width: 200, height: 100 }, { width: 1600, height: 1200 }, 270)).toBe(1);
  });

  it('clamps pan offsets to viewport bounds', () => {
    expect(clampPan({ x: 100, y: -50 }, { width: 800, height: 600 }, { width: 400, height: 300 })).toEqual({
      x: 0,
      y: 0,
    });
    expect(clampPan({ x: -100, y: 50 }, { width: 800, height: 600 }, { width: 1000, height: 900 })).toEqual({
      x: -100,
      y: 0,
    });
    expect(clampPan({ x: -80, y: -120 }, { width: 800, height: 600 }, { width: 1000, height: 900 })).toEqual({
      x: -80,
      y: -120,
    });
    expect(clampPan({ x: 10, y: -400 }, { width: 800, height: 600 }, { width: 800, height: 900 })).toEqual({
      x: 0,
      y: -300,
    });
  });

  it('clamps only the axis whose content overflows the viewport', () => {
    expect(clampPan({ x: -30, y: 100 }, { width: 800, height: 600 }, { width: 900, height: 1000 })).toEqual({
      x: -30,
      y: 0,
    });
    expect(clampPan({ x: -500, y: -200 }, { width: 800, height: 600 }, { width: 1000, height: 900 })).toEqual({
      x: -200,
      y: -200,
    });
    expect(clampPan({ x: -60, y: -250 }, { width: 800, height: 600 }, { width: 900, height: 900 })).toEqual({
      x: -60,
      y: -250,
    });
  });

  it('clamps both axes when content overflows in both directions', () => {
    expect(clampPan({ x: -300, y: -900 }, { width: 800, height: 600 }, { width: 1000, height: 1000 })).toEqual({
      x: -200,
      y: -400,
    });
    expect(clampPan({ x: -500, y: -500 }, { width: 800, height: 600 }, { width: 1000, height: 1000 })).toEqual({
      x: -200,
      y: -400,
    });
    expect(clampPan({ x: -50, y: 60 }, { width: 800, height: 600 }, { width: 1000, height: 1000 })).toEqual({
      x: -50,
      y: 0,
    });
  });

  it('moves zoom scale forward and backward with clamping', () => {
    expect(getNextZoomScale(1, 'in')).toBe(1.25);
    expect(getNextZoomScale(0.1, 'out')).toBe(0.1);
    expect(getNextZoomScale(8, 'in')).toBe(8);
  });

  it('detects wheel and pinch zoom intents across devices', () => {
    expect(shouldHandleWheelZoom({ deltaX: 0, deltaY: 120, deltaMode: 1, ctrlKey: false, metaKey: false })).toBe(true);
    expect(shouldHandleWheelZoom({ deltaX: 0, deltaY: 8, deltaMode: 0, ctrlKey: true, metaKey: false })).toBe(true);
    expect(shouldHandleWheelZoom({ deltaX: 0.5, deltaY: 6, deltaMode: 0, ctrlKey: false, metaKey: false })).toBe(false);
    expect(shouldHandleWheelZoom({ deltaX: 0, deltaY: 48, deltaMode: 0, ctrlKey: false, metaKey: false })).toBe(true);
    expect(getScaleFromWheelDelta(1, -120, 1)).toBeGreaterThan(1);
    expect(getScaleFromWheelDelta(1, 120, 1)).toBeLessThan(1);
  });

  it('projects anchored scroll offsets during zoom transitions', () => {
    expect(getCenteredContentOffset(800, 400)).toBe(200);
    expect(
      projectScrollOffsetForScale({
        viewportLength: 800,
        pointerOffset: 400,
        currentScroll: 0,
        contentLengthBefore: 400,
        contentLengthAfter: 1200,
      }),
    ).toBe(200);
    expect(
      projectPanOffsetForScale({
        viewportLength: 1000,
        pointerOffset: 500,
        naturalLength: 1000,
        currentScale: 0.9,
        nextScale: 1.8,
        currentPan: 0,
      }),
    ).toBe(0);
  });

  it('calculates pinch gesture geometry', () => {
    expect(getPointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(getPointerMidpoint({ x: 10, y: 20 }, { x: 30, y: 50 })).toEqual({ x: 20, y: 35 });
  });

  it('formats file labels for the viewer header', () => {
    expect(resolveFileName('/tmp/demo/image.png')).toBe('image.png');
    expect(resolveFileName('C:\\Users\\chips\\cover.webp')).toBe('cover.webp');
    expect(formatFileSize(999)).toBe('999 B');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatZoomPercent(1.26)).toBe('126%');
  });

  it('formats zoom percent for the badge and clamps out-of-range input', () => {
    expect(formatZoomPercent(0.25)).toBe('25%');
    expect(formatZoomPercent(1)).toBe('100%');
    expect(formatZoomPercent(2.5)).toBe('250%');
    expect(formatZoomPercent(0.05)).toBe('10%');
    expect(formatZoomPercent(Number.NaN)).toBe('100%');
  });
});
