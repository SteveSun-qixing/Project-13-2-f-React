import { describe, expect, it } from 'vitest';
import {
  getLyricsLayoutPosition,
  getLyricsTransitionDelay,
  LYRIC_LINE_GAP,
  resolveLyricsViewportOffset,
} from '../src/player/lyricsLayout';

/** 歌词滚动布局判例（随迁自旧仓 tests/unit/lyrics-layout.test.ts，逐条保真）。 */

describe('lyrics layout utilities', () => {
  it('resolves the viewport offset from window height', () => {
    expect(resolveLyricsViewportOffset(700)).toBe(200);
    expect(resolveLyricsViewportOffset(0)).toBe(0);
  });

  it('calculates lyric positions using measured line heights', () => {
    const heights = [40, 56, 48];
    const viewportOffset = 180;

    expect(getLyricsLayoutPosition(1, 1, heights, viewportOffset)).toBe(180);
    expect(getLyricsLayoutPosition(1, 2, heights, viewportOffset)).toBe(180 + (heights[1] as number) + LYRIC_LINE_GAP);
    expect(getLyricsLayoutPosition(1, 0, heights, viewportOffset)).toBe(180 - (heights[0] as number) - LYRIC_LINE_GAP);
  });

  it('matches the stagger timing used by the reference lyrics animation', () => {
    expect(getLyricsTransitionDelay(3, 3)).toBe(60);
    expect(getLyricsTransitionDelay(3, 5)).toBe(180);
    expect(getLyricsTransitionDelay(3, 20)).toBe(0);
  });
});
