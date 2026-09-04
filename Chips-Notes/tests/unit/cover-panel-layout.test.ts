import { describe, expect, it } from 'vitest';
import { resolveCoverPreviewFrameSize } from '../../src/components/CardSettings/panels/cover-panel-layout';

describe('resolveCoverPreviewFrameSize', () => {
  it('keeps the preview width fixed when the computed height stays within limits', () => {
    const result = resolveCoverPreviewFrameSize({
      ratio: '3:4',
      containerWidth: 520,
      containerHeight: 720,
    });

    expect(result).toEqual({
      width: 300,
      height: 400,
    });
  });

  it('falls back to the available height when the fixed width would make the preview too tall', () => {
    const result = resolveCoverPreviewFrameSize({
      ratio: '9:19.5',
      containerWidth: 520,
      containerHeight: 520,
    });

    expect(result.height).toBe(480);
    expect(result.width).toBeLessThan(300);
  });

  it('respects very narrow containers by shrinking from width first', () => {
    const result = resolveCoverPreviewFrameSize({
      ratio: '16:9',
      containerWidth: 220,
      containerHeight: 600,
    });

    expect(result.width).toBe(180);
    expect(result.height).toBe(101);
  });
});
