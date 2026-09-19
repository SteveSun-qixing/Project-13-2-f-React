import { describe, expect, it } from 'vitest';
import type { ICapability } from '../protocol/capability.js';
import { PLATFORM_CAPABILITY_OWNER } from '../protocol/capability-contracts.js';
import { createSchemaCompiler } from '../schema/compile.js';
import {
  createCapabilityRegistry,
  type ICapabilityContractRecord,
  type ICapabilityRegistryOptions,
} from './capability-registry.js';
import { thrownErrorCode } from '../../tests/fixtures/expect-chips-error.js';

const EMPTY_SCHEMA = { type: 'object', additionalProperties: false, properties: {} } as const;

interface IHarness {
  registry: ReturnType<typeof createCapabilityRegistry>;
  declared: Map<string, Set<string>>;
  activeOwners: Set<string>;
  unregistered: Array<{ capabilityId: string; owner: string }>;
  options: ICapabilityRegistryOptions;
}

function createHarness(
  overrides: {
    contracts?: readonly ICapabilityContractRecord[];
    declared?: Record<string, readonly string[]>;
    inactiveOwners?: readonly string[];
  } = {}
): IHarness {
  const declared = new Map<string, Set<string>>(
    Object.entries(overrides.declared ?? {}).map(([owner, permissions]) => [
      owner,
      new Set(permissions),
    ])
  );
  const activeOwners = new Set(['chips.platform', 'chips.service.demo', 'chips.service.other']);
  for (const owner of overrides.inactiveOwners ?? []) {
    activeOwners.delete(owner);
  }
  const unregistered: Array<{ capabilityId: string; owner: string }> = [];
  const options: ICapabilityRegistryOptions = {
    compiler: createSchemaCompiler(),
    declaredPermissions: (owner) => declared.get(owner) ?? new Set(),
    isOwnerActive: (owner) => activeOwners.has(owner),
    ...(overrides.contracts !== undefined ? { contracts: overrides.contracts } : {}),
    onUnregistered: (capabilityId, owner) => unregistered.push({ capabilityId, owner }),
  };
  return {
    registry: createCapabilityRegistry(options),
    declared,
    activeOwners,
    unregistered,
    options,
  };
}

function capability(
  id: string,
  permissions: string[] = [],
  schema: Record<string, unknown> = EMPTY_SCHEMA
): ICapability {
  return {
    id,
    permissions,
    schema,
    execute: () => Promise.resolve(null),
  };
}

describe('createCapabilityRegistry 注册与编目', () => {
  it('注册内置能力并与登记契约对齐', () => {
    const harness = createHarness({ declared: { 'chips.platform': ['filesystem:read'] } });
    harness.registry.register({
      capability: capability('file:read', ['filesystem:read']),
      owner: PLATFORM_CAPABILITY_OWNER,
      timeoutMs: 1000,
      concurrency: 'parallel',
      maxQueue: 4,
      sessionInFlightLimit: 8,
    });
    const registered = harness.registry.getRegistered('file:read');
    expect(registered).toMatchObject({
      owner: PLATFORM_CAPABILITY_OWNER,
      builtin: true,
      state: 'active',
      timeoutMs: 1000,
    });
    expect(registered?.targets).toEqual([
      { permission: 'filesystem:read', targetFields: ['path'] },
    ]);
    expect(harness.registry.get('file:read')).toBeDefined();
    expect(harness.registry.size).toBe(1);
    expect(harness.registry.catalog.get('file:read')).toMatchObject({
      id: 'file:read',
      builtin: true,
      state: 'active',
      permissions: ['filesystem:read'],
    });
    expect(harness.registry.catalog.list()).toHaveLength(1);
    expect(harness.registry.catalog.list({ owner: 'other' })).toEqual([]);
    expect(harness.registry.catalog.list({ builtin: true })).toHaveLength(1);
    expect(harness.registry.catalog.list({ domain: 'file' })).toHaveLength(1);
    expect(harness.registry.catalog.list({ domain: 'window' })).toEqual([]);
    expect(harness.registry.catalog.get('missing')).toBeUndefined();
  });

  it('缺省注册项使用文档默认值', () => {
    const harness = createHarness({ declared: { 'chips.platform': ['filesystem:read'] } });
    harness.registry.register({
      capability: capability('file:read', ['filesystem:read']),
      owner: PLATFORM_CAPABILITY_OWNER,
    });
    expect(harness.registry.getRegistered('file:read')).toMatchObject({
      timeoutMs: 30000,
      concurrency: 'parallel',
      maxQueue: 32,
      sessionInFlightLimit: 64,
    });
  });

  it('相同定义的幂等重复注册不报错，定义不一致时冲突', () => {
    const harness = createHarness({ declared: { 'chips.platform': ['filesystem:read'] } });
    const registration = {
      capability: capability('file:read', ['filesystem:read']),
      owner: PLATFORM_CAPABILITY_OWNER,
      timeoutMs: 1000,
      concurrency: 'parallel' as const,
      maxQueue: 4,
      sessionInFlightLimit: 8,
    };
    harness.registry.register(registration);
    expect(() => harness.registry.register({ ...registration })).not.toThrow();
    expect(
      thrownErrorCode(() => harness.registry.register({ ...registration, timeoutMs: 2000 }))
    ).toBe('BRIDGE_CAPABILITY_CONFLICT');
    expect(
      thrownErrorCode(() =>
        harness.registry.register({
          ...registration,
          capability: capability('file:read', ['filesystem:read'], {
            type: 'object',
            additionalProperties: false,
            properties: { path: { type: 'string' } },
          }),
        })
      )
    ).toBe('BRIDGE_CAPABILITY_CONFLICT');
  });

  it('注册项字段非法时冲突', () => {
    const harness = createHarness({ declared: { 'chips.platform': ['filesystem:read'] } });
    const base = {
      capability: capability('file:read', ['filesystem:read']),
      owner: PLATFORM_CAPABILITY_OWNER,
      timeoutMs: 1000,
      concurrency: 'parallel' as const,
      maxQueue: 4,
      sessionInFlightLimit: 8,
    };
    expect(thrownErrorCode(() => harness.registry.register({ ...base, timeoutMs: 0 }))).toBe(
      'BRIDGE_CAPABILITY_CONFLICT'
    );
    expect(thrownErrorCode(() => harness.registry.register({ ...base, maxQueue: -1 }))).toBe(
      'BRIDGE_CAPABILITY_CONFLICT'
    );
    expect(
      thrownErrorCode(() => harness.registry.register({ ...base, sessionInFlightLimit: 0 }))
    ).toBe('BRIDGE_CAPABILITY_CONFLICT');
    expect(
      thrownErrorCode(() =>
        harness.registry.register({ ...base, concurrency: 'fifo' as 'parallel' })
      )
    ).toBe('BRIDGE_CAPABILITY_CONFLICT');
  });

  it('注册项形状非法时冲突', () => {
    const harness = createHarness();
    const broken = [
      { capability: undefined as unknown as ICapability, owner: 'chips.platform' },
      { capability: { id: 'file:read' } as unknown as ICapability, owner: 'chips.platform' },
      {
        capability: {
          id: 'file:read',
          execute: () => Promise.resolve(null),
        } as unknown as ICapability,
        owner: 'chips.platform',
      },
      {
        capability: {
          id: 'file:read',
          execute: () => Promise.resolve(null),
          schema: null,
        } as unknown as ICapability,
        owner: 'chips.platform',
      },
      {
        capability: {
          id: 'file:read',
          execute: () => Promise.resolve(null),
          schema: EMPTY_SCHEMA,
          permissions: 'filesystem:read',
        } as unknown as ICapability,
        owner: 'chips.platform',
      },
      {
        capability: {
          id: 'file:read',
          execute: () => Promise.resolve(null),
          schema: EMPTY_SCHEMA,
          permissions: [1],
        } as unknown as ICapability,
        owner: 'chips.platform',
      },
      { capability: capability('file:read'), owner: '' },
    ];
    for (const registration of broken) {
      expect(thrownErrorCode(() => harness.registry.register(registration as never))).toBe(
        'BRIDGE_CAPABILITY_CONFLICT'
      );
    }
  });
});

describe('createCapabilityRegistry 校验规则', () => {
  it('拒绝未登记能力与非法 ID', () => {
    const harness = createHarness();
    expect(
      thrownErrorCode(() =>
        harness.registry.register({
          capability: capability('unknown:action'),
          owner: 'chips.platform',
        })
      )
    ).toBe('BRIDGE_CAPABILITY_CONFLICT');
    const badId = createHarness({
      contracts: [{ id: '1bad:id', owner: 'chips.service.demo', permissions: [] }],
      declared: { 'chips.service.demo': [] },
    });
    expect(
      thrownErrorCode(() =>
        badId.registry.register({ capability: capability('1bad:id'), owner: 'chips.service.demo' })
      )
    ).toBe('BRIDGE_CAPABILITY_CONFLICT');
  });

  it('拒绝 owner 与登记提供方不一致', () => {
    const harness = createHarness({ declared: { 'chips.platform': ['filesystem:read'] } });
    expect(
      thrownErrorCode(() =>
        harness.registry.register({
          capability: capability('file:read', ['filesystem:read']),
          owner: 'chips.service.other',
        })
      )
    ).toBe('BRIDGE_CAPABILITY_CONFLICT');
  });

  it('能力 ID 与权限 ID 相同时冲突（R3）', () => {
    const harness = createHarness({
      contracts: [{ id: 'filesystem:read', owner: 'chips.service.demo', permissions: [] }],
      declared: { 'chips.service.demo': [] },
    });
    expect(
      thrownErrorCode(() =>
        harness.registry.register({
          capability: capability('filesystem:read'),
          owner: 'chips.service.demo',
        })
      )
    ).toBe('BRIDGE_CAPABILITY_CONFLICT');
  });

  it('schema 编译失败返回 BRIDGE_INVALID_SCHEMA', () => {
    const harness = createHarness({ declared: { 'chips.platform': ['filesystem:read'] } });
    expect(
      thrownErrorCode(() =>
        harness.registry.register({
          capability: capability('file:read', ['filesystem:read'], { type: 'object' }),
          owner: PLATFORM_CAPABILITY_OWNER,
        })
      )
    ).toBe('BRIDGE_INVALID_SCHEMA');
  });

  it('权限未登记返回 PERMISSION_UNKNOWN，未在 manifest 声明返回 PERMISSION_NOT_DECLARED', () => {
    const withContract = createHarness({
      contracts: [
        { id: 'demo:run', owner: 'chips.service.demo', permissions: ['filesystem:exec'] },
      ],
      declared: { 'chips.service.demo': ['filesystem:exec'] },
    });
    expect(
      thrownErrorCode(() =>
        withContract.registry.register({
          capability: capability('demo:run', ['filesystem:exec']),
          owner: 'chips.service.demo',
        })
      )
    ).toBe('PERMISSION_UNKNOWN');

    const notDeclared = createHarness({
      contracts: [
        { id: 'demo:run', owner: 'chips.service.demo', permissions: ['filesystem:read'] },
      ],
      declared: { 'chips.service.demo': [] },
    });
    expect(
      thrownErrorCode(() =>
        notDeclared.registry.register({
          capability: capability('demo:run', ['filesystem:read']),
          owner: 'chips.service.demo',
        })
      )
    ).toBe('PERMISSION_NOT_DECLARED');
  });

  it('能力权限集合与登记契约不一致时冲突', () => {
    const harness = createHarness({
      contracts: [
        { id: 'demo:run', owner: 'chips.service.demo', permissions: ['filesystem:write'] },
      ],
      declared: { 'chips.service.demo': ['filesystem:read', 'filesystem:write'] },
    });
    expect(
      thrownErrorCode(() =>
        harness.registry.register({
          capability: capability('demo:run', ['filesystem:read']),
          owner: 'chips.service.demo',
        })
      )
    ).toBe('BRIDGE_CAPABILITY_CONFLICT');
  });

  it('owner 未激活返回 KERNEL_INVALID_TRANSITION', () => {
    const harness = createHarness({
      contracts: [{ id: 'demo:run', owner: 'chips.service.demo', permissions: [] }],
      declared: { 'chips.service.demo': [] },
      inactiveOwners: ['chips.service.demo'],
    });
    expect(
      thrownErrorCode(() =>
        harness.registry.register({
          capability: capability('demo:run'),
          owner: 'chips.service.demo',
        })
      )
    ).toBe('KERNEL_INVALID_TRANSITION');
  });
});

describe('createCapabilityRegistry 注销与蓝绿', () => {
  it('注销幂等、owner 绑定记忆与注销回调', () => {
    const harness = createHarness({
      contracts: [{ id: 'demo:run', owner: 'chips.service.demo', permissions: [] }],
      declared: { 'chips.service.demo': [] },
    });
    harness.registry.register({ capability: capability('demo:run'), owner: 'chips.service.demo' });
    harness.registry.unregister('demo:run');
    expect(harness.registry.get('demo:run')).toBeUndefined();
    expect(harness.unregistered).toEqual([
      { capabilityId: 'demo:run', owner: 'chips.service.demo' },
    ]);
    harness.registry.unregister('demo:run');
    expect(harness.unregistered).toHaveLength(1);
    expect(
      thrownErrorCode(() =>
        harness.registry.register({
          capability: capability('demo:run'),
          owner: 'chips.service.other',
        })
      )
    ).toBe('BRIDGE_CAPABILITY_CONFLICT');
    expect(() =>
      harness.registry.register({ capability: capability('demo:run'), owner: 'chips.service.demo' })
    ).not.toThrow();
  });

  it('markDraining 停止 get 命中并可被新代际接管', () => {
    const harness = createHarness({ declared: { 'chips.platform': ['filesystem:read'] } });
    const registration = {
      capability: capability('file:read', ['filesystem:read']),
      owner: PLATFORM_CAPABILITY_OWNER,
    };
    harness.registry.register(registration);
    harness.registry.markDraining('file:read');
    harness.registry.markDraining('file:read');
    harness.registry.markDraining('missing');
    expect(harness.registry.get('file:read')).toBeUndefined();
    expect(harness.registry.getRegistered('file:read')?.state).toBe('draining');
    expect(harness.registry.size).toBe(0);
    expect(harness.registry.catalog.get('file:read')?.state).toBe('draining');
    harness.registry.register(registration);
    expect(harness.registry.getRegistered('file:read')?.state).toBe('active');
  });

  it('注销 draining 注册项不再触发注销回调', () => {
    const harness = createHarness({ declared: { 'chips.platform': ['filesystem:read'] } });
    harness.registry.register({
      capability: capability('file:read', ['filesystem:read']),
      owner: PLATFORM_CAPABILITY_OWNER,
    });
    harness.registry.markDraining('file:read');
    harness.registry.unregister('file:read');
    expect(harness.unregistered).toEqual([]);
  });

  it('第三方登记契约可携带限定值目标规则', () => {
    const harness = createHarness({
      contracts: [
        {
          id: 'demo:run',
          owner: 'chips.service.demo',
          permissions: ['filesystem:read'],
          targets: [{ permission: 'filesystem:read', targetFields: ['path'] }],
        },
      ],
      declared: { 'chips.service.demo': ['filesystem:read'] },
    });
    harness.registry.register({
      capability: capability('demo:run', ['filesystem:read']),
      owner: 'chips.service.demo',
    });
    expect(harness.registry.getRegistered('demo:run')?.targets).toEqual([
      { permission: 'filesystem:read', targetFields: ['path'] },
    ]);
    expect(harness.registry.getRegistered('demo:run')?.builtin).toBe(false);
  });
});
