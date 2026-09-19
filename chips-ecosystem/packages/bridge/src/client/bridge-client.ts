/**
 * Bridge 客户端壳（01-Bridge-API规范 §2、§3、§4；02-Bridge三层设计 §2.4、§5.3、§10.2）。
 *
 * preload 与渲染进程共用：通过注入 `IIpcTransport` 把 `IChipsBridge` 三个方法映射到固定 IPC 通道。
 * 本壳负责 `requestId` / `controlId` 关联与迟到结果丢弃、订阅本地计数与回执前缓冲、会话权限快照
 * 快速失败预检（非安全边界）与资源句柄代理；权威判定始终在主进程 Bridge。
 */

import {
  BRIDGE_ERROR_CODES,
  ChipsError,
  createBridgeError,
  normalizeError,
} from '../protocol/errors.js';
import { EVENT_ERROR_CODES, isValidEventId } from '../protocol/events.js';
import {
  IPC_CHANNELS,
  decodeBridgeResponse,
  decodeEventControlResponse,
  decodeSessionPermissionsUpdate,
  eventChannel,
  type IBridgeRequest,
  type ISessionPermissionsUpdate,
} from '../protocol/ipc.js';
import { RESOURCE_ERROR_CODES, type ResourceInvalidateReason } from '../protocol/resource.js';
import type { IChipsBridge, ISubscription } from '../protocol/bridge.js';
import type { IResourceHandle } from '../protocol/resource.js';
import { parsePermissionId } from '../protocol/permissions.js';
import { normalizeResourceInput, type IResourceUri } from '../protocol/resource-uri.js';
import { matchResourceQualifier } from '../core/qualifiers.js';
import { createRequestId } from './request-id.js';
import { createResourceHandleProxy, type IResourceHandleProxy } from './resource-handle.js';
import type { IIpcTransport, IResourceByteSource } from './transport.js';

/** 订阅回执前缓冲上限（与主进程下行缓冲一致，先到者为准；溢出丢弃最旧）。 */
export const MAX_PENDING_EVENT_BUFFER = 1024;

export interface IBridgeClientOptions {
  readonly transport: IIpcTransport;
  /** 本会话标识；用于丢弃其他会话的权限下行推送。 */
  readonly sessionId: string;
  readonly bytes: IResourceByteSource;
  /** 初始权限快照（preload 由平台注入）；省略时资源预检只做语法校验。 */
  readonly grantedPermissions?: readonly string[];
  /** 标识生成器；缺省使用 UUID v4。 */
  readonly createRequestId?: () => string;
  /** 自身资源作用域判定（免权限范围）；由宿主注入。 */
  readonly isOwnResourceScope?: (scope: string) => boolean;
  readonly onDiagnostic?: (error: unknown) => void;
}

export interface IBridgeClient extends IChipsBridge {
  /** 本地订阅条目总数（诊断用）。 */
  readonly subscriptionCount: number;
  /** 当前权限快照版本；初始为 0。 */
  readonly permissionVersion: number;
  /** 应用 `session:permissions` 下行推送；会话不匹配或版本不递增时忽略。 */
  applyPermissionsUpdate(update: ISessionPermissionsUpdate): void;
  /** 释放全部本地订阅与下行监听（窗口销毁 / 插件停用时调用；幂等）。 */
  dispose(): void;
}

interface IEventEntry {
  readonly eventId: string;
  /** handler → 订阅次数（同一 handler 多次订阅各自独立）。 */
  readonly handlers: Map<(payload: unknown) => void, number>;
  acknowledged: boolean;
  failed: boolean;
  readonly buffer: unknown[];
  unsubscribeListener: () => void;
}

function eventError(code: string, message: string): ChipsError {
  return new ChipsError({ code, message, retryable: false });
}

function narrowEventEnvelope(
  raw: unknown,
  expectedEventId: string
): { payload: unknown } | undefined {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const record = raw as Record<string, unknown>;
  if (record.eventId !== expectedEventId) {
    return undefined;
  }
  return { payload: record.payload };
}

function narrowInvalidatedPayload(
  payload: unknown
): { uri: string; reason: ResourceInvalidateReason } | undefined {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }
  const record = payload as Record<string, unknown>;
  const reason = record.reason;
  if (typeof record.uri !== 'string') {
    return undefined;
  }
  if (reason !== 'source-changed' && reason !== 'session-closed' && reason !== 'scope-revoked') {
    return undefined;
  }
  return { uri: record.uri, reason };
}

export function createBridgeClient(options: IBridgeClientOptions): IBridgeClient {
  const createId = options.createRequestId ?? createRequestId;
  const reportDiagnostic = (error: unknown): void => {
    options.onDiagnostic?.(normalizeError(error));
  };

  const entries = new Map<string, IEventEntry>();
  const handleRecords = new Map<string, Set<IResourceHandleProxy>>();
  let granted: ReadonlySet<string> | undefined =
    options.grantedPermissions !== undefined ? new Set(options.grantedPermissions) : undefined;
  let permissionVersion = 0;
  let invalidationSubscription: ISubscription | undefined;

  const dispatch = (entry: IEventEntry, payload: unknown): void => {
    for (const [handler, count] of [...entry.handlers]) {
      for (let index = 0; index < count; index += 1) {
        try {
          handler(payload);
        } catch (error) {
          reportDiagnostic(error);
        }
      }
    }
  };

  const flush = (entry: IEventEntry): void => {
    const pending = entry.buffer.splice(0, entry.buffer.length);
    for (const payload of pending) {
      dispatch(entry, payload);
    }
  };

  const dropEntry = (entry: IEventEntry, error: unknown): void => {
    if (entry.failed) {
      return;
    }
    entry.failed = true;
    entry.buffer.length = 0;
    entry.handlers.clear();
    entry.unsubscribeListener();
    entries.delete(entry.eventId);
    reportDiagnostic(error);
  };

  const sendControl = (entry: IEventEntry, action: 'subscribe' | 'unsubscribe'): void => {
    const controlId = createId();
    void (async () => {
      try {
        const raw = await options.transport.invoke(IPC_CHANNELS.eventControl, {
          controlId,
          action,
          eventId: entry.eventId,
        });
        const response = decodeEventControlResponse(raw);
        if (response.controlId !== controlId) {
          throw createBridgeError(BRIDGE_ERROR_CODES.internal, {
            message: '事件控制响应关联失败',
            retryable: false,
          });
        }
        if (action !== 'subscribe') {
          return;
        }
        if (response.ok) {
          entry.acknowledged = true;
          flush(entry);
        } else {
          dropEntry(entry, ChipsError.fromPlain(response.error));
        }
      } catch (error) {
        if (action === 'subscribe') {
          dropEntry(entry, error);
        } else {
          reportDiagnostic(error);
        }
      }
    })();
  };

  const ensureEntry = (eventId: string): IEventEntry => {
    const existing = entries.get(eventId);
    if (existing !== undefined) {
      return existing;
    }
    const entry: IEventEntry = {
      eventId,
      handlers: new Map(),
      acknowledged: false,
      failed: false,
      buffer: [],
      unsubscribeListener: () => undefined,
    };
    entry.unsubscribeListener = options.transport.on(eventChannel(eventId), (raw: unknown) => {
      const envelope = narrowEventEnvelope(raw, eventId);
      if (envelope === undefined) {
        return;
      }
      if (!entry.acknowledged) {
        if (entry.buffer.length >= MAX_PENDING_EVENT_BUFFER) {
          entry.buffer.shift();
        }
        entry.buffer.push(envelope.payload);
        return;
      }
      dispatch(entry, envelope.payload);
    });
    entries.set(eventId, entry);
    sendControl(entry, 'subscribe');
    return entry;
  };

  const hasResourceRead = (normalized: IResourceUri): boolean => {
    if (granted === undefined) {
      return true;
    }
    if (normalized.authority === 'platform') {
      return true;
    }
    if (options.isOwnResourceScope?.(normalized.authority) === true) {
      return true;
    }
    if (granted.has('resources:read') || granted.has('resources:*')) {
      return true;
    }
    for (const permission of granted) {
      const parsed = parsePermissionId(permission);
      if (parsed === undefined || parsed.domain !== 'resources' || parsed.scope !== 'read') {
        continue;
      }
      if (
        parsed.qualifier !== undefined &&
        matchResourceQualifier(parsed.qualifier, normalized.uri)
      ) {
        return true;
      }
    }
    return false;
  };

  const pruneHandles = (): void => {
    for (const [key, handles] of handleRecords) {
      for (const handle of handles) {
        if (handle.state === 'released') {
          handles.delete(handle);
        }
      }
      if (handles.size === 0) {
        handleRecords.delete(key);
      }
    }
  };

  const ensureInvalidationSubscription = (): void => {
    if (invalidationSubscription !== undefined) {
      return;
    }
    invalidationSubscription = api.subscribe('resource:invalidated', (payload: unknown) => {
      const record = narrowInvalidatedPayload(payload);
      if (record === undefined) {
        return;
      }
      let normalized: string;
      try {
        normalized = normalizeResourceInput(record.uri).uri;
      } catch {
        return;
      }
      const handles = handleRecords.get(normalized);
      if (handles === undefined) {
        return;
      }
      for (const handle of [...handles]) {
        handle.invalidate(record.reason);
      }
    });
  };

  const sessionPermissionsUnsubscribe = options.transport.on(
    IPC_CHANNELS.sessionPermissions,
    (raw: unknown) => {
      const update = decodeSessionPermissionsUpdate(raw);
      if (update !== undefined) {
        applyPermissionsUpdate(update);
      }
    }
  );

  const applyPermissionsUpdate = (update: ISessionPermissionsUpdate): void => {
    if (update.sessionId !== options.sessionId) {
      return;
    }
    if (update.permissionVersion <= permissionVersion) {
      return;
    }
    permissionVersion = update.permissionVersion;
    granted = new Set(update.grantedPermissions);
  };

  const api: IBridgeClient = {
    async request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput> {
      const requestId = createId();
      const request: IBridgeRequest =
        input === undefined ? { requestId, capabilityId } : { requestId, capabilityId, input };
      let raw: unknown;
      try {
        raw = await options.transport.invoke(IPC_CHANNELS.bridgeRequest, request);
      } catch (error) {
        throw normalizeError(
          error,
          options.onDiagnostic !== undefined ? { onDiagnostic: options.onDiagnostic } : {}
        );
      }
      const response = decodeBridgeResponse(raw);
      if (response.requestId !== requestId) {
        throw createBridgeError(BRIDGE_ERROR_CODES.internal, {
          message: '能力调用响应关联失败',
          retryable: false,
        });
      }
      if (!response.ok) {
        throw ChipsError.fromPlain(response.error);
      }
      return response.result as TOutput;
    },

    subscribe(eventId: string, handler: (payload: unknown) => void): ISubscription {
      if (!isValidEventId(eventId)) {
        throw eventError(EVENT_ERROR_CODES.idInvalid, '事件 ID 格式不合法');
      }
      const entry = ensureEntry(eventId);
      entry.handlers.set(handler, (entry.handlers.get(handler) ?? 0) + 1);
      let disposed = false;
      return {
        dispose(): void {
          if (disposed) {
            return;
          }
          disposed = true;
          if (entry.failed) {
            return;
          }
          const count = entry.handlers.get(handler) ?? 0;
          if (count <= 1) {
            entry.handlers.delete(handler);
          } else {
            entry.handlers.set(handler, count - 1);
          }
          if (entry.handlers.size === 0) {
            entry.unsubscribeListener();
            entries.delete(entry.eventId);
            sendControl(entry, 'unsubscribe');
          }
        },
      };
    },

    resource(uri: string): IResourceHandle {
      const normalized = normalizeResourceInput(uri);
      if (!hasResourceRead(normalized)) {
        throw new ChipsError({
          code: RESOURCE_ERROR_CODES.permissionDenied,
          message: '缺少资源读取权限',
          details: { uri: normalized.uri, permission: 'resources:read' },
          retryable: false,
        });
      }
      pruneHandles();
      const handle = createResourceHandleProxy({
        uri,
        transport: options.transport,
        bytes: options.bytes,
        ...(options.createRequestId !== undefined
          ? { createRequestId: options.createRequestId }
          : {}),
        ...(options.onDiagnostic !== undefined ? { onDiagnostic: options.onDiagnostic } : {}),
      });
      const handles = handleRecords.get(normalized.uri) ?? new Set<IResourceHandleProxy>();
      handles.add(handle);
      handleRecords.set(normalized.uri, handles);
      ensureInvalidationSubscription();
      return handle;
    },

    get subscriptionCount(): number {
      let total = 0;
      for (const entry of entries.values()) {
        for (const count of entry.handlers.values()) {
          total += count;
        }
      }
      return total;
    },

    get permissionVersion(): number {
      return permissionVersion;
    },

    applyPermissionsUpdate,

    dispose(): void {
      for (const entry of entries.values()) {
        entry.failed = true;
        entry.buffer.length = 0;
        entry.handlers.clear();
        entry.unsubscribeListener();
      }
      entries.clear();
      invalidationSubscription?.dispose();
      invalidationSubscription = undefined;
      sessionPermissionsUnsubscribe();
    },
  };

  return api;
}
