/**
 * preload 桥（`window.chips` 实现）。
 *
 * 权威：`01-Bridge-API规范` §2（`IChipsBridge` 唯一对外形状与冻结方法面）、
 * `02-Bridge三层设计` §2.1 / §2.4 / §2.5（转发、订阅登记、快速失败预检）。
 *
 * @remarks
 * - 方法面固定为 `request` / `subscribe` / `resource` 三项，不得增删。
 * - 只做转发与预检：会话有效性、权限、schema 与路由全部在核心（Bridge 层）。
 * - `requestId` 由 preload 生成并用于关联响应；迟到或格式非法的响应一律拒绝。
 * - `traceId` 由 preload 在调用边界生成并随请求帧横切透传（工单046 段一：
 *   preload→`bridge:request`→router→事件下行四段贯通，审计条目与下行封套以此为源，
 *   禁另造关联键）；与 `requestId` 共用注入的 `generateId` 设施。
 */

import { ChipsError, normalizeError } from '@chips/bridge';
import { BRIDGE_REQUEST_CHANNEL, SESSION_PERMISSIONS_CHANNEL } from '../protocol/channels.js';
import { isBridgeResponse, isSessionPermissionsUpdate } from '../protocol/wire.js';
import { SessionPermissionCache } from './permission-cache.js';
import { createResourceHandle, ResourceInvalidationHub, type IResourceHandle } from './resource-handle.js';
import { SubscriptionRegistry, type ISubscription } from './subscriptions.js';
import type { IPreloadTransport } from './transport.js';

/** preload 桥依赖。 */
export interface PreloadBridgeDeps {
  /** 传输口。 */
  readonly transport: IPreloadTransport;
  /** `requestId` / `traceId` / `controlId` 生成器；默认 `crypto.randomUUID()`。 */
  readonly generateId?: () => string;
  /** `fetch` 实现透传（资源句柄）；默认全局 `fetch`。 */
  readonly fetchImpl?: typeof fetch;
  /** 诊断口；默认 `console.error`。 */
  readonly onDiagnostic?: (message: string, details?: Readonly<Record<string, unknown>>) => void;
}

/** `window.chips` 形状；与 `IChipsBridge` 一致。 */
export interface IPreloadBridge {
  /** 能力调用。 */
  request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput>;
  /** 事件订阅。 */
  subscribe(eventId: string, handler: (payload: unknown) => void): ISubscription;
  /** 资源句柄。 */
  resource(uri: string): IResourceHandle;
  /** 平台内部：释放全部订阅与句柄登记（preload 卸载时调用）。 */
  dispose(): void;
}

/** 默认 `requestId` 生成器。 */
function defaultGenerateId(): string {
  return crypto.randomUUID();
}

/**
 * 创建 preload 桥。
 *
 * @param deps 依赖。
 */
export function createPreloadBridge(deps: PreloadBridgeDeps): IPreloadBridge {
  const generateId = deps.generateId ?? defaultGenerateId;
  const onDiagnostic =
    deps.onDiagnostic ??
    ((message: string, details?: Readonly<Record<string, unknown>>): void => {
      console.error(`[chips-preload] ${message}`, details ?? {});
    });
  const permissions = new SessionPermissionCache();
  const subscriptions = new SubscriptionRegistry({
    transport: deps.transport,
    generateControlId: generateId,
    onDiagnostic,
  });
  const invalidations = new ResourceInvalidationHub(
    (eventId, handler) => subscriptions.subscribe(eventId, handler),
    onDiagnostic,
  );

  deps.transport.on(SESSION_PERMISSIONS_CHANNEL, (payload) => {
    if (!isSessionPermissionsUpdate(payload)) {
      onDiagnostic('丢弃非法会话权限推送');
      return;
    }
    permissions.update(payload);
  });

  return {
    async request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput> {
      if (typeof capabilityId !== 'string' || capabilityId.length === 0) {
        throw new ChipsError({ code: 'BRIDGE_INVALID_INPUT', message: '能力 ID 非法', retryable: false });
      }
      const requestId = generateId();
      const traceId = generateId();
      const request =
        input === undefined ? { requestId, traceId, capabilityId } : { requestId, traceId, capabilityId, input };
      let response: unknown;
      try {
        response = await deps.transport.invoke(BRIDGE_REQUEST_CHANNEL, request);
      } catch (error) {
        throw normalizeError(error, {
          onDiagnostic: (cause) => {
            onDiagnostic('能力调用传输失败', {
              reason: cause instanceof Error ? cause.message : typeof cause,
            });
          },
        });
      }
      if (!isBridgeResponse(response) || response.requestId !== requestId) {
        throw new ChipsError({ code: 'BRIDGE_INTERNAL', message: '能力调用响应格式非法', retryable: false });
      }
      if (!response.ok) {
        throw ChipsError.fromPlain(response.error);
      }
      return response.result as TOutput;
    },
    subscribe(eventId: string, handler: (payload: unknown) => void): ISubscription {
      return subscriptions.subscribe(eventId, handler);
    },
    resource(uri: string): IResourceHandle {
      return createResourceHandle(uri, {
        transport: deps.transport,
        permissions,
        invalidations,
        generateRequestId: generateId,
        ...(deps.fetchImpl !== undefined ? { fetchImpl: deps.fetchImpl } : {}),
        onDiagnostic,
      });
    },
    dispose(): void {
      subscriptions.disposeAll();
      invalidations.dispose();
    },
  };
}
