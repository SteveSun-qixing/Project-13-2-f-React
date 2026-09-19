import { describe, expect, it } from 'vitest';

import {
  isManagedResourceScope,
  isReservedResourceScope,
  isResourceUriFailure,
  normalizeResourceInput,
  parseResourceUri,
  toCanonicalResourceUri,
} from '../src/protocol/resource-uri.js';

describe('parseResourceUri：受管作用域', () => {
  it('接受各受管作用域与保留作用域', () => {
    for (const [uri, scope, path] of [
      ['chips-resource://card-7f3a/images/photo.jpg', 'card-7f3a', 'images/photo.jpg'],
      ['chips-resource://box-2c91/.box/cover.html', 'box-2c91', '.box/cover.html'],
      ['chips-resource://plugin-001/icon.png', 'plugin-001', 'icon.png'],
      ['chips-resource://workspace-a1/b.md', 'workspace-a1', 'b.md'],
      ['chips-resource://temp-a1/x', 'temp-a1', 'x'],
      ['chips-resource://platform/frame.html', 'platform', 'frame.html'],
      ['chips-resource://memory/a', 'memory', 'a'],
    ] as const) {
      const result = parseResourceUri(uri);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.scope).toBe(scope);
        expect(result.path).toBe(path);
        expect(result.query).toBeNull();
        expect(result.origin).toBeNull();
      }
    }
  });

  it('作用域大小写归一为小写', () => {
    const result = parseResourceUri('chips-resource://PLATFORM/Frame.html');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scope).toBe('platform');
      expect(result.path).toBe('Frame.html');
    }
  });

  it('空路径表示作用域根', () => {
    const result = parseResourceUri('chips-resource://platform/');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path).toBe('');
    }
  });

  it('拒绝未登记作用域与非 opaque 受管作用域', () => {
    for (const uri of ['chips-resource://unknown-1/a.png', 'chips-resource://card/a', 'chips-resource://Card_1/a']) {
      const result = parseResourceUri(uri);
      expect(isResourceUriFailure(result)).toBe(true);
      if (isResourceUriFailure(result)) {
        expect(result.code).toBe('RESOURCE_INVALID_URI');
        expect(result.reason).toBe('malformed_scope');
      }
    }
  });
});

describe('parseResourceUri：路径安全', () => {
  it('拒绝穿越、反斜杠、空段与设备名', () => {
    for (const [uri, reason] of [
      ['chips-resource://card-7f3a/images/../.card/metadata.yaml', 'segment'],
      ['chips-resource://card-7f3a/%2e%2e/.card/metadata.yaml', 'segment'],
      ['chips-resource://card-7f3a/images\\photo.jpg', 'separator'],
      ['chips-resource://card-7f3a/images//photo.jpg', 'segment'],
      ['chips-resource://card-7f3a/a/./b', 'segment'],
      ['chips-resource://card-7f3a/C:/x.png', 'absolute'],
      ['chips-resource://card-7f3a/con.txt', 'platform'],
      ['chips-resource://card-7f3a/name.', 'platform'],
      ['chips-resource://card-7f3a/name ', 'platform'],
      ['chips-resource://card-7f3a/a:b', 'platform'],
    ] as const) {
      const result = parseResourceUri(uri);
      expect(isResourceUriFailure(result), uri).toBe(true);
      if (isResourceUriFailure(result)) {
        expect(result.code).toBe('RESOURCE_PATH_INVALID');
        expect(result.pathReason).toBe(reason);
      }
    }
  });

  it('拒绝控制字符', () => {
    const result = parseResourceUri('chips-resource://platform/a\u0000b');
    expect(isResourceUriFailure(result)).toBe(true);
    if (isResourceUriFailure(result)) {
      expect(result.pathReason).toBe('control');
    }
  });

  it('拒绝未做 NFC 规范化的路径', () => {
    const decomposed = 'chips-resource://platform/cafe\u0301.txt';
    const result = parseResourceUri(decomposed);
    expect(isResourceUriFailure(result)).toBe(true);
    if (isResourceUriFailure(result)) {
      expect(result.pathReason).toBe('unicode');
    }
  });

  it('非法百分号编码按 URI 级错误处理', () => {
    const result = parseResourceUri('chips-resource://platform/%zz');
    expect(isResourceUriFailure(result)).toBe(true);
    if (isResourceUriFailure(result)) {
      expect(result.code).toBe('RESOURCE_INVALID_URI');
      expect(result.reason).toBe('invalid_encoding');
    }
  });

  it('百分号只解码一次：字面 %2e%2e 不构成穿越', () => {
    const result = parseResourceUri('chips-resource://card-7f3a/images/%252e%252e/x');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.path).toBe('images/%2e%2e/x');
    }
  });

  it('超过长度上限时拒绝', () => {
    const longSegment = 'a'.repeat(256);
    const result = parseResourceUri(`chips-resource://platform/${longSegment}`);
    expect(isResourceUriFailure(result)).toBe(true);
    if (isResourceUriFailure(result)) {
      expect(result.pathReason).toBe('length');
    }
    const tooLong = `chips-resource://platform/${'a'.repeat(8200)}`;
    expect(isResourceUriFailure(parseResourceUri(tooLong))).toBe(true);
  });
});

describe('parseResourceUri：URI 级校验', () => {
  it('拒绝受管作用域查询串与 fragment', () => {
    const query = parseResourceUri('chips-resource://card-7f3a/images/photo.jpg?v=2');
    expect(isResourceUriFailure(query)).toBe(true);
    if (isResourceUriFailure(query)) {
      expect(query.reason).toBe('query_not_allowed');
    }
    const fragment = parseResourceUri('chips-resource://platform/frame.html#top');
    expect(isResourceUriFailure(fragment)).toBe(true);
    if (isResourceUriFailure(fragment)) {
      expect(fragment.reason).toBe('fragment_not_allowed');
    }
  });

  it('拒绝非 chips-resource scheme 与非法 scheme 词法', () => {
    const unsupported = parseResourceUri('file:///Users/me/a.png');
    expect(isResourceUriFailure(unsupported)).toBe(true);
    if (isResourceUriFailure(unsupported)) {
      expect(unsupported.code).toBe('RESOURCE_UNSUPPORTED_SCHEME');
    }
    expect(isResourceUriFailure(parseResourceUri('not-a-uri'))).toBe(true);
    expect(isResourceUriFailure(parseResourceUri(''))).toBe(true);
  });
});

describe('parseResourceUri：External 作用域', () => {
  it('接受 http / https / webdav origin 与查询串', () => {
    const https = parseResourceUri('chips-resource://external/https/cdn.example.com/banner.png');
    expect(https.ok).toBe(true);
    if (https.ok) {
      expect(https.scope).toBe('external');
      expect(https.path).toBe('banner.png');
      expect(https.origin).toEqual({ scheme: 'https', host: 'cdn.example.com', port: null });
      expect(https.query).toBeNull();
    }
    const query = parseResourceUri('chips-resource://external/http/api.example.com:8080/v1/items?page=2');
    expect(query.ok).toBe(true);
    if (query.ok) {
      expect(query.origin).toEqual({ scheme: 'http', host: 'api.example.com', port: 8080 });
      expect(query.query).toBe('page=2');
      expect(query.path).toBe('v1/items');
    }
    const webdav = parseResourceUri('chips-resource://external/webdav/dav.example.com/team/a.card');
    expect(webdav.ok).toBe(true);
  });

  it('默认端口归一为空', () => {
    const result = parseResourceUri('chips-resource://external/https/example.com:443/a');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.origin?.port).toBeNull();
    }
  });

  it('拒绝 userinfo、未知 origin scheme 与缺失段', () => {
    for (const uri of [
      'chips-resource://external/https/user:pass@example.com/a',
      'chips-resource://external/ftp/example.com/a',
      'chips-resource://external/https',
      'chips-resource://external/https/',
    ]) {
      const result = parseResourceUri(uri);
      expect(isResourceUriFailure(result), uri).toBe(true);
      if (isResourceUriFailure(result)) {
        expect(result.code).toBe('RESOURCE_INVALID_URI');
      }
    }
  });

  it('External 使用受管作用域查询串规则的反面：允许查询但拒绝 fragment', () => {
    const fragment = parseResourceUri('chips-resource://external/https/example.com/a#x');
    expect(isResourceUriFailure(fragment)).toBe(true);
    if (isResourceUriFailure(fragment)) {
      expect(fragment.reason).toBe('fragment_not_allowed');
    }
  });
});

describe('normalizeResourceInput', () => {
  it('把裸 http(s) 归一为 External 规范 URI', () => {
    for (const [input, expected, query] of [
      ['https://cdn.example.com/banner.png', 'chips-resource://external/https/cdn.example.com/banner.png', null],
      [
        'http://api.example.com:8080/v1/items?page=2',
        'chips-resource://external/http/api.example.com:8080/v1/items',
        'page=2',
      ],
      ['HTTPS://CDN.EXAMPLE.COM/Banner.PNG', 'chips-resource://external/https/cdn.example.com/Banner.PNG', null],
      ['https://example.com:443/a', 'chips-resource://external/https/example.com/a', null],
    ] as const) {
      const result = normalizeResourceInput(input);
      expect(result.ok, input).toBe(true);
      if (result.ok) {
        expect(toCanonicalResourceUri(result)).toBe(expected);
        expect(result.query).toBe(query);
      }
    }
  });

  it('IDN host 归一为 punycode', () => {
    const result = normalizeResourceInput('https://例え.jp/a');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.origin?.host).toBe('xn--r8jz45g.jp');
      expect(toCanonicalResourceUri(result)).toBe('chips-resource://external/https/xn--r8jz45g.jp/a');
    }
  });

  it('拒绝 userinfo、file 与 webdav 引用形式', () => {
    for (const input of [
      'https://user:pass@example.com/a',
      'file:///Users/me/note.card/a.png',
      'webdav://dav.example.com/team/a.card',
    ]) {
      const result = normalizeResourceInput(input);
      expect(isResourceUriFailure(result), input).toBe(true);
    }
  });

  it('chips-resource 输入原样校验并返回规范形态', () => {
    const result = normalizeResourceInput('chips-resource://platform/shell.html');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(toCanonicalResourceUri(result)).toBe('chips-resource://platform/shell.html');
    }
  });

  it('非字符串与空输入按 URI 非法处理', () => {
    expect(normalizeResourceInput('').ok).toBe(false);
    expect(normalizeResourceInput(undefined as unknown as string).ok).toBe(false);
  });
});

describe('作用域判定', () => {
  it('isManagedResourceScope 只认受管前缀', () => {
    expect(isManagedResourceScope('card-1')).toBe(true);
    expect(isManagedResourceScope('plugin-abc')).toBe(true);
    expect(isManagedResourceScope('platform')).toBe(false);
    expect(isManagedResourceScope('external')).toBe(false);
  });

  it('isReservedResourceScope 只认保留字', () => {
    expect(isReservedResourceScope('platform')).toBe(true);
    expect(isReservedResourceScope('external')).toBe(true);
    expect(isReservedResourceScope('memory')).toBe(true);
    expect(isReservedResourceScope('card-1')).toBe(false);
  });
});
