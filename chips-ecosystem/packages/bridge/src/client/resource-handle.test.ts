import { describe, expect, it, vi } from 'vitest';
import { ChipsError } from '../protocol/errors.js';
import { IPC_CHANNELS } from '../protocol/ipc.js';
import { RESOURCE_ERROR_CODES, type IResourceMetadata } from '../protocol/resource.js';
import type { IResourceByteSource } from './transport.js';
import { createResourceHandleProxy } from './resource-handle.js';
import {
  createFakeTransport,
  flushAsync,
  type IFakeTransport,
} from '../../tests/fixtures/ipc-transport.js';
import { thrownErrorCode } from '../../tests/fixtures/expect-chips-error.js';

const URI = 'chips-resource://card-7f3a/images/photo.jpg';

const METADATA: IResourceMetadata = {
  uri: URI,
  size: 1024,
  mimeType: 'image/jpeg',
  version: 'v1',
  scope: 'document',
};

interface IHarness {
  fake: IFakeTransport;
  bytes: IResourceByteSource;
  readCalls: number;
  lastRange: { offset: number; length: number } | undefined;
  releaseCalls: number;
  handle: ReturnType<typeof createResourceHandleProxy>;
}

function createHarness(
  overrides: {
    metadata?: IResourceMetadata;
    openError?: ChipsError;
    releaseError?: ChipsError;
    echoRequestId?: boolean;
  } = {}
): IHarness {
  const fake = createFakeTransport();
  const state = {
    readCalls: 0,
    lastRange: undefined as { offset: number; length: number } | undefined,
    releaseCalls: 0,
  };
  const metadata = overrides.metadata ?? METADATA;
  fake.onInvoke(IPC_CHANNELS.bridgeResource, (payload) => {
    const request = payload as { requestId: string; operation: 'open' | 'release' };
    if (request.operation === 'release') {
      state.releaseCalls += 1;
      if (overrides.releaseError !== undefined) {
        return { requestId: request.requestId, ok: false, error: overrides.releaseError.toPlain() };
      }
      return { requestId: request.requestId, ok: true, metadata: null };
    }
    if (overrides.openError !== undefined) {
      return { requestId: request.requestId, ok: false, error: overrides.openError.toPlain() };
    }
    return {
      requestId: overrides.echoRequestId === false ? 'mismatched' : request.requestId,
      ok: true,
      metadata,
    };
  });
  const bytes: IResourceByteSource = {
    read: () => {
      state.readCalls += 1;
      return Promise.resolve(new Uint8Array([1, 2, 3]));
    },
    readRange: (_uri, offset, length) => {
      state.lastRange = { offset, length };
      return Promise.resolve(new Uint8Array([4, 5]));
    },
    openStream: () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      }),
  };
  const handle = createResourceHandleProxy({
    uri: URI,
    transport: fake.transport,
    bytes,
    createRequestId: () => 'request-fixed',
  });
  return {
    fake,
    bytes,
    get readCalls() {
      return state.readCalls;
    },
    get lastRange() {
      return state.lastRange;
    },
    get releaseCalls() {
      return state.releaseCalls;
    },
    handle,
  };
}

describe('createResourceHandleProxy', () => {
  it('同步返回懒打开句柄：初始 open 且未触发 open 调用', () => {
    const harness = createHarness();
    expect(harness.handle.uri).toBe(URI);
    expect(harness.handle.state).toBe('open');
    expect(harness.handle.opened).toBe(false);
    expect(harness.fake.invocations).toHaveLength(0);
  });

  it('metadata() 首次触发 bridge:resource open 并缓存元数据', async () => {
    const harness = createHarness();
    await expect(harness.handle.metadata()).resolves.toEqual(METADATA);
    expect(harness.handle.opened).toBe(true);
    await expect(harness.handle.metadata()).resolves.toEqual(METADATA);
    expect(harness.fake.invocations).toHaveLength(1);
    expect(harness.fake.invocations[0]?.channel).toBe(IPC_CHANNELS.bridgeResource);
    expect(harness.fake.invocations[0]?.payload).toEqual({
      requestId: 'request-fixed',
      operation: 'open',
      uri: URI,
    });
  });

  it('open 回执失败时以 ChipsError reject 且保持可重试', async () => {
    const failure = new ChipsError({
      code: RESOURCE_ERROR_CODES.notFound,
      message: '资源不存在',
    });
    const harness = createHarness({ openError: failure });
    await expect(harness.handle.metadata()).rejects.toMatchObject({
      code: RESOURCE_ERROR_CODES.notFound,
    });
    expect(harness.handle.state).toBe('open');
    expect(harness.handle.opened).toBe(false);
  });

  it('回执 requestId 不匹配时以 BRIDGE_INTERNAL 拒绝（迟到结果丢弃）', async () => {
    const harness = createHarness({ echoRequestId: false });
    await expect(harness.handle.metadata()).rejects.toMatchObject({ code: 'BRIDGE_INTERNAL' });
  });

  it('read() 超过 8 MiB 返回 RESOURCE_TOO_LARGE 且不读取字节', async () => {
    const harness = createHarness({
      metadata: { ...METADATA, size: 8 * 1024 * 1024 + 1 },
    });
    await expect(harness.handle.read()).rejects.toMatchObject({
      code: RESOURCE_ERROR_CODES.tooLarge,
    });
    expect(harness.readCalls).toBe(0);
  });

  it('read() 在 8 MiB 上限内返回字节', async () => {
    const harness = createHarness({
      metadata: { ...METADATA, size: 8 * 1024 * 1024 },
    });
    await expect(harness.handle.read()).resolves.toEqual(new Uint8Array([1, 2, 3]));
    expect(harness.readCalls).toBe(1);
  });

  it('readRange() 转发偏移与长度', async () => {
    const harness = createHarness();
    await expect(harness.handle.readRange(16, 32)).resolves.toEqual(new Uint8Array([4, 5]));
    expect(harness.lastRange).toEqual({ offset: 16, length: 32 });
  });

  it('stream() 返回字节源打开的流', async () => {
    const harness = createHarness();
    const stream = harness.handle.stream();
    expect(stream).toBeInstanceOf(ReadableStream);
    const reader = stream.getReader();
    await expect(reader.read()).resolves.toMatchObject({ done: true });
  });

  it('release() 幂等：重复调用只发送一次 release', async () => {
    const harness = createHarness();
    harness.handle.release();
    harness.handle.release();
    await flushAsync();
    expect(harness.handle.state).toBe('released');
    expect(harness.releaseCalls).toBe(1);
  });

  it('release 后除 uri / state / release 外的方法返回 RESOURCE_HANDLE_RELEASED', async () => {
    const harness = createHarness();
    harness.handle.release();
    await flushAsync();
    expect(harness.handle.uri).toBe(URI);
    await expect(harness.handle.metadata()).rejects.toMatchObject({
      code: RESOURCE_ERROR_CODES.handleReleased,
    });
    await expect(harness.handle.read()).rejects.toMatchObject({
      code: RESOURCE_ERROR_CODES.handleReleased,
    });
    await expect(harness.handle.readRange(0, 1)).rejects.toMatchObject({
      code: RESOURCE_ERROR_CODES.handleReleased,
    });
    expect(thrownErrorCode(() => harness.handle.stream())).toBe(
      RESOURCE_ERROR_CODES.handleReleased
    );
    const subscription = harness.handle.onInvalidate(() => undefined);
    expect(() => subscription.dispose()).not.toThrow();
    expect(() => subscription.dispose()).not.toThrow();
  });

  it('invalidate() 转移到 invalidated：读取被拒绝、已有订阅收到原因', async () => {
    const harness = createHarness();
    const reasons: string[] = [];
    const subscription = harness.handle.onInvalidate((reason) => reasons.push(reason));
    harness.handle.invalidate('source-changed');
    expect(harness.handle.state).toBe('invalidated');
    await expect(harness.handle.metadata()).rejects.toMatchObject({
      code: RESOURCE_ERROR_CODES.handleInvalidated,
    });
    expect(reasons).toEqual(['source-changed']);
    subscription.dispose();
  });

  it('失效后注册 onInvalidate 在下一微任务立即回调一次', async () => {
    const harness = createHarness();
    harness.handle.invalidate('scope-revoked');
    const reasons: string[] = [];
    harness.handle.onInvalidate((reason) => reasons.push(reason));
    expect(reasons).toEqual([]);
    await Promise.resolve();
    await Promise.resolve();
    expect(reasons).toEqual(['scope-revoked']);
  });

  it('invalidated 句柄仍可 release 并转 released', async () => {
    const harness = createHarness();
    harness.handle.invalidate('session-closed');
    harness.handle.release();
    await flushAsync();
    expect(harness.handle.state).toBe('released');
    expect(harness.releaseCalls).toBe(1);
  });

  it('onInvalidate 的 dispose 幂等且退订后不再回调', () => {
    const harness = createHarness();
    const handler = vi.fn();
    const subscription = harness.handle.onInvalidate(handler);
    subscription.dispose();
    subscription.dispose();
    harness.handle.invalidate('source-changed');
    expect(handler).not.toHaveBeenCalled();
  });

  it('release 调用失败只记录诊断，不向调用方抛出', async () => {
    const onDiagnostic = vi.fn();
    const fake = createFakeTransport();
    fake.onInvoke(IPC_CHANNELS.bridgeResource, () => {
      throw new Error('IPC 断开');
    });
    const handle = createResourceHandleProxy({
      uri: URI,
      transport: fake.transport,
      bytes: {
        read: () => Promise.resolve(new Uint8Array()),
        readRange: () => Promise.resolve(new Uint8Array()),
        openStream: () => new ReadableStream<Uint8Array>(),
      },
      onDiagnostic,
    });
    expect(() => handle.release()).not.toThrow();
    await flushAsync();
    expect(handle.state).toBe('released');
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
  });
});
