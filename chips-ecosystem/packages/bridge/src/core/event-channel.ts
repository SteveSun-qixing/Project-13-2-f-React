/**
 * 事件通道（02-Bridge三层设计 §7.5、§2.4、05-事件契约规范 §5）。
 *
 * - 投递使用 `event:<eventId>` 单通道单事件；只向已登记该事件的窗口推送，计数为 0 的窗口不做序列化；
 * - 订阅控制经 `event:control`：事件未登记返回 `EVENT_NOT_REGISTERED`，不可见返回 `EVENT_SUBSCRIBE_DENIED`，
 *   ID 非法返回 `EVENT_ID_INVALID`；回执失败时 preload 侧丢弃缓冲、订阅不建立；
 * - 定向事件按 payload 字段或宿主提供的归属解析器逐事件过滤（fail-closed）；
 * - 会话销毁时一次性清理该会话全部订阅与转发计数。
 */

import {
  BRIDGE_ERROR_CODES,
  ChipsError,
  createBridgeError,
  normalizeError,
  type IChipsError,
} from '../protocol/errors.js';
import {
  EVENT_ERROR_CODES,
  findStandardEvent,
  isValidEventId,
  type IEventEnvelope,
  type IStandardEventDefinition,
} from '../protocol/events.js';
import {
  assertEventPayload,
  decodeEventControlRequest,
  encodeEventControlFailure,
  encodeEventControlSuccess,
  eventChannel,
} from '../protocol/ipc.js';
import type { ISessionSnapshot, ISessionSource } from '../protocol/session.js';
import type { ISessionRegistry } from './session-registry.js';

export interface IEventVisibilityResolver {
  /** 对单条事件实例判定会话是否可见；无法判定时返回 false（fail-closed）。 */
  isVisible(
    definition: IStandardEventDefinition,
    payload: unknown,
    session: ISessionSnapshot
  ): boolean;
}

export type EventOwnerScope = 'command' | 'tray' | 'shortcut' | 'transfer';

export interface IDefaultEventVisibilityOptions {
  /**
   * 归属查询接缝（command / tray / shortcut / transfer 类定向事件）：
   * 返回目标插件 ID；`null` 表示平台侧（不对插件投递）；`undefined` 表示无法判定（不可见）。
   */
  readonly resolveOwnerPluginId?: (
    scope: EventOwnerScope,
    payload: unknown,
    session: ISessionSnapshot
  ) => string | null | undefined;
}

function readPayloadField(payload: unknown, field: string): unknown {
  let current: unknown = payload;
  for (const segment of field.split('.')) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function hasConfigNamespaceGrant(session: ISessionSnapshot, namespace: string): boolean {
  return (
    session.grantedPermissions.has(`config:read:${namespace}`) ||
    session.grantedPermissions.has('config:read')
  );
}

/** 默认可见性解析：公开 / 平台专属 / payload 字段定向 / 配置命名空间 / 归属查询。 */
export function createDefaultEventVisibilityResolver(
  options: IDefaultEventVisibilityOptions = {}
): IEventVisibilityResolver {
  return {
    isVisible(
      definition: IStandardEventDefinition,
      payload: unknown,
      session: ISessionSnapshot
    ): boolean {
      if (session.pluginId === 'platform') {
        return true;
      }
      switch (definition.visibility.kind) {
        case 'public':
          return true;
        case 'platform':
          return false;
        case 'plugin-field': {
          const value = readPayloadField(payload, definition.visibility.field);
          return typeof value === 'string' && value === session.pluginId;
        }
        case 'config-namespace': {
          const key = readPayloadField(payload, 'key');
          if (typeof key !== 'string') {
            return false;
          }
          if (key === 'platform' || key.startsWith('platform.')) {
            return hasConfigNamespaceGrant(session, 'platform');
          }
          const ownNamespace = `plugins.${session.pluginId}`;
          return key === ownNamespace || key.startsWith(`${ownNamespace}.`);
        }
        case 'owner-lookup': {
          const owner = options.resolveOwnerPluginId?.(
            definition.visibility.scope,
            payload,
            session
          );
          return typeof owner === 'string' && owner === session.pluginId;
        }
        default:
          return false;
      }
    },
  };
}

export interface IEventDeliveryPort {
  /** 向窗口投递事件封套（主进程 → 渲染，`webContents.send`）。 */
  sendToWindow(windowId: number, channel: string, envelope: IEventEnvelope): void;
}

export interface IEventChannelOptions {
  readonly sessions: ISessionRegistry;
  readonly delivery: IEventDeliveryPort;
  readonly visibility?: IEventVisibilityResolver;
  readonly onDiagnostic?: (error: unknown) => void;
}

export interface IEventChannel {
  /** 处理 `event:control` 请求并返回回执（subscribe / unsubscribe）。 */
  handleControl(
    raw: unknown,
    source: ISessionSource
  ):
    | {
        controlId: string;
        ok: true;
      }
    | { controlId: string; ok: false; error: IChipsError };
  /** 投递事件实例；返回实际投递的窗口数（0 表示无订阅者，不做序列化）。 */
  deliver(eventId: string, payload: unknown, emittedAt?: number): number;
  /** 某事件跨会话订阅总数。 */
  subscriptionCount(eventId: string): number;
  /** 某窗口对某事件的订阅计数。 */
  windowSubscriptionCount(windowId: number, eventId: string): number;
  /** 清理某会话全部订阅（会话关闭）。 */
  cleanupSession(sessionId: string): void;
  dispose(): void;
}

function eventError(code: string, message: string, details?: unknown): ChipsError {
  return new ChipsError({
    code,
    message,
    ...(details !== undefined ? { details } : {}),
    retryable: false,
  });
}

export function createEventChannel(options: IEventChannelOptions): IEventChannel {
  const visibility = options.visibility ?? createDefaultEventVisibilityResolver();
  const sessionSubscriptions = new Map<string, Map<string, number>>();
  const windowSubscriptions = new Map<number, Map<string, number>>();

  const adjustWindow = (windowId: number, eventId: string, delta: number): void => {
    const counts = windowSubscriptions.get(windowId) ?? new Map<string, number>();
    const next = (counts.get(eventId) ?? 0) + delta;
    if (next <= 0) {
      counts.delete(eventId);
    } else {
      counts.set(eventId, next);
    }
    if (counts.size === 0) {
      windowSubscriptions.delete(windowId);
    } else {
      windowSubscriptions.set(windowId, counts);
    }
  };

  const cleanupSession = (sessionId: string): void => {
    const events = sessionSubscriptions.get(sessionId);
    if (events === undefined) {
      return;
    }
    const session = options.sessions.resolveById(sessionId);
    const windowId = session?.windowId;
    for (const [eventId, count] of events) {
      if (windowId !== undefined) {
        adjustWindow(windowId, eventId, -count);
      }
    }
    sessionSubscriptions.delete(sessionId);
  };

  const unsubscribeClosed = options.sessions.onSessionClosed((session) => {
    cleanupSession(session.sessionId);
  });

  return {
    handleControl(
      raw: unknown,
      source: ISessionSource
    ):
      | {
          controlId: string;
          ok: true;
        }
      | { controlId: string; ok: false; error: IChipsError } {
      let controlId = '';
      try {
        const control = decodeEventControlRequest(raw);
        controlId = control.controlId;
        const session = options.sessions.resolve(source);
        if (session === undefined) {
          throw createBridgeError(BRIDGE_ERROR_CODES.sessionUnknown);
        }
        if (!isValidEventId(control.eventId)) {
          throw eventError(EVENT_ERROR_CODES.idInvalid, '事件 ID 格式不合法');
        }
        const definition = findStandardEvent(control.eventId);
        if (definition === undefined) {
          throw eventError(EVENT_ERROR_CODES.notRegistered, '事件未登记');
        }
        const events = sessionSubscriptions.get(session.sessionId) ?? new Map<string, number>();
        if (control.action === 'subscribe') {
          if (definition.visibility.kind === 'platform') {
            throw eventError(EVENT_ERROR_CODES.subscribeDenied, '该事件对插件不可见');
          }
          events.set(control.eventId, (events.get(control.eventId) ?? 0) + 1);
          sessionSubscriptions.set(session.sessionId, events);
          adjustWindow(session.windowId, control.eventId, 1);
        } else {
          const current = events.get(control.eventId) ?? 0;
          if (current > 0) {
            if (current - 1 <= 0) {
              events.delete(control.eventId);
            } else {
              events.set(control.eventId, current - 1);
            }
            adjustWindow(session.windowId, control.eventId, -1);
          }
          if (events.size === 0) {
            sessionSubscriptions.delete(session.sessionId);
          }
        }
        return encodeEventControlSuccess(control.controlId);
      } catch (error) {
        return encodeEventControlFailure(
          controlId,
          normalizeError(
            error,
            options.onDiagnostic !== undefined ? { onDiagnostic: options.onDiagnostic } : {}
          )
        );
      }
    },

    deliver(eventId: string, payload: unknown, emittedAt: number = Date.now()): number {
      const definition = findStandardEvent(eventId);
      if (definition === undefined) {
        throw eventError(EVENT_ERROR_CODES.notRegistered, '事件未登记');
      }
      assertEventPayload(payload);
      let hasSubscribers = false;
      for (const events of sessionSubscriptions.values()) {
        if ((events.get(eventId) ?? 0) > 0) {
          hasSubscribers = true;
          break;
        }
      }
      if (!hasSubscribers) {
        return 0;
      }
      const targets = new Map<number, ISessionSnapshot>();
      for (const [sessionId, events] of sessionSubscriptions) {
        if ((events.get(eventId) ?? 0) <= 0) {
          continue;
        }
        const session = options.sessions.resolveById(sessionId);
        if (session === undefined || session.state !== 'active') {
          cleanupSession(sessionId);
          continue;
        }
        if (!visibility.isVisible(definition, payload, session)) {
          continue;
        }
        targets.set(session.windowId, session);
      }
      if (targets.size === 0) {
        return 0;
      }
      const envelope: IEventEnvelope = { eventId, payload, emittedAt };
      let delivered = 0;
      for (const [windowId] of targets) {
        if ((windowSubscriptions.get(windowId)?.get(eventId) ?? 0) <= 0) {
          continue;
        }
        options.delivery.sendToWindow(windowId, eventChannel(eventId), envelope);
        delivered += 1;
      }
      return delivered;
    },

    subscriptionCount(eventId: string): number {
      let total = 0;
      for (const events of sessionSubscriptions.values()) {
        total += events.get(eventId) ?? 0;
      }
      return total;
    },

    windowSubscriptionCount(windowId: number, eventId: string): number {
      return windowSubscriptions.get(windowId)?.get(eventId) ?? 0;
    },

    cleanupSession,

    dispose(): void {
      sessionSubscriptions.clear();
      windowSubscriptions.clear();
      unsubscribeClosed();
    },
  };
}
