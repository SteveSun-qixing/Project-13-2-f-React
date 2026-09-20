import { describe, expect, it } from 'vitest';

import { createHostSessionRegistry, evaluateHostPermissions } from '../src/runtime/capability/session.js';

function session(granted: readonly string[]): ReadonlySet<string> {
  return new Set(granted);
}

describe('壳侧会话注册表', () => {
  it('open 后按来源解析并幂等', () => {
    const sessions = createHostSessionRegistry();
    const first = sessions.open({ sessionId: 's1', pluginId: 'demo', windowId: 7, frameId: null });
    expect(first.state).toBe('active');
    const resolved = sessions.resolve({ windowId: 7, frameId: null });
    expect(resolved?.sessionId).toBe('s1');
    // 同一来源再次 open 返回既有活跃会话
    const again = sessions.open({ sessionId: 's1-dup', pluginId: 'demo', windowId: 7, frameId: null });
    expect(again.sessionId).toBe('s1');
  });

  it('updatePermissions 递增版本并通知监听', () => {
    const sessions = createHostSessionRegistry();
    sessions.open({ sessionId: 's1', pluginId: 'demo', windowId: 1, frameId: null, grantedPermissions: ['a:b'] });
    const seen: number[] = [];
    sessions.onPermissionsChanged((s) => seen.push(s.permissionVersion));
    const updated = sessions.updatePermissions('s1', ['a:b', 'c:d']);
    expect(updated?.grantedPermissions.size).toBe(2);
    expect(updated?.permissionVersion).toBe(1);
    expect(seen).toEqual([1]);
    expect(sessions.updatePermissions('missing', [])).toBeUndefined();
  });

  it('close 触发关闭回调并中止取消信号，幂等', () => {
    const sessions = createHostSessionRegistry();
    sessions.open({ sessionId: 's1', pluginId: 'demo', windowId: 1, frameId: null });
    let closed = 0;
    sessions.onClosed(() => {
      closed += 1;
    });
    const signal = sessions.signalFor('s1');
    expect(signal?.aborted).toBe(false);
    sessions.close('s1');
    sessions.close('s1');
    expect(closed).toBe(1);
    expect(signal?.aborted).toBe(true);
    expect(sessions.resolve({ windowId: 1, frameId: null })).toBeUndefined();
    expect(sessions.getById('s1')?.state).toBe('closed');
  });

  it('closeByWindow 关闭该窗口全部会话（含子帧）', () => {
    const sessions = createHostSessionRegistry();
    sessions.open({ sessionId: 'a', pluginId: 'demo', windowId: 3, frameId: null });
    sessions.open({ sessionId: 'b', pluginId: 'demo', windowId: 3, frameId: 5 });
    sessions.open({ sessionId: 'c', pluginId: 'demo', windowId: 4, frameId: null });
    expect(sessions.activeCount).toBe(3);
    sessions.closeByWindow(3);
    expect(sessions.activeCount).toBe(1);
    expect(sessions.getById('c')?.state).toBe('active');
  });

  it('addOpenedDocument 累计去重', () => {
    const sessions = createHostSessionRegistry();
    sessions.open({ sessionId: 's1', pluginId: 'demo', windowId: 1, frameId: null });
    sessions.addOpenedDocument('s1', 'doc-1');
    sessions.addOpenedDocument('s1', 'doc-1');
    sessions.addOpenedDocument('s1', 'doc-2');
    expect(sessions.getById('s1')?.openedDocuments.size).toBe(2);
    const view = sessions.list().find((v) => v.sessionId === 's1');
    expect(view?.openedDocumentCount).toBe(2);
  });
});

describe('运行时权限判定（08 §7.2）', () => {
  it('精确授予放行', () => {
    const decision = evaluateHostPermissions({
      capabilityId: 'document:open',
      requiredPermissions: ['resources:read'],
      grantedPermissions: session(['resources:read']),
    });
    expect(decision.allowed).toBe(true);
    expect(decision.missing).toEqual([]);
  });

  it('全域通配 * 放行', () => {
    const decision = evaluateHostPermissions({
      capabilityId: 'document:write',
      requiredPermissions: ['resources:write'],
      grantedPermissions: session(['*']),
    });
    expect(decision.allowed).toBe(true);
  });

  it('域级通配放行', () => {
    const decision = evaluateHostPermissions({
      capabilityId: 'document:read',
      requiredPermissions: ['resources:read'],
      grantedPermissions: session(['resources:*']),
    });
    expect(decision.allowed).toBe(true);
  });

  it('缺权限拒绝并列出缺失与首个拒绝原因', () => {
    const decision = evaluateHostPermissions({
      capabilityId: 'document:save',
      requiredPermissions: ['resources:write', 'fs:write'],
      grantedPermissions: session(['resources:read']),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.permission).toBe('resources:write');
    expect(decision.missing).toEqual(['resources:write', 'fs:write']);
    expect(decision.reason).toBe('not_granted');
  });

  it('无要求权限时放行', () => {
    const decision = evaluateHostPermissions({
      capabilityId: 'system:info',
      requiredPermissions: [],
      grantedPermissions: session([]),
    });
    expect(decision.allowed).toBe(true);
  });
});
