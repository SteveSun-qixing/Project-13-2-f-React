import { describe, expect, it } from 'vitest';

import { isValidAssetPath, normalizeHtmlToImageInput, utf8ByteLength } from '../src/normalize.js';
import { isChipsErrorLike } from '../src/errors.js';
import { MAX_INLINE_INPUT_BYTES } from '../src/descriptor.js';

const bytes = (length: number): Uint8Array => new Uint8Array(length);

describe('isValidAssetPath', () => {
  it('接受合法相对路径', () => {
    expect(isValidAssetPath('style.css')).toBe(true);
    expect(isValidAssetPath('assets/img/logo.png')).toBe(true);
    expect(isValidAssetPath('a/b/c.d')).toBe(true);
  });

  it('拒绝绝对路径、反斜杠与点段', () => {
    expect(isValidAssetPath('/etc/passwd')).toBe(false);
    expect(isValidAssetPath('C:\\tmp\\a.png')).toBe(false);
    expect(isValidAssetPath('a\\b.png')).toBe(false);
    expect(isValidAssetPath('../secret')).toBe(false);
    expect(isValidAssetPath('a/../b.png')).toBe(false);
    expect(isValidAssetPath('./a.png')).toBe(false);
    expect(isValidAssetPath('')).toBe(false);
  });

  it('拒绝超长路径', () => {
    expect(isValidAssetPath('a'.repeat(257))).toBe(false);
    expect(isValidAssetPath('a'.repeat(256))).toBe(true);
  });
});

describe('utf8ByteLength', () => {
  it('按 UTF-8 编码计长', () => {
    expect(utf8ByteLength('')).toBe(0);
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('薯片')).toBe(6);
  });
});

describe('normalizeHtmlToImageInput', () => {
  it('接受最小输入', () => {
    const normalized = normalizeHtmlToImageInput({ html: '<html></html>' });
    expect(normalized.html).toBe('<html></html>');
    expect(Object.keys(normalized.assets)).toHaveLength(0);
  });

  it('接受带资源的输入并归一资源表', () => {
    const normalized = normalizeHtmlToImageInput({
      html: '<html></html>',
      assets: { 'assets/logo.png': bytes(4), 'style.css': bytes(2) },
    });
    expect(Object.keys(normalized.assets)).toEqual(['assets/logo.png', 'style.css']);
  });

  it('接受输入携带的主题底色', () => {
    const normalized = normalizeHtmlToImageInput({ html: '<p></p>', themeBackground: '#abcdef' });
    expect(normalized.themeBackground).toBe('#abcdef');
  });

  it('拒绝非对象与缺失 HTML', () => {
    expect(() => normalizeHtmlToImageInput(null)).toThrowError();
    expect(() => normalizeHtmlToImageInput('html')).toThrowError();
    expect(() => normalizeHtmlToImageInput({})).toThrowError();
    expect(() => normalizeHtmlToImageInput({ html: '' })).toThrowError();
    expect(() => normalizeHtmlToImageInput({ html: 42 })).toThrowError();
  });

  it('拒绝非法资源路径', () => {
    try {
      normalizeHtmlToImageInput({ html: '<p></p>', assets: { '../x': bytes(1) } });
      expect.unreachable('应当抛出');
    } catch (error) {
      expect(isChipsErrorLike(error)).toBe(true);
      expect((error as { code: string }).code).toBe('CONVERTER_INPUT_UNSUPPORTED');
      expect((error as { details?: { reason?: string } }).details?.reason).toBe(
        'ASSET_PATH_INVALID'
      );
    }
  });

  it('拒绝非 Uint8Array 资源字节', () => {
    try {
      normalizeHtmlToImageInput({ html: '<p></p>', assets: { 'a.png': 'raw' } });
      expect.unreachable('应当抛出');
    } catch (error) {
      expect((error as { details?: { reason?: string } }).details?.reason).toBe(
        'ASSET_BYTES_INVALID'
      );
    }
  });

  it('拒绝超长 HTML', () => {
    const big = 'a'.repeat(8 * 1024 * 1024 + 1);
    try {
      normalizeHtmlToImageInput({ html: big });
      expect.unreachable('应当抛出');
    } catch (error) {
      expect((error as { details?: { reason?: string } }).details?.reason).toBe('HTML_TOO_LARGE');
    }
  });

  it('拒绝合计超限的输入', () => {
    const html = 'a'.repeat(1024);
    const assets = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [`a${index}.bin`, bytes(1024 * 1024)])
    );
    expect(html.length + 40 * 1024 * 1024).toBeGreaterThan(MAX_INLINE_INPUT_BYTES);
    try {
      normalizeHtmlToImageInput({ html, assets });
      expect.unreachable('应当抛出');
    } catch (error) {
      expect((error as { code: string }).code).toBe('CONVERTER_INPUT_UNSUPPORTED');
      expect((error as { details?: { reason?: string } }).details?.reason).toBe(
        'INPUT_TOO_LARGE'
      );
    }
  });

  it('拒绝非法主题底色', () => {
    expect(() => normalizeHtmlToImageInput({ html: '<p></p>', themeBackground: 'blue' })).toThrowError();
  });
});
