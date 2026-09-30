/**
 * 输入字节归一与缓存键断言：二进制唯一承载面（禁内联 base64、禁 Buffer JSON）。
 */

import { ChipsError } from '@chips/sdk';
import { describe, expect, it } from 'vitest';

import { errorDetails } from './support/error-shape.js';
import { buildCacheKey, normalizeImageBytes, toOwnedBytes } from '../src/bytes.js';
import { IMAGE_INPUT_UNSUPPORTED } from '../src/errors.js';
import type { IPickColorsInput } from '../src/types.js';

const pickCode = (run: () => unknown): ChipsError => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ChipsError);
    return error as ChipsError;
  }
  throw new Error('预期抛出 ChipsError，实际未抛出。');
};

describe('toOwnedBytes / normalizeImageBytes', () => {
  it('ArrayBuffer 输入产出独立副本', () => {
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const owned = toOwnedBytes(buffer);
    new Uint8Array(buffer)[0] = 99;

    expect(Array.from(owned)).toEqual([1, 2, 3, 4]);
  });

  it('TypedArray 视图输入按 byteOffset/byteLength 截取副本', () => {
    const source = new Uint8Array([9, 8, 7, 6, 5]);
    const view = source.subarray(1, 4);
    const owned = normalizeImageBytes(view);
    source[1] = 0;

    expect(Array.from(owned)).toEqual([8, 7, 6]);
  });

  it('DataView 输入被接受', () => {
    const view = new DataView(new Uint8Array([10, 20, 30]).buffer);
    expect(Array.from(normalizeImageBytes(view))).toEqual([10, 20, 30]);
  });

  it('零长度输入以 IMAGE_INPUT_UNSUPPORTED 收口', () => {
    const error = pickCode(() => normalizeImageBytes(new Uint8Array(0)));
    expect(error.code).toBe(IMAGE_INPUT_UNSUPPORTED);
    expect(errorDetails(error).reason).toBe('EMPTY_INPUT');
  });

  it('base64 字符串输入被拒绝（§8.3 约束 5：禁内联 base64 兜底）', () => {
    const error = pickCode(() => normalizeImageBytes('iVBORw0KGgo='));
    expect(error.code).toBe(IMAGE_INPUT_UNSUPPORTED);
    expect(errorDetails(error).reason).toBe('NOT_BINARY');
  });

  it('数字数组与 Buffer JSON 输入被拒绝（旧解码臂按契约下线）', () => {
    expect(pickCode(() => normalizeImageBytes([1, 2, 3])).code).toBe(IMAGE_INPUT_UNSUPPORTED);
    expect(pickCode(() => normalizeImageBytes({ type: 'Buffer', data: [1, 2, 3] })).code).toBe(
      IMAGE_INPUT_UNSUPPORTED
    );
    expect(pickCode(() => normalizeImageBytes(undefined)).code).toBe(IMAGE_INPUT_UNSUPPORTED);
  });
});

describe('buildCacheKey', () => {
  const input = (overrides: Partial<IPickColorsInput>): IPickColorsInput => ({
    image: new Uint8Array(12),
    ...overrides,
  });

  it('给出来源标识时键含标识、采样边长与字节长度', () => {
    const key = buildCacheKey(input({ sourceKey: 'chips-resource://box/a.png@3' }), 96);
    expect(key).toBe('chips-resource://box/a.png@3::96::12');
  });

  it('缺来源标识时不参与缓存', () => {
    expect(buildCacheKey(input({}), 96)).toBeUndefined();
    expect(buildCacheKey(input({ sourceKey: '   ' }), 96)).toBeUndefined();
  });
});
