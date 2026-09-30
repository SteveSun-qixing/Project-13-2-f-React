/**
 * 歌词滚动布局（迁移件）。
 *
 * 迁移来源：旧仓 `Chips-MusicPlayer/src/utils/lyrics-layout.ts`（覆盖矩阵「歌词解析与布局」
 * 行，判迁移：滚动偏移/行高排布/交错动画时序纯函数，测试随迁）。
 */

export const LYRIC_LINE_GAP = 20;
export const LYRIC_VIEWPORT_OFFSET_DIVISOR = 3.5;

export function resolveLyricsViewportOffset(viewportHeight: number): number {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return 0;
  }

  return viewportHeight / LYRIC_VIEWPORT_OFFSET_DIVISOR;
}

export function getLyricsLayoutPosition(
  activeIndex: number,
  targetIndex: number,
  lineHeights: readonly number[],
  viewportOffset: number,
  lineGap: number = LYRIC_LINE_GAP,
): number {
  let offset = 0;

  if (targetIndex > activeIndex) {
    for (let index = activeIndex; index < targetIndex; index += 1) {
      offset += (lineHeights[index] ?? 0) + lineGap;
    }
  } else {
    for (let index = activeIndex; index > targetIndex; index -= 1) {
      offset -= (lineHeights[index - 1] ?? 0) + lineGap;
    }
  }

  return offset + viewportOffset;
}

export function getLyricsTransitionDelay(activeIndex: number, targetIndex: number): number {
  let step = targetIndex - activeIndex + 1;
  if (step > 10) {
    step = 0;
  }

  const delay = step * 70 - step * 10;
  return delay > 0 ? delay : 0;
}
