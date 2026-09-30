import { describe, it, expect } from 'vitest';
import { ScrollEngine } from '../../src/engine/scroll-engine';
import type { ScrollMetrics } from '../../src/engine/types';

function createMetrics(overrides: Partial<ScrollMetrics> = {}): ScrollMetrics {
  const defaults: ScrollMetrics = {
    scrollOffset: 500,
    maxScrollOffset: 3000,
    viewportSize: 800,
    contentSize: 3800,
    scrollFraction: 500 / 3000,
  };
  return { ...defaults, ...overrides };
}

describe('ScrollEngine', () => {
  const engine = new ScrollEngine();

  // ─── computeScrollFraction ─────────────────────────────────

  describe('computeScrollFraction', () => {
    it('顶部返回 0', () => {
      expect(engine.computeScrollFraction(0, 3000)).toBe(0);
    });

    it('底部返回 1', () => {
      expect(engine.computeScrollFraction(3000, 3000)).toBe(1);
    });

    it('中间位置返回正确比例', () => {
      expect(engine.computeScrollFraction(1500, 3000)).toBeCloseTo(0.5, 5);
      expect(engine.computeScrollFraction(750, 3000)).toBeCloseTo(0.25, 5);
    });

    it('maxOffset 为 0 返回 0', () => {
      expect(engine.computeScrollFraction(0, 0)).toBe(0);
      expect(engine.computeScrollFraction(100, 0)).toBe(0);
    });

    it('clamp 到 0–1 范围', () => {
      expect(engine.computeScrollFraction(-100, 3000)).toBe(0);
      expect(engine.computeScrollFraction(5000, 3000)).toBe(1);
    });
  });

  // ─── isNearBoundary ────────────────────────────────────────

  describe('isNearBoundary', () => {
    it('接近顶部检测到 previous 边界', () => {
      const metrics = createMetrics({ scrollOffset: 10, viewportSize: 800 });
      // 阈值 = max(24, round(800*0.04)) = max(24, 32) = 32
      expect(engine.isNearBoundary(metrics, 'previous')).toBe(true);
    });

    it('远离顶部不检测到 previous 边界', () => {
      const metrics = createMetrics({ scrollOffset: 500, viewportSize: 800 });
      expect(engine.isNearBoundary(metrics, 'previous')).toBe(false);
    });

    it('接近底部检测到 next 边界', () => {
      const metrics = createMetrics({
        scrollOffset: 2990,
        maxScrollOffset: 3000,
        viewportSize: 800,
      });
      expect(engine.isNearBoundary(metrics, 'next')).toBe(true);
    });

    it('远离底部不检测到 next 边界', () => {
      const metrics = createMetrics({
        scrollOffset: 2000,
        maxScrollOffset: 3000,
        viewportSize: 800,
      });
      expect(engine.isNearBoundary(metrics, 'next')).toBe(false);
    });

    it('阈值可自定义', () => {
      const metrics = createMetrics({ scrollOffset: 50, viewportSize: 800 });
      // 默认阈值 32，50 > 32 → 不在边界
      expect(engine.isNearBoundary(metrics, 'previous')).toBe(false);
      // 自定义阈值 60 → 50 <= 60 → 在边界
      expect(engine.isNearBoundary(metrics, 'previous', 60)).toBe(true);
    });
  });

  // ─── isAtBoundary ─────────────────────────────────────────

  describe('isAtBoundary', () => {
    it('精确在顶部', () => {
      const metrics = createMetrics({ scrollOffset: 0 });
      expect(engine.isAtBoundary(metrics, 'start')).toBe(true);
    });

    it('精确在底部', () => {
      const metrics = createMetrics({ scrollOffset: 3000, maxScrollOffset: 3000 });
      expect(engine.isAtBoundary(metrics, 'end')).toBe(true);
    });

    it('接近但未到达边界', () => {
      const metrics = createMetrics({ scrollOffset: 5 });
      expect(engine.isAtBoundary(metrics, 'start')).toBe(false);
    });
  });

  // ─── computeScrollTarget ───────────────────────────────────

  describe('computeScrollTarget', () => {
    it('正常滚动在范围内', () => {
      const result = engine.computeScrollTarget(500, 200, 3000);
      expect(result.target).toBe(700);
      expect(result.reachedBoundary).toBeNull();
    });

    it('超出底部触发 end 边界', () => {
      const result = engine.computeScrollTarget(2900, 200, 3000);
      expect(result.target).toBe(3000);
      expect(result.reachedBoundary).toBe('end');
    });

    it('超出顶部触发 start 边界', () => {
      const result = engine.computeScrollTarget(50, -200, 3000);
      expect(result.target).toBe(0);
      expect(result.reachedBoundary).toBe('start');
    });

    it('精确到达底部触发 end 边界', () => {
      const result = engine.computeScrollTarget(2800, 200, 3000);
      expect(result.target).toBe(3000);
      expect(result.reachedBoundary).toBe('end');
    });

    it('delta 为 0 不触发边界', () => {
      const result = engine.computeScrollTarget(500, 0, 3000);
      expect(result.target).toBe(500);
      expect(result.reachedBoundary).toBeNull();
    });
  });

  // ─── computeBoundaryOffset ─────────────────────────────────

  describe('computeBoundaryOffset', () => {
    it('start 返回 0', () => {
      expect(engine.computeBoundaryOffset('start', 3000)).toBe(0);
    });

    it('end 返回 maxOffset', () => {
      expect(engine.computeBoundaryOffset('end', 3000)).toBe(3000);
    });
  });
});
