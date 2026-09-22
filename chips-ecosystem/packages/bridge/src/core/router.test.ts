import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChipsError } from '../protocol/errors.js';
import type { ICapabilityContext } from '../protocol/capability.js';
import { PLATFORM_CAPABILITY_OWNER } from '../protocol/capability-contracts.js';
import { findBuiltinCapability } from '../protocol/capability-contracts.js';
import { createSchemaCompiler } from '../schema/compile.js';
import { createCapabilityGate } from './concurrency.js';
import { createCapabilityRegistry } from './capability-registry.js';
import { createSessionRegistry } from './session-registry.js';
import { createPermissionEnvironment } from './qualifiers.js';
import { createBridgeRouter, type ICapabilityInvoker } from './router.js';
import { isUlid } from './ulid.js';
import type { IPermissionAuditEntry } from '../protocol/permission.js';
import type { IRegisteredCapability } from './capability-registry.js';

const EMPTY_SCHEMA = { type: 'object', additionalProperties: false, properties: {} } as const;

interface IHarnessOptions {
  readonly timeoutMs?: number;
  readonly concurrency?: 'parallel' | 'serial';
  readonly maxQueue?: number;
  readonly sessionInFlightLimit?: number;
  readonly grantedPermissions?: readonly string[];
  readonly auditThrows?: boolean;
  /** 缺省审计注入位（不装配条目组装的裸路由面）。 */
  readonly auditOff?: boolean;
  readonly now?: () => number;
}

interface IHarness {
  router: ReturnType<typeof createBridgeRouter>;
  sessions: ReturnType<typeof createSessionRegistry>;
  registry: ReturnType<typeof createCapabilityRegistry>;
  calls: Array<{ input: unknown; ctx: ICapabilityContext; registration: IRegisteredCapability }>;
  audits: IPermissionAuditEntry[];
  diagnostics: unknown[];
  setExecutor(executor: (input: unknown, ctx: ICapabilityContext) => Promise<unknown>): void;
  register(id: string, schema?: Record<string, unknown>, permissions?: string[]): void;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createHarness(options: IHarnessOptions = {}): IHarness {
  const sessions = createSessionRegistry();
  const registry = createCapabilityRegistry({
    compiler: createSchemaCompiler(),
    declaredPermissions: () =>
      new Set(['filesystem:read', 'filesystem:write', 'system:read', 'window:control']),
    contracts: [
      {
        id: 'demo:read',
        owner: 'chips.service.demo',
        permissions: ['filesystem:read'],
        targets: [{ permission: 'filesystem:read', targetFields: ['path'] }],
      },
    ],
  });
  const gate = createCapabilityGate();
  const calls: IHarness['calls'] = [];
  const audits: IPermissionAuditEntry[] = [];
  const diagnostics: unknown[] = [];
  let executor: (input: unknown, ctx: ICapabilityContext) => Promise<unknown> = () =>
    Promise.resolve(null);

  const invoker: ICapabilityInvoker = {
    async execute(registration, input, ctx) {
      calls.push({ registration, input, ctx });
      return executor(input, ctx);
    },
  };

  const router = createBridgeRouter({
    sessions,
    registry,
    gate,
    invoker,
    permissionEnvironment: createPermissionEnvironment({
      platform: 'linux',
      directories: { userDocuments: '/home/u/Documents' },
      pluginDataRoot: (pluginId) => `/data/plugins/${pluginId}`,
    }),
    ...(options.auditOff === true
      ? {}
      : {
          audit: {
            emit: (entry: IPermissionAuditEntry) => {
              if (options.auditThrows === true) {
                throw new Error('审计写入失败');
              }
              audits.push(entry);
            },
            resolvePluginVersion: () => '1.0.0',
            newTraceId: () => 't-harness',
          },
        }),
    onDiagnostic: (error) => diagnostics.push(error),
    ...(options.now !== undefined ? { now: options.now } : {}),
  });

  sessions.create({
    sessionId: 's1',
    pluginId: 'chips.official.editor',
    windowId: 1,
    frameId: 0,
    grantedPermissions: options.grantedPermissions ?? [],
  });

  return {
    router,
    sessions,
    registry,
    calls,
    audits,
    diagnostics,
    setExecutor(next) {
      executor = next;
    },
    register(id, schema = EMPTY_SCHEMA, permissions) {
      const effectivePermissions = permissions ?? [
        ...(findBuiltinCapability(id)?.permissions ?? []),
      ];
      if (id.startsWith('demo:')) {
        registry.register({
          capability: {
            id,
            permissions: effectivePermissions,
            schema,
            execute: () => Promise.resolve(null),
          },
          owner: 'chips.service.demo',
          ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
          ...(options.concurrency !== undefined ? { concurrency: options.concurrency } : {}),
          ...(options.maxQueue !== undefined ? { maxQueue: options.maxQueue } : {}),
          ...(options.sessionInFlightLimit !== undefined
            ? { sessionInFlightLimit: options.sessionInFlightLimit }
            : {}),
        });
        return;
      }
      registry.register({
        capability: {
          id,
          permissions: effectivePermissions,
          schema,
          execute: () => Promise.resolve(null),
        },
        owner: PLATFORM_CAPABILITY_OWNER,
        ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
        ...(options.concurrency !== undefined ? { concurrency: options.concurrency } : {}),
        ...(options.maxQueue !== undefined ? { maxQueue: options.maxQueue } : {}),
        ...(options.sessionInFlightLimit !== undefined
          ? { sessionInFlightLimit: options.sessionInFlightLimit }
          : {}),
      });
    },
  };
}

function requestInput(capabilityId: string, input?: unknown): unknown {
  return input === undefined
    ? { requestId: 'r1', capabilityId }
    : { requestId: 'r1', capabilityId, input };
}

const SOURCE = { windowId: 1, frameId: 0 };

afterEach(() => {
  vi.useRealTimers();
});

describe('createBridgeRouter 基础命中', () => {
  it('会话不存在返回 BRIDGE_SESSION_UNKNOWN', async () => {
    const harness = createHarness();
    harness.register('system:info');
    const response = await harness.router.handleRequest(requestInput('system:info'), {
      windowId: 9,
      frameId: 0,
    });
    expect(response).toMatchObject({
      requestId: 'r1',
      ok: false,
      error: { code: 'BRIDGE_SESSION_UNKNOWN' },
    });
  });

  it('能力未注册返回 BRIDGE_CAPABILITY_NOT_FOUND', async () => {
    const harness = createHarness();
    const response = await harness.router.handleRequest(requestInput('system:info'), SOURCE);
    expect(response).toMatchObject({ ok: false, error: { code: 'BRIDGE_CAPABILITY_NOT_FOUND' } });
  });

  it('draining 注册项按未找到处理', async () => {
    const harness = createHarness();
    harness.register('system:info');
    harness.registry.markDraining('system:info');
    const response = await harness.router.handleRequest(requestInput('system:info'), SOURCE);
    expect(response).toMatchObject({ ok: false, error: { code: 'BRIDGE_CAPABILITY_NOT_FOUND' } });
  });

  it('请求结构非法返回 BRIDGE_INTERNAL 并保留可提取的 requestId', async () => {
    const harness = createHarness();
    const response = await harness.router.handleRequest(
      { requestId: 'r9', capabilityId: '' },
      SOURCE
    );
    expect(response).toMatchObject({
      requestId: 'r9',
      ok: false,
      error: { code: 'BRIDGE_INTERNAL' },
    });
    const anonymous = await harness.router.handleRequest('bad', SOURCE);
    expect(anonymous).toMatchObject({
      requestId: '',
      ok: false,
      error: { code: 'BRIDGE_INTERNAL' },
    });
  });
});

describe('createBridgeRouter 权限与校验', () => {
  it('权限不足返回 BRIDGE_PERMISSION_DENIED 与结构化详情，并写审计', async () => {
    const harness = createHarness();
    harness.register('demo:read', EMPTY_SCHEMA, ['filesystem:read']);
    const response = await harness.router.handleRequest(
      requestInput('demo:read', { path: '/secret/a' }),
      SOURCE
    );
    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'BRIDGE_PERMISSION_DENIED',
        retryable: false,
        details: {
          capabilityId: 'demo:read',
          permission: 'filesystem:read',
          missing: ['filesystem:read'],
          granted: [],
          reason: 'not_granted',
          target: '/secret/a',
        },
      },
    });
    expect(harness.calls).toHaveLength(0);
    const denyAudit = harness.audits.at(-1);
    expect(denyAudit).toMatchObject({
      action: 'deny',
      actor: 'system',
      pluginId: 'chips.official.editor',
      pluginVersion: '1.0.0',
      sessionId: 's1',
      permission: 'filesystem:read',
      capabilityId: 'demo:read',
      target: '/secret/a',
      reason: 'not_granted',
      traceId: 't-harness',
      requestId: 'r1',
    });
    expect(denyAudit?.source).toBeUndefined();
    expect(isUlid(denyAudit?.id ?? '')).toBe(true);
    expect(Number.isNaN(Date.parse(denyAudit?.timestamp ?? ''))).toBe(false);
  });

  it('schema 校验失败返回 BRIDGE_INVALID_INPUT 且不执行', async () => {
    const harness = createHarness();
    harness.register('system:info', {
      type: 'object',
      additionalProperties: false,
      required: ['path'],
      properties: { path: { type: 'string', minLength: 1 } },
    });
    const response = await harness.router.handleRequest(
      requestInput('system:info', { path: '' }),
      SOURCE
    );
    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'BRIDGE_INVALID_INPUT',
        details: {
          capabilityId: 'system:info',
          errors: [{ pointer: '/path', keyword: 'minLength' }],
          truncated: false,
        },
      },
    });
    expect(harness.calls).toHaveLength(0);
  });

  it('权限通过后放行并写审计', async () => {
    const harness = createHarness({ grantedPermissions: ['filesystem:read'] });
    harness.register('demo:read', EMPTY_SCHEMA, ['filesystem:read']);
    harness.setExecutor(() => Promise.resolve({ value: 1 }));
    const response = await harness.router.handleRequest(requestInput('demo:read', {}), SOURCE);
    expect(response).toMatchObject({ ok: true, result: { value: 1 } });
    expect(harness.audits.at(-1)).toMatchObject({
      action: 'allow',
      actor: 'system',
      permission: 'filesystem:read',
      capabilityId: 'demo:read',
      traceId: 't-harness',
      requestId: 'r1',
    });
    expect(harness.audits.at(-1)?.reason).toBeUndefined();
  });

  it('审计写入失败不阻塞调用且记录诊断', async () => {
    const harness = createHarness({ auditThrows: true });
    harness.register('system:info');
    harness.setExecutor(() => Promise.resolve('ok'));
    const response = await harness.router.handleRequest(requestInput('system:info'), SOURCE);
    expect(response).toMatchObject({ ok: true, result: 'ok' });
    expect(harness.diagnostics).toHaveLength(1);
  });
});

describe('createBridgeRouter 横切贯通（traceId/requestId，工单046 段一）', () => {
  it('请求帧 traceId 贯通审计条目与能力调用上下文', async () => {
    const harness = createHarness({ grantedPermissions: ['filesystem:read'] });
    harness.register('demo:read', EMPTY_SCHEMA, ['filesystem:read']);
    harness.setExecutor(() => Promise.resolve('ok'));
    const response = await harness.router.handleRequest(
      { requestId: 'r-trace', capabilityId: 'demo:read', input: {}, traceId: 't-chain-1' },
      SOURCE
    );
    expect(response).toMatchObject({ ok: true, result: 'ok' });
    expect(harness.audits.at(-1)).toMatchObject({ traceId: 't-chain-1', requestId: 'r-trace' });
    expect(harness.calls.at(-1)?.ctx).toMatchObject({
      traceId: 't-chain-1',
      requestId: 'r-trace',
    });
  });

  it('请求帧未携 traceId：上下文如实缺省，审计条目经 newTraceId 兜底', async () => {
    const harness = createHarness({ grantedPermissions: ['filesystem:read'] });
    harness.register('demo:read', EMPTY_SCHEMA, ['filesystem:read']);
    harness.setExecutor(() => Promise.resolve('ok'));
    const response = await harness.router.handleRequest(requestInput('demo:read', {}), SOURCE);
    expect(response).toMatchObject({ ok: true });
    expect(harness.calls.at(-1)?.ctx.traceId).toBeUndefined();
    expect(harness.calls.at(-1)?.ctx.requestId).toBe('r1');
    expect(harness.audits.at(-1)?.traceId).toBe('t-harness');
  });

  it('缺省审计注入位：判定照常放行且零条目组装副作用', async () => {
    const harness = createHarness({ grantedPermissions: ['filesystem:read'], auditOff: true });
    harness.register('demo:read', EMPTY_SCHEMA, ['filesystem:read']);
    harness.setExecutor(() => Promise.resolve('ok'));
    const response = await harness.router.handleRequest(requestInput('demo:read', {}), SOURCE);
    expect(response).toMatchObject({ ok: true, result: 'ok' });
    expect(harness.audits).toHaveLength(0);
    expect(harness.diagnostics).toHaveLength(0);
  });
});

describe('createBridgeRouter 信封与上下文', () => {
  it('二进制字段拆分后合并回 Uint8Array 交给 execute', async () => {
    const harness = createHarness();
    harness.register('system:info', {
      type: 'object',
      additionalProperties: false,
      required: ['data'],
      properties: { data: { 'x-chips-binary': 4 } },
    });
    harness.setExecutor((input) => Promise.resolve(input));
    const response = await harness.router.handleRequest(
      requestInput('system:info', { data: new Uint8Array([1, 2, 3]) }),
      SOURCE
    );
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result).toEqual({ data: new Uint8Array([1, 2, 3]) });
    }
  });

  it('二进制超限返回 BRIDGE_INVALID_INPUT', async () => {
    const harness = createHarness();
    harness.register('system:info', {
      type: 'object',
      additionalProperties: false,
      required: ['data'],
      properties: { data: { 'x-chips-binary': 2 } },
    });
    const response = await harness.router.handleRequest(
      requestInput('system:info', { data: new Uint8Array(3) }),
      SOURCE
    );
    expect(response).toMatchObject({ ok: false, error: { code: 'BRIDGE_INVALID_INPUT' } });
    expect(harness.calls).toHaveLength(0);
  });

  it('调用上下文如实传递 sessionId / callerId / signal / deadline', async () => {
    const harness = createHarness({ timeoutMs: 5000, now: () => 1000 });
    harness.register('system:info');
    harness.setExecutor((_input, ctx) =>
      Promise.resolve({
        sessionId: ctx.sessionId,
        callerId: ctx.callerId,
        deadline: ctx.deadline,
        aborted: ctx.signal.aborted,
      })
    );
    const response = await harness.router.handleRequest(requestInput('system:info'), SOURCE);
    expect(response).toMatchObject({
      ok: true,
      result: {
        sessionId: 's1',
        callerId: 'chips.official.editor',
        deadline: 6000,
        aborted: false,
      },
    });
  });

  it('未识别异常归一为 BRIDGE_INTERNAL 并写诊断', async () => {
    const harness = createHarness();
    harness.register('system:info');
    harness.setExecutor(() => Promise.reject(new Error('boom')));
    const response = await harness.router.handleRequest(requestInput('system:info'), SOURCE);
    expect(response).toMatchObject({ ok: false, error: { code: 'BRIDGE_INTERNAL' } });
    expect(harness.diagnostics).toHaveLength(1);
  });

  it('宿主业务错误码原样透传', async () => {
    const harness = createHarness();
    harness.register('system:info');
    harness.setExecutor(() =>
      Promise.reject(new ChipsError({ code: 'FILE_NOT_FOUND', message: '文件不存在' }))
    );
    const response = await harness.router.handleRequest(requestInput('system:info'), SOURCE);
    expect(response).toMatchObject({ ok: false, error: { code: 'FILE_NOT_FOUND' } });
  });

  it('不可克隆的结果归一为 BRIDGE_INTERNAL', async () => {
    const harness = createHarness();
    harness.register('system:info');
    harness.setExecutor(() => Promise.resolve({ handler: () => undefined }));
    const response = await harness.router.handleRequest(requestInput('system:info'), SOURCE);
    expect(response).toMatchObject({ ok: false, error: { code: 'BRIDGE_INTERNAL' } });
  });
});

describe('createBridgeRouter 并发与超时', () => {
  it('会话在途超限返回 BRIDGE_SESSION_BUSY', async () => {
    const harness = createHarness({ sessionInFlightLimit: 1 });
    harness.register('system:info');
    const gate = deferred<unknown>();
    harness.setExecutor(async () => gate.promise);
    const first = harness.router.handleRequest(requestInput('system:info'), SOURCE);
    await Promise.resolve();
    const second = await harness.router.handleRequest(
      { requestId: 'r2', capabilityId: 'system:info' },
      SOURCE
    );
    expect(second).toMatchObject({
      requestId: 'r2',
      ok: false,
      error: { code: 'BRIDGE_SESSION_BUSY', retryable: true },
    });
    gate.resolve('done');
    await expect(first).resolves.toMatchObject({ ok: true, result: 'done' });
  });

  it('串行能力队列溢出返回 BRIDGE_QUEUE_OVERFLOW', async () => {
    const harness = createHarness({ concurrency: 'serial', maxQueue: 0 });
    harness.register('system:info');
    const gate = deferred<unknown>();
    harness.setExecutor(async () => gate.promise);
    const first = harness.router.handleRequest(requestInput('system:info'), SOURCE);
    await Promise.resolve();
    const response = await harness.router.handleRequest(
      { requestId: 'r2', capabilityId: 'system:info' },
      SOURCE
    );
    expect(response).toMatchObject({
      ok: false,
      error: { code: 'BRIDGE_QUEUE_OVERFLOW', retryable: true },
    });
    gate.resolve('done');
    await first;
  });

  it('超时返回 BRIDGE_TIMEOUT 并丢弃迟到结果', async () => {
    vi.useFakeTimers();
    const harness = createHarness({ timeoutMs: 1000 });
    harness.register('system:info');
    let lateResolve: ((value: unknown) => void) | undefined;
    harness.setExecutor(
      async () =>
        new Promise((resolve) => {
          lateResolve = resolve;
        })
    );
    const responsePromise = harness.router.handleRequest(requestInput('system:info'), SOURCE);
    await Promise.resolve();
    expect(harness.router.inFlightCount).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    const response = await responsePromise;
    expect(response).toMatchObject({
      ok: false,
      error: { code: 'BRIDGE_TIMEOUT', retryable: true },
    });
    expect(harness.router.inFlightCount).toBe(0);
    lateResolve?.('late');
    await Promise.resolve();
    expect(harness.router.inFlightCount).toBe(0);
  });

  it('会话关闭取消在途调用并返回 BRIDGE_CANCELLED', async () => {
    const harness = createHarness();
    harness.register('system:info');
    const gate = deferred<unknown>();
    harness.setExecutor(async () => gate.promise);
    const promise = harness.router.handleRequest(requestInput('system:info'), SOURCE);
    await Promise.resolve();
    harness.sessions.close('s1');
    const response = await promise;
    expect(response).toMatchObject({ ok: false, error: { code: 'BRIDGE_CANCELLED' } });
    gate.resolve('late');
  });

  it('cancelCapability / dispose 取消在途调用', async () => {
    const harness = createHarness();
    harness.register('system:info');
    const first = deferred<unknown>();
    harness.setExecutor(async () => first.promise);
    const callA = harness.router.handleRequest(requestInput('system:info'), SOURCE);
    await Promise.resolve();
    harness.router.cancelCapability('system:info');
    await expect(callA).resolves.toMatchObject({ ok: false, error: { code: 'BRIDGE_CANCELLED' } });

    const second = deferred<unknown>();
    harness.setExecutor(async () => second.promise);
    const callB = harness.router.handleRequest(
      { requestId: 'r3', capabilityId: 'system:info' },
      SOURCE
    );
    await Promise.resolve();
    expect(harness.router.inFlightCount).toBe(1);
    harness.router.dispose();
    await expect(callB).resolves.toMatchObject({ ok: false, error: { code: 'BRIDGE_CANCELLED' } });
    expect(harness.router.inFlightCount).toBe(0);
    second.resolve('x');
  });

  it('cancelSession 取消指定会话在途调用', async () => {
    const harness = createHarness();
    harness.register('system:info');
    const gate = deferred<unknown>();
    harness.setExecutor(async () => gate.promise);
    const call = harness.router.handleRequest(requestInput('system:info'), SOURCE);
    await Promise.resolve();
    harness.router.cancelSession('s1');
    await expect(call).resolves.toMatchObject({ ok: false, error: { code: 'BRIDGE_CANCELLED' } });
  });
});
