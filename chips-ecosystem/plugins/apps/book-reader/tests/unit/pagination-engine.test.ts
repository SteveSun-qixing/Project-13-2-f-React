import { describe, it, expect } from 'vitest';
import { PaginationEngine } from '../../src/engine/pagination-engine';
import type { PaginationMetrics } from '../../src/engine/types';

function createMetrics(overrides: Partial<PaginationMetrics> = {}): PaginationMetrics {
  return {
    totalColumns: 66,
    columnsPerSpread: 1,
    spreadCount: 66,
    currentSpreadIndex: 0,
    spreadWidthPx: 1440,
    spreadAdvancePx: 1440,
    columnWidthPx: 1440,
    columnGapPx: 0,
    totalScrollableWidth: 95611,
    maxScrollOffset: 95611 - 1440,
    ...overrides,
  };
}

describe('PaginationEngine', () => {
  const engine = new PaginationEngine();

  // ─── resolveSpreadIndex ────────────────────────────────────

  describe('resolveSpreadIndex', () => {
    it('从滚动偏移准确反推 spread 索引', () => {
      expect(engine.resolveSpreadIndex(0, 1440)).toBe(0);
      expect(engine.resolveSpreadIndex(1440, 1440)).toBe(1);
      expect(engine.resolveSpreadIndex(2880, 1440)).toBe(2);
      expect(engine.resolveSpreadIndex(14400, 1440)).toBe(10);
    });

    it('处理微小的子像素偏移', () => {
      // 浏览器可能因子像素渲染产生 ±0.5px 的偏差
      expect(engine.resolveSpreadIndex(1440.3, 1440)).toBe(1);
      expect(engine.resolveSpreadIndex(1439.7, 1440)).toBe(1);
      expect(engine.resolveSpreadIndex(2879.5, 1440)).toBe(2);
      expect(engine.resolveSpreadIndex(2880.5, 1440)).toBe(2);
    });

    it('scrollOffset 为 0 返回 spread 0', () => {
      expect(engine.resolveSpreadIndex(0, 1440)).toBe(0);
    });

    it('spreadWidth 为 0 返回 0', () => {
      expect(engine.resolveSpreadIndex(5000, 0)).toBe(0);
      expect(engine.resolveSpreadIndex(0, 0)).toBe(0);
    });

    it('负的 scrollOffset 返回 0', () => {
      expect(engine.resolveSpreadIndex(-100, 1440)).toBe(0);
    });
  });

  // ─── computeTargetOffset ───────────────────────────────────

  describe('computeTargetOffset', () => {
    it('翻到下一页：targetIndex = currentIndex + 1', () => {
      const metrics = createMetrics();
      const result = engine.computeTargetOffset(3, 'next', metrics);
      expect(result.targetIndex).toBe(4);
      expect(result.targetOffset).toBe(4 * 1440);
    });

    it('翻到上一页：targetIndex = currentIndex - 1', () => {
      const metrics = createMetrics();
      const result = engine.computeTargetOffset(5, 'previous', metrics);
      expect(result.targetIndex).toBe(4);
      expect(result.targetOffset).toBe(4 * 1440);
    });

    it('在最后一个 spread 翻下一页不超出', () => {
      const metrics = createMetrics({ spreadCount: 66 });
      const result = engine.computeTargetOffset(65, 'next', metrics);
      expect(result.targetIndex).toBe(65);
      expect(result.targetOffset).toBeLessThanOrEqual(metrics.maxScrollOffset);
    });

    it('在第一个 spread 翻上一页不低于 0', () => {
      const metrics = createMetrics();
      const result = engine.computeTargetOffset(0, 'previous', metrics);
      expect(result.targetIndex).toBe(0);
      expect(result.targetOffset).toBe(0);
    });

    it('targetOffset = targetIndex × spreadAdvance', () => {
      const metrics = createMetrics({
        spreadWidthPx: 1200,
        spreadAdvancePx: 1200,
        spreadCount: 100,
        maxScrollOffset: 120000,
      });
      const result = engine.computeTargetOffset(10, 'next', metrics);
      expect(result.targetIndex).toBe(11);
      expect(result.targetOffset).toBe(11 * 1200);
    });

    it('targetOffset 不超过 maxScrollOffset', () => {
      const maxOffset = 50000;
      const metrics = createMetrics({
        spreadWidthPx: 1000,
        spreadAdvancePx: 1000,
        spreadCount: 55,
        maxScrollOffset: maxOffset,
      });
      // 最后一个 spread (54) 的偏移 = 54 * 1000 = 54000 > maxOffset
      const result = engine.computeTargetOffset(53, 'next', metrics);
      expect(result.targetOffset).toBeLessThanOrEqual(maxOffset);
    });

    it('双页 spread 会把列间距计入真实翻页步长', () => {
      const metrics = createMetrics({
        columnsPerSpread: 2,
        spreadCount: 5,
        spreadWidthPx: 1440,
        spreadAdvancePx: 1480,
        columnWidthPx: 700,
        columnGapPx: 40,
        totalScrollableWidth: 7360,
        maxScrollOffset: 5920,
      });

      const result = engine.computeTargetOffset(1, 'next', metrics);
      expect(result).toEqual({
        targetIndex: 2,
        targetOffset: 2960,
      });
    });
  });

  // ─── 连续翻页无累积漂移 ────────────────────────────────────

  describe('连续翻页无累积漂移', () => {
    it('翻页 100 次后位置与理论值误差 ≤ 1px', () => {
      // 模拟 scrollWidth 不是 offsetWidth 整数倍的场景
      // scrollWidth=95611, offsetWidth=1440, 95611/1440=66.396...
      const metrics = createMetrics({
        spreadWidthPx: 1440,
        spreadAdvancePx: 1440,
        spreadCount: 67, // ceil(95611/1440)
        totalScrollableWidth: 95611,
        maxScrollOffset: 95611 - 1440,
      });

      let currentIndex = 0;
      for (let i = 0; i < 100; i++) {
        const result = engine.computeTargetOffset(currentIndex, 'next', metrics);
        currentIndex = result.targetIndex;

        // 每次翻页的目标偏移量都精确等于 index × spreadAdvance（或 maxOffset）
        const expectedOffset = Math.min(currentIndex * 1440, metrics.maxScrollOffset);
        expect(Math.abs(result.targetOffset - expectedOffset)).toBeLessThanOrEqual(1);
      }
    });

    it('往返翻页后回到起始位置', () => {
      const metrics = createMetrics();
      let currentIndex = 0;

      // 翻 20 页
      for (let i = 0; i < 20; i++) {
        const result = engine.computeTargetOffset(currentIndex, 'next', metrics);
        currentIndex = result.targetIndex;
      }
      expect(currentIndex).toBe(20);

      // 翻回 20 页
      for (let i = 0; i < 20; i++) {
        const result = engine.computeTargetOffset(currentIndex, 'previous', metrics);
        currentIndex = result.targetIndex;
      }
      expect(currentIndex).toBe(0);

      // 回到起始位置的偏移量精确为 0
      const offset = engine.computeOffsetForSpread(
        currentIndex,
        metrics.spreadAdvancePx,
        metrics.maxScrollOffset
      );
      expect(offset).toBe(0);
    });

    it('双页 spread 连续翻页不会每次少走一个 columnGap', () => {
      const metrics = createMetrics({
        columnsPerSpread: 2,
        spreadCount: 6,
        spreadWidthPx: 1440,
        spreadAdvancePx: 1480,
        columnWidthPx: 700,
        columnGapPx: 40,
        totalScrollableWidth: 8840,
        maxScrollOffset: 7400,
      });

      let currentIndex = 0;
      const visitedOffsets: number[] = [];
      for (let index = 0; index < 4; index += 1) {
        const result = engine.computeTargetOffset(currentIndex, 'next', metrics);
        visitedOffsets.push(result.targetOffset);
        currentIndex = result.targetIndex;
      }

      expect(visitedOffsets).toEqual([1480, 2960, 4440, 5920]);
    });

    it('scrollWidth 不是 offsetWidth 整数倍时正常工作', () => {
      // 95611 / 1440 = 66.396...
      const metrics = createMetrics({
        spreadWidthPx: 1440,
        spreadAdvancePx: 1440,
        totalScrollableWidth: 95611,
        maxScrollOffset: 95611 - 1440,
        spreadCount: 67,
      });

      // 翻到最后一个 spread
      let currentIndex = 0;
      while (currentIndex < metrics.spreadCount - 1) {
        const result = engine.computeTargetOffset(currentIndex, 'next', metrics);
        if (result.targetIndex === currentIndex) break; // 不再前进
        currentIndex = result.targetIndex;
      }

      // 最后位置不超过 maxScrollOffset
      const finalOffset = engine.computeOffsetForSpread(
        currentIndex,
        metrics.spreadAdvancePx,
        metrics.maxScrollOffset
      );
      expect(finalOffset).toBeLessThanOrEqual(metrics.maxScrollOffset);
      expect(finalOffset).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── isAtBoundary ─────────────────────────────────────────

  describe('isAtBoundary', () => {
    it('在章节开头检测到 start 边界', () => {
      const metrics = createMetrics();
      expect(engine.isAtBoundary(0, metrics, 'previous')).toBe(true);
      expect(engine.isAtBoundary(1, metrics, 'previous')).toBe(true); // 容差内
    });

    it('在章节末尾检测到 end 边界', () => {
      const metrics = createMetrics();
      expect(engine.isAtBoundary(metrics.maxScrollOffset, metrics, 'next')).toBe(true);
      expect(engine.isAtBoundary(metrics.maxScrollOffset - 1, metrics, 'next')).toBe(true); // 容差内
    });

    it('在中间位置不检测到边界', () => {
      const metrics = createMetrics();
      expect(engine.isAtBoundary(5000, metrics, 'previous')).toBe(false);
      expect(engine.isAtBoundary(5000, metrics, 'next')).toBe(false);
    });
  });

  // ─── snapToSpread ─────────────────────────────────────────

  describe('snapToSpread', () => {
    it('对齐到最近的 spread 边界', () => {
      expect(engine.snapToSpread(1450, 1440)).toBe(1440);
      expect(engine.snapToSpread(1430, 1440)).toBe(1440);
      expect(engine.snapToSpread(1000, 1440)).toBe(1440);
      // 700/1440 ≈ 0.486 → round → 0 → 0*1440 = 0
      expect(engine.snapToSpread(700, 1440)).toBe(0);
    });

    it('微小偏移量被正确对齐', () => {
      expect(engine.snapToSpread(0.3, 1440)).toBe(0);
      expect(engine.snapToSpread(1440.1, 1440)).toBe(1440);
      expect(engine.snapToSpread(2879.9, 1440)).toBe(2880);
    });

    it('spreadWidth 为 0 不抛错', () => {
      expect(engine.snapToSpread(100, 0)).toBe(100);
    });
  });

  // ─── computeOffsetForSpread ────────────────────────────────

  describe('computeOffsetForSpread', () => {
    it('计算正确的偏移量', () => {
      expect(engine.computeOffsetForSpread(0, 1440, 90000)).toBe(0);
      expect(engine.computeOffsetForSpread(5, 1440, 90000)).toBe(7200);
      expect(engine.computeOffsetForSpread(10, 1440, 90000)).toBe(14400);
    });

    it('不超过 maxOffset', () => {
      expect(engine.computeOffsetForSpread(100, 1440, 50000)).toBe(50000);
    });

    it('负索引处理为 0', () => {
      expect(engine.computeOffsetForSpread(-1, 1440, 50000)).toBe(0);
    });
  });

  // ─── computeOffsetForBoundary ──────────────────────────────

  describe('computeOffsetForBoundary', () => {
    it('start 返回 0', () => {
      const metrics = createMetrics();
      expect(engine.computeOffsetForBoundary('start', metrics)).toBe(0);
    });

    it('end 返回 maxScrollOffset', () => {
      const metrics = createMetrics();
      expect(engine.computeOffsetForBoundary('end', metrics)).toBe(metrics.maxScrollOffset);
    });
  });
});
