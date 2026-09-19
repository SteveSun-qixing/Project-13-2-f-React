import { describe, expect, it, vi } from 'vitest';
import { ChipsError } from '../protocol/errors.js';
import type { ISessionSnapshot } from '../protocol/session.js';
import { createSessionRegistry } from './session-registry.js';
import { thrownErrorCode } from '../../tests/fixtures/expect-chips-error.js';

function createSession(
  registry: ReturnType<typeof createSessionRegistry>,
  sessionId = 's1'
): ISessionSnapshot {
  return registry.create({
    sessionId,
    pluginId: 'chips.official.editor',
    windowId: 1,
    frameId: 0,
    grantedPermissions: ['filesystem:read'],
    openedDocuments: ['card-1'],
  });
}

describe('createSessionRegistry 创建与解析', () => {
  it('登记会话并可按来源解析', () => {
    const registry = createSessionRegistry();
    const snapshot = createSession(registry);
    expect(snapshot).toMatchObject({
      sessionId: 's1',
      pluginId: 'chips.official.editor',
      windowId: 1,
      frameId: 0,
      state: 'active',
      permissionVersion: 0,
    });
    expect(snapshot.grantedPermissions.has('filesystem:read')).toBe(true);
    expect(snapshot.openedDocuments.has('card-1')).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(registry.resolve({ windowId: 1, frameId: 0 })).toBe(snapshot);
    expect(registry.resolve({ windowId: 1, frameId: 1 })).toBeUndefined();
    expect(registry.size).toBe(1);
  });

  it('拒绝空标识、非法窗口标识与绑定冲突', () => {
    const registry = createSessionRegistry();
    expect(() =>
      registry.create({ sessionId: '', pluginId: 'p', windowId: 1, frameId: 0 })
    ).toThrowError('会话标识与插件标识不得为空');
    expect(() =>
      registry.create({ sessionId: 's1', pluginId: '', windowId: 1, frameId: 0 })
    ).toThrowError('会话标识与插件标识不得为空');
    expect(() =>
      registry.create({ sessionId: 's1', pluginId: 'p', windowId: 1.5, frameId: 0 })
    ).toThrowError('会话窗口与框架标识必须为整数');
    createSession(registry);
    expect(() =>
      registry.create({ sessionId: 's2', pluginId: 'p', windowId: 1, frameId: 0 })
    ).toThrowError('同一窗口与框架已绑定其他会话，须先关闭旧会话');
    expect(() =>
      registry.create({ sessionId: 's1', pluginId: 'p', windowId: 2, frameId: 0 })
    ).toThrowError('会话标识已存在');
  });

  it('已关闭会话的标识可重新登记', () => {
    const registry = createSessionRegistry();
    createSession(registry);
    registry.close('s1');
    expect(registry.size).toBe(0);
    expect(() =>
      registry.create({ sessionId: 's1', pluginId: 'p', windowId: 1, frameId: 0 })
    ).not.toThrow();
  });
});

describe('createSessionRegistry 权限与文档快照', () => {
  it('updatePermissions 整体替换快照并递增版本号', () => {
    const registry = createSessionRegistry();
    createSession(registry);
    const updated = registry.updatePermissions('s1', ['filesystem:write']);
    expect(updated.permissionVersion).toBe(1);
    expect(updated.grantedPermissions.has('filesystem:write')).toBe(true);
    expect(updated.grantedPermissions.has('filesystem:read')).toBe(false);
    expect(registry.resolveById('s1')?.permissionVersion).toBe(1);
    expect(thrownErrorCode(() => registry.updatePermissions('missing', []))).toBe(
      'BRIDGE_SESSION_UNKNOWN'
    );
  });

  it('setOpenedDocuments 与 addOpenedDocument 维护已打开文档集合', () => {
    const registry = createSessionRegistry();
    createSession(registry);
    const replaced = registry.setOpenedDocuments('s1', ['card-2']);
    expect([...replaced.openedDocuments]).toEqual(['card-2']);
    expect(replaced.permissionVersion).toBe(0);
    const added = registry.addOpenedDocument('s1', 'box-1');
    expect([...added.openedDocuments].sort()).toEqual(['box-1', 'card-2']);
  });
});

describe('createSessionRegistry 关闭与取消', () => {
  it('close 幂等、清理绑定、中止信号并通知监听器', () => {
    const registry = createSessionRegistry();
    createSession(registry);
    const listener = vi.fn();
    const unsubscribe = registry.onSessionClosed(listener);
    const signal = registry.signalFor('s1');
    expect(signal?.aborted).toBe(false);
    registry.close('s1');
    registry.close('s1');
    expect(registry.size).toBe(0);
    expect(registry.resolve({ windowId: 1, frameId: 0 })).toBeUndefined();
    expect(registry.resolveById('s1')?.state).toBe('closed');
    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBeInstanceOf(ChipsError);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    unsubscribe();
    registry.close('s1');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(registry.signalFor('missing')).toBeUndefined();
    expect(() => registry.close('missing')).not.toThrow();
  });
});
