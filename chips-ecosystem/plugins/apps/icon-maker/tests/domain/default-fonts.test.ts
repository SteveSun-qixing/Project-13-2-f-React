import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createPrivateUseGlyphs,
  EMOJI_FONT_SOURCE,
  MATERIAL_SYMBOLS_FONT_SOURCE,
  parseMaterialSymbolsCodepoints,
} from '../../src/domain/default-fonts';

// vitest 以包根为工作目录，夹具按包内固定路径读取（真实 codepoints 切片）。
const FIXTURE_PATH = resolve(process.cwd(), 'tests/fixtures/material-symbols-codepoints-sample.txt');

describe('Material Symbols 码位表解析（真实夹具）', () => {
  const fixtureSource = readFileSync(FIXTURE_PATH, 'utf-8');

  it('逐行解析真实码位表切片，跳过空行与非法行', () => {
    const glyphs = parseMaterialSymbolsCodepoints(fixtureSource);

    // 夹具 = 真实 codepoints 文件前 36 行 + 4 条精选行 + 空行与一条非法行。
    expect(glyphs).toHaveLength(40);

    expect(glyphs[0]).toEqual({
      id: 'material-10k',
      label: '10k',
      display: '\uE951',
      codepoint: 'U+E951',
    });
    expect(glyphs[1]).toEqual({
      id: 'material-10mp',
      label: '10mp',
      display: '\uE952',
      codepoint: 'U+E952',
    });

    const byLabel = new Map(glyphs.map((glyph) => [glyph.label, glyph]));
    expect(byLabel.get('favorite')).toEqual({
      id: 'material-favorite',
      label: 'favorite',
      display: '\uE87E',
      codepoint: 'U+E87E',
    });
    expect(byLabel.get('home')).toEqual({
      id: 'material-home',
      label: 'home',
      display: '\uE9B2',
      codepoint: 'U+E9B2',
    });
    expect(byLabel.get('search')?.codepoint).toBe('U+E8B6');
    expect(byLabel.get('settings')?.codepoint).toBe('U+E8B8');

    // 非法行「not-a-codepoint-line」不得产出字形，id 面无残留。
    expect(glyphs.every((glyph) => glyph.id.startsWith('material-'))).toBe(true);
    expect(glyphs.some((glyph) => glyph.label === 'not-a-codepoint-line')).toBe(false);
  });

  it('码位十六进制大小写归一为大写 U+ 形式', () => {
    const glyphs = parseMaterialSymbolsCodepoints('18_up_rating f8fd\n');
    expect(glyphs).toEqual([
      {
        id: 'material-18_up_rating',
        label: '18_up_rating',
        display: String.fromCodePoint(0xf8fd),
        codepoint: 'U+F8FD',
      },
    ]);
  });
});

describe('内置字体源', () => {
  it('精选 Material Symbols 表为 36 个字形且码位正确', () => {
    expect(MATERIAL_SYMBOLS_FONT_SOURCE.glyphs).toHaveLength(36);
    expect(MATERIAL_SYMBOLS_FONT_SOURCE.id).toBe('material-symbols');
    expect(MATERIAL_SYMBOLS_FONT_SOURCE.kind).toBe('material');

    const byLabel = new Map(MATERIAL_SYMBOLS_FONT_SOURCE.glyphs.map((glyph) => [glyph.label, glyph]));
    expect(byLabel.get('home')).toEqual({
      id: 'material-home',
      label: 'home',
      display: '\uE88A',
      codepoint: 'U+E88A',
    });
    expect(byLabel.get('auto_awesome')?.codepoint).toBe('U+E65F');
    expect(byLabel.get('brush')?.display).toBe('\uE3AE');
  });

  it('Emoji 字形全部来自声明的码位区间且满足表情字符判定', () => {
    const glyphs = EMOJI_FONT_SOURCE.glyphs;
    expect(glyphs.length).toBeGreaterThan(1000);

    const ids = glyphs.map((glyph) => glyph.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const glyph of glyphs) {
      const value = Number.parseInt(glyph.codepoint?.slice(2) ?? '', 16);
      const inRange = [
        [0x2600, 0x27bf],
        [0x1f000, 0x1f02f],
        [0x1f0a0, 0x1f0ff],
        [0x1f100, 0x1f1ff],
        [0x1f200, 0x1f2ff],
        [0x1f300, 0x1f5ff],
        [0x1f600, 0x1f64f],
        [0x1f680, 0x1f6ff],
        [0x1f700, 0x1f77f],
        [0x1f780, 0x1f7ff],
        [0x1f800, 0x1f8ff],
        [0x1f900, 0x1f9ff],
        [0x1fa70, 0x1faff],
      ].some(([start, end]) => value >= (start ?? 0) && value <= (end ?? -1));
      expect(inRange, `字形 ${glyph.label} 越界`).toBe(true);
    }
  });

  it('私用区字形按 U+E000 起连续生成', () => {
    expect(createPrivateUseGlyphs(3)).toEqual([
      { id: 'custom-E000', label: 'U+E000', display: '\uE000', codepoint: 'U+E000' },
      { id: 'custom-E001', label: 'U+E001', display: '\uE001', codepoint: 'U+E001' },
      { id: 'custom-E002', label: 'U+E002', display: '\uE002', codepoint: 'U+E002' },
    ]);
    expect(createPrivateUseGlyphs()).toHaveLength(60);
    expect(createPrivateUseGlyphs(72)).toHaveLength(72);
    const last = createPrivateUseGlyphs(72).at(-1);
    expect(last?.codepoint).toBe('U+E047');
  });
});
