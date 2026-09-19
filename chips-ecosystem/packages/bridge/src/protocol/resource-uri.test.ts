import { describe, expect, it } from 'vitest';
import { RESOURCE_ERROR_CODES } from './resource.js';
import {
  isReservedResourceScope,
  normalizeHttpReference,
  normalizeResourceInput,
  parseResourceUri,
} from './resource-uri.js';

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    expect.unreachable('应当抛出 ChipsError');
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

describe('parseResourceUri', () => {
  it('解析受管作用域并归一 authority 为小写、路径解码一次', () => {
    expect(parseResourceUri('chips-resource://card-7f3a/images/photo.jpg')).toEqual({
      uri: 'chips-resource://card-7f3a/images/photo.jpg',
      authority: 'card-7f3a',
      category: 'document',
      path: 'images/photo.jpg',
    });
    expect(parseResourceUri('chips-resource://PLATFORM/frame.html')).toMatchObject({
      uri: 'chips-resource://platform/frame.html',
      category: 'platform',
    });
    expect(parseResourceUri('chips-resource://plugin-001/%E5%9B%BE%E7%89%87.png')).toMatchObject({
      authority: 'plugin-001',
      category: 'plugin',
      path: '图片.png',
      uri: 'chips-resource://plugin-001/%E5%9B%BE%E7%89%87.png',
    });
    expect(parseResourceUri('chips-resource://plugin-001/%e5%9b%be%e7%89%87.png').uri).toBe(
      'chips-resource://plugin-001/%E5%9B%BE%E7%89%87.png'
    );
    expect(parseResourceUri('chips-resource://temp-9/a.bin')).toMatchObject({
      category: 'temporary',
    });
    expect(parseResourceUri('chips-resource://memory/a.bin')).toMatchObject({ category: 'memory' });
    expect(parseResourceUri('chips-resource://workspace-2/notes/a.txt')).toMatchObject({
      category: 'workspace',
      path: 'notes/a.txt',
    });
    expect(parseResourceUri('chips-resource://platform/')).toMatchObject({ path: '' });
    expect(parseResourceUri('chips-resource://card-1/a%20b.png')).toMatchObject({
      path: 'a b.png',
      uri: 'chips-resource://card-1/a%20b.png',
    });
  });

  it('解析 external 作用域并归一 origin（默认端口省略、主机小写）', () => {
    const parsed = parseResourceUri(
      'chips-resource://external/https/EXAMPLE.com:443/images/a.png?v=1'
    );
    expect(parsed.category).toBe('external');
    expect(parsed.external).toEqual({ scheme: 'https', host: 'example.com' });
    expect(parsed.uri).toBe('chips-resource://external/https/example.com/images/a.png?v=1');
  });

  it('拒绝空 URI、超长与 fragment', () => {
    expectCode(() => parseResourceUri(''), RESOURCE_ERROR_CODES.invalidUri);
    expectCode(
      () => parseResourceUri('chips-resource://card-1/a', { maxUriLength: 5 }),
      RESOURCE_ERROR_CODES.invalidUri
    );
    expectCode(
      () => parseResourceUri('chips-resource://card-1/a#top'),
      RESOURCE_ERROR_CODES.invalidUri
    );
  });

  it('拒绝非 ASCII、非法百分号编码与未编码空格', () => {
    expectCode(
      () => parseResourceUri('chips-resource://card-1/图片.png'),
      RESOURCE_ERROR_CODES.invalidUri
    );
    expectCode(
      () => parseResourceUri('chips-resource://card-1/%ZZ'),
      RESOURCE_ERROR_CODES.invalidUri
    );
    expectCode(
      () => parseResourceUri('chips-resource://card-1/a b.png'),
      RESOURCE_ERROR_CODES.pathInvalid
    );
  });

  it('拒绝非 chips-resource scheme（含 file:// 与 webdav://）', () => {
    expectCode(() => parseResourceUri('file:///tmp/a.png'), RESOURCE_ERROR_CODES.unsupportedScheme);
    expectCode(
      () => parseResourceUri('webdav://dav.example.com/a.card'),
      RESOURCE_ERROR_CODES.unsupportedScheme
    );
  });

  it('作用域非法时拒绝（首字符非字母、超长、含非法字符）', () => {
    expectCode(() => parseResourceUri('chips-resource://card-1'), RESOURCE_ERROR_CODES.invalidUri);
    expectCode(() => parseResourceUri('chips-resource://1card/a'), RESOURCE_ERROR_CODES.invalidUri);
    expectCode(() => parseResourceUri('chips-resource://ca_rd/a'), RESOURCE_ERROR_CODES.invalidUri);
    expectCode(
      () => parseResourceUri(`chips-resource://${'a'.repeat(65)}/x`),
      RESOURCE_ERROR_CODES.invalidUri
    );
  });

  it('受管作用域拒绝查询串，external 保留查询串', () => {
    expectCode(
      () => parseResourceUri('chips-resource://card-1/a.png?x=1'),
      RESOURCE_ERROR_CODES.invalidUri
    );
    expect(parseResourceUri('chips-resource://external/https/example.com/a?x=1').uri).toBe(
      'chips-resource://external/https/example.com/a?x=1'
    );
  });

  it('路径拒绝穿越（含解码后）、绝对路径、盘符、反斜杠、空段、控制字符', () => {
    const cases = [
      'chips-resource://card-1/images/../.card/meta.yaml',
      'chips-resource://card-1/%2e%2e/meta.yaml',
      'chips-resource://card-1//a.png',
      'chips-resource://card-1/./a.png',
      'chips-resource://card-1/images\\photo.jpg',
      'chips-resource://card-1/C:/a.png',
    ];
    for (const uri of cases) {
      expectCode(() => parseResourceUri(uri), RESOURCE_ERROR_CODES.pathInvalid);
    }
  });

  it('二次编码的穿越串按字面名处理（只解码一次）', () => {
    expect(parseResourceUri('chips-resource://card-1/%252e%252e/x').path).toBe('%2e%2e/x');
  });

  it('拒绝尾随点/空格、设备名与段内冒号', () => {
    expectCode(
      () => parseResourceUri('chips-resource://card-1/a.png.'),
      RESOURCE_ERROR_CODES.pathInvalid
    );
    expectCode(
      () => parseResourceUri('chips-resource://card-1/con'),
      RESOURCE_ERROR_CODES.pathInvalid
    );
    expectCode(
      () => parseResourceUri('chips-resource://card-1/aux.txt'),
      RESOURCE_ERROR_CODES.pathInvalid
    );
    expectCode(
      () => parseResourceUri('chips-resource://card-1/a:b'),
      RESOURCE_ERROR_CODES.pathInvalid
    );
  });

  it('external 缺少 origin 或携带 userinfo 时拒绝', () => {
    expectCode(
      () => parseResourceUri('chips-resource://external/https/example.com'),
      RESOURCE_ERROR_CODES.invalidUri
    );
    expectCode(
      () => parseResourceUri('chips-resource://external/https/user:pass@example.com/a'),
      RESOURCE_ERROR_CODES.invalidUri
    );
  });

  it('段长度与 URI 长度可配置', () => {
    expectCode(
      () => parseResourceUri('chips-resource://card-1/abcdef', { maxSegmentLength: 3 }),
      RESOURCE_ERROR_CODES.invalidUri
    );
  });
});

describe('normalizeHttpReference', () => {
  it('裸 http(s):// 归一为 external 形式并保留查询串', () => {
    expect(normalizeHttpReference('https://example.com/a/b.png?x=1')).toBe(
      'chips-resource://external/https/example.com/a/b.png?x=1'
    );
    expect(normalizeHttpReference('http://example.com:8080')).toBe(
      'chips-resource://external/http/example.com:8080/'
    );
    expect(normalizeHttpReference('https://example.com?x=1')).toBe(
      'chips-resource://external/https/example.com/?x=1'
    );
  });

  it('拒绝 userinfo', () => {
    expectCode(
      () => normalizeHttpReference('https://user:pass@example.com/a'),
      RESOURCE_ERROR_CODES.invalidUri
    );
  });

  it('IPv6 主机以方括号编码进 authority 段', () => {
    const normalized = normalizeHttpReference('http://[::1]:8080/a.png');
    expect(normalized).toBe('chips-resource://external/http/%5B::1%5D:8080/a.png');
    expect(normalizeResourceInput('http://[::1]:8080/a.png').external).toEqual({
      scheme: 'http',
      host: '[::1]',
      port: 8080,
    });
  });
});

describe('normalizeResourceInput', () => {
  it('chips-resource 与裸 http(s) 走同一解析出口', () => {
    expect(normalizeResourceInput('chips-resource://card-1/a.png').authority).toBe('card-1');
    expect(normalizeResourceInput('https://example.com/a.png').authority).toBe('external');
  });

  it('缺少协议前缀与未知 scheme 拒绝', () => {
    expectCode(() => normalizeResourceInput('/tmp/a.png'), RESOURCE_ERROR_CODES.invalidUri);
    expectCode(
      () => normalizeResourceInput('file:///tmp/a.png'),
      RESOURCE_ERROR_CODES.unsupportedScheme
    );
    expectCode(
      () => normalizeResourceInput('webdav://x/a'),
      RESOURCE_ERROR_CODES.unsupportedScheme
    );
  });
});

describe('isReservedResourceScope', () => {
  it('platform / external / memory 为平台保留作用域', () => {
    expect(isReservedResourceScope('platform')).toBe(true);
    expect(isReservedResourceScope('external')).toBe(true);
    expect(isReservedResourceScope('memory')).toBe(true);
    expect(isReservedResourceScope('card-1')).toBe(false);
  });
});
