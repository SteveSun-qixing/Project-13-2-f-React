import { describe, expect, it, vi } from 'vitest';

import { createHostCapabilityRouter } from '../src/runtime/capability/router.js';
import { createHostCapabilityRegistry } from '../src/runtime/capability/registry.js';
import { createHostCallScheduler } from '../src/runtime/capability/scheduler.js';
import type { IHostCapabilityDescriptor, IHostSession } from '../src/runtime/capability/contracts.js';
import type { IHostCapabilityRegistry } from '../src/runtime/capability/registry.js';
import type { IHostCallScheduler } from '../src/runtime/capability/scheduler.js';
import type { IBridgeRequest } from '../src/protocol/wire.js';

function makeSession(granted: readonly string[] = ['*']): IHostSession {
  return {
    sessionId: 'sess-1',
    pluginId: 'demo.plug',
    windowId: 42,
    frameId: null,
    grantedPermissions: new Set(granted),
    openedDocuments: new Set(),
    state: 'active',
    permissionVersion: 0,
  };
}

interface Harness {
  registry: IHostCapabilityRegistry;
  scheduler: IHostCallScheduler;
  publishEvent: ReturnType<typeof vi.fn>;
  sessionSignal: AbortController;
  route: (request: IBridgeRequest) => Promise<import('../src/protocol/wire.js').IBridgeResponse>;
  routeWith: (
    session: IHostSession,
    request: IBridgeRequest,
  ) => Promise<import('../src/protocol/wire.js').IBridgeResponse>;
}

function harness(extra?: { readonly now?: () => number }): Harness {
  const registry = createHostCapabilityRegistry();
  const scheduler = createHostCallScheduler();
  const publishEvent = vi.fn();
  const sessionSignal = new AbortController();
  const router = createHostCapabilityRouter({
    registry,
    scheduler,
    now: extra?.now ?? ((): number => Date.now()),
    publishEvent,
    sessionSignalFor: () => sessionSignal.signal,
  });
  const session = makeSession();
  return {
    registry,
    scheduler,
    publishEvent,
    sessionSignal,
    route: (request) => router.route(session, request),
    routeWith: (s, request) => router.route(s, request),
  };
}

function descriptor(overrides: Partial<IHostCapabilityDescriptor> = {}): IHostCapabilityDescriptor {
  return { id: 'test:action', permissions: [], handler: () => Promise.resolve(null), ...overrides };
}

const req = (capabilityId: string, input?: unknown): IBridgeRequest => ({ requestId: 'r-1', capabilityId, input });

describe('能力路由管线（02 §5.2）', () => {
  it('注册命中：返回 handler 结果', async () => {
    const h = harness();
    h.registry.register(descriptor({ handler: (input) => Promise.resolve({ echoed: input }) }));
    const response = await h.route(req('test:action', { a: 1 }));
    expect(response).toEqual({ requestId: 'r-1', ok: true, result: { echoed: { a: 1 } } });
  });

  it('注册表未命中：BRIDGE_CAPABILITY_NOT_FOUND', async () => {
    const h = harness();
    const response = await h.route(req('missing:cap'));
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_CAPABILITY_NOT_FOUND');
      expect(response.error.details).toEqual({ capabilityId: 'missing:cap' });
    }
  });

  it('draining 能力视为未命中', async () => {
    const h = harness();
    h.registry.register(descriptor());
    h.registry.markDraining('test:action');
    const response = await h.route(req('test:action'));
    expect(response.ok).toBe(false);
  });

  it('权限不足：BRIDGE_PERMISSION_DENIED 且携带缺失权限', async () => {
    const h = harness();
    h.registry.register(descriptor({ permissions: ['resources:write'], handler: () => Promise.resolve('nope') }));
    const response = await h.routeWith(makeSession([]), req('test:action'));
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_PERMISSION_DENIED');
      expect(response.error.details).toMatchObject({ permission: 'resources:write', missing: ['resources:write'] });
    }
  });

  it('输入缺少必填字段：BRIDGE_INVALID_INPUT', async () => {
    const h = harness();
    h.registry.register(descriptor({ schema: { type: 'object', required: ['documentId'] } }));
    const response = await h.route(req('test:action', {}));
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_INVALID_INPUT');
      expect(response.error.details).toEqual({ capabilityId: 'test:action', missing: ['documentId'] });
    }
  });

  it('handler 抛出结构化错误：按码归一传播', async () => {
    const h = harness();
    h.registry.register(
      descriptor({
        handler: () =>
          Promise.reject(Object.assign(new Error('资源缺失'), { code: 'RESOURCE_NOT_FOUND', retryable: false })),
      }),
    );
    const response = await h.route(req('test:action'));
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('RESOURCE_NOT_FOUND');
    }
  });

  it('超时：BRIDGE_TIMEOUT 并取消上下文信号', async () => {
    const h = harness();
    let observedSignal = false;
    h.registry.register(
      descriptor({
        timeoutMs: 20,
        handler: (_input, ctx) =>
          new Promise((resolve) => {
            ctx.signal.addEventListener('abort', () => {
              observedSignal = true;
              resolve(null);
            });
          }),
      }),
    );
    const response = await h.route(req('test:action'));
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_TIMEOUT');
    }
    expect(observedSignal).toBe(true);
    expect(h.scheduler.inFlight).toBe(0);
  });

  it('会话取消：BRIDGE_CANCELLED', async () => {
    const h = harness();
    h.registry.register(
      descriptor({
        timeoutMs: 5000,
        handler: (_input, ctx) =>
          new Promise((_resolve, reject) => {
            ctx.signal.addEventListener('abort', () =>
              reject(Object.assign(new Error('取消'), { code: 'BRIDGE_CANCELLED' })),
            );
          }),
      }),
    );
    const promise = h.route(req('test:action'));
    h.sessionSignal.abort();
    const response = await promise;
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_CANCELLED');
    }
  });

  it('上下文 emit 经 publishEvent 投递到会话窗口', async () => {
    const h = harness();
    h.registry.register(
      descriptor({
        handler: (_input, ctx) => {
          ctx.emit('document:changed', { id: 'd1' });
          return Promise.resolve('done');
        },
      }),
    );
    const response = await h.route(req('test:action'));
    expect(response.ok).toBe(true);
    expect(h.publishEvent).toHaveBeenCalledWith('sess-1', 42, 'document:changed', { id: 'd1' });
  });

  it('deadline = now + timeoutMs 如实传递给上下文', async () => {
    const h = harness({ now: () => 1000 });
    let seenDeadline = 0;
    h.registry.register(
      descriptor({
        timeoutMs: 2500,
        handler: (_input, ctx) => {
          seenDeadline = ctx.deadline;
          return Promise.resolve(null);
        },
      }),
    );
    await h.route(req('test:action'));
    expect(seenDeadline).toBe(3500);
  });
});

describe('并发与在途闸门', () => {
  it('同会话对同一能力超过在途上限：BRIDGE_SESSION_BUSY', async () => {
    const scheduler = createHostCallScheduler();
    const gate = {
      capabilityId: 'test:action',
      sessionId: 'sess-1',
      concurrency: 'parallel' as const,
      maxQueue: 32,
      sessionInFlightLimit: 1,
      signal: new AbortController().signal,
    };
    const permit = await scheduler.acquire(gate);
    await expect(scheduler.acquire(gate)).rejects.toMatchObject({ code: 'BRIDGE_SESSION_BUSY' });
    permit.release();
    expect(scheduler.inFlight).toBe(0);
  });

  it('serial 并发：第二个调用排队至第一个释放', async () => {
    const scheduler = createHostCallScheduler();
    const order: string[] = [];
    const signal = new AbortController().signal;
    const gate = {
      capabilityId: 'test:serial',
      sessionId: 'sess-1',
      concurrency: 'serial' as const,
      maxQueue: 8,
      sessionInFlightLimit: 64,
      signal,
    };
    const first = await scheduler.acquire(gate);
    const secondPromise = scheduler.acquire(gate).then((p) => {
      order.push('second');
      p.release();
    });
    order.push('first');
    await Promise.resolve();
    first.release();
    await secondPromise;
    expect(order).toEqual(['first', 'second']);
  });

  it('serial 队列已满：BRIDGE_QUEUE_OVERFLOW', async () => {
    const scheduler = createHostCallScheduler();
    const gate = {
      capabilityId: 'test:serial',
      sessionId: 'sess-1',
      concurrency: 'serial' as const,
      maxQueue: 0,
      sessionInFlightLimit: 64,
      signal: new AbortController().signal,
    };
    await scheduler.acquire(gate);
    await expect(scheduler.acquire(gate)).rejects.toMatchObject({ code: 'BRIDGE_QUEUE_OVERFLOW' });
  });

  it('serial 等待中被取消信号打断：BRIDGE_CANCELLED 且出队', async () => {
    const scheduler = createHostCallScheduler();
    const canceller = new AbortController();
    const gate = {
      capabilityId: 'test:serial',
      sessionId: 'sess-1',
      concurrency: 'serial' as const,
      maxQueue: 8,
      sessionInFlightLimit: 64,
      signal: canceller.signal,
    };
    await scheduler.acquire(gate); // 占位
    const waiting = scheduler.acquire(gate);
    canceller.abort();
    await expect(waiting).rejects.toMatchObject({ code: 'BRIDGE_CANCELLED' });
  });
});
