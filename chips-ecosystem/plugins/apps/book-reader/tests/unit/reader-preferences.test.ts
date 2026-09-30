import { describe, expect, it } from 'vitest';
import {
  normalizeBackgroundTone,
  normalizeReaderPreferences,
  normalizeReadingMode,
} from '../../src/core/book-model';

describe('reader preferences', () => {
  it('会把阅读模式和背景色归一到正式范围', () => {
    expect(normalizeReadingMode('scroll')).toBe('scroll');
    expect(normalizeReadingMode('unknown')).toBe('paginated');

    expect(normalizeBackgroundTone('warm')).toBe('warm');
    expect(normalizeBackgroundTone('invalid')).toBe('system');
    expect(normalizeBackgroundTone('system')).toBe('system');
  });

  it('会完整归一阅读偏好对象', () => {
    expect(
      normalizeReaderPreferences({
        fontScale: 5,
        contentWidth: 200,
        fontFamily: 'sans',
        readingMode: 'scroll',
        backgroundTone: 'night',
      })
    ).toEqual({
      fontScale: 1.4,
      contentWidth: 560,
      fontFamily: 'sans',
      readingMode: 'scroll',
      backgroundTone: 'night',
      lineHeight: 1.65,
      letterSpacing: 0.01,
      textAlign: 'justify',
      writingMode: 'horizontal',
      brightness: 1,
    });
  });
});
