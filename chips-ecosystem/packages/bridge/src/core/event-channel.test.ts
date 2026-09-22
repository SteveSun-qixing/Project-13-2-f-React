import { describe, expect, it } from 'vitest';
import type { IEventEnvelope } from '../protocol/events.js';
import type { ISessionSnapshot } from '../protocol/session.js';
import {
  createDefaultEventVisibilityResolver,
  createEventChannel,
  type IEventChannel,
  type IEventDeliveryPort,
} from './event-channel.js';
import { createSessionRegistry } from './session-registry.js';
import { thrownErrorCode } from '../../tests/fixtures/expect-chips-error.js';

interface ISentMessage {
  windowId: number;
  channel: string;
  envelope: IEventEnvelope;
}

interface IHarness {
  channel: IEventChannel;
  sessions: ReturnType<typeof createSessionRegistry>;
  sent: ISentMessage[];
  diagnostics: unknown[];
  delivery: IEventDeliveryPort;
}

function createHarness(options?: {
  resolveOwnerPluginId?: (
    scope: string,
    payload: unknown,
    session: ISessionSnapshot
  ) => string | null | undefined;
}): IHarness {
  const sessions = createSessionRegistry();
  sessions.create({
    sessionId: 's1',
    pluginId: 'chips.official.editor',
    windowId: 1,
    frameId: 0,
    grantedPermissions: ['config:read:platform'],
  });
  sessions.create({
    sessionId: 's2',
    pluginId: 'chips.official.viewer',
    windowId: 2,
    frameId: 0,
  });
  const sent: ISentMessage[] = [];
  const diagnostics: unknown[] = [];
  const delivery: IEventDeliveryPort = {
    sendToWindow(windowId, channel, envelope) {
      sent.push({ windowId, channel, envelope });
    },
  };
  const channel = createEventChannel({
    sessions,
    delivery,
    visibility: createDefaultEventVisibilityResolver(
      options?.resolveOwnerPluginId !== undefined
        ? { resolveOwnerPluginId: options.resolveOwnerPluginId }
        : {}
    ),
    onDiagnostic: (error) => diagnostics.push(error),
  });
  return { channel, sessions, sent, diagnostics, delivery };
}

const SOURCE_1 = { windowId: 1, frameId: 0 };
const SOURCE_2 = { windowId: 2, frameId: 0 };

function control(action: 'subscribe' | 'unsubscribe', eventId: string, controlId = 'c1'): unknown {
  return { controlId, action, eventId };
}

describe('createEventChannel handleControl', () => {
  it('控制请求结构非法返回 BRIDGE_INTERNAL 回执', () => {
    const harness = createHarness();
    const response = harness.channel.handleControl(null, SOURCE_1);
    expect(response).toMatchObject({
      controlId: '',
      ok: false,
      error: { code: 'BRIDGE_INTERNAL' },
    });
    const malformed = harness.channel.handleControl(
      { controlId: 'c9', action: 'subscribe', eventId: '' },
      SOURCE_1
    );
    expect(malformed).toMatchObject({
      controlId: '',
      ok: false,
      error: { code: 'BRIDGE_INTERNAL' },
    });
  });

  it('会话无法解析返回 BRIDGE_SESSION_UNKNOWN', () => {
    const harness = createHarness();
    const response = harness.channel.handleControl(control('subscribe', 'file:changed'), {
      windowId: 9,
      frameId: 0,
    });
    expect(response).toMatchObject({ ok: false, error: { code: 'BRIDGE_SESSION_UNKNOWN' } });
  });

  it('事件 ID 非法返回 EVENT_ID_INVALID', () => {
    const harness = createHarness();
    const response = harness.channel.handleControl(control('subscribe', 'file.changed'), SOURCE_1);
    expect(response).toMatchObject({ ok: false, error: { code: 'EVENT_ID_INVALID' } });
  });

  it('未登记事件返回 EVENT_NOT_REGISTERED', () => {
    const harness = createHarness();
    const response = harness.channel.handleControl(control('subscribe', 'editor:dirty'), SOURCE_1);
    expect(response).toMatchObject({ ok: false, error: { code: 'EVENT_NOT_REGISTERED' } });
  });

  it('平台专属事件对插件不可见返回 EVENT_SUBSCRIBE_DENIED', () => {
    const harness = createHarness();
    const response = harness.channel.handleControl(
      control('subscribe', 'security:audit'),
      SOURCE_1
    );
    expect(response).toMatchObject({ ok: false, error: { code: 'EVENT_SUBSCRIBE_DENIED' } });
  });

  it('订阅与退订维护会话与窗口计数', () => {
    const harness = createHarness();
    expect(harness.channel.handleControl(control('subscribe', 'file:changed'), SOURCE_1)).toEqual({
      controlId: 'c1',
      ok: true,
    });
    harness.channel.handleControl(control('subscribe', 'file:changed', 'c2'), SOURCE_1);
    harness.channel.handleControl(control('subscribe', 'file:changed', 'c3'), SOURCE_2);
    expect(harness.channel.subscriptionCount('file:changed')).toBe(3);
    expect(harness.channel.windowSubscriptionCount(1, 'file:changed')).toBe(2);
    expect(harness.channel.windowSubscriptionCount(2, 'file:changed')).toBe(1);

    harness.channel.handleControl(control('unsubscribe', 'file:changed'), SOURCE_1);
    expect(harness.channel.windowSubscriptionCount(1, 'file:changed')).toBe(1);
    harness.channel.handleControl(control('unsubscribe', 'file:changed'), SOURCE_1);
    expect(harness.channel.windowSubscriptionCount(1, 'file:changed')).toBe(0);
    // 计数归零后再退订为 no-op
    harness.channel.handleControl(control('unsubscribe', 'file:changed'), SOURCE_1);
    expect(harness.channel.windowSubscriptionCount(1, 'file:changed')).toBe(0);
    expect(harness.channel.subscriptionCount('file:changed')).toBe(1);
  });
});

describe('createEventChannel deliver', () => {
  it('未登记事件拒绝投递，非法载荷拒绝', () => {
    const harness = createHarness();
    expect(thrownErrorCode(() => harness.channel.deliver('editor:dirty', {}))).toBe(
      'EVENT_NOT_REGISTERED'
    );
    expect(
      thrownErrorCode(() => harness.channel.deliver('file:changed', { fn: () => undefined }))
    ).toBe('EVENT_PAYLOAD_UNSUPPORTED');
    expect(
      thrownErrorCode(() => harness.channel.deliver('file:changed', new Uint8Array(300 * 1024)))
    ).toBe('EVENT_PAYLOAD_TOO_LARGE');
  });

  it('无订阅者时返回 0 且不投递', () => {
    const harness = createHarness();
    expect(harness.channel.deliver('file:changed', { uri: 'a' })).toBe(0);
    expect(harness.sent).toHaveLength(0);
  });

  it('按窗口投递事件封套，每个窗口只投递一次', () => {
    const harness = createHarness();
    harness.channel.handleControl(control('subscribe', 'file:changed', 'c1'), SOURCE_1);
    harness.channel.handleControl(control('subscribe', 'file:changed', 'c2'), SOURCE_1);
    harness.channel.handleControl(control('subscribe', 'file:changed', 'c3'), SOURCE_2);
    const delivered = harness.channel.deliver(
      'file:changed',
      { uri: 'chips-resource://card-1/a' },
      123
    );
    expect(delivered).toBe(2);
    expect(harness.sent.map((message) => message.windowId).sort()).toEqual([1, 2]);
    expect(harness.sent[0]).toMatchObject({
      channel: 'event:file:changed',
      envelope: { eventId: 'file:changed', emittedAt: 123 },
    });
  });

  it('横切关联键随封套透出；非请求触发源不造键（工单046 段一）', () => {
    const harness = createHarness();
    harness.channel.handleControl(control('subscribe', 'file:changed', 'c1'), SOURCE_1);
    const delivered = harness.channel.deliver('file:changed', { uri: 'a' }, 123, {
      traceId: 't-9',
      requestId: 'r-9',
    });
    expect(delivered).toBe(1);
    expect(harness.sent[0]?.envelope).toMatchObject({
      eventId: 'file:changed',
      emittedAt: 123,
      traceId: 't-9',
      requestId: 'r-9',
    });
    const bare = createHarness();
    bare.channel.handleControl(control('subscribe', 'file:changed', 'c1'), SOURCE_1);
    bare.channel.deliver('file:changed', { uri: 'a' }, 124);
    expect(bare.sent[0]?.envelope.traceId).toBeUndefined();
    expect(bare.sent[0]?.envelope.requestId).toBeUndefined();
  });

  it('会话关闭后清理订阅，不再投递', () => {
    const harness = createHarness();
    harness.channel.handleControl(control('subscribe', 'file:changed'), SOURCE_1);
    expect(harness.channel.subscriptionCount('file:changed')).toBe(1);
    harness.sessions.close('s1');
    expect(harness.channel.subscriptionCount('file:changed')).toBe(0);
    expect(harness.channel.windowSubscriptionCount(1, 'file:changed')).toBe(0);
    expect(harness.channel.deliver('file:changed', { uri: 'a' })).toBe(0);
  });

  it('dispose 清空全部订阅与监听', () => {
    const harness = createHarness();
    harness.channel.handleControl(control('subscribe', 'file:changed'), SOURCE_1);
    harness.channel.dispose();
    expect(harness.channel.subscriptionCount('file:changed')).toBe(0);
    expect(harness.channel.deliver('file:changed', { uri: 'a' })).toBe(0);
    expect(() => harness.channel.cleanupSession('s1')).not.toThrow();
  });
});

describe('默认可见性解析器', () => {
  it('公开事件对所有活跃会话可见，平台会话可见一切', () => {
    const resolver = createDefaultEventVisibilityResolver();
    const definition = { id: 'file:changed', visibility: { kind: 'public' as const } };
    const editor = {
      pluginId: 'chips.official.editor',
    } as ISessionSnapshot;
    const platform = { pluginId: 'platform' } as ISessionSnapshot;
    expect(resolver.isVisible(definition, {}, editor)).toBe(true);
    expect(resolver.isVisible(definition, {}, platform)).toBe(true);
  });

  it('平台专属事件对插件不可见', () => {
    const resolver = createDefaultEventVisibilityResolver();
    const definition = { id: 'security:audit', visibility: { kind: 'platform' as const } };
    expect(resolver.isVisible(definition, {}, { pluginId: 'p' } as ISessionSnapshot)).toBe(false);
  });

  it('plugin-field 可见性按 payload 字段定向', () => {
    const resolver = createDefaultEventVisibilityResolver();
    const definition = {
      id: 'resource:opened',
      visibility: { kind: 'plugin-field' as const, field: 'pluginId' },
    };
    const editor = { pluginId: 'editor' } as ISessionSnapshot;
    const viewer = { pluginId: 'viewer' } as ISessionSnapshot;
    expect(resolver.isVisible(definition, { pluginId: 'editor' }, editor)).toBe(true);
    expect(resolver.isVisible(definition, { pluginId: 'editor' }, viewer)).toBe(false);
    expect(resolver.isVisible(definition, { pluginId: 1 }, editor)).toBe(false);
    expect(resolver.isVisible(definition, null, editor)).toBe(false);
  });

  it('config-namespace 可见性：平台命名空间需授权，自身命名空间免判定', () => {
    const resolver = createDefaultEventVisibilityResolver();
    const definition = { id: 'config:changed', visibility: { kind: 'config-namespace' as const } };
    const granted = {
      pluginId: 'editor',
      grantedPermissions: new Set(['config:read:platform']),
    } as unknown as ISessionSnapshot;
    const notGranted = {
      pluginId: 'editor',
      grantedPermissions: new Set<string>(),
    } as unknown as ISessionSnapshot;
    const viewer = {
      pluginId: 'viewer',
      grantedPermissions: new Set<string>(),
    } as unknown as ISessionSnapshot;
    expect(resolver.isVisible(definition, { key: 'platform.theme' }, granted)).toBe(true);
    expect(resolver.isVisible(definition, { key: 'platform.theme' }, notGranted)).toBe(false);
    expect(resolver.isVisible(definition, { key: 'plugins.editor.fontSize' }, notGranted)).toBe(
      true
    );
    expect(resolver.isVisible(definition, { key: 'plugins.viewer.fontSize' }, notGranted)).toBe(
      false
    );
    expect(resolver.isVisible(definition, { key: 1 }, notGranted)).toBe(false);
    expect(resolver.isVisible(definition, {}, notGranted)).toBe(false);
    expect(resolver.isVisible(definition, { key: 'plugins.viewer.fontSize' }, viewer)).toBe(true);
  });

  it('owner-lookup 依赖宿主解析器且 fail-closed', () => {
    const definition = {
      id: 'command:invoked',
      visibility: { kind: 'owner-lookup' as const, scope: 'command' as const },
    };
    const editor = { pluginId: 'editor' } as ISessionSnapshot;
    const withoutResolver = createDefaultEventVisibilityResolver();
    expect(withoutResolver.isVisible(definition, { commandId: 'x' }, editor)).toBe(false);
    const resolver = createDefaultEventVisibilityResolver({
      resolveOwnerPluginId: (scope, payload) => {
        expect(scope).toBe('command');
        return (payload as { owner: string }).owner;
      },
    });
    expect(resolver.isVisible(definition, { owner: 'editor' }, editor)).toBe(true);
    expect(resolver.isVisible(definition, { owner: 'viewer' }, editor)).toBe(false);
    const platformOwned = createDefaultEventVisibilityResolver({
      resolveOwnerPluginId: () => null,
    });
    expect(platformOwned.isVisible(definition, {}, editor)).toBe(false);
  });

  it('未知可见性种类 fail-closed', () => {
    const resolver = createDefaultEventVisibilityResolver();
    const definition = {
      id: 'x:y',
      visibility: { kind: 'unknown' } as never,
    };
    expect(resolver.isVisible(definition, {}, { pluginId: 'p' } as ISessionSnapshot)).toBe(false);
  });
});

describe('可见性在投递链路上的效果', () => {
  it('定向事件只投递给匹配窗口', () => {
    const harness = createHarness();
    harness.channel.handleControl(control('subscribe', 'resource:opened'), SOURCE_1);
    harness.channel.handleControl(control('subscribe', 'resource:opened'), SOURCE_2);
    const delivered = harness.channel.deliver('resource:opened', {
      pluginId: 'chips.official.viewer',
      context: {},
    });
    expect(delivered).toBe(1);
    expect(harness.sent[0]?.windowId).toBe(2);
  });

  it('owner-lookup 事件通过宿主解析器投递', () => {
    const harness = createHarness({
      resolveOwnerPluginId: (_scope, payload) => (payload as { owner: string }).owner,
    });
    harness.channel.handleControl(control('subscribe', 'command:invoked'), SOURCE_1);
    harness.channel.handleControl(control('subscribe', 'command:invoked'), SOURCE_2);
    harness.channel.deliver('command:invoked', { owner: 'chips.official.editor' });
    expect(harness.sent.map((message) => message.windowId)).toEqual([1]);
  });

  it('无可见目标时返回 0 且不投递', () => {
    const harness = createHarness({
      resolveOwnerPluginId: () => 'other-plugin',
    });
    harness.channel.handleControl(control('subscribe', 'command:invoked'), SOURCE_1);
    expect(harness.channel.deliver('command:invoked', {})).toBe(0);
    expect(harness.sent).toHaveLength(0);
  });
});
