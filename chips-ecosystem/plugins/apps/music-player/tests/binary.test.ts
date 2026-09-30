import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeBinaryContent } from '../src/player/binary';
import { decodeTextWithFallback, parseLyricsText } from '../src/player/lyrics';

/**
 * 二进制内容归一判例（随迁自旧仓 tests/unit/binary.test.ts）＋真实夹具链面：
 * base64/字节串归一 → 多编码收口 → 真实 LRC 夹具解析，全链不 mock 解析器。
 * 夹具以包根相对路径读取（vitest 以包目录为 cwd；jsdom 环境 import.meta.url 为 http 形态）。
 */

const TIMED_FIXTURE_PATH = resolve(process.cwd(), 'tests/fixtures/lyrics/sample-timed.lrc');

describe('binary normalization（迁移判例）', () => {
  it('decodes base64 binary strings from file.read before parsing lyrics', () => {
    const lyricsText = '[00:01.00]你好\n[00:02.50]世界';
    const encoded = Buffer.from(lyricsText, 'utf8').toString('base64');

    const normalized = normalizeBinaryContent(encoded);
    const decoded = decodeTextWithFallback(normalized);
    const lyrics = parseLyricsText(decoded);

    expect(decoded).toBe(lyricsText);
    expect(lyrics.mode).toBe('timed');
    expect(lyrics.lines.map((line) => line.text)).toEqual(['你好', '世界']);
  });

  it('keeps Uint8Array inputs unchanged', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(normalizeBinaryContent(bytes)).toEqual(bytes);
  });

  it('also decodes host-style wrapped binary payloads after unwrapping', () => {
    const lyricsText = '[00:01.00]line one';
    const wrapped: { content: string } = {
      content: Buffer.from(lyricsText, 'utf8').toString('base64'),
    };

    const decoded = decodeTextWithFallback(normalizeBinaryContent(wrapped.content));
    const lyrics = parseLyricsText(decoded);

    expect(lyrics.mode).toBe('timed');
    expect(lyrics.lines[0]?.text).toBe('line one');
  });

  it('归一真实夹具文件字节后完整解析出 timed 歌词', () => {
    const bytes = new Uint8Array(readFileSync(TIMED_FIXTURE_PATH));

    const lyrics = parseLyricsText(decodeTextWithFallback(normalizeBinaryContent(bytes)), 'companion');

    expect(lyrics.mode).toBe('timed');
    expect(lyrics.metadata.title).toBe('夜曲');
    expect(lyrics.lines).toHaveLength(5);
  });
});
