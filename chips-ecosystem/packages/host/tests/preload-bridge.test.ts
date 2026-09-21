import { describe, expect, it, vi } from 'vitest';

import { BRIDGE_REQUEST_CHANNEL, SESSION_PERMISSIONS_CHANNEL } from '../src/protocol/channels.js';
import { createPreloadBridge } from '../src/preload/bridge.js';
import { ChipsError } from '@chips/bridge';
import { FakeTransport } from './helpers/fake-transport.js';

function createBridge(responder?: FakeTransport['responder']): {
  bridge: ReturnType<typeof createPreloadBridge>;
  transport: FakeTransport;
  diagnostics: string[];
} {
  const transport = new FakeTransport();
  if (responder !== undefined) {
    transport.responder = responder;
  }
  const diagnostics: string[] = [];
  const bridge = createPreloadBridge({
    transport,
    generateId: () => 'r1',
    fetchImpl: vi.fn(async () => Promise.resolve(new Response(new Uint8Array([1])))),
    onDiagnostic: (message) => {
      diagnostics.push(message);
    },
  });
  return { bridge, transport, diagnostics };
}

describe('createPreloadBridge.request', () => {
  it('生成 requestId 并返回结果', async () => {
    const { bridge, transport } = createBridge((channel, payload) => {
      expect(channel).toBe(BRIDGE_REQUEST_CHANNEL);
      expect(payload).toEqual({ requestId: 'r1', capabilityId: 'system:info', input: { a: 1 } });
      return { requestId: 'r1', ok: true, result: { platform: 'darwin' } };
    });
    await expect(bridge.request('system:info', { a: 1 })).resolves.toEqual({ platform: 'darwin' });
    expect(transport.invocations).toHaveLength(1);
  });

  it('输入缺省时不携带 input 字段', async () => {
    const { bridge, transport } = createBridge((_channel, payload) => {
      expect(payload).toEqual({ requestId: 'r1', capabilityId: 'window:list' });
      return { requestId: 'r1', ok: true, result: [] };
    });
    await bridge.request('window:list');
    expect(transport.invocations).toHaveLength(1);
  });

  it('能力 ID 非法时本地快速失败且不发请求', async () => {
    const { bridge, transport } = createBridge();
    await expect(bridge.request('')).rejects.toMatchObject({ code: 'BRIDGE_INVALID_INPUT' });
    await expect(bridge.request(undefined as unknown as string)).rejects.toMatchObject({
      code: 'BRIDGE_INVALID_INPUT',
    });
    expect(transport.invocations).toHaveLength(0);
  });

  it('传输失败归一为 BRIDGE_INTERNAL', async () => {
    const { bridge } = createBridge(() => Promise.reject(new Error('IPC 断开')));
    await expect(bridge.request('system:info')).rejects.toMatchObject({ code: 'BRIDGE_INTERNAL' });
  });

  it('关联键不匹配或响应格式非法时拒绝', async () => {
    const mismatched = createBridge(() => ({ requestId: 'other', ok: true, result: 1 }));
    await expect(mismatched.bridge.request('system:info')).rejects.toMatchObject({ code: 'BRIDGE_INTERNAL' });

    const malformed = createBridge(() => 'not-a-response');
    await expect(malformed.bridge.request('system:info')).rejects.toMatchObject({ code: 'BRIDGE_INTERNAL' });
  });

  it('错误响应还原为 ChipsError 并保留字段', async () => {
    const { bridge } = createBridge(() => ({
      requestId: 'r1',
      ok: false,
      error: { code: 'BRIDGE_PERMISSION_DENIED', message: '插件缺少所需权限', retryable: false },
    }));
    await expect(bridge.request('file:read')).rejects.toSatisfy(
      (error: unknown) => error instanceof ChipsError && error.code === 'BRIDGE_PERMISSION_DENIED',
    );
  });
});

describe('createPreloadBridge：权限快照与资源', () => {
  it('缓存会话权限快照并用于资源预检', () => {
    const { bridge, transport } = createBridge();
    transport.emit(SESSION_PERMISSIONS_CHANNEL, {
      sessionId: 's1',
      grantedPermissions: ['resources:read:platform'],
      permissionVersion: 1,
    });
    expect(() => bridge.resource('chips-resource://platform/a.bin')).not.toThrow();

    transport.emit(SESSION_PERMISSIONS_CHANNEL, {
      sessionId: 's1',
      grantedPermissions: [],
      permissionVersion: 2,
    });
    expect(() => bridge.resource('chips-resource://platform/a.bin')).toThrow('没有访问该资源的权限');
  });

  it('非法权限推送被丢弃并记诊断', () => {
    const { transport, diagnostics } = createBridge();
    transport.emit(SESSION_PERMISSIONS_CHANNEL, { sessionId: 's1', permissionVersion: 'x' });
    expect(diagnostics).toContain('丢弃非法会话权限推送');
  });

  it('resource 委派句柄并暴露既定方法面', () => {
    const { bridge } = createBridge();
    const handle = bridge.resource('chips-resource://platform/a.bin');
    expect(handle.uri).toBe('chips-resource://platform/a.bin');
    expect(handle.state).toBe('open');
    for (const method of ['metadata', 'read', 'readRange', 'stream', 'release', 'onInvalidate'] as const) {
      expect(typeof handle[method]).toBe('function');
    }
  });

  it('subscribe 委派订阅登记并在 dispose 后释放', () => {
    const { bridge, transport } = createBridge();
    const subscription = bridge.subscribe('window:closed', vi.fn());
    expect(transport.listenerCount('event:window:closed')).toBe(1);
    subscription.dispose();
    expect(transport.listenerCount('event:window:closed')).toBe(0);
  });

  it('dispose 释放全部订阅', () => {
    const { bridge, transport } = createBridge();
    bridge.subscribe('window:closed', vi.fn());
    bridge.subscribe('custom:event', vi.fn());
    bridge.dispose();
    expect(transport.listenerCount('event:window:closed')).toBe(0);
    expect(transport.listenerCount('event:custom:event')).toBe(0);
  });
});
