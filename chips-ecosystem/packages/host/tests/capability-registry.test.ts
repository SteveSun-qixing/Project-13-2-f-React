import { describe, expect, it } from 'vitest';

import { createHostCapabilityRegistry, HostCapabilityRegistrationError } from '../src/runtime/capability/registry.js';
import type { IHostCapabilityDescriptor } from '../src/runtime/capability/contracts.js';

const noopHandler = (): Promise<unknown> => Promise.resolve({ ok: true });

function descriptor(overrides: Partial<IHostCapabilityDescriptor> = {}): IHostCapabilityDescriptor {
  return {
    id: 'test:action',
    permissions: [],
    handler: noopHandler,
    ...overrides,
  };
}

describe('壳侧能力注册表：装配与校验', () => {
  it('注册合法能力并归一默认值', () => {
    const registry = createHostCapabilityRegistry();
    registry.register(descriptor());
    const entry = registry.get('test:action');
    expect(entry).toBeDefined();
    expect(entry?.timeoutMs).toBe(30000);
    expect(entry?.concurrency).toBe('parallel');
    expect(entry?.maxQueue).toBe(32);
    expect(entry?.sessionInFlightLimit).toBe(64);
    expect(entry?.owner).toBe('chips.official.host');
    expect(registry.size).toBe(1);
  });

  it('批量注册后编目按 ID 升序', () => {
    const registry = createHostCapabilityRegistry();
    registry.registerAll([
      descriptor({ id: 'zeta:one' }),
      descriptor({ id: 'alpha:one' }),
      descriptor({ id: 'mid:one' }),
    ]);
    const report = registry.report();
    expect(report.total).toBe(3);
    expect(report.capabilities.map((view) => view.id)).toEqual(['alpha:one', 'mid:one', 'zeta:one']);
    expect(report.byDomain).toMatchObject({ alpha: 1, mid: 1, zeta: 1 });
  });

  it('同一定义重复注册幂等，不增加条目', () => {
    const registry = createHostCapabilityRegistry();
    const d = descriptor();
    registry.register(d);
    expect(() => registry.register(d)).not.toThrow();
    expect(registry.size).toBe(1);
  });

  it('非法 ID 文法拒绝（BRIDGE_CAPABILITY_CONFLICT）', () => {
    const registry = createHostCapabilityRegistry();
    expect(() => registry.register(descriptor({ id: 'Bad_ID' }))).toThrow(HostCapabilityRegistrationError);
    try {
      registry.register(descriptor({ id: 'Bad_ID' }));
    } catch (error) {
      expect((error as HostCapabilityRegistrationError).wire.code).toBe('BRIDGE_CAPABILITY_CONFLICT');
    }
  });

  it('缺少 handler 拒绝', () => {
    const registry = createHostCapabilityRegistry();
    expect(() =>
      registry.register({ ...descriptor(), handler: undefined as unknown as IHostCapabilityDescriptor['handler'] }),
    ).toThrow(HostCapabilityRegistrationError);
  });

  it('未登记权限拒绝（PERMISSION_UNKNOWN）', () => {
    const registry = createHostCapabilityRegistry({ knownPermissions: new Set(['resources:read']) });
    try {
      registry.register(descriptor({ permissions: ['resources:write'] }));
      expect.unreachable();
    } catch (error) {
      expect((error as HostCapabilityRegistrationError).wire.code).toBe('PERMISSION_UNKNOWN');
    }
  });

  it('权限文法非法拒绝（PERMISSION_INVALID）', () => {
    const registry = createHostCapabilityRegistry();
    try {
      registry.register(descriptor({ permissions: ['Bad:Perm'] }));
      expect.unreachable();
    } catch (error) {
      expect((error as HostCapabilityRegistrationError).wire.code).toBe('PERMISSION_INVALID');
    }
  });

  it('未在提供方清单声明拒绝（PERMISSION_NOT_DECLARED）', () => {
    const registry = createHostCapabilityRegistry({
      knownPermissions: new Set(['resources:read']),
      declaredPermissions: () => new Set<string>(),
    });
    try {
      registry.register(descriptor({ permissions: ['resources:read'] }));
      expect.unreachable();
    } catch (error) {
      expect((error as HostCapabilityRegistrationError).wire.code).toBe('PERMISSION_NOT_DECLARED');
    }
  });

  it('能力 ID 与权限 ID 同值拒绝（04 §4.2 第 4 项 / R3 命名空间隔离）', () => {
    const registry = createHostCapabilityRegistry();
    try {
      registry.register(descriptor({ id: 'resources:read', permissions: ['resources:read'] }));
      expect.unreachable();
    } catch (error) {
      const failure = error as HostCapabilityRegistrationError;
      expect(failure.wire.code).toBe('BRIDGE_CAPABILITY_CONFLICT');
      expect(failure.wire.details).toMatchObject({ capabilityId: 'resources:read', permission: 'resources:read' });
    }
    expect(registry.size).toBe(0);
  });

  it('同 owner 不同定义冲突拒绝，draining 可再注册', () => {
    const registry = createHostCapabilityRegistry();
    registry.register(descriptor());
    expect(() => registry.register(descriptor({ timeoutMs: 9999 }))).toThrow(HostCapabilityRegistrationError);
    registry.markDraining('test:action');
    expect(registry.get('test:action')).toBeUndefined();
    expect(registry.getRegistered('test:action')?.state).toBe('draining');
    expect(() => registry.register(descriptor({ handler: () => Promise.resolve(1) }))).not.toThrow();
  });

  it('注销幂等；未注册注销不抛', () => {
    const registry = createHostCapabilityRegistry();
    registry.register(descriptor());
    registry.unregister('test:action');
    expect(() => registry.unregister('test:action')).not.toThrow();
    expect(registry.size).toBe(0);
  });

  it('按域与 owner 过滤编目', () => {
    const registry = createHostCapabilityRegistry();
    registry.register(descriptor({ id: 'doc:open', owner: 'chips.official.host' }));
    registry.register(descriptor({ id: 'sys:info', owner: 'chips.official.host' }));
    expect(registry.list({ domain: 'doc' })).toHaveLength(1);
    expect(registry.list({ owner: 'nobody' })).toHaveLength(0);
  });
});
