/**
 * 输入归一断言：入口 HTML、资源表路径文法、字节上限（8 MiB / 32 MiB）、
 * 排版度量块形状与去重；错误统一 CONVERTER_INPUT_UNSUPPORTED 且
 * details.field / details.reason 逐字锁定。
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_ASSET_PATH_LENGTH,
  MAX_HTML_BYTES,
  MAX_INLINE_INPUT_BYTES,
} from '../src/descriptor.js';
import { isChipsErrorLike } from '../src/errors.js';
import { isValidAssetPath, normalizeBlocks, normalizeHtmlToPdfInput, utf8ByteLength } from '../src/normalize.js';

const bytes = (length: number): Uint8Array => new Uint8Array(length);

function captureReason(run: () => unknown): { code: string; details?: Record<string, unknown>; message: string } {
  try {
    run();
  } catch (error) {
    expect(isChipsErrorLike(error)).toBe(true);
    const chipsError = error as { code: string; details?: Record<string, unknown>; message: string };
    expect(chipsError.code).toBe('CONVERTER_INPUT_UNSUPPORTED');
    return chipsError;
  }
  expect.unreachable('应当抛出');
}

describe('isValidAssetPath', () => {
  it('接受合法相对路径（多级、正斜杠）', () => {
    expect(isValidAssetPath('style.css')).toBe(true);
    expect(isValidAssetPath('assets/img/logo.png')).toBe(true);
    expect(isValidAssetPath('a/b/c.d')).toBe(true);
  });

  it('拒绝空路径、绝对路径、反斜杠与点段', () => {
    expect(isValidAssetPath('')).toBe(false);
    expect(isValidAssetPath('/abs.png')).toBe(false);
    expect(isValidAssetPath('C:\\tmp\\a.png')).toBe(false);
    expect(isValidAssetPath('a\\b.png')).toBe(false);
    expect(isValidAssetPath('..')).toBe(false);
    expect(isValidAssetPath('.')).toBe(false);
    expect(isValidAssetPath('../secret')).toBe(false);
    expect(isValidAssetPath('a/../b.png')).toBe(false);
    expect(isValidAssetPath('./a.png')).toBe(false);
    expect(isValidAssetPath('a//b.png')).toBe(false);
    expect(isValidAssetPath('a/')).toBe(false);
  });

  it('路径长度边界 256', () => {
    expect(MAX_ASSET_PATH_LENGTH).toBe(256);
    expect(isValidAssetPath('a'.repeat(MAX_ASSET_PATH_LENGTH))).toBe(true);
    expect(isValidAssetPath(`a/${'b'.repeat(MAX_ASSET_PATH_LENGTH - 2)}`)).toBe(true);
    expect(isValidAssetPath('a'.repeat(MAX_ASSET_PATH_LENGTH + 1))).toBe(false);
  });
});

describe('utf8ByteLength', () => {
  it('按 UTF-8 编码计长', () => {
    expect(utf8ByteLength('')).toBe(0);
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('薯片')).toBe(6);
  });
});

describe('normalizeBlocks', () => {
  it('缺省与空数组归一为空清单', () => {
    expect(normalizeBlocks(undefined)).toEqual([]);
    expect(normalizeBlocks([])).toEqual([]);
  });

  it('合法块如实保留，keepTogether=false 不产出键', () => {
    expect(normalizeBlocks([{ id: 'a', heightPx: 100 }])).toEqual([{ id: 'a', heightPx: 100 }]);
    expect(normalizeBlocks([{ id: 'a', heightPx: 12.5, keepTogether: false }])).toEqual([
      { id: 'a', heightPx: 12.5 },
    ]);
    expect(normalizeBlocks([{ id: 'a', heightPx: 12.5, keepTogether: true }])).toEqual([
      { id: 'a', heightPx: 12.5, keepTogether: true },
    ]);
  });

  it('非数组清单按 CONVERTER_INPUT_UNSUPPORTED 拒绝', () => {
    for (const raw of ['blocks', 42, {}, null]) {
      const error = captureReason(() => normalizeBlocks(raw));
      expect(error.details).toEqual({ field: 'blocks' });
      expect(error.message).toBe('blocks 必须是数组。');
    }
  });

  it('块项非对象拒绝', () => {
    const error = captureReason(() => normalizeBlocks([42]));
    expect(error.details).toEqual({ field: 'blocks' });
    expect(error.message).toBe('排版度量块必须是对象。');
  });

  it('块 id 必须是长度 1~256 的字符串', () => {
    expect(normalizeBlocks([{ id: 'x'.repeat(256), heightPx: 1 }])).toHaveLength(1);
    for (const id of ['', 'x'.repeat(257), 42]) {
      const error = captureReason(() => normalizeBlocks([{ id, heightPx: 1 }]));
      expect(error.details).toEqual({ field: 'blocks' });
      expect(error.message).toBe('排版度量块 id 必须是长度 1~256 的字符串。');
    }
  });

  it('块 heightPx 必须是正有限数（BLOCK_HEIGHT_INVALID 携带 blockId）', () => {
    for (const heightPx of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '100', null]) {
      const error = captureReason(() => normalizeBlocks([{ id: 'blk', heightPx }]));
      expect(error.details).toEqual({
        field: 'blocks',
        reason: 'BLOCK_HEIGHT_INVALID',
        blockId: 'blk',
      });
    }
  });

  it('块 id 重复拒绝（BLOCK_ID_DUPLICATED）', () => {
    const error = captureReason(() =>
      normalizeBlocks([
        { id: 'dup', heightPx: 10 },
        { id: 'dup', heightPx: 20 },
      ])
    );
    expect(error.details).toEqual({ field: 'blocks', reason: 'BLOCK_ID_DUPLICATED', blockId: 'dup' });
  });

  it('keepTogether 非布尔拒绝（BLOCK_KEEP_TOGETHER_INVALID）', () => {
    const error = captureReason(() => normalizeBlocks([{ id: 'blk', heightPx: 5, keepTogether: 'yes' }]));
    expect(error.details).toEqual({
      field: 'blocks',
      reason: 'BLOCK_KEEP_TOGETHER_INVALID',
      blockId: 'blk',
    });
  });
});

describe('normalizeHtmlToPdfInput', () => {
  it('最小输入：html 必填，assets 与 blocks 缺省为空', () => {
    const normalized = normalizeHtmlToPdfInput({ html: '<html></html>' });
    expect(normalized.html).toBe('<html></html>');
    expect(normalized.assets).toEqual({});
    expect(normalized.blocks).toEqual([]);
  });

  it('归一结果恰好三个键，输入未知键不进入归一结果', () => {
    const normalized = normalizeHtmlToPdfInput({ html: '<p></p>', extra: 1 });
    expect(Object.keys(normalized)).toEqual(['html', 'assets', 'blocks']);
  });

  it('带资源与度量块的输入如实归一', () => {
    const normalized = normalizeHtmlToPdfInput({
      html: '<p></p>',
      assets: { 'assets/logo.png': bytes(4), 'style.css': bytes(2) },
      blocks: [{ id: 'a', heightPx: 50 }],
    });
    expect(Object.keys(normalized.assets)).toEqual(['assets/logo.png', 'style.css']);
    expect(normalized.blocks).toEqual([{ id: 'a', heightPx: 50 }]);
  });

  it('非对象输入拒绝（field=input）', () => {
    for (const raw of [null, 'html', 42, []]) {
      const error = captureReason(() => normalizeHtmlToPdfInput(raw));
      expect(error.details).toEqual({ field: 'input' });
      expect(error.message).toBe('转换输入必须是对象。');
    }
  });

  it('html 必须是非空字符串（field=html）', () => {
    for (const html of [undefined, '', 42, null]) {
      const error = captureReason(() => normalizeHtmlToPdfInput({ html }));
      expect(error.details).toEqual({ field: 'html' });
      expect(error.message).toBe('入口 HTML 文本必须是非空字符串。');
    }
  });

  it('HTML 上限 8 MiB：恰等于上限可用，超一字节按 UTF-8 字节拒绝', () => {
    expect(MAX_HTML_BYTES).toBe(8 * 1024 * 1024);
    const boundary = normalizeHtmlToPdfInput({ html: 'a'.repeat(MAX_HTML_BYTES) });
    expect(boundary.html).toHaveLength(MAX_HTML_BYTES);
    const error = captureReason(() =>
      normalizeHtmlToPdfInput({ html: `${'a'.repeat(MAX_HTML_BYTES - 2)}薯` })
    );
    expect(error.details).toEqual({
      field: 'html',
      reason: 'HTML_TOO_LARGE',
      bytes: MAX_HTML_BYTES + 1,
      limit: MAX_HTML_BYTES,
    });
  });

  it('资源表非对象拒绝（field=assets）', () => {
    for (const assets of ['x', 42, []]) {
      const error = captureReason(() => normalizeHtmlToPdfInput({ html: '<p></p>', assets }));
      expect(error.details).toEqual({ field: 'assets' });
    }
  });

  it('非法资源路径拒绝（ASSET_PATH_INVALID 携带 path）', () => {
    const error = captureReason(() =>
      normalizeHtmlToPdfInput({ html: '<p></p>', assets: { '../x': bytes(1) } })
    );
    expect(error.details).toEqual({ field: 'assets', reason: 'ASSET_PATH_INVALID', path: '../x' });
    expect(error.message).toContain('相对路径');
  });

  it('非 Uint8Array 资源字节拒绝（ASSET_BYTES_INVALID）', () => {
    for (const value of ['raw', 42, null, new ArrayBuffer(4)]) {
      const error = captureReason(() =>
        normalizeHtmlToPdfInput({ html: '<p></p>', assets: { 'a.bin': value as never } })
      );
      expect(error.details).toEqual({ field: 'assets', reason: 'ASSET_BYTES_INVALID', path: 'a.bin' });
    }
  });

  it('输入合计上限 32 MiB：恰等于上限可用，超出按 INPUT_TOO_LARGE 拒绝', () => {
    expect(MAX_INLINE_INPUT_BYTES).toBe(32 * 1024 * 1024);
    const boundary = normalizeHtmlToPdfInput({
      html: 'a'.repeat(MAX_HTML_BYTES),
      assets: { 'blob.bin': bytes(MAX_INLINE_INPUT_BYTES - MAX_HTML_BYTES) },
    });
    expect(boundary.assets['blob.bin']).toHaveLength(MAX_INLINE_INPUT_BYTES - MAX_HTML_BYTES);

    const html = 'a'.repeat(1024);
    const assets = Object.fromEntries(
      Array.from({ length: 33 }, (_, index) => [`a${index}.bin`, bytes(1024 * 1024)])
    );
    const error = captureReason(() => normalizeHtmlToPdfInput({ html, assets }));
    expect(error.details).toEqual({
      field: 'input',
      reason: 'INPUT_TOO_LARGE',
      bytes: html.length + 33 * 1024 * 1024,
      limit: MAX_INLINE_INPUT_BYTES,
    });
  });
});
