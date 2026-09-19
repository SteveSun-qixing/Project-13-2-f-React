import { describe, expect, it } from 'vitest';
import { canonicalizeJson, sha256Hex } from './digest.js';

describe('sha256Hex', () => {
  it('与标准测试向量一致', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('相同输入稳定、不同输入不同', () => {
    expect(sha256Hex('中文字符串')).toBe(sha256Hex('中文字符串'));
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
  });

  it('处理超过一个分块的长输入', () => {
    const long = 'a'.repeat(1000);
    expect(sha256Hex(long)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('canonicalizeJson', () => {
  it('对象键按字典序稳定序列化', () => {
    expect(canonicalizeJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('支持数组、标量、null 与 undefined', () => {
    expect(canonicalizeJson([1, 'x', null, true])).toBe('[1,"x",null,true]');
    expect(canonicalizeJson(undefined)).toBe('undefined');
    expect(canonicalizeJson(null)).toBe('null');
    expect(canonicalizeJson(1.5)).toBe('1.5');
    expect(canonicalizeJson('a"b')).toBe('"a\\"b"');
  });

  it('嵌套结构与对象数组顺序稳定', () => {
    expect(canonicalizeJson({ list: [{ z: 1, a: 2 }] })).toBe('{"list":[{"a":2,"z":1}]}');
  });
});
