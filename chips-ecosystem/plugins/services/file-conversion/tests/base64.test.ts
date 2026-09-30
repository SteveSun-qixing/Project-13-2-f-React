/**
 * RFC 4648 base64 纯 TS 编解码测试：ASCII / UTF-8 / 全字节域 / 空串 /
 * 非 4 倍长 padding 与 RFC 向量对齐（路径世界 ↔ 字节世界桥接的编解码正确性）。
 */

import { describe, expect, it } from 'vitest';

import { decodeBase64, encodeBase64 } from '../src/base64.js';

const bytesOf = (values: readonly number[]): Uint8Array => Uint8Array.from(values);

describe('encodeBase64', () => {
  it('RFC 4648 向量（foobar 族）', () => {
    expect(encodeBase64(bytesOf([]))).toBe('');
    expect(encodeBase64(bytesOf([102]))).toBe('Zg==');
    expect(encodeBase64(bytesOf([102, 111]))).toBe('Zm8=');
    expect(encodeBase64(bytesOf([102, 111, 111]))).toBe('Zm9v');
    expect(encodeBase64(bytesOf([102, 111, 111, 98]))).toBe('Zm9vYg==');
    expect(encodeBase64(bytesOf([102, 111, 111, 98, 97]))).toBe('Zm9vYmE=');
    expect(encodeBase64(bytesOf([102, 111, 111, 98, 97, 114]))).toBe('Zm9vYmFy');
  });

  it('全字节域 0–255 往返一致', () => {
    const all = Uint8Array.from({ length: 256 }, (_, index) => index);
    expect(decodeBase64(encodeBase64(all))).toEqual(all);
  });
});

describe('decodeBase64', () => {
  it('标准向量与 padding 缺省容忍', () => {
    expect(decodeBase64('')).toEqual(bytesOf([]));
    expect(decodeBase64('Zg==')).toEqual(bytesOf([102]));
    expect(decodeBase64('Zm8=')).toEqual(bytesOf([102, 111]));
    expect(decodeBase64('Zm9v')).toEqual(bytesOf([102, 111, 111]));
  });

  it('中文 UTF-8 字节往返一致', () => {
    const encoded = encodeBase64(new TextEncoder().encode('薯片生态·文件转换'));
    const decoded = new TextDecoder().decode(decodeBase64(encoded));
    expect(decoded).toBe('薯片生态·文件转换');
  });

  it('非法字符与非法长度拒绝（不变量：宿主 file:read base64 恒为合法编码）', () => {
    expect(() => decodeBase64('Zm9*')).toThrowError(TypeError);
    expect(() => decodeBase64('Zm9vY')).toThrowError(TypeError);
    expect(() => decodeBase64('Zg=')).toThrowError(TypeError);
  });
});
