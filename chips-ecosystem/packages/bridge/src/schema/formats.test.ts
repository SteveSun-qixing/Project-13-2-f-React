import { describe, expect, it } from 'vitest';
import { checkFormat } from './formats.js';

describe('checkFormat（白名单强制语义）', () => {
  it('date-time 接受 RFC 3339 日期时间', () => {
    expect(checkFormat('date-time', '2026-09-19T12:00:00Z')).toBe(true);
    expect(checkFormat('date-time', '2026-09-19T12:00:00.123+08:00')).toBe(true);
    expect(checkFormat('date-time', '2026-09-19 12:00:00')).toBe(false);
    expect(checkFormat('date-time', '2026-13-40T00:00:00Z')).toBe(false);
    expect(checkFormat('date-time', 'not-a-date')).toBe(false);
  });

  it('uri 要求绝对 URI', () => {
    expect(checkFormat('uri', 'https://example.com/a')).toBe(true);
    expect(checkFormat('uri', 'chips-resource://card-1/a.png')).toBe(true);
    expect(checkFormat('uri', '/relative/path')).toBe(false);
    expect(checkFormat('uri', 'not a uri')).toBe(false);
  });

  it('chips-resource-uri 走资源 URI 解析', () => {
    expect(checkFormat('chips-resource-uri', 'chips-resource://card-1/a.png')).toBe(true);
    expect(checkFormat('chips-resource-uri', 'https://example.com/a.png')).toBe(true);
    expect(checkFormat('chips-resource-uri', 'chips-resource://card-1/../a.png')).toBe(false);
    expect(checkFormat('chips-resource-uri', 'file:///tmp/a.png')).toBe(false);
  });

  it('chips-credential 校验 `credential://<pluginId>/<name>` 引用', () => {
    expect(checkFormat('chips-credential', 'credential://chips.official.editor/token')).toBe(true);
    expect(checkFormat('chips-credential', 'credential://editor/my_secret-1')).toBe(true);
    expect(checkFormat('chips-credential', 'credential://editor/')).toBe(false);
    expect(checkFormat('chips-credential', 'https://example.com')).toBe(false);
  });

  it('未在白名单内的 format 不做强制校验', () => {
    expect(checkFormat('email', 'not-an-email')).toBe(true);
  });
});
