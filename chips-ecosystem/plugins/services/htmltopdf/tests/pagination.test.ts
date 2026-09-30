/**
 * 分页预估器真算法断言：边界（空文档、精确填满、跨页续段、keep-together 移页
 * 与独占页）、极值与守恒、可打印区高度防御。全部落在大地真实输出上，不 mock 内核。
 */

import { describe, expect, it } from 'vitest';

import { WARN_PAGE_OVERFLOW_KEEP_BLOCK, paginateBlocks } from '../src/pagination.js';
import type { IPaginatedBlock } from '../src/types.js';

const block = (id: string, heightPx: number, keepTogether?: boolean): IPaginatedBlock => ({
  id,
  heightPx,
  ...(keepTogether === true ? { keepTogether: true } : {}),
});

/** 汇总断言：分段高度守恒、分段高度恒正、页数与 pages 一致。 */
function expectConserved(
  result: ReturnType<typeof paginateBlocks>,
  blocks: readonly IPaginatedBlock[]
): void {
  expect(result.pageCount).toBe(result.pages.length);
  const segmentHeightById = new Map<string, number>();
  for (const page of result.pages) {
    expect(page.length).toBeGreaterThan(0);
    for (const segment of page) {
      expect(segment.heightPx).toBeGreaterThan(0);
      segmentHeightById.set(
        segment.id,
        (segmentHeightById.get(segment.id) ?? 0) + segment.heightPx
      );
    }
  }
  expect(segmentHeightById.size).toBe(blocks.length);
  for (const item of blocks) {
    expect(segmentHeightById.get(item.id)).toBe(item.heightPx);
  }
}

describe('paginateBlocks：基础填充', () => {
  it('空文档产出零页且无警告', () => {
    expect(paginateBlocks([], 1000)).toEqual({ pages: [], pageCount: 0, warnings: [] });
  });

  it('单块整装一页', () => {
    const result = paginateBlocks([block('a', 100)], 1000);
    expect(result.pageCount).toBe(1);
    expect(result.pages).toEqual([[{ id: 'a', heightPx: 100, continuation: false }]]);
    expect(result.warnings).toEqual([]);
  });

  it('块高恰等于可打印区：单页精确填满', () => {
    const result = paginateBlocks([block('a', 1000)], 1000);
    expect(result.pageCount).toBe(1);
    expect(result.pages).toEqual([[{ id: 'a', heightPx: 1000, continuation: false }]]);
  });

  it('精确填满后的下一块移入新页', () => {
    const result = paginateBlocks([block('a', 1000), block('b', 1)], 1000);
    expect(result.pages).toEqual([
      [{ id: 'a', heightPx: 1000, continuation: false }],
      [{ id: 'b', heightPx: 1, continuation: false }],
    ]);
  });
});

describe('paginateBlocks：跨页拆分与续段标志', () => {
  it('超长普通块按剩余空间拆分，首段 continuation=false、续段 true', () => {
    const result = paginateBlocks([block('long', 2500)], 1000);
    expect(result.pageCount).toBe(3);
    expect(result.pages).toEqual([
      [{ id: 'long', heightPx: 1000, continuation: false }],
      [{ id: 'long', heightPx: 1000, continuation: true }],
      [{ id: 'long', heightPx: 500, continuation: true }],
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('多块混排：普通块先填满当前页再拆分续页，keep-together 不受影响', () => {
    const result = paginateBlocks(
      [block('kt', 600, true), block('n', 500), block('m', 400)],
      1000
    );
    expect(result.pages).toEqual([
      [
        { id: 'kt', heightPx: 600, continuation: false },
        { id: 'n', heightPx: 400, continuation: false },
      ],
      [
        { id: 'n', heightPx: 100, continuation: true },
        { id: 'm', heightPx: 400, continuation: false },
      ],
    ]);
  });

  it('小数高度拆分精确（无浮点漂移）', () => {
    const result = paginateBlocks([block('f', 201)], 100.5);
    expect(result.pages).toEqual([
      [{ id: 'f', heightPx: 100.5, continuation: false }],
      [{ id: 'f', heightPx: 100.5, continuation: true }],
    ]);
  });
});

describe('paginateBlocks：keep-together 语义', () => {
  it('当前页放不下且当前页非空：整块移入新页，不拆分', () => {
    const result = paginateBlocks([block('n', 700), block('kt', 500, true)], 1000);
    expect(result.pages).toEqual([
      [{ id: 'n', heightPx: 700, continuation: false }],
      [{ id: 'kt', heightPx: 500, continuation: false }],
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('前一普通块恰好填满整页时，keep-together 同样移页', () => {
    const result = paginateBlocks([block('n', 1000), block('kt', 500, true)], 1000);
    expect(result.pages).toEqual([
      [{ id: 'n', heightPx: 1000, continuation: false }],
      [{ id: 'kt', heightPx: 500, continuation: false }],
    ]);
  });

  it('keep-together 恰好等于剩余空间：留在当前页', () => {
    const result = paginateBlocks([block('n', 500), block('kt', 500, true)], 1000);
    expect(result.pageCount).toBe(1);
    expect(result.pages).toEqual([
      [
        { id: 'n', heightPx: 500, continuation: false },
        { id: 'kt', heightPx: 500, continuation: false },
      ],
    ]);
  });

  it('keep-together 高于可打印区：独占一页并给出 PAGE_OVERFLOW_KEEP_BLOCK 警告', () => {
    const result = paginateBlocks([block('kt', 1500, true)], 1000);
    expect(result.pageCount).toBe(1);
    expect(result.pages).toEqual([[{ id: 'kt', heightPx: 1500, continuation: false }]]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe(WARN_PAGE_OVERFLOW_KEEP_BLOCK);
    expect(result.warnings[0]?.code).toBe('PAGE_OVERFLOW_KEEP_BLOCK');
    expect(result.warnings[0]?.message).toContain('keep-together');
    expect(result.warnings[0]?.details).toEqual({ blockId: 'kt' });
  });

  it('警告码常量与随包契约登记一致且为唯一警告码', () => {
    expect(WARN_PAGE_OVERFLOW_KEEP_BLOCK).toBe('PAGE_OVERFLOW_KEEP_BLOCK');
  });

  it('独占页之后的普通块从新页起排', () => {
    const result = paginateBlocks([block('a', 400), block('kt', 1500, true), block('b', 200)], 1000);
    expect(result.pages).toEqual([
      [{ id: 'a', heightPx: 400, continuation: false }],
      [{ id: 'kt', heightPx: 1500, continuation: false }],
      [{ id: 'b', heightPx: 200, continuation: false }],
    ]);
    expect(result.warnings).toHaveLength(1);
  });

  it('keep-together 移页后，后续普通块继续填充该新页', () => {
    const result = paginateBlocks(
      [block('n', 700), block('kt', 500, true), block('b', 400)],
      1000
    );
    expect(result.pages).toEqual([
      [{ id: 'n', heightPx: 700, continuation: false }],
      [
        { id: 'kt', heightPx: 500, continuation: false },
        { id: 'b', heightPx: 400, continuation: false },
      ],
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('keep-together 高于可打印区（小数边界）：同样独占一页', () => {
    const result = paginateBlocks([block('kt', 500, true)], 499.5);
    expect(result.pageCount).toBe(1);
    expect(result.warnings.map((item) => item.code)).toEqual(['PAGE_OVERFLOW_KEEP_BLOCK']);
  });
});

describe('paginateBlocks：极值与守恒', () => {
  it('大数值边界：2.5e6 高块在 1e6 可打印区拆为三段', () => {
    const result = paginateBlocks([block('big', 2_500_000)], 1_000_000);
    expect(result.pageCount).toBe(3);
    expectConserved(result, [block('big', 2_500_000)]);
  });

  it('密集块清单：500 块 × 10px 在 1000px 可打印区恰好 5 页', () => {
    const blocks = Array.from({ length: 500 }, (_, index) => block(`b${index}`, 10));
    const result = paginateBlocks(blocks, 1000);
    expect(result.pageCount).toBe(5);
    for (const page of result.pages) {
      expect(page).toHaveLength(100);
      const pageHeight = page.reduce((total, segment) => total + segment.heightPx, 0);
      expect(pageHeight).toBe(1000);
    }
    expectConserved(result, blocks);
  });

  it('混合 keep-together 的固定清单高度守恒、页数与分段一致', () => {
    const blocks = [
      block('a', 120),
      block('kt1', 640, true),
      block('b', 90.5),
      block('kt2', 2000, true),
      block('c', 3000),
      block('kt3', 1000, true),
    ];
    const result = paginateBlocks(blocks, 1000);
    expectConserved(result, blocks);
    expect(result.warnings.map((item) => item.code)).toEqual(['PAGE_OVERFLOW_KEEP_BLOCK']);
    expect(result.warnings[0]?.details).toEqual({ blockId: 'kt2' });
  });
});

describe('paginateBlocks：可打印区高度防御', () => {
  it('非正或非有限高度抛 TypeError', () => {
    for (const printableHeightPx of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => paginateBlocks([], printableHeightPx)).toThrowError(TypeError);
      expect(() => paginateBlocks([], printableHeightPx)).toThrowError(
        '可打印区高度必须是正有限数（CSS 像素）。'
      );
    }
  });
});
