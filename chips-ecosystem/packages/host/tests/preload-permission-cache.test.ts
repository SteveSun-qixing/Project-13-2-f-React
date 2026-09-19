import { describe, expect, it } from 'vitest';

import { SessionPermissionCache } from '../src/preload/permission-cache.js';

describe('SessionPermissionCache', () => {
  it('初始状态未就绪且无授权', () => {
    const cache = new SessionPermissionCache();
    expect(cache.ready).toBe(false);
    expect(cache.permissionVersion).toBe(-1);
    expect(cache.currentSessionId).toBeNull();
    expect(cache.has('resources:read')).toBe(false);
    expect(cache.snapshot()).toEqual([]);
  });

  it('应用推送并支持限定权限命中基础权限', () => {
    const cache = new SessionPermissionCache();
    cache.update({
      sessionId: 's1',
      grantedPermissions: ['resources:read:platform', 'window:list'],
      permissionVersion: 1,
    });
    expect(cache.ready).toBe(true);
    expect(cache.permissionVersion).toBe(1);
    expect(cache.currentSessionId).toBe('s1');
    expect(cache.has('resources:read')).toBe(true);
    expect(cache.has('resources:read:platform')).toBe(true);
    expect(cache.has('resources:write')).toBe(false);
    expect(cache.snapshot()).toEqual(['resources:read:platform', 'window:list']);
  });

  it('丢弃迟到与重复版本推送', () => {
    const cache = new SessionPermissionCache();
    cache.update({ sessionId: 's1', grantedPermissions: ['a'], permissionVersion: 5 });
    cache.update({ sessionId: 's2', grantedPermissions: ['b'], permissionVersion: 4 });
    cache.update({ sessionId: 's2', grantedPermissions: ['b'], permissionVersion: 5 });
    expect(cache.permissionVersion).toBe(5);
    expect(cache.currentSessionId).toBe('s1');
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('换新版本时整体替换授权集合，可清空', () => {
    const cache = new SessionPermissionCache();
    cache.update({ sessionId: 's1', grantedPermissions: ['a'], permissionVersion: 1 });
    cache.update({ sessionId: 's1', grantedPermissions: ['b'], permissionVersion: 2 });
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    cache.clear();
    expect(cache.ready).toBe(false);
    expect(cache.snapshot()).toEqual([]);
  });
});
