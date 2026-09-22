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

  it('NFC 规范化差异不构成拒绝：未规范化输入归一为 NFC 后放行且与规范形判定等值（#190-D1 权威翻正）', () => {
    // 《06.02》§2.4 Unicode 行权威文面：NFC 差异归一后校验与比较（核心 path_guard 同判，
    // 旧臂「直接拒绝未规范化输入」拒了内核会收的合法形，随任务 #190 翻正）。
    const decomposed = parseResourceUri('chips-resource://platform/cafe\u0301.txt');
    const composed = parseResourceUri('chips-resource://platform/caf\u00e9.txt');
    expect(decomposed.ok).toBe(true);
    expect(composed.ok).toBe(true);
    if (decomposed.ok && composed.ok) {
      expect(decomposed.path).toBe('caf\u00e9.txt');
      expect(composed.path).toBe('caf\u00e9.txt');
      expect(toCanonicalResourceUri(decomposed)).toBe(toCanonicalResourceUri(composed));
    }
  });

  it('百分号解码产物 NFC 等值：cafe%CC%81 ≡ caf%C3%A9（镜像核心 path_guard 对偶锁测）', () => {
    const decomposedEncoded = parseResourceUri('chips-resource://platform/cafe%CC%81.txt');
    const composedEncoded = parseResourceUri('chips-resource://platform/caf%C3%A9.txt');
    expect(decomposedEncoded.ok).toBe(true);
    expect(composedEncoded.ok).toBe(true);
    if (decomposedEncoded.ok && composedEncoded.ok) {
      expect(decomposedEncoded.path).toBe('caf\u00e9.txt');
      expect(composedEncoded.path).toBe('caf\u00e9.txt');
    }
    const bareDecoded = normalizeResourceInput('chips-resource://platform/cafe\u0301.txt');
    expect(bareDecoded.ok).toBe(true);
    if (bareDecoded.ok) {
      expect(bareDecoded.path).toBe('caf\u00e9.txt');
    }
  });

  it('D1 翻正零放宽：NFC 归一产物上全部拒绝臂原样执行（归一不能洗白违规形）', () => {
    for (const [uri, reason] of [
      // `cafe\u0301.` 归一后 `café.` 仍命中尾随点平台特例。
      ['chips-resource://platform/cafe%CC%81.', 'platform'],
      // 分解形态中夹 `..` 段照常按段拒。
      ['chips-resource://platform/cafe%CC%81/../x', 'segment'],
      // 分解形态中夹控制符照常拒。
      ['chips-resource://platform/cafe%CC%81%00', 'control'],
      // 分解形态中夹反斜杠照常拒。
      ['chips-resource://platform/cafe%CC%81\\x', 'separator'],
      // NFC 归一不能洗白双编码段：`%252e%252e` 解码一次得字面 `%2e%2e` 按字面名放行，
      // 而 `%2e%2e` 独立成段仍按解码后 `..` 拒。
      ['chips-resource://platform/cafe%CC%81/%2e%2e', 'segment'],
    ] as const) {
      const result = parseResourceUri(uri);
      expect(isResourceUriFailure(result), uri).toBe(true);
      if (isResourceUriFailure(result)) {
        expect(result.code, uri).toBe('RESOURCE_PATH_INVALID');
        expect(result.pathReason, uri).toBe(reason);
      }
    }
  });

  it('非字符与替换字符全集触发臂：解码产物逐码位族拒绝（#190-D2，§2.4 v1.0.4 全集镜像）', () => {
    // 全集 = U+FFFD 替换字符 + 非字符区 U+FDD0–U+FDEF + U+nFFFE/U+nFFFF（n=0–16 全 17 平面），
    // 与核心 path_guard.rs::is_forbidden_unicode 逐码位镜像（工单043 A1 收紧 + 工单049 端点勘误）。
    const forbidden: ReadonlyArray<readonly [string, string]> = [
      ['U+FFFD 字面量', 'chips-resource://platform/a\uFFFDb'],
      ['U+FFFE 字面量', 'chips-resource://platform/a\uFFFEb'],
      ['U+FFFF 字面量', 'chips-resource://platform/a\uFFFFb'],
      ['U+FDD0 非字符区起点', 'chips-resource://platform/a\u{FDD0}b'],
      ['U+FDEF 非字符区终点', 'chips-resource://platform/a\u{FDEF}b'],
      ['U+FFFD 百分号形', 'chips-resource://platform/%EF%BF%BD'],
      ['U+FFFE 百分号形', 'chips-resource://platform/%EF%BF%BE'],
      ['U+FFFF 百分号形', 'chips-resource://platform/%EF%BF%BF'],
      ['U+FDD0 百分号形', 'chips-resource://platform/%EF%B7%90'],
      ['U+FDEF 百分号形', 'chips-resource://platform/%EF%B7%AF'],
      ['U+1FFFE 平面 1 尾', 'chips-resource://platform/%F0%9F%BF%BE'],
      ['U+1FFFF 平面 1 尾', 'chips-resource://platform/%F0%9F%BF%BF'],
      ['U+FFFFE 平面 15 尾', 'chips-resource://platform/%F3%BF%BF%BE'],
      ['U+10FFFE 平面 16 尾', 'chips-resource://platform/%F4%8F%BF%BE'],
      ['U+10FFFF 码位上界', 'chips-resource://platform/%F4%8F%BF%BF'],
    ];
    for (const [label, uri] of forbidden) {
      const result = parseResourceUri(uri);
      expect(isResourceUriFailure(result), `${label} 必须拒`).toBe(true);
      if (isResourceUriFailure(result)) {
        expect(result.code, label).toBe('RESOURCE_PATH_INVALID');
        expect(result.pathReason, label).toBe('unicode');
      }
    }
  });

  it('非字符全集不设防旧臂收口：external 路径同扫、合法码位不误伤', () => {
    const externalForbidden = parseResourceUri('chips-resource://external/https/example.com/a%EF%BF%BDb');
    expect(isResourceUriFailure(externalForbidden)).toBe(true);
    if (isResourceUriFailure(externalForbidden)) {
      expect(externalForbidden.pathReason).toBe('unicode');
    }
    // 平面 16 合法码位（U+10FFFF 之外的常用形与 U+FFFF 邻位 U+FFA0 等）不误伤。
    expect(parseResourceUri('chips-resource://platform/%F0%9F%8E%A8').ok).toBe(true); // U+1F3A8 🎨
    expect(parseResourceUri('chips-resource://platform/%EF%BF%AC').ok).toBe(true); // U+FFFC 对象替换符（非 U+FFFD）
    expect(parseResourceUri('chips-resource://platform/%EF%B7%8F').ok).toBe(true); // U+FDCF（非字符区外一位）
  });

  it('解码两臂分流：非法百分号语法属 URI 级、解码产物非合法 UTF-8 属 Unicode 触发臂（镜像核心两臂）', () => {
    const malformed = parseResourceUri('chips-resource://platform/%zz');
    expect(isResourceUriFailure(malformed)).toBe(true);
    if (isResourceUriFailure(malformed)) {
      expect(malformed.code).toBe('RESOURCE_INVALID_URI');
      expect(malformed.reason).toBe('invalid_encoding');
    }
    for (const [label, uri] of [
      ['裸高位字节 %FF', 'chips-resource://platform/%FF'],
      ['overlong %C0%80', 'chips-resource://platform/%C0%80'],
      ['代理区编码 %ED%A0%80', 'chips-resource://platform/%ED%A0%80'],
      ['越界码位 %F4%90%80%80', 'chips-resource://platform/%F4%90%80%80'],
      ['截断序列 %E4%B8', 'chips-resource://platform/%E4%B8'],
    ] as const) {
      const result = parseResourceUri(uri);
      expect(isResourceUriFailure(result), label).toBe(true);
      if (isResourceUriFailure(result)) {
        expect(result.code, label).toBe('RESOURCE_PATH_INVALID');
        expect(result.pathReason, label).toBe('unicode');
      }
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

  it('External 路径段平台特例臂与受管形判定等值（#190-D4 跳检收口，镜像核心全臂同走）', () => {
    // 核心 PathGuard 对 external 路径同走 check_platform_segment 全臂（uri.rs External 腿
    // 复用 VirtualPath::validate）；host TS 旧臂 `isExternal=true` 直接跳过盘符/冒号/
    // 设备名/尾点臂为预检弱位，随任务 #190 收口，判定面两侧等值。
    for (const [suffix, pathReason] of [
      ['C:/x.png', 'absolute'],
      ['a:b', 'platform'],
      ['con.txt', 'platform'],
      ['NUL', 'platform'],
      ['name.', 'platform'],
    ] as const) {
      const external = parseResourceUri(`chips-resource://external/https/example.com/${suffix}`);
      const managed = parseResourceUri(`chips-resource://card-7f3a/${suffix}`);
      expect(isResourceUriFailure(external), suffix).toBe(true);
      expect(isResourceUriFailure(managed), suffix).toBe(true);
      if (isResourceUriFailure(external) && isResourceUriFailure(managed)) {
        expect(external.code, suffix).toBe('RESOURCE_PATH_INVALID');
        expect(external.pathReason, suffix).toBe(pathReason);
        expect(managed.pathReason, suffix).toBe(pathReason);
      }
    }
    // 裸 http(s) 归一腿同闸。
    const bareHttp = normalizeResourceInput('https://example.com/con.txt');
    expect(isResourceUriFailure(bareHttp)).toBe(true);
    if (isResourceUriFailure(bareHttp)) {
      expect(bareHttp.pathReason).toBe('platform');
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
