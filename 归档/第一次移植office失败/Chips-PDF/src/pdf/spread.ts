/**
 * 页面行布局：单页模式一行一页；双页模式按主流阅读器惯例
 * 从第 1 页开始两两成对（1+2、3+4、…）。
 */
export function spreadRows(visList: readonly number[], spread: 1 | 2): number[][] {
  if (spread === 1) return visList.map((i) => [i]);
  const out: number[][] = [];
  for (let i = 0; i < visList.length; i += 2) out.push(visList.slice(i, i + 2));
  return out;
}

/** 可见位置 → 行下标 */
export function rowOfVisIdx(visIdx: number, spread: 1 | 2): number {
  return spread === 1 ? visIdx : Math.floor(visIdx / 2);
}

/**
 * 翻页步进以整行为单位（双页模式下跨一对，否则在行内步进不会滚动）。
 * page 为 1 起始的可见页码；返回目标行的首页可见页码。
 */
export function stepPage(visList: readonly number[], spread: 1 | 2, page: number, dir: 1 | -1): number {
  const rows = spreadRows(visList, spread);
  if (rows.length === 0) return page;
  const cur = rowOfVisIdx(page - 1, spread);
  const target = Math.min(Math.max(0, cur + dir), rows.length - 1);
  const firstPage = rows[target]?.[0];
  return firstPage === undefined ? page : visList.indexOf(firstPage) + 1;
}
