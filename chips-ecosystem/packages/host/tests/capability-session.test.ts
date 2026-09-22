import { describe, expect, it } from 'vitest';

import { createDocumentBridgeSessionGuardPort } from '../src/capabilities/document/adapters/bridge-session-guard.js';
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

/**
 * 会话权限快照查询面（08 §7.6 快照本体）——工单036 §五.3-1 / 开发日志刀4 缝①收口锁测。
 *
 * @remarks 本面是组合根把文档守卫端口（`IDocumentGuardPort`）默认绑定到壳侧会话登记表的
 * 唯一判定输入源：快照必须透出完整权限集与终态、每调用触达实态、且判定与路由管线同源
 * （同一 `evaluateHostPermissions` 实现），否则「服务侧复查」与「路由侧准入」即漂移。
 */
describe('会话权限快照查询面 listPermissionSnapshots（08 §7.6 / 工单036 §五.3-1）', () => {
  it('透出完整权限集与终态会话；与 list() 诊断视图分职（视图只给 grantedCount）', () => {
    const registry = createHostSessionRegistry();
    registry.open({
      sessionId: 'session:7:main',
      pluginId: 'demo',
      windowId: 7,
      frameId: null,
      grantedPermissions: ['resources:read', 'document:read'],
    });
    registry.open({ sessionId: 'session:7:2', pluginId: 'demo', windowId: 7, frameId: 2, grantedPermissions: [] });
    registry.close('session:7:2');

    const snapshots = registry.listPermissionSnapshots();
    expect(snapshots.map((item) => item.sessionId).sort()).toEqual(['session:7:2', 'session:7:main']);
    const main = snapshots.find((item) => item.sessionId === 'session:7:main');
    expect([...(main?.grantedPermissions ?? [])].sort()).toEqual(['document:read', 'resources:read']);
    expect(main?.state).toBe('active');
    // 终态会话同样入快照（守卫据 `state` 如实拒绝，而非静默消失）。
    const closed = snapshots.find((item) => item.sessionId === 'session:7:2');
    expect(closed?.state).toBe('closed');
    expect(closed?.grantedPermissions.size).toBe(0);

    // 诊断视图维持原形状：授权原文不出现在 `list()`（本面不是诊断面的替代品）。
    const view = registry.list().find((item) => item.sessionId === 'session:7:main');
    expect(view).not.toHaveProperty('grantedPermissions');
    expect(view?.grantedCount).toBe(2);
  });

  it('每调用触达登记表实态：授权变更与会话关闭在下次取快照即反映，不缓存（11 §9.1）', () => {
    const registry = createHostSessionRegistry();
    registry.open({ sessionId: 's1', pluginId: 'demo', windowId: 1, frameId: null, grantedPermissions: ['a:b'] });
    expect([...(registry.listPermissionSnapshots()[0]?.grantedPermissions ?? [])]).toEqual(['a:b']);
    registry.updatePermissions('s1', ['a:b', 'c:d']);
    expect([...(registry.listPermissionSnapshots()[0]?.grantedPermissions ?? [])]).toEqual(['a:b', 'c:d']);
    registry.close('s1');
    expect(registry.listPermissionSnapshots()[0]?.state).toBe('closed');
    expect(registry.listPermissionSnapshots()[0]?.grantedPermissions.size).toBe(2);
  });

  it('快照对象即登记表内已冻结的会话本体（同一引用，不深拷贝不裁剪；消费位不得就地改授权）', () => {
    const registry = createHostSessionRegistry();
    const opened = registry.open({ sessionId: 's1', pluginId: 'demo', windowId: 1, frameId: null });
    const snapshot = registry.listPermissionSnapshots()[0];
    expect(snapshot).toBe(opened);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('快照源直连文档守卫端口：通配 / 域通配 / 缺权限 / 终态逐项判定与路由管线同源', async () => {
    const registry = createHostSessionRegistry();
    registry.open({
      sessionId: 's1',
      pluginId: 'demo',
      windowId: 1,
      frameId: null,
      grantedPermissions: ['resources:*'],
    });
    const guard = createDocumentBridgeSessionGuardPort(() => registry.listPermissionSnapshots());
    await expect(guard.isSessionActive('s1')).resolves.toBe(true);
    await expect(guard.hasPermission('s1', 'resources:write')).resolves.toBe(true);
    await expect(guard.hasPermission('s1', 'fs:write')).resolves.toBe(false);
    // 与单点判定本体逐字同源（同输入同结论，禁第二套判定）。
    const parity = evaluateHostPermissions({
      capabilityId: 'document:save',
      requiredPermissions: ['fs:write'],
      grantedPermissions: registry.listPermissionSnapshots()[0]?.grantedPermissions ?? new Set<string>(),
    });
    expect(parity.allowed).toBe(false);
    // 未登记会话与终态会话一律拒绝。
    await expect(guard.hasPermission('s-missing', 'resources:write')).resolves.toBe(false);
    registry.close('s1');
    await expect(guard.isSessionActive('s1')).resolves.toBe(false);
    await expect(guard.hasPermission('s1', 'resources:write')).resolves.toBe(false);
  });
});
