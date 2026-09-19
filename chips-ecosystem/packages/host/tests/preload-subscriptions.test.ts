import { describe, expect, it, vi } from 'vitest';

import { EVENT_CONTROL_CHANNEL } from '../src/protocol/channels.js';
import { SubscriptionRegistry, MAX_PENDING_EVENTS } from '../src/preload/subscriptions.js';
import { FakeTransport } from './helpers/fake-transport.js';

function envelope(payload: unknown, eventId = 'window:closed'): unknown {
  return { eventId, payload, emittedAt: 1 };
}

function createRegistry(responder: FakeTransport['responder']): {
  registry: SubscriptionRegistry;
  transport: FakeTransport;
  onDiagnostic: ReturnType<typeof vi.fn>;
} {
  const transport = new FakeTransport();
  transport.responder = responder;
  const onDiagnostic = vi.fn();
  const registry = new SubscriptionRegistry({
    transport,
    generateControlId: () => 'c1',
    onDiagnostic,
  });
  return { registry, transport, onDiagnostic };
}

describe('SubscriptionRegistry：订阅建立', () => {
  it('同步挂载监听、发起订阅并在确认后按序派发缓冲事件', async () => {
    const { registry, transport } = createRegistry((channel, payload) => {
      if (channel !== EVENT_CONTROL_CHANNEL) {
        throw new Error('未知通道');
      }
      expect(payload).toEqual({ controlId: 'c1', action: 'subscribe', eventId: 'window:closed' });
      return { controlId: 'c1', ok: true };
    });
    const handler = vi.fn();
    const subscription = registry.subscribe('window:closed', handler);
    expect(transport.listenerCount('event:window:closed')).toBe(1);

    transport.emit('event:window:closed', envelope({ windowId: 1 }));
    expect(handler).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledWith({ windowId: 1 });
    });

    transport.emit('event:window:closed', envelope({ windowId: 2 }));
    expect(handler).toHaveBeenLastCalledWith({ windowId: 2 });

    subscription.dispose();
    expect(transport.listenerCount('event:window:closed')).toBe(0);
    const last = transport.invocations.at(-1);
    expect(last?.payload).toMatchObject({ action: 'unsubscribe', eventId: 'window:closed' });
  });

  it('同一 eventId 的多个订阅共享一次控制请求', async () => {
    const { registry, transport } = createRegistry(() => ({ controlId: 'c1', ok: true }));
    const first = vi.fn();
    const second = vi.fn();
    const firstSubscription = registry.subscribe('window:closed', first);
    registry.subscribe('window:closed', second);
    expect(transport.invocations).toHaveLength(1);
    await vi.waitFor(() => {
      expect(transport.invocations[0]?.payload).toMatchObject({ action: 'subscribe' });
    });
    firstSubscription.dispose();
    expect(transport.listenerCount('event:window:closed')).toBe(1);
    await vi.waitFor(() => {
      transport.emit('event:window:closed', envelope({ windowId: 3 }));
      expect(second).toHaveBeenCalledWith({ windowId: 3 });
    });
  });

  it('事件负载经信封解包后交给 handler', async () => {
    const { registry, transport } = createRegistry(() => ({ controlId: 'c1', ok: true }));
    const handler = vi.fn();
    registry.subscribe('custom:event', handler);
    await vi.waitFor(() => {
      transport.emit('event:custom:event', envelope({ value: 42 }, 'custom:event'));
      expect(handler).toHaveBeenCalledWith({ value: 42 });
    });
  });

  it('确认前的缓冲按 FIFO 顺序冲刷', async () => {
    const deferred: { resolve?: (value: unknown) => void } = {};
    const { registry, transport } = createRegistry(
      () =>
        new Promise((resolve) => {
          deferred.resolve = resolve;
        }),
    );
    const handler = vi.fn();
    registry.subscribe('window:closed', handler);
    transport.emit('event:window:closed', envelope(1));
    transport.emit('event:window:closed', envelope(2));
    expect(handler).not.toHaveBeenCalled();
    deferred.resolve?.({ controlId: 'c1', ok: true });
    await vi.waitFor(() => {
      expect(handler.mock.calls).toEqual([[1], [2]]);
    });
  });

  it('缓冲超限时丢弃并记诊断', () => {
    const { registry, transport, onDiagnostic } = createRegistry(() => new Promise(() => undefined));
    registry.subscribe('window:closed', vi.fn());
    for (let index = 0; index <= MAX_PENDING_EVENTS; index += 1) {
      transport.emit('event:window:closed', envelope(index));
    }
    expect(onDiagnostic).toHaveBeenCalledWith('事件缓冲超限，丢弃待确认事件', { eventId: 'window:closed' });
  });
});

describe('SubscriptionRegistry：失败路径', () => {
  it('回执失败时丢弃缓冲、移除监听且不再投递', async () => {
    const { registry, transport, onDiagnostic } = createRegistry(() => ({
      controlId: 'c1',
      ok: false,
      error: { code: 'EVENT_NOT_REGISTERED', message: '事件未注册' },
    }));
    const handler = vi.fn();
    registry.subscribe('window:closed', handler);
    transport.emit('event:window:closed', envelope({ windowId: 1 }));
    await vi.waitFor(() => {
      expect(onDiagnostic).toHaveBeenCalledWith('事件订阅未建立', {
        eventId: 'window:closed',
        reason: 'EVENT_NOT_REGISTERED',
      });
    });
    expect(transport.listenerCount('event:window:closed')).toBe(0);
    transport.emit('event:window:closed', envelope({ windowId: 2 }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('控制请求被拒绝或响应格式非法时同样不建立订阅', async () => {
    const rejected = createRegistry(() => Promise.reject(new Error('IPC 断开')));
    rejected.registry.subscribe('window:closed', vi.fn());
    await vi.waitFor(() => {
      expect(rejected.onDiagnostic).toHaveBeenCalledWith('事件订阅未建立', {
        eventId: 'window:closed',
        reason: 'IPC 断开',
      });
    });

    const malformed = createRegistry(() => 'not-a-response');
    malformed.registry.subscribe('window:closed', vi.fn());
    await vi.waitFor(() => {
      expect(malformed.onDiagnostic).toHaveBeenCalledWith('事件订阅未建立', {
        eventId: 'window:closed',
        reason: 'EVENT_CONTROL_RESPONSE_INVALID',
      });
    });
  });

  it('handler 抛错不影响其他订阅者与后续投递', async () => {
    const { registry, transport, onDiagnostic } = createRegistry(() => ({ controlId: 'c1', ok: true }));
    const failing = vi.fn(() => {
      throw new Error('处理器异常');
    });
    const healthy = vi.fn();
    registry.subscribe('window:closed', failing);
    registry.subscribe('window:closed', healthy);
    await vi.waitFor(() => {
      transport.emit('event:window:closed', envelope({ windowId: 1 }));
      expect(healthy).toHaveBeenCalledWith({ windowId: 1 });
    });
    expect(onDiagnostic).toHaveBeenCalledWith('事件处理器抛出异常', {
      eventId: 'window:closed',
      reason: '处理器异常',
    });
  });

  it('丢弃非法事件负载', async () => {
    const { registry, transport, onDiagnostic } = createRegistry(() => ({ controlId: 'c1', ok: true }));
    const handler = vi.fn();
    registry.subscribe('window:closed', handler);
    await vi.waitFor(() => {
      transport.emit('event:window:closed', { eventId: 'window:closed' });
      expect(onDiagnostic).toHaveBeenCalledWith('丢弃非法事件负载', { eventId: 'window:closed' });
    });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('SubscriptionRegistry：释放与非法入参', () => {
  it('非法 eventId / handler 返回死订阅且不发请求', () => {
    const { registry, transport, onDiagnostic } = createRegistry(() => ({ controlId: 'c1', ok: true }));
    const dead = registry.subscribe('', vi.fn());
    const deadHandler = registry.subscribe('window:closed', undefined as never);
    expect(transport.invocations).toHaveLength(0);
    expect(onDiagnostic).toHaveBeenCalledWith('忽略非法事件订阅请求');
    expect(() => {
      dead.dispose();
      deadHandler.dispose();
    }).not.toThrow();
  });

  it('dispose 幂等且仅最后一个订阅触发退订', async () => {
    const { registry, transport } = createRegistry(() => ({ controlId: 'c1', ok: true }));
    const first = registry.subscribe('window:closed', vi.fn());
    const second = registry.subscribe('window:closed', vi.fn());
    await vi.waitFor(() => {
      expect(transport.listenerCount('event:window:closed')).toBe(1);
    });
    first.dispose();
    first.dispose();
    expect(
      transport.invocations.filter((call) => (call.payload as { action: string }).action === 'unsubscribe'),
    ).toHaveLength(0);
    second.dispose();
    expect(
      transport.invocations.filter((call) => (call.payload as { action: string }).action === 'unsubscribe'),
    ).toHaveLength(1);
  });

  it('disposeAll 移除全部监听且后续订阅为死订阅', () => {
    const { registry, transport } = createRegistry(() => ({ controlId: 'c1', ok: true }));
    registry.subscribe('window:closed', vi.fn());
    registry.subscribe('custom:event', vi.fn());
    registry.disposeAll();
    registry.disposeAll();
    expect(transport.listenerCount('event:window:closed')).toBe(0);
    expect(transport.listenerCount('event:custom:event')).toBe(0);
    const dead = registry.subscribe('window:closed', vi.fn());
    expect(() => dead.dispose()).not.toThrow();
    expect(
      transport.invocations.filter((call) => (call.payload as { action?: string }).action === 'subscribe'),
    ).toHaveLength(2);
  });
});
