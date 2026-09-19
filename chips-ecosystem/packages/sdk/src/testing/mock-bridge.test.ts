import { describe, expect, it } from 'vitest';
import { ChipsError, SDK_UNKNOWN_ERROR } from '../errors.js';
import { createMockBridge } from './mock-bridge.js';
import type { IMockBridge, IMockCall } from './mock-bridge.js';
import type { IMockResourceInit } from './mock-resource.js';
import { MOCK_ERROR_CODES } from './codes.js';

/** 取 Promise 的拒绝原因；未拒绝时断言失败。 */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('预期调用被拒绝');
    },
    (error: unknown) => error
  );
}

describe('createMockBridge 能力通道', () => {
  it('未登记桩的能力调用拒绝 BRIDGE_CAPABILITY_NOT_FOUND', async () => {
    const bridge = createMockBridge();
    const error = await rejection(bridge.request('file:read', { path: 'a.txt' }));
    expect(error).toBeInstanceOf(ChipsError);
    expect((error as ChipsError).code).toBe(MOCK_ERROR_CODES.capabilityNotFound);
    expect((error as ChipsError).details).toEqual({ capabilityId: 'file:read' });
  });

  it('登记桩后同步返回值作为能力输出', async () => {
    const bridge = createMockBridge();
    bridge.handle('file:read', () => ({ content: 'name: 示例卡片', encoding: 'utf-8' }));
    await expect(bridge.request('file:read', { path: '.card/metadata.yaml' })).resolves.toEqual({
      content: 'name: 示例卡片',
      encoding: 'utf-8',
    });
  });

  it('桩返回 Promise 时等待其结果，并把输入原样交给桩', async () => {
    const bridge = createMockBridge();
    const seen: unknown[] = [];
    bridge.handle('document:open', (input: { documentId: string }) =>
      Promise.resolve({ documentId: input.documentId, kind: 'card' })
    );
    await expect(bridge.request('document:open', { documentId: 'a1B2c3D4e5' })).resolves.toEqual({
      documentId: 'a1B2c3D4e5',
      kind: 'card',
    });
    seen.push(bridge.calls[0]?.input);
    expect(seen).toEqual([{ documentId: 'a1B2c3D4e5' }]);
  });

  it('同一能力后注册覆盖先注册', async () => {
    const bridge = createMockBridge();
    bridge.handle('system:info', () => ({ platform: 'darwin' }));
    bridge.handle('system:info', () => ({ platform: 'win32' }));
    await expect(bridge.request('system:info')).resolves.toEqual({ platform: 'win32' });
  });

  it('桩抛 ChipsError 时以该错误拒绝，实例与字段不变', async () => {
    const bridge = createMockBridge();
    const denied = new ChipsError({
      code: 'BRIDGE_PERMISSION_DENIED',
      message: '缺少文件读取权限',
      details: { permission: 'filesystem:read' },
      retryable: false,
    });
    bridge.handle('file:read', () => {
      throw denied;
    });
    const error = await rejection(bridge.request('file:read'));
    expect(error).toBe(denied);
  });

  it('桩抛其他值时经 toChipsError 归一后拒绝', async () => {
    const bridge = createMockBridge();
    bridge.handle('file:read', () => {
      throw new TypeError('内部异常');
    });
    const error = (await rejection(bridge.request('file:read'))) as ChipsError;
    expect(error).toBeInstanceOf(ChipsError);
    expect(error.code).toBe(SDK_UNKNOWN_ERROR);
    expect(error.details).toEqual({ name: 'TypeError', cause: '内部异常' });
  });

  it('桩抛同构普通对象时还原为同码 ChipsError 实例', async () => {
    const bridge = createMockBridge();
    // 刻意抛出跨 Bridge 传回的同构普通对象（非 Error 实例），验证 Mock 走 toChipsError 归一口径
    const plainError: unknown = {
      code: 'RESOURCE_PERMISSION_DENIED',
      message: '无权写入该位置',
      retryable: false,
    };
    bridge.handle('file:write', () => {
      throw plainError;
    });
    const error = (await rejection(bridge.request('file:write'))) as ChipsError;
    expect(error).toBeInstanceOf(ChipsError);
    expect(error.code).toBe('RESOURCE_PERMISSION_DENIED');
    expect(error.message).toBe('无权写入该位置');
  });

  it('桩内异步失败同样按 ChipsError 口径拒绝', async () => {
    const bridge = createMockBridge();
    bridge.handle('http:request', async () => {
      await Promise.resolve();
      throw new ChipsError({ code: 'BRIDGE_TIMEOUT', message: '请求超时', retryable: true });
    });
    const error = (await rejection(bridge.request('http:request'))) as ChipsError;
    expect(error.code).toBe('BRIDGE_TIMEOUT');
    expect(error.retryable).toBe(true);
  });
});

describe('createMockBridge 调用记录', () => {
  it('calls 按调用时序记录 request 的能力 ID 与输入', async () => {
    const bridge = createMockBridge();
    bridge.handle('file:read', () => ({ content: '', encoding: 'utf-8' }));
    bridge.handle('system:info', () => ({ platform: 'darwin' }));
    await bridge.request('file:read', { path: 'a.txt' });
    await bridge.request('system:info');
    await rejection(bridge.request('document:open', { documentId: 'x' }));
    const calls: readonly IMockCall[] = bridge.calls;
    expect(calls.map((call) => call.capabilityId)).toEqual([
      'file:read',
      'system:info',
      'document:open',
    ]);
    expect(calls[0]?.input).toEqual({ path: 'a.txt' });
    expect(calls[1]?.input).toBeUndefined();
  });

  it('resource 不经能力通道，不进入 calls', () => {
    const bridge = createMockBridge({
      resources: { 'chips-resource://workspace/a.card': { data: 'x' } },
    });
    bridge.resource('chips-resource://workspace/a.card');
    expect(bridge.calls).toEqual([]);
  });

  it('calls 是同一数组视图，reset 前后可直接对比长度', async () => {
    const bridge = createMockBridge();
    const view = bridge.calls;
    bridge.handle('file:read', () => ({ content: '', encoding: 'utf-8' }));
    await bridge.request('file:read');
    expect(view).toHaveLength(1);
    bridge.reset();
    expect(view).toHaveLength(0);
    expect(bridge.calls).toBe(view);
  });
});

describe('createMockBridge 事件通道', () => {
  it('emit 同步调用该事件的全部订阅 handler', () => {
    const bridge: IMockBridge = createMockBridge();
    const first: unknown[] = [];
    const second: unknown[] = [];
    bridge.subscribe('document:changed', (payload) => first.push(payload));
    bridge.subscribe('document:changed', (payload) => second.push(payload));
    bridge.emit('document:changed', { documentId: 'a1B2' });
    expect(first).toEqual([{ documentId: 'a1B2' }]);
    expect(second).toEqual([{ documentId: 'a1B2' }]);
  });

  it('无订阅时 emit 丢弃载荷且不报错', () => {
    const bridge = createMockBridge();
    expect(() => bridge.emit('plugin:loaded', { pluginId: 'p' })).not.toThrow();
    expect(bridge.subscriptionCount('plugin:loaded')).toBe(0);
  });

  it('事件之间互不影响', () => {
    const bridge = createMockBridge();
    const received: unknown[] = [];
    bridge.subscribe('file:changed', (payload) => received.push(payload));
    bridge.emit('document:saved', { documentId: 'a1B2' });
    expect(received).toEqual([]);
  });

  it('dispose 退订且幂等，subscriptionCount 随之变化', () => {
    const bridge = createMockBridge();
    const received: unknown[] = [];
    const subscription = bridge.subscribe('file:changed', (payload) => received.push(payload));
    expect(bridge.subscriptionCount('file:changed')).toBe(1);
    subscription.dispose();
    subscription.dispose();
    expect(bridge.subscriptionCount('file:changed')).toBe(0);
    bridge.emit('file:changed', { path: 'a.txt' });
    expect(received).toEqual([]);
  });

  it('同一 handler 多次订阅各自独立，单次 dispose 只减一个订阅', () => {
    const bridge = createMockBridge();
    let count = 0;
    const handler = (): void => {
      count += 1;
    };
    const first = bridge.subscribe('clipboard:changed', handler);
    bridge.subscribe('clipboard:changed', handler);
    expect(bridge.subscriptionCount('clipboard:changed')).toBe(2);
    first.dispose();
    expect(bridge.subscriptionCount('clipboard:changed')).toBe(1);
    bridge.emit('clipboard:changed', null);
    expect(count).toBe(1);
  });

  it('同一事件仍有其他订阅时，重复 dispose 不误删他人且幂等', () => {
    const bridge = createMockBridge();
    const first: unknown[] = [];
    const second: unknown[] = [];
    const subscription = bridge.subscribe('document:changed', (payload) => first.push(payload));
    bridge.subscribe('document:changed', (payload) => second.push(payload));
    subscription.dispose();
    // 订阅表内仍留有同事件的其他项：本次 dispose 找不到自己的活动项，按幂等返回
    subscription.dispose();
    expect(bridge.subscriptionCount('document:changed')).toBe(1);
    bridge.emit('document:changed', { documentId: 'a1B2' });
    expect(first).toEqual([]);
    expect(second).toEqual([{ documentId: 'a1B2' }]);
  });

  it('reset 之后原订阅的 dispose 为无操作', () => {
    const bridge = createMockBridge();
    const received: unknown[] = [];
    const subscription = bridge.subscribe('file:changed', (payload) => received.push(payload));
    bridge.subscribe('clipboard:changed', () => undefined);
    bridge.reset();
    expect(() => subscription.dispose()).not.toThrow();
    expect(bridge.subscriptionCount('file:changed')).toBe(0);
    expect(bridge.subscriptionCount('clipboard:changed')).toBe(0);
    bridge.emit('file:changed', { path: 'a.txt' });
    expect(received).toEqual([]);
  });

  it('订阅回调中退订不影响本次派发', () => {
    const bridge = createMockBridge();
    const received: unknown[] = [];
    const subscription = bridge.subscribe('app:opened-with-url', (payload) => {
      received.push(payload);
      subscription.dispose();
    });
    bridge.emit('app:opened-with-url', 'chips://open');
    bridge.emit('app:opened-with-url', 'chips://again');
    expect(received).toEqual(['chips://open']);
    expect(bridge.subscriptionCount('app:opened-with-url')).toBe(0);
  });
});

describe('createMockBridge reset', () => {
  it('清空桩、调用记录与订阅', async () => {
    const bridge = createMockBridge();
    bridge.handle('file:read', () => ({ content: 'x', encoding: 'utf-8' }));
    bridge.subscribe('file:changed', () => undefined);
    await bridge.request('file:read');
    bridge.reset();
    expect(bridge.calls).toEqual([]);
    expect(bridge.subscriptionCount('file:changed')).toBe(0);
    const error = (await rejection(bridge.request('file:read'))) as ChipsError;
    expect(error.code).toBe(MOCK_ERROR_CODES.capabilityNotFound);
  });

  it('资源表恢复为初始配置，构造后改动夹具表不生效', async () => {
    const fixtures: Record<string, IMockResourceInit> = {
      'chips-resource://workspace/a.card': { data: '初始内容' },
    };
    const bridge = createMockBridge({ resources: fixtures });
    const expected = {
      uri: 'chips-resource://workspace/a.card',
      size: 12,
      mimeType: 'application/octet-stream',
      version: '1',
      scope: 'memory',
    };
    await expect(bridge.resource('chips-resource://workspace/a.card').metadata()).resolves.toEqual(
      expected
    );
    // 构造时已登记为内部快照：之后追加 / 覆盖夹具都不改变 Mock 提供的资源
    fixtures['chips-resource://workspace/b.card'] = { data: '后加内容' };
    fixtures['chips-resource://workspace/a.card'] = { data: '改写内容' };
    await expect(bridge.resource('chips-resource://workspace/a.card').read()).resolves.toEqual(
      new TextEncoder().encode('初始内容')
    );
    expect(
      ((await rejection(bridge.resource('chips-resource://workspace/b.card').read())) as ChipsError)
        .code
    ).toBe(MOCK_ERROR_CODES.notFound);
    bridge.reset();
    await expect(bridge.resource('chips-resource://workspace/a.card').metadata()).resolves.toEqual(
      expected
    );
  });

  it('未配置夹具时 reset 前后资源都不可读', async () => {
    const bridge = createMockBridge();
    const handle = bridge.resource('chips-resource://workspace/a.card');
    expect(((await rejection(handle.read())) as ChipsError).code).toBe(MOCK_ERROR_CODES.notFound);
    bridge.reset();
    expect(((await rejection(handle.read())) as ChipsError).code).toBe(MOCK_ERROR_CODES.notFound);
  });
});
