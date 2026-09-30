/**
 * 紧凑视口分页布局（迁移件）。
 *
 * 迁移来源：旧仓 `Chips-MusicPlayer/src/utils/layout.ts`（覆盖矩阵「格式表与纯函数域」行
 * 附带 `layout.ts:36`，判迁移：窄竖长视口的分页判定与滑动翻页目标页纯函数，测试随迁）。
 * 消费面：`AppView` 以 `shouldUseMobilePagerLayout` 决定舞台/队列的紧凑单列与宽幅双列布局。
 */

const MOBILE_PAGER_MAX_WIDTH = 960;
const MOBILE_PAGER_MIN_HEIGHT_RATIO = 1.08;
const MOBILE_PAGER_SWIPE_THRESHOLD_RATIO = 0.16;
const MOBILE_PAGER_MAX_SWIPE_THRESHOLD = 120;

export function shouldUseMobilePagerLayout(viewportWidth: number, viewportHeight: number): boolean {
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return false;
  }

  return viewportWidth <= MOBILE_PAGER_MAX_WIDTH && viewportHeight / viewportWidth >= MOBILE_PAGER_MIN_HEIGHT_RATIO;
}

export function resolveMobilePagerTargetPage(
  startPageIndex: number,
  deltaX: number,
  pageWidth: number,
  pageCount: number = 2,
): number {
  const maxPageIndex = Math.max(0, pageCount - 1);
  const normalizedStartPageIndex = Math.max(0, Math.min(maxPageIndex, startPageIndex));

  if (pageWidth <= 0) {
    return normalizedStartPageIndex;
  }

  const swipeThreshold = Math.min(
    MOBILE_PAGER_MAX_SWIPE_THRESHOLD,
    pageWidth * MOBILE_PAGER_SWIPE_THRESHOLD_RATIO,
  );

  if (Math.abs(deltaX) < swipeThreshold) {
    return normalizedStartPageIndex;
  }

  const nextPageIndex = deltaX < 0 ? normalizedStartPageIndex + 1 : normalizedStartPageIndex - 1;
  return Math.max(0, Math.min(maxPageIndex, nextPageIndex));
}
