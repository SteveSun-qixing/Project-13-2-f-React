/**
 * HTML 转 PDF 服务：分页预估器（纯计算）。
 *
 * 给定排版度量块（块高、keep-together 规则）与可打印区高度，按确定规则
 * 计算分页断点与预估页数，供打印前预检与进度估算使用；实际分页以打印
 * 承载排版为准，预估结果不改变打印请求语义。
 *
 * 规则：
 * - keep-together 块不跨页拆分：当前页放不下且当前页非空则整块移到下一页；
 *   单块高于可打印区时独占一页并给出 PAGE_OVERFLOW_KEEP_BLOCK 警告；
 * - 普通块按高度填充当前页剩余空间，放不下时从剩余空间处拆分续到下一页。
 */

import { warning } from './errors.js';
import type { IConverterWarning, IPaginatedBlock, IPaginationResult, IPaginationSegment } from './types.js';

/** 警告码：keep-together 块高于可打印区，单块独占一页。 */
export const WARN_PAGE_OVERFLOW_KEEP_BLOCK = 'PAGE_OVERFLOW_KEEP_BLOCK';

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

/** 按可打印区高度（CSS 像素）对块清单做分页预估。 */
export function paginateBlocks(
  blocks: readonly IPaginatedBlock[],
  printableHeightPx: number
): IPaginationResult {
  if (!isFiniteNumber(printableHeightPx) || printableHeightPx <= 0) {
    throw new TypeError('可打印区高度必须是正有限数（CSS 像素）。');
  }

  const warnings: IConverterWarning[] = [];
  const pages: IPaginationSegment[][] = [];
  let currentPage: IPaginationSegment[] = [];
  let remaining = printableHeightPx;

  const flushPage = (): void => {
    if (currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      remaining = printableHeightPx;
    }
  };

  for (const block of blocks) {
    if (block.keepTogether === true) {
      if (block.heightPx <= remaining) {
        currentPage.push({ id: block.id, heightPx: block.heightPx, continuation: false });
        remaining -= block.heightPx;
        continue;
      }
      flushPage();
      if (block.heightPx <= printableHeightPx) {
        currentPage.push({ id: block.id, heightPx: block.heightPx, continuation: false });
        remaining = printableHeightPx - block.heightPx;
      } else {
        // 单块高于可打印区：整块独占一页，实际断点交给打印承载排版。
        pages.push([{ id: block.id, heightPx: block.heightPx, continuation: false }]);
        warnings.push(
          warning(
            WARN_PAGE_OVERFLOW_KEEP_BLOCK,
            'keep-together 块高于可打印区，单块独占一页，实际分页以打印引擎排版为准。',
            { blockId: block.id }
          )
        );
      }
      continue;
    }

    let offset = 0;
    let isFirstSegment = true;
    while (offset < block.heightPx) {
      if (remaining <= 0) {
        flushPage();
      }
      const take = Math.min(remaining, block.heightPx - offset);
      currentPage.push({
        id: block.id,
        heightPx: take,
        continuation: !isFirstSegment,
      });
      isFirstSegment = false;
      offset += take;
      remaining -= take;
      if (remaining <= 0 && offset < block.heightPx) {
        flushPage();
      }
    }
  }
  flushPage();

  return { pages, pageCount: pages.length, warnings };
}
