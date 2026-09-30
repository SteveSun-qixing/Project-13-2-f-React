import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createEmptyLyricsDocument,
  decodeTextWithFallback,
  findActiveLyricIndex,
  parseLyricsText,
  resolveActiveLyricProgress,
} from '../src/player/lyrics';

/**
 * LRC 歌词解析判例（随迁自旧仓 tests/unit/lyrics.test.ts）＋真实夹具面。
 *
 * 「真实夹具」口径：timed 与 plain 判例直接读取 `tests/fixtures/lyrics/` 下的真实
 * 歌词文件字节（真实文件 → decodeTextWithFallback → parseLyricsText），不 mock 解析器。
 * 夹具以包根相对路径读取（vitest 以包目录为 cwd）；jsdom 环境下 import.meta.url 为
 * http 形态，不作路径基准。
 */

const TIMED_FIXTURE_PATH = resolve(process.cwd(), 'tests/fixtures/lyrics/sample-timed.lrc');
const PLAIN_FIXTURE_PATH = resolve(process.cwd(), 'tests/fixtures/lyrics/sample-plain.txt');

function readFixture(path: string): Uint8Array {
  return new Uint8Array(readFileSync(path));
}

describe('lyrics utilities（迁移判例）', () => {
  it('parses timed lrc content with metadata and offset', () => {
    const lyrics = parseLyricsText('[ar:Artist]\n[offset:500]\n[00:01.00]Hello\n[00:02.50]World');
    expect(lyrics.mode).toBe('timed');
    expect(lyrics.metadata.artist).toBe('Artist');
    expect(lyrics.lines[0]?.timeMs).toBe(1500);
    expect(lyrics.lines[1]?.timeMs).toBe(3000);
  });

  it('falls back to plain lyrics when timestamps are missing', () => {
    const lyrics = parseLyricsText('Line 1\nLine 2');
    expect(lyrics.mode).toBe('plain');
    expect(lyrics.lines.map((line) => line.text)).toEqual(['Line 1', 'Line 2']);
  });

  it('locates the active lyric line by current playback time', () => {
    const lyrics = parseLyricsText('[00:01.00]Hello\n[00:03.00]World');
    expect(findActiveLyricIndex(lyrics.lines, 500)).toBe(-1);
    expect(findActiveLyricIndex(lyrics.lines, 1500)).toBe(0);
    expect(findActiveLyricIndex(lyrics.lines, 3500)).toBe(1);
  });

  it('resolves progressive highlight fill for the active lyric line', () => {
    const lyrics = parseLyricsText('[00:01.00]Hello\n[00:03.00]World');
    expect(resolveActiveLyricProgress(lyrics.lines, 1000, 0)).toBe(0);
    expect(resolveActiveLyricProgress(lyrics.lines, 2000, 0)).toBe(0.5);
    expect(resolveActiveLyricProgress(lyrics.lines, 3000, 1)).toBe(1);
  });

  it('decodes binary lyric buffers with utf-8 fallback', () => {
    const bytes = new TextEncoder().encode('你好，歌词');
    expect(decodeTextWithFallback(bytes)).toBe('你好，歌词');
  });

  it('returns an empty document for blank input', () => {
    expect(parseLyricsText('   \n  ')).toEqual(createEmptyLyricsDocument('companion'));
  });
});

describe('lyrics utilities（真实夹具文件面）', () => {
  it('解析真实 timed 夹具：元信息、补偿偏移、多时间轴行与排序', () => {
    const lyrics = parseLyricsText(decodeTextWithFallback(readFixture(TIMED_FIXTURE_PATH)), 'companion');

    expect(lyrics.mode).toBe('timed');
    expect(lyrics.metadata).toMatchObject({ title: '夜曲', artist: '测试歌手', album: '测试专辑', by: '夹具生成器' });
    expect(lyrics.offsetMs).toBe(500);
    // offset:+500 补偿进时间轴；多时间轴行展开并整体按时间升序。
    expect(lyrics.lines.map((line) => line.timeMs)).toEqual([1500, 4000, 6700, 8900, 12250]);
    expect(lyrics.lines[2]?.text).toBe('副歌段落多时间轴行');
    expect(lyrics.lines[0]?.text).toBe('夜风轻拂过窗台');
  });

  it('解析真实 plain 夹具：逐行平铺且无时间轴', () => {
    const lyrics = parseLyricsText(decodeTextWithFallback(readFixture(PLAIN_FIXTURE_PATH)), 'companion');

    expect(lyrics.mode).toBe('plain');
    expect(lyrics.lines.map((line) => line.text)).toEqual([
      '这是一段没有时间轴的纯文本歌词',
      '逐行呈现，不做卡拉OK跟随',
      '第二段从这一行开始',
    ]);
    expect(lyrics.lines.every((line) => line.timeMs === null)).toBe(true);
  });

  it('真实 timed 夹具可被活动行定位与行内进度消费', () => {
    const lyrics = parseLyricsText(decodeTextWithFallback(readFixture(TIMED_FIXTURE_PATH)), 'companion');

    // 1500ms 起播第 0 行（offset 已补偿）；6800ms 落在 6700 行内、进度约 4.5%。
    expect(findActiveLyricIndex(lyrics.lines, 1400)).toBe(-1);
    expect(findActiveLyricIndex(lyrics.lines, 1500)).toBe(0);
    expect(findActiveLyricIndex(lyrics.lines, 6800)).toBe(2);
    expect(resolveActiveLyricProgress(lyrics.lines, 6800, 2)).toBeCloseTo(100 / 2200, 5);
  });
});
