import { describe, expect, it } from 'vitest';

import { isHexColor, MAX_INLINE_INPUT_BYTES, htmlToImageCapabilityDescriptor } from '../src/descriptor.js';
import { outputPixelWidth, resolveRasterGeometry } from '../src/geometry.js';

const baseOptions = {
  format: 'png' as const,
  width: 794,
  height: null,
  scaleFactor: 2,
  background: 'theme' as const,
  themeBackground: '#112233',
};

const baseInput = { html: '<p></p>', assets: {} };

/** 剔除 themeBackground 属性：表达「归一选项不携带主题底色」的形状（exactOptionalPropertyTypes 下属性缺席与显式 undefined 不同型）。 */
function withoutThemeBackground(
  options: typeof baseOptions
): Omit<typeof baseOptions, 'themeBackground'> {
  return {
    format: options.format,
    width: options.width,
    height: options.height,
    scaleFactor: options.scaleFactor,
    background: options.background,
  };
}

describe('描述符', () => {
  it('与登记契约一致', () => {
    expect(htmlToImageCapabilityDescriptor.id).toBe('content-converter.html-to-image');
    expect(htmlToImageCapabilityDescriptor.service).toBe('content-html-to-image');
    expect(htmlToImageCapabilityDescriptor.provider).toBe('chips.service.htmltoimage');
    expect(htmlToImageCapabilityDescriptor.operations).toEqual(['htmlToImage']);
    expect(htmlToImageCapabilityDescriptor.sourceFormats).toEqual(['html-directory']);
    expect(htmlToImageCapabilityDescriptor.targetFormats).toEqual(['png', 'jpeg', 'webp']);
    expect(htmlToImageCapabilityDescriptor.streaming).toEqual({ input: false, output: false });
    expect(htmlToImageCapabilityDescriptor.maxInlineInputBytes).toBe(MAX_INLINE_INPUT_BYTES);
    expect(htmlToImageCapabilityDescriptor.contractPackage).toBe(
      'chips.service.htmltoimage/contracts'
    );
  });
});

describe('isHexColor', () => {
  it('接受合法十六进制颜色', () => {
    expect(isHexColor('#fff')).toBe(true);
    expect(isHexColor('#ffff')).toBe(true);
    expect(isHexColor('#ffffff')).toBe(true);
    expect(isHexColor('#ffffffff')).toBe(true);
    expect(isHexColor('#AbCdEf')).toBe(true);
  });

  it('拒绝非法颜色', () => {
    expect(isHexColor('white')).toBe(false);
    expect(isHexColor('#12345')).toBe(false);
    expect(isHexColor('123456')).toBe(false);
    expect(isHexColor('')).toBe(false);
  });
});

describe('outputPixelWidth', () => {
  it('按缩放系数换算并取整', () => {
    expect(outputPixelWidth(794, 1)).toBe(794);
    expect(outputPixelWidth(794, 2)).toBe(1588);
    expect(outputPixelWidth(793, 2)).toBe(1586);
  });
});

describe('resolveRasterGeometry', () => {
  it('theme 背景优先使用选项底色', () => {
    const { geometry, warnings } = resolveRasterGeometry(baseOptions, baseInput);
    expect(geometry.viewport).toEqual({ width: 794, height: null });
    expect(geometry.scaleFactor).toBe(2);
    expect(geometry.background).toBe('#112233');
    expect(warnings).toEqual([]);
  });

  it('选项缺底色时回退输入携带的主题底色', () => {
    const { geometry, warnings } = resolveRasterGeometry(
      withoutThemeBackground(baseOptions),
      { html: '<p></p>', assets: {}, themeBackground: '#445566' }
    );
    expect(geometry.background).toBe('#445566');
    expect(warnings).toEqual([]);
  });

  it('主题底色整体缺失时回退白色并警告', () => {
    const { geometry, warnings } = resolveRasterGeometry(
      withoutThemeBackground(baseOptions),
      baseInput
    );
    expect(geometry.background).toBe('#ffffff');
    expect(warnings.map((item) => item.code)).toEqual(['THEME_BACKGROUND_MISSING']);
  });

  it('white 与 transparent 解析', () => {
    expect(resolveRasterGeometry({ ...baseOptions, background: 'white' }, baseInput).geometry.background).toBe(
      '#ffffff'
    );
    expect(
      resolveRasterGeometry({ ...baseOptions, background: 'transparent' }, baseInput).geometry
        .background
    ).toBe('transparent');
  });

  it('固定高视口原样传递', () => {
    const { geometry } = resolveRasterGeometry({ ...baseOptions, height: 1123 }, baseInput);
    expect(geometry.viewport).toEqual({ width: 794, height: 1123 });
  });
});
