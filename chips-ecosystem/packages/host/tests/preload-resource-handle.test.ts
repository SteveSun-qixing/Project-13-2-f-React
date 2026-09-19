import { describe, expect, it, vi } from 'vitest';

import { BRIDGE_RESOURCE_CHANNEL } from '../src/protocol/channels.js';
import { ChipsError } from '../src/preload/chips-error.js';
import { SessionPermissionCache } from '../src/preload/permission-cache.js';
import {
  createResourceHandle,
  ResourceInvalidationHub,
  RESOURCE_INLINE_MAX_BYTES,
  type IResourceHandle,
  type IResourceMetadata,
  type ResourceInvalidateReason,
} from '../src/preload/resource-handle.js';
import type { ISubscription } from '../src/preload/subscriptions.js';
import { FakeTransport } from './helpers/fake-transport.js';

const METADATA_FIXTURE: IResourceMetadata = {
  uri: 'chips-resource://platform/a.bin',
  size: 4,
  mimeType: 'application/octet-stream',
  version: 'v1',
  scope: 'platform',
};

class FakeInvalidationSource {
  readonly handlers = new Set<(payload: unknown) => void>();
  disposeCalls = 0;

  readonly subscribe = (_eventId: string, handler: (payload: unknown) => void): ISubscription => {
    this.handlers.add(handler);
    return {
      dispose: () => {
        this.disposeCalls += 1;
        this.handlers.delete(handler);
      },
    };
  };

  emit(payload: unknown): void {
    for (const handler of [...this.handlers]) {
      handler(payload);
    }
  }

  get size(): number {
    return this.handlers.size;
  }
}

interface Harness {
  readonly handle: IResourceHandle;
  readonly transport: FakeTransport;
  readonly permissions: SessionPermissionCache;
  readonly fetchImpl: ReturnType<typeof vi.fn>;
  readonly invalidations: FakeInvalidationSource;
  readonly diagnostics: string[];
}

function createHarness(
  options: {
    uri?: string;
    metadata?: IResourceMetadata;
    openError?: boolean;
  } = {},
): Harness {
  const uri = options.uri ?? 'chips-resource://platform/a.bin';
  const transport = new FakeTransport();
  transport.responder = (channel, payload) => {
    if (channel !== BRIDGE_RESOURCE_CHANNEL) {
      throw new Error(`未知通道：${channel}`);
    }
    const request = payload as { requestId: string; operation: string };
    if (request.operation === 'open') {
      if (options.openError === true) {
        return {
          requestId: request.requestId,
          ok: false,
          error: { code: 'RESOURCE_NOT_FOUND', message: '资源不存在', retryable: false },
        };
      }
      return {
        requestId: request.requestId,
        ok: true,
        metadata: options.metadata ?? { ...METADATA_FIXTURE, uri },
      };
    }
    return { requestId: request.requestId, ok: true, metadata: null };
  };
  const permissions = new SessionPermissionCache();
  const invalidations = new FakeInvalidationSource();
  const diagnostics: string[] = [];
  const hub = new ResourceInvalidationHub(invalidations.subscribe, (message) => {
    diagnostics.push(message);
  });
  const fetchImpl = vi.fn(async () => Promise.resolve(new Response(new Uint8Array([1, 2, 3, 4]))));
  let sequence = 0;
  const handle = createResourceHandle(uri, {
    transport,
    permissions,
    invalidations: hub,
    generateRequestId: () => `r${++sequence}`,
    fetchImpl,
    onDiagnostic: (message) => {
      diagnostics.push(message);
    },
  });
  return { handle, transport, permissions, fetchImpl, invalidations, diagnostics };
}

describe('createResourceHandle：预检', () => {
  it('URI 非法时同步抛出语法错误码', () => {
    expect(() => createHarness({ uri: 'chips-resource://platform/%2e%2e/x' })).toThrow(ChipsError);
    try {
      createHarness({ uri: 'https://example.com/a' });
      expect.unreachable();
    } catch (error) {
      expect((error as ChipsError).code).toBe('RESOURCE_UNSUPPORTED_SCHEME');
    }
  });

  it('平台作用域在快照未就绪时不拦截，在明确未授权时拒绝', () => {
    expect(() => createHarness()).not.toThrow();
    const blocked = createHarness();
    blocked.permissions.update({ sessionId: 's', grantedPermissions: ['window:list'], permissionVersion: 1 });
    expect(() =>
      createResourceHandle('chips-resource://platform/a.bin', {
        transport: blocked.transport,
        permissions: blocked.permissions,
        invalidations: new ResourceInvalidationHub(blocked.invalidations.subscribe, () => undefined),
        generateRequestId: () => 'r',
        fetchImpl: blocked.fetchImpl,
        onDiagnostic: () => undefined,
      }),
    ).toThrow('没有访问该资源的权限');
  });

  it('限定权限命中基础权限后放行', () => {
    const harness = createHarness({ uri: 'chips-resource://external/https/example.com/a.bin' });
    harness.permissions.update({
      sessionId: 's',
      grantedPermissions: ['resources:read:external'],
      permissionVersion: 1,
    });
    expect(() =>
      createResourceHandle('chips-resource://external/https/example.com/a.bin', {
        transport: harness.transport,
        permissions: harness.permissions,
        invalidations: new ResourceInvalidationHub(harness.invalidations.subscribe, () => undefined),
        generateRequestId: () => 'r',
        fetchImpl: harness.fetchImpl,
        onDiagnostic: () => undefined,
      }),
    ).not.toThrow();
  });
});

describe('createResourceHandle：懒打开', () => {
  it('metadata 首次调用触发 open 并缓存结果', async () => {
    const harness = createHarness();
    await expect(harness.handle.metadata()).resolves.toEqual(METADATA_FIXTURE);
    expect(harness.transport.invocations).toEqual([
      {
        channel: BRIDGE_RESOURCE_CHANNEL,
        payload: { requestId: 'r1', operation: 'open', uri: 'chips-resource://platform/a.bin' },
      },
    ]);
    await harness.handle.metadata();
    expect(harness.transport.invocations).toHaveLength(1);
    expect(harness.handle.state).toBe('open');
  });

  it('open 失败时以 ChipsError 拒绝且允许重试', async () => {
    const failing = createHarness({ openError: true });
    await expect(failing.handle.metadata()).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    transport_ok(failing);
    await expect(failing.handle.metadata()).resolves.toMatchObject({ uri: METADATA_FIXTURE.uri });
    expect(failing.transport.invocations).toHaveLength(2);
  });

  it('响应格式非法时归一为 BRIDGE_INTERNAL', async () => {
    const harness = createHarness();
    harness.transport.responder = () => 'not-a-response';
    await expect(harness.handle.metadata()).rejects.toMatchObject({ code: 'BRIDGE_INTERNAL' });
  });

  it('open 成功但元数据为空时视为资源不存在', async () => {
    const harness = createHarness();
    harness.transport.responder = (_channel, payload) => ({
      requestId: (payload as { requestId: string }).requestId,
      ok: true,
      metadata: null,
    });
    await expect(harness.handle.metadata()).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });
});

/** 让先前失败的 open 在重试时成功。 */
function transport_ok(harness: Harness): void {
  harness.transport.responder = (_channel, payload) => ({
    requestId: (payload as { requestId: string }).requestId,
    ok: true,
    metadata: METADATA_FIXTURE,
  });
}

describe('createResourceHandle：读取', () => {
  it('read 返回完整字节', async () => {
    const harness = createHarness();
    const bytes = await harness.handle.read();
    expect([...bytes]).toEqual([1, 2, 3, 4]);
    expect(harness.fetchImpl).toHaveBeenCalledWith('chips-resource://platform/a.bin', {});
  });

  it('超过 8 MiB 时拒绝且不发起读取', async () => {
    const harness = createHarness({ metadata: { ...METADATA_FIXTURE, size: RESOURCE_INLINE_MAX_BYTES + 1 } });
    await expect(harness.handle.read()).rejects.toMatchObject({ code: 'RESOURCE_TOO_LARGE' });
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('HTTP 403 / 404 映射为资源错误码', async () => {
    const forbidden = createHarness();
    forbidden.fetchImpl.mockResolvedValue(new Response(null, { status: 403 }));
    await expect(forbidden.handle.read()).rejects.toMatchObject({ code: 'RESOURCE_PERMISSION_DENIED' });

    const missing = createHarness();
    missing.fetchImpl.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(missing.handle.read()).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('fetch 抛错归一为 RESOURCE_NETWORK_FAILED', async () => {
    const harness = createHarness();
    harness.fetchImpl.mockRejectedValue(new Error('网络不可用'));
    await expect(harness.handle.read()).rejects.toMatchObject({ code: 'RESOURCE_NETWORK_FAILED', retryable: true });
  });

  it('readRange 使用 Range 头并返回 206 内容', async () => {
    const harness = createHarness();
    harness.fetchImpl.mockImplementation(async (_input: unknown, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['Range']).toBe('bytes=1-2');
      return Promise.resolve(new Response(new Uint8Array([2, 3]), { status: 206 }));
    });
    await expect(harness.handle.readRange(1, 2)).resolves.toEqual(new Uint8Array([2, 3]));
  });

  it('readRange 在服务端返回 200 全量时按偏移截取', async () => {
    const harness = createHarness();
    await expect(harness.handle.readRange(1, 2)).resolves.toEqual(new Uint8Array([2, 3]));
  });

  it('readRange 参数非法时拒绝', async () => {
    const harness = createHarness();
    for (const args of [
      [-1, 1],
      [0, 0],
      [1.5, 2],
    ] as const) {
      await expect(harness.handle.readRange(args[0], args[1])).rejects.toMatchObject({ code: 'BRIDGE_INVALID_INPUT' });
    }
  });
});

describe('createResourceHandle：流式与互斥', () => {
  it('stream 返回可读流并在流结束后允许再次读取', async () => {
    const harness = createHarness();
    const stream = await harness.handle.stream();
    const reader = stream.getReader();
    const chunks: number[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(...value);
    }
    expect(chunks).toEqual([1, 2, 3, 4]);
    await expect(harness.handle.readRange(0, 1)).resolves.toEqual(new Uint8Array([1]));
  });

  it('流未结束时 readRange 与再次 stream 返回 RESOURCE_BUSY', async () => {
    const harness = createHarness();
    const gate: { release?: () => void } = {};
    // 只门控本次 stream 的响应体；流结束后的 readRange 回落到 harness 默认全量响应，
    // 否则第二个门控 Promise 无人释放，arrayBuffer 会挂死到用例超时。
    harness.fetchImpl.mockImplementationOnce(async () => {
      const wait = new Promise<void>((resolve) => {
        gate.release = resolve;
      });
      const body = new ReadableStream<Uint8Array>({
        async start(controller): Promise<void> {
          await wait;
          controller.enqueue(new Uint8Array([9]));
          controller.close();
        },
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    });
    const stream = await harness.handle.stream();
    await expect(harness.handle.readRange(0, 1)).rejects.toMatchObject({ code: 'RESOURCE_BUSY' });
    await expect(harness.handle.stream()).rejects.toMatchObject({ code: 'RESOURCE_BUSY' });
    gate.release?.();
    const reader = stream.getReader();
    await reader.read();
    await expect(reader.read()).resolves.toMatchObject({ done: true });
    await expect(harness.handle.readRange(0, 1)).resolves.toBeInstanceOf(Uint8Array);
  });

  it('取消流后释放互斥标记', async () => {
    const harness = createHarness();
    const stream = await harness.handle.stream();
    await stream.cancel();
    // 取消即释放互斥：readRange(0, 1) 返回偏移 0 起的 1 字节（Bridge API 规范 §3 readRange(offset, length)）。
    await expect(harness.handle.readRange(0, 1)).resolves.toEqual(new Uint8Array([1]));
  });
});

describe('createResourceHandle：释放与失效', () => {
  it('未打开时 release 不发起核心请求', () => {
    const harness = createHarness();
    harness.handle.release();
    harness.handle.release();
    expect(harness.transport.invocations).toHaveLength(0);
    expect(harness.handle.state).toBe('released');
  });

  it('已打开后 release 发送一次释放请求，终态拒绝读取', async () => {
    const harness = createHarness();
    await harness.handle.metadata();
    harness.handle.release();
    harness.handle.release();
    const releases = harness.transport.invocations.filter(
      (call) => (call.payload as { operation: string }).operation === 'release',
    );
    expect(releases).toHaveLength(1);
    await expect(harness.handle.metadata()).rejects.toMatchObject({ code: 'RESOURCE_HANDLE_RELEASED' });
    await expect(harness.handle.read()).rejects.toMatchObject({ code: 'RESOURCE_HANDLE_RELEASED' });
  });

  it('针对已释放句柄的 onInvalidate 返回死订阅', () => {
    const harness = createHarness();
    harness.handle.release();
    const subscription = harness.handle.onInvalidate(() => undefined);
    expect(() => subscription.dispose()).not.toThrow();
    expect(harness.invalidations.size).toBe(0);
  });

  it('失效事件推进状态并通知处理器，之后读取被拒绝', async () => {
    const harness = createHarness();
    await harness.handle.metadata();
    const reasons: ResourceInvalidateReason[] = [];
    const subscription = harness.handle.onInvalidate((reason) => {
      reasons.push(reason);
    });
    expect(harness.invalidations.size).toBe(1);
    const before = harness.transport.invocations.length;
    harness.invalidations.emit({ uri: 'chips-resource://platform/a.bin', reason: 'scope-revoked' });
    expect(reasons).toEqual(['scope-revoked']);
    expect(harness.handle.state).toBe('invalidated');
    const after = harness.transport.invocations.length;
    expect(after).toBe(before);
    await expect(harness.handle.read()).rejects.toMatchObject({ code: 'RESOURCE_HANDLE_INVALIDATED' });
    subscription.dispose();
    expect(harness.invalidations.size).toBe(0);
  });

  it('失效事件只影响匹配 URI 的句柄', () => {
    const harness = createHarness();
    const other = createHarness({ uri: 'chips-resource://platform/b.bin' });
    const handler = vi.fn();
    harness.handle.onInvalidate(handler);
    other.handle.onInvalidate(vi.fn());
    harness.invalidations.emit({ uri: 'chips-resource://platform/other.bin', reason: 'source-changed' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('丢弃非法失效事件与非法原因', () => {
    const harness = createHarness();
    harness.handle.onInvalidate(() => undefined);
    harness.invalidations.emit(null);
    harness.invalidations.emit({ reason: 'source-changed' });
    harness.invalidations.emit({ uri: 'chips-resource://platform/a.bin', reason: 'unknown' });
    expect(harness.diagnostics).toContain('丢弃非法资源失效事件');
    expect(harness.diagnostics).toContain('丢弃原因非法的资源失效事件');
  });

  it('同一 URI 的多个句柄各自收到失效通知，释放后不再通知', () => {
    const harness = createHarness();
    const first = vi.fn();
    const second = vi.fn();
    harness.handle.onInvalidate(first);
    harness.handle.onInvalidate(second);
    harness.handle.release();
    harness.invalidations.emit({ uri: 'chips-resource://platform/a.bin', reason: 'session-closed' });
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it('处理器抛错不阻断其他处理器并记诊断', () => {
    const harness = createHarness();
    harness.handle.onInvalidate(() => {
      throw new Error('处理器异常');
    });
    const healthy = vi.fn();
    harness.handle.onInvalidate(healthy);
    harness.invalidations.emit({ uri: 'chips-resource://platform/a.bin', reason: 'source-changed' });
    expect(healthy).toHaveBeenCalledWith('source-changed');
    expect(harness.diagnostics).toContain('资源失效处理器抛出异常');
  });

  it('hub 在无登记时释放底层订阅', () => {
    const invalidations = new FakeInvalidationSource();
    const hub = new ResourceInvalidationHub(invalidations.subscribe, () => undefined);
    const subscription = hub.register('chips-resource://platform/a.bin', () => undefined);
    expect(invalidations.size).toBe(1);
    subscription.dispose();
    subscription.dispose();
    expect(invalidations.size).toBe(0);
    expect(invalidations.disposeCalls).toBe(1);
    hub.dispose();
  });
});
