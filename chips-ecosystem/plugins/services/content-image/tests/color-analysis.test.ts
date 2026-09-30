/**
 * 色彩分析核心行为回归（迁移自旧模块 `tests/unit/color-analysis.test.ts`，
 * 断言面逐条对照保留；错误码按 04-能力契约规范 §8.6 由 `COLOR_PICKER_IMAGE_EMPTY`
 * 翻正为已登记的 `IMAGE_EMPTY`）。
 */

import { ChipsError } from '@chips/sdk';
import { describe, expect, it } from 'vitest';

import { analyzeColorSample } from '../src/color-analysis.js';
import { IMAGE_ANALYSIS_FAILED, IMAGE_EMPTY } from '../src/errors.js';
import type { IDecodedImageInfo, IRgbaPixelSample } from '../src/types.js';

const hexToRgb = (input: string): { r: number; g: number; b: number } => {
  const normalized = input.replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

const relativeLuminance = (input: { r: number; g: number; b: number }): number => {
  return (0.2126 * input.r + 0.7152 * input.g + 0.0722 * input.b) / 255;
};

const createSample = (
  width: number,
  height: number,
  fill: (x: number, y: number) => { r: number; g: number; b: number; a?: number }
): IRgbaPixelSample => {
  const pixels = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const color = fill(x, y);
      pixels[offset] = color.r;
      pixels[offset + 1] = color.g;
      pixels[offset + 2] = color.b;
      pixels[offset + 3] = color.a ?? 255;
    }
  }

  return { width, height, pixels };
};

const posterSample = createSample(10, 10, (x, y) => {
  if (x < 7) {
    return { r: 24, g: 34, b: 94 };
  }
  if (y < 7) {
    return { r: 242, g: 112, b: 56 };
  }
  return { r: 210, g: 84, b: 150 };
});

describe('analyzeColorSample', () => {
  it('海报型样本：取出蓝色背景与暖色强调', () => {
    const result = analyzeColorSample(posterSample);
    const background = hexToRgb(result.backgroundColor);
    const accent = hexToRgb(result.accentColor);

    expect(background.b).toBeGreaterThan(background.r);
    expect(background.b).toBeGreaterThan(background.g);
    expect(accent.r).toBeGreaterThan(accent.b);
    expect(relativeLuminance(accent)).toBeGreaterThan(relativeLuminance(background));
    expect(relativeLuminance(background)).toBeGreaterThan(0.22);
    expect(relativeLuminance(accent)).toBeGreaterThan(0.45);
    expect(result.palette[0]).toMatchObject({ color: result.backgroundColor, role: 'background' });
    expect(result.palette[1]).toMatchObject({ color: result.accentColor, role: 'accent' });
    expect(result.metadata.algorithm).toBe('oklab-kmeans-v1');
    expect(result.metadata.sample.visiblePixelRatio).toBe(1);
    expect(result.metadata.sample.transparentPixelRatio).toBe(0);
  });

  it('灰度样本：产出两个分离的中性色', () => {
    const result = analyzeColorSample(
      createSample(6, 6, (x) => (x < 3 ? { r: 70, g: 70, b: 70 } : { r: 205, g: 205, b: 205 }))
    );
    const background = hexToRgb(result.backgroundColor);
    const accent = hexToRgb(result.accentColor);

    expect(result.backgroundColor).not.toBe(result.accentColor);
    expect(relativeLuminance(background)).toBeLessThan(relativeLuminance(accent));
    expect(relativeLuminance(background)).toBeGreaterThan(0.22);
    expect(relativeLuminance(accent)).toBeGreaterThan(0.45);
  });

  it('忽略透明像素并回报 Alpha 覆盖诊断', () => {
    const result = analyzeColorSample(
      createSample(8, 8, (x, y) =>
        x < 4 && y < 4 ? { r: 42, g: 128, b: 214, a: 255 } : { r: 255, g: 255, b: 255, a: 0 }
      )
    );

    expect(result.backgroundColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(result.accentColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(result.metadata.sample.visiblePixelRatio).toBe(0.25);
    expect(result.metadata.sample.transparentPixelRatio).toBe(0.75);
    expect(result.metadata.sample.clusterCount).toBeGreaterThanOrEqual(1);
  });

  it('全透明样本以已登记码 IMAGE_EMPTY 收口', () => {
    const sample = createSample(4, 4, () => ({ r: 255, g: 255, b: 255, a: 0 }));

    expect(() => analyzeColorSample(sample)).toThrow(ChipsError);
    try {
      analyzeColorSample(sample);
    } catch (error) {
      expect((error as ChipsError).code).toBe(IMAGE_EMPTY);
      expect((error as ChipsError).message).toContain('可见像素');
    }
  });

  it('单色样本：只出一个簇，强调色由背景派生且与背景不同', () => {
    const result = analyzeColorSample(createSample(8, 8, () => ({ r: 30, g: 90, b: 160 })));

    expect(result.metadata.sample.clusterCount).toBe(1);
    expect(result.palette).toHaveLength(2);
    expect(result.backgroundColor).not.toBe(result.accentColor);
    expect(result.palette.map((entry) => entry.role)).toEqual(['background', 'accent']);
  });

  it('调色板上限 8 项、颜色文法与角色取值合法', () => {
    const fallbackColor = { r: 0, g: 0, b: 255 };
    const paletteColors = [
      { r: 12, g: 22, b: 40 },
      { r: 240, g: 200, b: 40 },
      { r: 200, g: 30, b: 90 },
      { r: 30, g: 210, b: 180 },
      { r: 130, g: 60, b: 220 },
      { r: 250, g: 120, b: 20 },
      { r: 20, g: 160, b: 60 },
      { r: 245, g: 245, b: 250 },
    ];
    const result = analyzeColorSample(
      createSample(
        8,
        8,
        (x, y) => paletteColors[(y * 8 + x) % paletteColors.length] ?? fallbackColor
      )
    );

    expect(result.palette.length).toBeGreaterThanOrEqual(2);
    expect(result.palette.length).toBeLessThanOrEqual(8);
    for (const entry of result.palette) {
      expect(entry.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(['background', 'accent', 'representative']).toContain(entry.role);
      expect(entry.population).toBeGreaterThanOrEqual(0);
      expect(entry.population).toBeLessThanOrEqual(1);
    }
  });

  it('元数据回填：解码端口给出的原图信息原样透出', () => {
    const info: IDecodedImageInfo = {
      width: 1_200,
      height: 800,
      format: 'jpeg',
      animated: false,
      pageCount: 1,
      hasAlpha: false,
      orientation: 6,
    };
    const result = analyzeColorSample(posterSample, { sampleSize: 96, info });

    expect(result.metadata.image).toEqual(info);
    expect(result.metadata.sample).toMatchObject({ width: 10, height: 10, sampleSize: 96 });
  });

  it('元数据缺省：无端口信息时按样本自身尺寸回填', () => {
    const result = analyzeColorSample(posterSample);

    expect(result.metadata.image).toMatchObject({
      width: 10,
      height: 10,
      animated: false,
      pageCount: 1,
      hasAlpha: true,
    });
    expect(result.metadata.image.format).toBeUndefined();
    expect(result.metadata.sample.sampleSize).toBe(10);
  });

  it('确定性：同一输入两次分析结果全等（无随机初始化）', () => {
    expect(analyzeColorSample(posterSample)).toEqual(analyzeColorSample(posterSample));
  });

  it('坏样本（尺寸与字节数不符）不产出结果', () => {
    expect(() =>
      analyzeColorSample({ width: 4, height: 4, pixels: new Uint8Array(4 * 3 * 4) })
    ).toThrow(ChipsError);
    try {
      analyzeColorSample({ width: 4, height: 4, pixels: new Uint8Array(4 * 3 * 4) });
    } catch (error) {
      expect([IMAGE_EMPTY, IMAGE_ANALYSIS_FAILED]).toContain((error as ChipsError).code);
    }
  });
});
