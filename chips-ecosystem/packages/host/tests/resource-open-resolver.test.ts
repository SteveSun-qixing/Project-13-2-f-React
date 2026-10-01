/**
 * 处理器解析唯一实现的锁单测（14-资源打开与默认处理器契约 §2.3、§4.1、§4.2、§6.2 全表）。
 *
 * @remarks 路由表锁测（槽位解析全分支）：匹配等级 M1＞M2＞E1、octet-stream 跳级、
 * 单插件最佳等级去重、偏好三级查找与无效偏好忽略、组内排序文法（OR-12）、
 * 槽位视图集合与顺序规则（§6.2）。全部确定性纯函数，离线可测。
 */

import { describe, expect, it } from 'vitest';

import {
  buildHandlerSlots,
  matchDeclarationLevel,
  normalizeOpenRequest,
  resolveHandler,
} from '../src/capabilities/resource-open/resolve-handler.js';
import type {
  IHandlerDeclaration,
  INormalizedResourceView,
} from '../src/capabilities/resource-open/resolve-handler.js';

/** 完整归一视图构造捷径（匹配面只消费 mimeType / extension）。 */
function viewOf(mimeType: string, extension: string | undefined): INormalizedResourceView {
  return {
    uri: 'chips-resource://card-abc/target',
    mimeType,
    extension,
    fileName: undefined,
    title: undefined,
    payload: undefined,
  };
}

/** 声明构造捷径（缺省 primary、同刻安装、按 ID 定序）。 */
function declaration(input: {
  readonly pluginId: string;
  readonly extensions?: readonly string[];
  readonly mimeTypes?: readonly string[];
  readonly tier?: 'primary' | 'fallback';
  readonly name?: string;
  readonly role?: 'app' | 'service';
  readonly installedAt?: string;
}): IHandlerDeclaration {
  return {
    pluginId: input.pluginId,
    name: input.name ?? input.pluginId,
    role: input.role ?? 'app',
    tier: input.tier ?? 'primary',
    extensions: input.extensions ?? [],
    mimeTypes: input.mimeTypes ?? [],
    installedAt: input.installedAt ?? '2026-01-01T00:00:00.000Z',
  };
}

describe('输入归一（14 §2.3）', () => {
  it('MIME 提示优先；无提示按扩展名静态表推断；仍无法判定落 octet-stream', () => {
    const hinted = normalizeOpenRequest({ uri: 'chips-resource://card-abc/images/photo.xyz' }, 'view', 0, 65536);
    expect(hinted.ok).toBe(true);
    if (!hinted.ok) throw new Error('unreachable');
    expect(hinted.request.view.mimeType).toBe('application/octet-stream');

    const inferred = normalizeOpenRequest({ uri: 'chips-resource://card-abc/photo.png' }, undefined, 0, 65536);
    expect(inferred.ok).toBe(true);
    if (!inferred.ok) throw new Error('unreachable');
    expect(inferred.request.view.mimeType).toBe('image/png');
    expect(inferred.request.intent).toBe('view');

    const explicit = normalizeOpenRequest(
      { uri: 'chips-resource://card-abc/photo.png', mimeType: 'image/custom' },
      undefined,
      0,
      65536,
    );
    expect(explicit.ok).toBe(true);
    if (!explicit.ok) throw new Error('unreachable');
    expect(explicit.request.view.mimeType).toBe('image/custom');
  });

  it('扩展名取自 fileName 缺省（URI 末段百分号解码）；无文件名即缺席', () => {
    const named = normalizeOpenRequest(
      { uri: 'chips-resource://card-abc/media', fileName: 'Track.FLAC' },
      undefined,
      0,
      65536,
    );
    expect(named.ok).toBe(true);
    if (!named.ok) throw new Error('unreachable');
    expect(named.request.view.extension).toBe('.flac');
    expect(named.request.view.fileName).toBe('Track.FLAC');

    const fromUri = normalizeOpenRequest({ uri: 'chips-resource://card-abc/a%20b/song.mp3' }, undefined, 0, 65536);
    expect(fromUri.ok).toBe(true);
    if (!fromUri.ok) throw new Error('unreachable');
    expect(fromUri.request.view.fileName).toBe('song.mp3');
    expect(fromUri.request.view.extension).toBe('.mp3');

    const scopeRoot = normalizeOpenRequest({ uri: 'chips-resource://card-abc/' }, undefined, 0, 65536);
    expect(scopeRoot.ok).toBe(true);
    if (!scopeRoot.ok) throw new Error('unreachable');
    expect(scopeRoot.request.view.fileName).toBeUndefined();
    expect(scopeRoot.request.view.extension).toBeUndefined();
    expect(scopeRoot.request.view.mimeType).toBe('application/octet-stream');
  });

  it('非 chips-resource URI 与超限 payload 确定性拒绝', () => {
    expect(normalizeOpenRequest({ uri: 'file:///etc/passwd' }, undefined, 0, 65536)).toEqual({
      ok: false,
      reason: 'uri-invalid',
    });
    expect(normalizeOpenRequest({ uri: 'chips-resource://card-abc/a.png' }, undefined, 70000, 65536)).toEqual({
      ok: false,
      reason: 'payload-too-large',
    });
    // 恰好在限内放行。
    expect(normalizeOpenRequest({ uri: 'chips-resource://card-abc/a.png' }, undefined, 65536, 65536).ok).toBe(true);
  });
});

describe('匹配等级（14 §4.1 全表）', () => {
  it('M1 精确 MIME ＞ M2 主类型通配 ＞ E1 扩展名', () => {
    const decl = declaration({ pluginId: 'a', mimeTypes: ['image/png', 'image/*'], extensions: ['.png'] });
    expect(matchDeclarationLevel(decl, viewOf('image/png', '.png'))).toBe(1);
    expect(matchDeclarationLevel(decl, viewOf('image/tiff', '.tiff'))).toBe(2);
    expect(matchDeclarationLevel(decl, viewOf('text/plain', '.png'))).toBe(3);
    expect(matchDeclarationLevel(decl, viewOf('text/plain', '.md'))).toBeNull();
  });

  it('octet-stream 跳过 M1/M2 直接按扩展名；扩展名同时缺席即无候选', () => {
    const decl = declaration({ pluginId: 'a', mimeTypes: ['application/octet-stream'], extensions: ['.bin'] });
    expect(matchDeclarationLevel(decl, viewOf('application/octet-stream', '.bin'))).toBe(3);
    expect(matchDeclarationLevel(decl, viewOf('application/octet-stream', undefined))).toBeNull();
  });
});

describe('解析顺序与偏好（14 §4.1/§4.2）', () => {
  const view = viewOf('image/png', '.png');

  it('高等级优先：存在 M1 候选时不再考查 M2 与 E1', () => {
    const m1 = declaration({ pluginId: 'app.m1', mimeTypes: ['image/png'] });
    const m2 = declaration({ pluginId: 'app.m2', mimeTypes: ['image/*'] });
    const e1 = declaration({ pluginId: 'app.e1', extensions: ['.png'] });
    const resolved = resolveHandler([e1, m2, m1], view);
    expect(resolved?.declaration.pluginId).toBe('app.m1');
    expect(resolved?.slot).toBe('mime:image/png');
  });

  it('同一插件多等级命中只按最佳等级计入一次', () => {
    const both = declaration({ pluginId: 'app.both', mimeTypes: ['image/*'], extensions: ['.png'] });
    const exact = declaration({ pluginId: 'app.exact', mimeTypes: ['image/png'] });
    const resolved = resolveHandler([both, exact], view);
    expect(resolved?.declaration.pluginId).toBe('app.exact');
    expect(resolved?.level).toBe(1);
  });

  it('组内排序：primary 先于 fallback → 安装顺序 → 插件 ID 字典序（OR-12）', () => {
    const fallbackEarly = declaration({
      pluginId: 'b.fallback',
      mimeTypes: ['image/png'],
      tier: 'fallback',
      installedAt: '2025-01-01T00:00:00.000Z',
    });
    const primaryLate = declaration({
      pluginId: 'a.primary',
      mimeTypes: ['image/png'],
      installedAt: '2026-06-01T00:00:00.000Z',
    });
    expect(resolveHandler([fallbackEarly, primaryLate], view)?.declaration.pluginId).toBe('a.primary');

    const first = declaration({
      pluginId: 'z.first',
      mimeTypes: ['image/png'],
      installedAt: '2025-01-01T00:00:00.000Z',
    });
    const second = declaration({
      pluginId: 'a.second',
      mimeTypes: ['image/png'],
      installedAt: '2025-01-01T00:00:00.000Z',
    });
    expect(resolveHandler([second, first], view)?.declaration.pluginId).toBe('a.second');

    const same = declaration({ pluginId: 'app.b', mimeTypes: ['image/png'], installedAt: '2025-01-01T00:00:00.000Z' });
    const other = declaration({ pluginId: 'app.a', mimeTypes: ['image/png'], installedAt: '2025-01-01T00:00:00.000Z' });
    expect(resolveHandler([same, other], view)?.declaration.pluginId).toBe('app.a');
  });

  it('偏好三级查找 mime:<精确> → mime:<主类型>/* → ext:<扩展名>；有效偏好直接改选', () => {
    const exact = declaration({ pluginId: 'app.exact', mimeTypes: ['image/png'] });
    const wildcard = declaration({ pluginId: 'app.wildcard', mimeTypes: ['image/*'] });
    const ext = declaration({ pluginId: 'app.ext', extensions: ['.png'] });
    expect(
      resolveHandler([exact, wildcard, ext], view, { 'mime:image/png': 'app.wildcard' })?.declaration.pluginId,
    ).toBe('app.wildcard');
    expect(resolveHandler([wildcard, ext], view, { 'mime:image/*': 'app.ext' })?.declaration.pluginId).toBe('app.ext');
    expect(resolveHandler([ext], view, { 'ext:.png': 'app.ext' })?.slot).toBe('ext:.png');
  });

  it('偏好指向未命中候选的插件：忽略该偏好项、回落常规排序（§4.2 规则 3）', () => {
    const exact = declaration({ pluginId: 'app.exact', mimeTypes: ['image/png'] });
    const other = declaration({ pluginId: 'app.other', extensions: ['.png'] });
    // 偏好指向的插件有候选资格（other 有 E1 命中）→ mime 精确键改选 other。
    expect(resolveHandler([exact, other], view, { 'mime:image/png': 'app.other' })?.declaration.pluginId).toBe(
      'app.other',
    );
    // 偏好指向不在候选集合的插件 → 忽略。
    expect(resolveHandler([exact], view, { 'mime:image/png': 'app.gone' })?.declaration.pluginId).toBe('app.exact');
    // 偏好不改变该插件自身的匹配等级判定（OR-7）。
    const preferred = resolveHandler([exact], view, { 'ext:.png': 'app.exact' });
    expect(preferred?.level).toBe(1);
    expect(preferred?.slot).toBe('mime:image/png');
  });

  it('octet-stream 无候选（扩展名缺席）→ null；无任何候选 → null（未命中降级由服务层承接）', () => {
    expect(
      resolveHandler(
        [declaration({ pluginId: 'a', extensions: ['.png'] })],
        viewOf('application/octet-stream', undefined),
      ),
    ).toBeNull();
    expect(
      resolveHandler([declaration({ pluginId: 'a', extensions: ['.png'] })], viewOf('video/mp4', '.mp4')),
    ).toBeNull();
  });

  it('解析是确定性函数：同输入同状态重放结果一致（§4.1 规则）', () => {
    const candidates = [
      declaration({ pluginId: 'app.b', mimeTypes: ['image/png'] }),
      declaration({ pluginId: 'app.a', mimeTypes: ['image/png'] }),
    ];
    const first = resolveHandler(candidates, view);
    const second = resolveHandler([...candidates].reverse(), view);
    expect(first).toEqual(second);
  });
});

describe('槽位视图（14 §6.2）', () => {
  it('槽位集合 = 候选声明槽位 + 含偏好记录但无候选的槽位；无候选无偏好的槽位不出现', () => {
    const output = buildHandlerSlots(
      [declaration({ pluginId: 'app.photo', extensions: ['.png'], mimeTypes: ['image/png'] })],
      { 'ext:.xyz': 'app.gone' },
    );
    const slots = output.slots.map((slot) => slot.slot);
    expect(slots).toEqual(['ext:.png', 'ext:.xyz', 'mime:image/png']);
    const orphan = output.slots.find((slot) => slot.slot === 'ext:.xyz');
    expect(orphan?.handlers).toEqual([]);
    expect(orphan?.preferencePluginId).toBe('app.gone');
    expect(orphan?.defaultPluginId).toBeNull();
  });

  it('槽位内顺序固定：有效偏好在前，primary 先于 fallback，同级按安装顺序与 ID 字典序', () => {
    const output = buildHandlerSlots(
      [
        declaration({ pluginId: 'app.b-fallback', extensions: ['.png'], tier: 'fallback' }),
        declaration({ pluginId: 'app.c-primary', extensions: ['.png'], installedAt: '2026-01-01T00:00:00.000Z' }),
        declaration({ pluginId: 'app.a-primary', extensions: ['.png'], installedAt: '2026-01-01T00:00:00.000Z' }),
      ],
      { 'ext:.png': 'app.b-fallback' },
    );
    const slot = output.slots.find((entry) => entry.slot === 'ext:.png');
    expect(slot?.handlers.map((handler) => handler.pluginId)).toEqual([
      'app.b-fallback',
      'app.a-primary',
      'app.c-primary',
    ]);
    expect(slot?.handlers.map((handler) => handler.isPreferred)).toEqual([true, false, false]);
    expect(slot?.defaultPluginId).toBe('app.b-fallback');
    expect(slot?.extension).toBe('.png');
    expect(slot?.mimeType).toBeUndefined();
  });

  it('失效偏好保留原记录、default 回落排序首位；MIME 槽位带 mimeType 字段', () => {
    const output = buildHandlerSlots(
      [declaration({ pluginId: 'app.png', extensions: ['.png'], mimeTypes: ['image/png'] })],
      { 'ext:.png': 'app.uninstalled', 'mime:image/png': 'app.also-gone' },
    );
    const extSlot = output.slots.find((slot) => slot.slot === 'ext:.png');
    expect(extSlot?.preferencePluginId).toBe('app.uninstalled');
    expect(extSlot?.defaultPluginId).toBe('app.png');
    const mimeSlot = output.slots.find((slot) => slot.slot === 'mime:image/png');
    expect(mimeSlot?.mimeType).toBe('image/png');
    expect(mimeSlot?.extension).toBeUndefined();
    expect(mimeSlot?.preferencePluginId).toBe('app.also-gone');
    expect(mimeSlot?.defaultPluginId).toBe('app.png');
  });
});
