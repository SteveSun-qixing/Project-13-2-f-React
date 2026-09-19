import { describe, expect, it, vi } from 'vitest';
import { ChipsError } from '../protocol/errors.js';
import { IPC_CHANNELS, eventChannel } from '../protocol/ipc.js';
import { RESOURCE_ERROR_CODES } from '../protocol/resource.js';
import { EVENT_ERROR_CODES } from '../protocol/events.js';
import type { IResourceByteSource } from './transport.js';
import { createBridgeClient } from './bridge-client.js';
import {
  createFakeTransport,
  flushAsync,
  type IFakeTransport,
} from '../../tests/fixtures/ipc-transport.js';
import { thrownErrorCode } from '../../tests/fixtures/expect-chips-error.js';

const SESSION_ID = 'session-001';
const CAPABILITY_ID = 'file:read';

function createBytes(): IResourceByteSource {
  return {
    read: () => Promise.resolve(new Uint8Array([1])),
    readRange: () => Promise.resolve(new Uint8Array([2])),
    openStream: () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      }),
  };
}

interface IHarness {
  fake: IFakeTransport;
  client: ReturnType<typeof createBridgeClient>;
  emitEvent(eventId: string, payload: unknown): void;
  controlAcks: Array<{ controlId: string; action: string; eventId: string }>;
}

function createHarness(
  options: {
    grantedPermissions?: readonly string[];
    isOwnResourceScope?: (scope: string) => boolean;
    onDiagnostic?: (error: unknown) => void;
  } = {}
): IHarness {
  const fake = createFakeTransport();
  const controlAcks: IHarness['controlAcks'] = [];
  fake.onInvoke(IPC_CHANNELS.bridgeRequest, (payload) => {
    const request = payload as { requestId: string; capabilityId: string; input?: unknown };
    return {
      requestId: request.requestId,
      ok: true,
      result: { capabilityId: request.capabilityId },
    };
  });
  fake.onInvoke(IPC_CHANNELS.eventControl, (payload) => {
    const control = payload as { controlId: string; action: string; eventId: string };
    controlAcks.push(control);
    return { controlId: control.controlId, ok: true };
  });
  fake.onInvoke(IPC_CHANNELS.bridgeResource, (payload) => {
    const request = payload as { requestId: string; operation: string; uri: string };
    if (request.operation === 'release') {
      return { requestId: request.requestId, ok: true, metadata: null };
    }
    return {
      requestId: request.requestId,
      ok: true,
      metadata: {
        uri: request.uri,
        size: 4,
        mimeType: 'text/plain',
        version: 'v1',
        scope: 'document',
      },
    };
  });
  const client = createBridgeClient({
    transport: fake.transport,
    sessionId: SESSION_ID,
    bytes: createBytes(),
    createRequestId: () => 'request-fixed',
    ...(options.grantedPermissions !== undefined
      ? { grantedPermissions: options.grantedPermissions }
      : {}),
    ...(options.isOwnResourceScope !== undefined
      ? { isOwnResourceScope: options.isOwnResourceScope }
      : {}),
    ...(options.onDiagnostic !== undefined ? { onDiagnostic: options.onDiagnostic } : {}),
  });
  return {
    fake,
    client,
    controlAcks,
    emitEvent(eventId, payload) {
      fake.emit(eventChannel(eventId), { eventId, payload, emittedAt: 1 });
    },
  };
}

describe('createBridgeClient.request', () => {
  it('经 bridge:request 调用能力并返回结果', async () => {
    const harness = createHarness();
    await expect(harness.client.request(CAPABILITY_ID, { path: '/a' })).resolves.toEqual({
      capabilityId: CAPABILITY_ID,
    });
    expect(harness.fake.invocations[0]?.channel).toBe(IPC_CHANNELS.bridgeRequest);
    expect(harness.fake.invocations[0]?.payload).toEqual({
      requestId: 'request-fixed',
      capabilityId: CAPABILITY_ID,
      input: { path: '/a' },
    });
  });

  it('无输入的调用不携带 input 字段', async () => {
    const harness = createHarness();
    await harness.client.request('system:info');
    expect(harness.fake.invocations[0]?.payload).toEqual({
      requestId: 'request-fixed',
      capabilityId: 'system:info',
    });
  });

  it('回执 ok:false 时以 ChipsError reject 并保留 code 与 retryable', async () => {
    const harness = createHarness();
    harness.fake.onInvoke(IPC_CHANNELS.bridgeRequest, (payload) => {
      const request = payload as { requestId: string };
      return {
        requestId: request.requestId,
        ok: false,
        error: { code: 'BRIDGE_TIMEOUT', message: '能力调用超时', retryable: true },
      };
    });
    await expect(harness.client.request(CAPABILITY_ID)).rejects.toMatchObject({
      code: 'BRIDGE_TIMEOUT',
      retryable: true,
    });
  });

  it('回执 requestId 不匹配时以 BRIDGE_INTERNAL 拒绝（迟到结果丢弃）', async () => {
    const harness = createHarness();
    harness.fake.onInvoke(IPC_CHANNELS.bridgeRequest, () => ({
      requestId: 'late-response',
      ok: true,
      result: null,
    }));
    await expect(harness.client.request(CAPABILITY_ID)).rejects.toMatchObject({
      code: 'BRIDGE_INTERNAL',
    });
  });

  it('传输层异常归一为 BRIDGE_INTERNAL 并记录诊断', async () => {
    const onDiagnostic = vi.fn();
    const harness = createHarness({ onDiagnostic });
    harness.fake.onInvoke(IPC_CHANNELS.bridgeRequest, () => {
      throw new Error('IPC 断开');
    });
    await expect(harness.client.request(CAPABILITY_ID)).rejects.toMatchObject({
      code: 'BRIDGE_INTERNAL',
    });
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
  });
});

describe('createBridgeClient.subscribe', () => {
  it('非法事件 ID 同步抛出 EVENT_ID_INVALID 且不建立订阅', () => {
    const harness = createHarness();
    expect(thrownErrorCode(() => harness.client.subscribe('File.Changed', () => undefined))).toBe(
      EVENT_ERROR_CODES.idInvalid
    );
    expect(harness.client.subscriptionCount).toBe(0);
    expect(harness.fake.channels()).toEqual([IPC_CHANNELS.sessionPermissions]);
  });

  it('订阅确认前缓冲载荷，确认后按序派发', async () => {
    const harness = createHarness();
    const received: unknown[] = [];
    harness.client.subscribe('file:changed', (payload) => received.push(payload));
    expect(harness.client.subscriptionCount).toBe(1);
    harness.emitEvent('file:changed', { uri: 'a' });
    harness.emitEvent('file:changed', { uri: 'b' });
    expect(received).toEqual([]);
    await flushAsync();
    expect(harness.controlAcks).toEqual([
      { controlId: 'request-fixed', action: 'subscribe', eventId: 'file:changed' },
    ]);
    expect(received).toEqual([{ uri: 'a' }, { uri: 'b' }]);
  });

  it('同一事件的两个 handler 各自独立；dispose 一个不影响另一个', async () => {
    const harness = createHarness();
    const first: unknown[] = [];
    const second: unknown[] = [];
    const subscriptionA = harness.client.subscribe('file:changed', (payload) =>
      first.push(payload)
    );
    const subscriptionB = harness.client.subscribe('file:changed', (payload) =>
      second.push(payload)
    );
    await flushAsync();
    expect(harness.controlAcks).toHaveLength(1);
    subscriptionA.dispose();
    subscriptionA.dispose();
    harness.emitEvent('file:changed', { uri: 'a' });
    expect(first).toEqual([]);
    expect(second).toEqual([{ uri: 'a' }]);
    expect(harness.client.subscriptionCount).toBe(1);
    subscriptionB.dispose();
    await flushAsync();
    expect(harness.controlAcks).toHaveLength(2);
    expect(harness.controlAcks[1]?.action).toBe('unsubscribe');
    expect(harness.fake.listenerCount(eventChannel('file:changed'))).toBe(0);
  });

  it('回执失败时订阅不建立：缓冲丢弃、监听移除、dispose 无副作用', async () => {
    const harness = createHarness();
    harness.fake.onInvoke(IPC_CHANNELS.eventControl, (payload) => {
      const control = payload as { controlId: string };
      return {
        controlId: control.controlId,
        ok: false,
        error: {
          code: EVENT_ERROR_CODES.subscribeDenied,
          message: '该事件对插件不可见',
          retryable: false,
        },
      };
    });
    const received: unknown[] = [];
    const subscription = harness.client.subscribe('security:audit', (payload) =>
      received.push(payload)
    );
    harness.emitEvent('security:audit', { action: 'grant' });
    await flushAsync();
    expect(received).toEqual([]);
    expect(harness.client.subscriptionCount).toBe(0);
    expect(harness.fake.listenerCount(eventChannel('security:audit'))).toBe(0);
    expect(() => subscription.dispose()).not.toThrow();
    expect(harness.fake.invocations).toHaveLength(1);
  });

  it('handler 抛出的异常被捕获且不影响其他订阅者', async () => {
    const onDiagnostic = vi.fn();
    const harness = createHarness({ onDiagnostic });
    const received: unknown[] = [];
    harness.client.subscribe('file:changed', () => {
      throw new Error('handler 失败');
    });
    harness.client.subscribe('file:changed', (payload) => received.push(payload));
    await flushAsync();
    harness.emitEvent('file:changed', { uri: 'a' });
    expect(received).toEqual([{ uri: 'a' }]);
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
  });

  it('封套 eventId 与通道不一致时忽略该封套', async () => {
    const harness = createHarness();
    const received: unknown[] = [];
    harness.client.subscribe('file:changed', (payload) => received.push(payload));
    await flushAsync();
    harness.fake.emit(eventChannel('file:changed'), {
      eventId: 'document:changed',
      payload: { uri: 'a' },
      emittedAt: 1,
    });
    expect(received).toEqual([]);
  });

  it('dispose 清理全部订阅与内部监听', async () => {
    const harness = createHarness();
    harness.client.subscribe('file:changed', () => undefined);
    harness.client.subscribe('document:changed', () => undefined);
    await flushAsync();
    harness.client.dispose();
    expect(harness.client.subscriptionCount).toBe(0);
    expect(harness.fake.channels()).toEqual([]);
  });
});

describe('createBridgeClient.resource', () => {
  it('URI 语法非法同步抛出 RESOURCE_INVALID_URI', () => {
    const harness = createHarness();
    expect(thrownErrorCode(() => harness.client.resource('chips-resource://card-1/a/../b'))).toBe(
      RESOURCE_ERROR_CODES.pathInvalid
    );
  });

  it('不支持的 scheme 同步抛出 RESOURCE_UNSUPPORTED_SCHEME', () => {
    const harness = createHarness();
    expect(thrownErrorCode(() => harness.client.resource('file:///tmp/a.png'))).toBe(
      RESOURCE_ERROR_CODES.unsupportedScheme
    );
  });

  it('无资源读取权限时预检同步抛出 RESOURCE_PERMISSION_DENIED', () => {
    const harness = createHarness({ grantedPermissions: ['filesystem:read'] });
    expect(thrownErrorCode(() => harness.client.resource('chips-resource://card-1/a.png'))).toBe(
      RESOURCE_ERROR_CODES.permissionDenied
    );
  });

  it('基础权限或同域通配放行预检', () => {
    const withBase = createHarness({ grantedPermissions: ['resources:read'] });
    expect(withBase.client.resource('chips-resource://card-1/a.png').uri).toBe(
      'chips-resource://card-1/a.png'
    );
    const withWildcard = createHarness({ grantedPermissions: ['resources:*'] });
    expect(withWildcard.client.resource('chips-resource://card-1/a.png').uri).toBe(
      'chips-resource://card-1/a.png'
    );
  });

  it('限定值覆盖目标作用域时放行，超出作用域时拒绝', () => {
    const covered = createHarness({ grantedPermissions: ['resources:read:card-1'] });
    expect(covered.client.resource('chips-resource://card-1/a.png').uri).toBe(
      'chips-resource://card-1/a.png'
    );
    const uncovered = createHarness({ grantedPermissions: ['resources:read:card-2'] });
    expect(thrownErrorCode(() => uncovered.client.resource('chips-resource://card-1/a.png'))).toBe(
      RESOURCE_ERROR_CODES.permissionDenied
    );
  });

  it('平台作用域公开只读与自身作用域免预检', () => {
    const platform = createHarness({ grantedPermissions: [] });
    expect(platform.client.resource('chips-resource://platform/frame.html').uri).toBe(
      'chips-resource://platform/frame.html'
    );
    const own = createHarness({
      grantedPermissions: [],
      isOwnResourceScope: (scope) => scope === 'plugin-001',
    });
    expect(own.client.resource('chips-resource://plugin-001/icon.png').uri).toBe(
      'chips-resource://plugin-001/icon.png'
    );
  });

  it('未提供权限快照时只做语法预检（权威判定在主进程）', () => {
    const harness = createHarness();
    expect(() => harness.client.resource('chips-resource://card-1/a.png')).not.toThrow();
  });

  it('返回懒打开句柄：首次 metadata 才触发 bridge:resource', async () => {
    const harness = createHarness({ grantedPermissions: ['resources:read'] });
    const handle = harness.client.resource('chips-resource://card-1/a.png');
    expect(
      harness.fake.invocations.some(({ channel }) => channel === IPC_CHANNELS.bridgeResource)
    ).toBe(false);
    await handle.metadata();
    const resourceCalls = harness.fake.invocations.filter(
      ({ channel }) => channel === IPC_CHANNELS.bridgeResource
    );
    expect(resourceCalls).toHaveLength(1);
    expect(resourceCalls[0]?.payload).toMatchObject({ operation: 'open' });
  });

  it('resource:invalidated 事件使对应句柄失效', async () => {
    const harness = createHarness({ grantedPermissions: ['resources:read'] });
    const handle = harness.client.resource('chips-resource://card-1/a.png');
    await handle.metadata();
    await flushAsync();
    harness.emitEvent('resource:invalidated', {
      uri: 'chips-resource://card-1/a.png',
      reason: 'source-changed',
    });
    expect(handle.state).toBe('invalidated');
    await expect(handle.metadata()).rejects.toMatchObject({
      code: RESOURCE_ERROR_CODES.handleInvalidated,
    });
  });
});

describe('createBridgeClient.applyPermissionsUpdate', () => {
  it('版本递增时更新快照并影响预检', () => {
    const harness = createHarness({ grantedPermissions: [] });
    expect(() => harness.client.resource('chips-resource://card-1/a.png')).toThrow();
    harness.client.applyPermissionsUpdate({
      sessionId: SESSION_ID,
      grantedPermissions: ['resources:read'],
      permissionVersion: 1,
    });
    expect(harness.client.permissionVersion).toBe(1);
    expect(() => harness.client.resource('chips-resource://card-1/a.png')).not.toThrow();
  });

  it('会话不匹配或版本不递增的推送被忽略', () => {
    const harness = createHarness({ grantedPermissions: ['resources:read'] });
    harness.client.applyPermissionsUpdate({
      sessionId: 'other-session',
      grantedPermissions: [],
      permissionVersion: 9,
    });
    expect(harness.client.permissionVersion).toBe(0);
    harness.client.applyPermissionsUpdate({
      sessionId: SESSION_ID,
      grantedPermissions: ['resources:read'],
      permissionVersion: 2,
    });
    harness.client.applyPermissionsUpdate({
      sessionId: SESSION_ID,
      grantedPermissions: [],
      permissionVersion: 1,
    });
    expect(harness.client.permissionVersion).toBe(2);
    expect(() => harness.client.resource('chips-resource://card-1/a.png')).not.toThrow();
  });

  it('监听 session:permissions 下行通道并自动应用快照', async () => {
    const harness = createHarness({ grantedPermissions: [] });
    harness.fake.emit(IPC_CHANNELS.sessionPermissions, {
      sessionId: SESSION_ID,
      grantedPermissions: ['resources:read'],
      permissionVersion: 3,
    });
    expect(harness.client.permissionVersion).toBe(3);
    await flushAsync();
    expect(() => harness.client.resource('chips-resource://card-1/a.png')).not.toThrow();
  });
});

describe('创建参数校验', () => {
  it('release 失败诊断不影响句柄终态', async () => {
    const onDiagnostic = vi.fn();
    const harness = createHarness({ onDiagnostic });
    const handle = harness.client.resource('chips-resource://card-1/a.png');
    harness.fake.onInvoke(IPC_CHANNELS.bridgeResource, () => {
      throw new Error('IPC 断开');
    });
    handle.release();
    await flushAsync();
    expect(handle.state).toBe('released');
    expect(onDiagnostic).toHaveBeenCalled();
  });

  it('预检错误为 ChipsError 实例', () => {
    const harness = createHarness({ grantedPermissions: [] });
    try {
      harness.client.resource('chips-resource://card-1/a.png');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ChipsError);
    }
  });
});
