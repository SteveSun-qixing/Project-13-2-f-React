import { describe, expect, it } from 'vitest';
import { FORMAT_MIME_TYPES, resolveBaseName, resolveIcnsType } from '../../src/domain/generator';
import { inferMimeType, inferFileName } from '../../src/export/source-image';
import { isSupportedIconSource } from '../../src/domain/image-loader';
import { EMOJI_FONT_SOURCE, MATERIAL_SYMBOLS_FONT_SOURCE } from '../../src/domain/default-fonts';
import {
  DEFAULT_ICON_SETTINGS,
  type RenderIconOptions,
  type SourceIconImage,
} from '../../src/domain/types';

function createOptions(partial: Partial<RenderIconOptions>): RenderIconOptions {
  return {
    size: 256,
    settings: DEFAULT_ICON_SETTINGS,
    sourceMode: 'font',
    imageSource: null,
    fontSource: MATERIAL_SYMBOLS_FONT_SOURCE,
    selectedGlyph: null,
    ...partial,
  };
}

function createImageSource(baseName: string): SourceIconImage {
  return {
    id: 'demo',
    fileName: `${baseName}.png`,
    baseName,
    objectUrl: 'blob:demo',
    width: 64,
    height: 64,
    file: new File([new Uint8Array(1)], `${baseName}.png`, { type: 'image/png' }),
  };
}

describe('生成命名与格式决策（真实输入输出）', () => {
  it('图片模式使用源图安全基名', () => {
    const options = createOptions({ sourceMode: 'image', imageSource: createImageSource('App-Icon-2') });
    expect(resolveBaseName(options)).toBe('App-Icon-2');
  });

  it('字体模式以字形标签清洗出基名，空标签回落 icon', () => {
    expect(
      resolveBaseName(
        createOptions({ sourceMode: 'font', selectedGlyph: { id: 'g', label: 'Star Rise!', display: '★' } }),
      ),
    ).toBe('starrise');
    expect(
      resolveBaseName(
        createOptions({ sourceMode: 'font', selectedGlyph: { id: 'g', label: 'U+E88A', display: '' } }),
      ),
    ).toBe('ue88a');
    expect(resolveBaseName(createOptions({ sourceMode: 'font', selectedGlyph: { id: 'g', label: '家', display: '家' } }))).toBe(
      'icon',
    );
  });

  it('ICNS 类型按尺寸阶梯映射', () => {
    expect(resolveIcnsType(16)).toBe('ic04');
    expect(resolveIcnsType(32)).toBe('ic05');
    expect(resolveIcnsType(64)).toBe('ic12');
    expect(resolveIcnsType(128)).toBe('ic07');
    expect(resolveIcnsType(256)).toBe('ic08');
    expect(resolveIcnsType(512)).toBe('ic09');
    expect(resolveIcnsType(1024)).toBe('ic09');
  });

  it('输出格式 MIME 映射固定', () => {
    expect(FORMAT_MIME_TYPES).toEqual({
      png: 'image/png',
      ico: 'image/x-icon',
      icns: 'image/icns',
    });
  });
});

describe('来源图支持判定与路径推断', () => {
  it('按 MIME 或扩展名放行支持的图片来源', () => {
    expect(isSupportedIconSource(new File([new Uint8Array(1)], 'a.png', { type: 'image/png' }))).toBe(true);
    expect(isSupportedIconSource(new File([new Uint8Array(1)], 'a.svg', { type: '' }))).toBe(true);
    expect(isSupportedIconSource(new File([new Uint8Array(1)], 'a.JPG', { type: '' }))).toBe(true);
    expect(isSupportedIconSource(new File([new Uint8Array(1)], 'a.exe', { type: 'application/octet-stream' }))).toBe(false);
  });

  it('字体源不是图片来源', () => {
    expect(isSupportedIconSource(new File([new Uint8Array(1)], 'font.woff2', { type: 'font/woff2' }))).toBe(false);
  });

  it('路径 MIME 推断与文件名截取', () => {
    expect(inferMimeType('~/图片/demo.PNG')).toBe('image/png');
    expect(inferMimeType('/tmp/a.jpeg')).toBe('image/jpeg');
    expect(inferMimeType('/tmp/a.webp')).toBe('image/webp');
    expect(inferMimeType('/tmp/a.gif')).toBe('image/gif');
    expect(inferMimeType('/tmp/a.svg')).toBe('image/svg+xml');
    expect(inferMimeType('/tmp/a.bin')).toBe('application/octet-stream');
    expect(inferFileName('/Users/demo/图片/图标.png')).toBe('图标.png');
    expect(inferFileName('C:\\Users\\demo\\a.png')).toBe('a.png');
    expect(inferFileName('///')).toBe('icon');
  });

  it('Emoji 字体源可作为无字形命令上下文（CLI 场景族名固定）', () => {
    expect(EMOJI_FONT_SOURCE.family).toContain('Apple Color Emoji');
    expect(EMOJI_FONT_SOURCE.kind).toBe('emoji');
  });
});
