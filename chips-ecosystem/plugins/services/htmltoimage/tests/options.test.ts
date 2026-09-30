import { describe, expect, it } from 'vitest';

import { normalizeHtmlToImageOptions } from '../src/options.js';
import { isChipsErrorLike } from '../src/errors.js';

describe('normalizeHtmlToImageOptions', () => {
  it('缺省选项归一为 png / 自适应高 / scale 1 / 透明背景', () => {
    const { options, warnings } = normalizeHtmlToImageOptions(undefined);
    expect(options).toEqual({
      format: 'png',
      width: 794,
      height: null,
      scaleFactor: 1,
      background: 'transparent',
    });
    expect(warnings).toEqual([]);
  });

  it('JPEG 缺省背景为白色', () => {
    const { options } = normalizeHtmlToImageOptions({ format: 'jpeg' });
    expect(options.background).toBe('white');
  });

  it('JPEG + 透明背景归一为白色并给出警告', () => {
    const { options, warnings } = normalizeHtmlToImageOptions({
      format: 'jpeg',
      background: 'transparent',
    });
    expect(options.background).toBe('white');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.code).toBe('BACKGROUND_NORMALIZED_OPAQUE');
    expect(warnings[0]?.message).toContain('JPEG');
  });

  it('theme 背景携带合法底色时保留解析材料', () => {
    const { options, warnings } = normalizeHtmlToImageOptions({
      background: 'theme',
      themeBackground: '#1a2b3c',
    });
    expect(options.background).toBe('theme');
    expect(options.themeBackground).toBe('#1a2b3c');
    expect(warnings).toEqual([]);
  });

  it('theme 背景缺底色回退白色并给出警告', () => {
    const { options, warnings } = normalizeHtmlToImageOptions({ background: 'theme' });
    expect(options.background).toBe('white');
    expect(warnings.map((item) => item.code)).toEqual(['THEME_BACKGROUND_MISSING']);
  });

  it('非法格式抛 CONVERTER_INPUT_UNSUPPORTED', () => {
    try {
      normalizeHtmlToImageOptions({ format: 'gif' });
      expect.unreachable('应当抛出');
    } catch (error) {
      expect(isChipsErrorLike(error)).toBe(true);
      expect((error as { code: string }).code).toBe('CONVERTER_INPUT_UNSUPPORTED');
      expect((error as { details?: { field?: string } }).details?.field).toBe('options.format');
    }
  });

  it('非法尺寸抛 CONVERTER_INPUT_UNSUPPORTED', () => {
    for (const width of [0, -1, 15, 20001, 3.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      try {
        normalizeHtmlToImageOptions({ width });
        expect.unreachable(`width=${String(width)} 应当抛出`);
      } catch (error) {
        expect(isChipsErrorLike(error)).toBe(true);
        expect((error as { code: string }).code).toBe('CONVERTER_INPUT_UNSUPPORTED');
      }
    }
  });

  it('height=null 表示按内容自适应', () => {
    const { options } = normalizeHtmlToImageOptions({ height: null });
    expect(options.height).toBeNull();
  });

  it('scaleFactor 越界抛 CONVERTER_INPUT_UNSUPPORTED', () => {
    for (const scaleFactor of [0.5, 0, 5, Number.NaN]) {
      expect(() => normalizeHtmlToImageOptions({ scaleFactor })).toThrowError();
    }
  });

  it('scaleFactor 边界值可用', () => {
    expect(normalizeHtmlToImageOptions({ scaleFactor: 1 }).options.scaleFactor).toBe(1);
    expect(normalizeHtmlToImageOptions({ scaleFactor: 4 }).options.scaleFactor).toBe(4);
  });

  it('非法主题底色抛 CONVERTER_INPUT_UNSUPPORTED', () => {
    expect(() =>
      normalizeHtmlToImageOptions({ background: 'theme', themeBackground: 'red' })
    ).toThrowError();
    expect(() =>
      normalizeHtmlToImageOptions({ background: 'theme', themeBackground: '#12345' })
    ).toThrowError();
  });

  it('非对象选项抛 CONVERTER_INPUT_UNSUPPORTED', () => {
    expect(() => normalizeHtmlToImageOptions('png')).toThrowError();
    expect(() => normalizeHtmlToImageOptions(null)).toThrowError();
    expect(() => normalizeHtmlToImageOptions([])).toThrowError();
  });
});
