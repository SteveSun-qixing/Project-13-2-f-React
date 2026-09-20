/**
 * 能力调用路由管线（02-Bridge三层设计 §5.2 阶段序）。
 *
 * 权威：`02-Bridge三层设计` §5.2（注册表命中 → 权限判定 → Schema 准入 → 并发闸门 → 调用上下文 →
 * 执行 → 错误归一 → 响应编码），§8（超时/取消），§9.1（错误归一）。
 *
 * @remarks
 * - 本路由在**已解析会话**的前提下执行；会话解析与建立由运行时组合根承担（见 `runtime/host-runtime.ts`），
 *   路由不重复实现第二套会话表。
 * - Schema 准入仅做契约声明的顶层 `required` 字段存在性检查（快速失败），深度校验在 Bridge 内核交付后由内核承担。
 * - 处理器抛出的任何值都经 `toWireError` 归一为结构化错误；超时/取消在归一之前判定，避免语义漂移。
 */

import { BRIDGE_ERROR_CODES, bridgeWireError } from '../../protocol/error-codes.js';
import { toWireError, type IBridgeRequest, type IBridgeResponse, type IWireChipsError } from '../../protocol/wire.js';
import type { IHostCallScheduler } from './scheduler.js';
import type { IHostCapabilityRegistry } from './registry.js';
import { evaluateHostPermissions } from './session.js';
import type { IHostCapabilityContext, IHostSession } from './contracts.js';

/** 路由依赖。 */
export interface IHostCapabilityRouterDeps {
  /** 能力注册表。 */
  readonly registry: IHostCapabilityRegistry;
  /** 并发闸门。 */
  readonly scheduler: IHostCallScheduler;
  /** 时钟（毫秒）；测试可注入。 */
  readonly now: () => number;
  /** 向会话所在窗口投递事件（按订阅计数由运行时决定去留）。 */
  readonly publishEvent: (sessionId: string, windowId: number, eventId: string, payload: unknown) => void;
  /** 会话取消信号（会话关闭 / 停机时触发）；不存在时返回 `undefined`。 */
  readonly sessionSignalFor: (sessionId: string) => AbortSignal | undefined;
}

/** 能力路由。 */
export interface IHostCapabilityRouter {
  /** 处理一次已解析会话的能力调用；始终返回结构化响应，不抛出。 */
  route(session: IHostSession, request: IBridgeRequest): Promise<IBridgeResponse>;
}

/** 顶层 `required` 字段的输入准入；返回缺失字段列表。 */
function missingRequiredFields(schema: Readonly<Record<string, unknown>> | undefined, input: unknown): string[] {
  if (schema === undefined) {
    return [];
  }
  const required = schema['required'];
  if (!Array.isArray(required) || required.length === 0) {
    return [];
  }
  const source: Record<string, unknown> =
    typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const missing: string[] = [];
  for (const field of required) {
    if (typeof field === 'string' && !(field in source)) {
      missing.push(field);
    }
  }
  return missing;
}

const TIMEOUT_REASON = 'bridge-timeout';
const CANCEL_REASON = 'bridge-cancel';

/** 创建能力路由。 */
export function createHostCapabilityRouter(deps: IHostCapabilityRouterDeps): IHostCapabilityRouter {
  const { registry, scheduler } = deps;

  const route = async (session: IHostSession, request: IBridgeRequest): Promise<IBridgeResponse> => {
    const entry = registry.get(request.capabilityId);
    if (entry === undefined) {
      return {
        requestId: request.requestId,
        ok: false,
        error: bridgeWireError(BRIDGE_ERROR_CODES.capabilityNotFound, {
          details: { capabilityId: request.capabilityId },
        }),
      };
    }

    const decision = evaluateHostPermissions({
      capabilityId: entry.id,
      requiredPermissions: entry.permissions,
      grantedPermissions: session.grantedPermissions,
    });
    if (!decision.allowed) {
      return {
        requestId: request.requestId,
        ok: false,
        error: bridgeWireError(BRIDGE_ERROR_CODES.permissionDenied, {
          details: {
            capabilityId: entry.id,
            pluginId: session.pluginId,
            permission: decision.permission,
            missing: decision.missing,
            reason: decision.reason,
          },
        }),
      };
    }

    const missing = missingRequiredFields(entry.descriptor.schema, request.input);
    if (missing.length > 0) {
      return {
        requestId: request.requestId,
        ok: false,
        error: bridgeWireError(BRIDGE_ERROR_CODES.invalidInput, {
          details: { capabilityId: entry.id, missing },
        }),
      };
    }

    const controller = new AbortController();
    const sessionSignal = deps.sessionSignalFor(session.sessionId);
    const onSessionAbort = (): void => {
      if (!controller.signal.aborted) {
        controller.abort(CANCEL_REASON);
      }
    };
    if (sessionSignal !== undefined) {
      if (sessionSignal.aborted) {
        onSessionAbort();
      } else {
        sessionSignal.addEventListener('abort', onSessionAbort, { once: true });
      }
    }

    let permit: Awaited<ReturnType<IHostCallScheduler['acquire']>> | null = null;
    const deadline = deps.now() + entry.timeoutMs;

    try {
      permit = await scheduler.acquire({
        capabilityId: entry.id,
        sessionId: session.sessionId,
        concurrency: entry.concurrency,
        maxQueue: entry.maxQueue,
        sessionInFlightLimit: entry.sessionInFlightLimit,
        signal: controller.signal,
      });
    } catch (error) {
      if (sessionSignal !== undefined) {
        sessionSignal.removeEventListener('abort', onSessionAbort);
      }
      return { requestId: request.requestId, ok: false, error: toWireError(error) };
    }

    const context: IHostCapabilityContext = {
      signal: controller.signal,
      deadline,
      sessionId: session.sessionId,
      callerId: session.pluginId,
      emit(eventId: string, payload: unknown): void {
        if (!controller.signal.aborted) {
          deps.publishEvent(session.sessionId, session.windowId, eventId, payload);
        }
      },
    };

    const execution = (async (): Promise<IBridgeResponse> => {
      const handler = Promise.resolve()
        .then(() => entry.descriptor.handler(request.input, context))
        .then(
          (result): IBridgeResponse => ({ requestId: request.requestId, ok: true, result }),
          (error: unknown): IBridgeResponse => ({
            requestId: request.requestId,
            ok: false,
            error: toWireError(error),
          }),
        );

      const aborting = new Promise<IBridgeResponse>((resolve) => {
        const settle = (): void => {
          const reason: unknown = controller.signal.reason;
          const error: IWireChipsError =
            reason === TIMEOUT_REASON
              ? bridgeWireError(BRIDGE_ERROR_CODES.timeout, { details: { capabilityId: entry.id } })
              : bridgeWireError(BRIDGE_ERROR_CODES.cancelled, { details: { capabilityId: entry.id } });
          resolve({ requestId: request.requestId, ok: false, error });
        };
        if (controller.signal.aborted) {
          settle();
          return;
        }
        controller.signal.addEventListener('abort', settle, { once: true });
      });

      return Promise.race([handler, aborting]);
    })();

    const timer = setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort(TIMEOUT_REASON);
      }
    }, entry.timeoutMs);

    try {
      return await execution;
    } finally {
      clearTimeout(timer);
      if (sessionSignal !== undefined) {
        sessionSignal.removeEventListener('abort', onSessionAbort);
      }
      permit?.release();
    }
  };

  return { route };
}
