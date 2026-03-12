import { describe, expect, it } from 'vitest';
import { KernelRouter } from '../../packages/kernel/src';
import type { RouteInvocationContext } from '../../src/shared/types';

const context = (requestId = 'req-1'): RouteInvocationContext => ({
  requestId,
  caller: {
    id: 'tester',
    type: 'service',
    permissions: ['math.read', 'math.write']
  },
  timestamp: Date.now()
});

describe('KernelRouter', () => {
  it('invokes a registered route', async () => {
    const router = new KernelRouter();
    router.register({
      key: 'math.add',
      schemaIn: 'schemas/math.add.request.json',
      schemaOut: 'schemas/math.add.response.json',
      permission: ['math.read'],
      timeoutMs: 1000,
      idempotent: true,
      retries: 0,
      handler: async (input: { a: number; b: number }) => ({ sum: input.a + input.b })
    });

    const result = await router.invoke<{ a: number; b: number }, { sum: number }>('math.add', { a: 1, b: 2 }, context());
    expect(result.sum).toBe(3);
  });

  it('blocks calls without permission', async () => {
    const router = new KernelRouter();
    router.register({
      key: 'secure.action',
      schemaIn: 'schemas/secure.action.request.json',
      schemaOut: 'schemas/secure.action.response.json',
      permission: ['secure.use'],
      timeoutMs: 1000,
      idempotent: true,
      retries: 0,
      handler: async () => ({ ok: true })
    });

    await expect(
      router.invoke('secure.action', {}, {
        ...context(),
        caller: {
          ...context().caller,
          permissions: []
        }
      })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('allows namespace manage permissions to satisfy specific route permissions', async () => {
    const router = new KernelRouter();
    router.register({
      key: 'file.copy',
      schemaIn: 'schemas/file.copy.request.json',
      schemaOut: 'schemas/file.copy.response.json',
      permission: ['file.manage'],
      timeoutMs: 1000,
      idempotent: false,
      retries: 0,
      handler: async () => ({ ok: true })
    });
    router.register({
      key: 'file.stat',
      schemaIn: 'schemas/file.stat.request.json',
      schemaOut: 'schemas/file.stat.response.json',
      permission: ['file.read'],
      timeoutMs: 1000,
      idempotent: true,
      retries: 0,
      handler: async () => ({ ok: true })
    });

    const manageContext: RouteInvocationContext = {
      ...context('req-manage'),
      caller: {
        ...context('req-manage').caller,
        permissions: ['file.manage']
      }
    };

    await expect(router.invoke('file.copy', {}, manageContext)).resolves.toEqual({ ok: true });
    await expect(router.invoke('file.stat', {}, manageContext)).resolves.toEqual({ ok: true });
  });

  it('retries retryable errors for idempotent actions', async () => {
    const router = new KernelRouter();
    let calls = 0;
    router.register({
      key: 'unstable.fetch',
      schemaIn: 'schemas/unstable.fetch.request.json',
      schemaOut: 'schemas/unstable.fetch.response.json',
      permission: ['math.read'],
      timeoutMs: 1000,
      idempotent: true,
      retries: 2,
      handler: async () => {
        calls += 1;
        if (calls < 3) {
          throw { code: 'SERVICE_UNAVAILABLE', message: 'not ready', retryable: true };
        }
        return { ok: true };
      }
    });

    const result = await router.invoke('unstable.fetch', {}, context());
    expect(result).toMatchObject({ ok: true });
    expect(calls).toBe(3);
  });

  it('rejects replayed request IDs for non-idempotent routes', async () => {
    const router = new KernelRouter({ replayWindowMs: 5_000 });
    let calls = 0;
    router.register({
      key: 'math.increment',
      schemaIn: 'schemas/math.increment.request.json',
      schemaOut: 'schemas/math.increment.response.json',
      permission: ['math.write'],
      timeoutMs: 1000,
      idempotent: false,
      retries: 0,
      handler: async (input: { value: number }) => {
        calls += 1;
        return { next: input.value + 1 };
      }
    });

    const initial = await router.invoke<{ value: number }, { next: number }>('math.increment', { value: 1 }, context('req-replay'));
    expect(initial.next).toBe(2);

    await expect(
      router.invoke<{ value: number }, { next: number }>('math.increment', { value: 1 }, context('req-replay'))
    ).rejects.toMatchObject({ code: 'ROUTE_REPLAY_DETECTED' });
    expect(calls).toBe(1);
  });

  it('allows repeated request IDs for idempotent routes', async () => {
    const router = new KernelRouter({ replayWindowMs: 5_000 });
    let calls = 0;
    router.register({
      key: 'math.constant',
      schemaIn: 'schemas/math.constant.request.json',
      schemaOut: 'schemas/math.constant.response.json',
      permission: ['math.read'],
      timeoutMs: 1000,
      idempotent: true,
      retries: 0,
      handler: async () => {
        calls += 1;
        return { value: 42 };
      }
    });

    const first = await router.invoke<{}, { value: number }>('math.constant', {}, context('req-stable'));
    const second = await router.invoke<{}, { value: number }>('math.constant', {}, context('req-stable'));

    expect(first.value).toBe(42);
    expect(second.value).toBe(42);
    expect(calls).toBe(2);
  });

  it('does not match prefix routes when namespace boundary is missing', async () => {
    const router = new KernelRouter();
    router.register({
      key: 'file.*',
      schemaIn: 'schemas/file.any.request.json',
      schemaOut: 'schemas/file.any.response.json',
      permission: ['math.read'],
      timeoutMs: 1000,
      idempotent: true,
      retries: 0,
      handler: async () => ({ ok: true })
    });

    await expect(router.invoke('filex.read', {}, context())).rejects.toMatchObject({
      code: 'ROUTE_NOT_FOUND'
    });
  });

  it('opens circuit after repeated failures and recovers after cooldown', async () => {
    const router = new KernelRouter({ failureThreshold: 2, coolDownMs: 30 });
    let calls = 0;

    router.register({
      key: 'unstable.circuit',
      schemaIn: 'schemas/unstable.circuit.request.json',
      schemaOut: 'schemas/unstable.circuit.response.json',
      permission: ['math.read'],
      timeoutMs: 100,
      idempotent: false,
      retries: 0,
      handler: async () => {
        calls += 1;
        throw { code: 'SERVICE_UNAVAILABLE', message: 'fail' };
      }
    });

    await expect(router.invoke('unstable.circuit', {}, context('c1'))).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE'
    });
    await expect(router.invoke('unstable.circuit', {}, context('c2'))).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE'
    });
    const before = calls;

    await expect(router.invoke('unstable.circuit', {}, context('c3'))).rejects.toMatchObject({
      code: 'RUNTIME_CIRCUIT_OPEN'
    });
    expect(calls).toBe(before);

    await new Promise((resolve) => setTimeout(resolve, 40));

    await expect(router.invoke('unstable.circuit', {}, context('c4'))).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE'
    });
    expect(calls).toBe(before + 1);
  });
});
