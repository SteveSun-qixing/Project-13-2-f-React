/**
 * 批注边栏的纵向布局：卡片希望与其定位钉齐平、互不重叠，
 * 锚定卡片（激活线程或正在输入的草稿）保持精确的钉对齐位置，其余让位。
 */

/** 定位钉中心到卡片引线附着行的偏移 */
export const CARD_PIN_ALIGN = 14;

export interface MarginLayoutEntry {
  key: string;
  /** 定位钉中心 y，相对边栏列顶部 */
  pinY: number;
}

/**
 * 计算卡片顶部。按钉的位置排序（自上而下）。无锚点时单趟下推即可；
 * 有锚点时锚定卡片固定在钉对齐位置，上方卡片上推、下方卡片下推。
 */
export function layoutMarginCards(
  entries: MarginLayoutEntry[],
  height: (key: string) => number,
  anchorKey: string | null,
  gap = 10,
  minTop = 4,
): Map<string, number> {
  const sorted = [...entries].sort((a, b) => a.pinY - b.pinY);
  const desired = (e: MarginLayoutEntry): number => Math.max(minTop, e.pinY - CARD_PIN_ALIGN);
  const tops = new Array<number>(sorted.length);

  const anchorIdx = anchorKey === null ? -1 : sorted.findIndex((e) => e.key === anchorKey);
  if (anchorIdx < 0) {
    for (let i = 0; i < sorted.length; i++) {
      const min = i === 0 ? minTop : (tops[i - 1] ?? 0) + height(sorted[i - 1]?.key ?? "") + gap;
      tops[i] = Math.max(desired(sorted[i] as MarginLayoutEntry), min);
    }
  } else {
    tops[anchorIdx] = desired(sorted[anchorIdx] as MarginLayoutEntry);
    // 锚点上方：碰撞时上推（可能越过上边界——避让重叠优先于保持在顶边内）
    for (let i = anchorIdx - 1; i >= 0; i--) {
      const max = (tops[i + 1] ?? 0) - gap - height(sorted[i]?.key ?? "");
      tops[i] = Math.min(desired(sorted[i] as MarginLayoutEntry), max);
    }
    for (let i = anchorIdx + 1; i < sorted.length; i++) {
      const min = (tops[i - 1] ?? 0) + height(sorted[i - 1]?.key ?? "") + gap;
      tops[i] = Math.max(desired(sorted[i] as MarginLayoutEntry), min);
    }
  }

  const out = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) out.set(sorted[i]?.key ?? "", tops[i] ?? minTop);
  return out;
}
