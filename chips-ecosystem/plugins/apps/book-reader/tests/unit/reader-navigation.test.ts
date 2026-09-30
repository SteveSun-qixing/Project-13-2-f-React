import { describe, expect, it } from 'vitest';
import { resolveWheelNavigationThreshold } from '../../src/core/book-model';

describe('reader navigation', () => {
  it('滚轮阈值会根据阅读模式与设备粒度调整，避免翻页手感过钝', () => {
    expect(resolveWheelNavigationThreshold({ readingMode: 'paginated', deltaMode: 1 })).toBe(8);
    expect(resolveWheelNavigationThreshold({ readingMode: 'paginated', deltaMode: 0 })).toBe(14);
    expect(resolveWheelNavigationThreshold({ readingMode: 'scroll', deltaMode: 1 })).toBe(6);
    expect(resolveWheelNavigationThreshold({ readingMode: 'scroll', deltaMode: 0 })).toBe(10);
    expect(resolveWheelNavigationThreshold({ readingMode: 'scroll', deltaMode: 2 })).toBe(1);
  });
});
