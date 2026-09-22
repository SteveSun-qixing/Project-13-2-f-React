/**
 * Bridge 路由与调用管线（02-Bridge三层设计 §2.3、§5.2、§6.2、§8、§9）。
 *
 * 管线：会话解析 → 注册表命中 → 权限判定 → 信封拆分 → Schema 校验 → 并发闸门 →
 * 调用上下文（signal / deadline）→ 执行 → 错误归一 → 响应编码。
 * 迟到结果按 `requestId` 丢弃；并发不保证跨能力公平性；Bridge 不自动重试、不去重执行。
 */

import {
  BRIDGE_ERROR_CODES,
  ChipsError,
  createBridgeError,
  normalizeError,
} from '../protocol/errors.js';
import type { ICapabilityContext } from '../protocol/capability.js';
import type { IPermissionTargetRule } from '../protocol/capability-contracts.js';
import type { IPermissionAuditEntry } from '../protocol/permission.js';
import {
  decodeBridgeRequest,
  encodeBridgeResponse,
  type IBridgeRequest,
  type IBridgeResponse,
} from '../protocol/ipc.js';
import type { ISessionSource, ISessionSnapshot } from '../protocol/session.js';
import type { IValidationIssue } from '../schema/validate.js';
import type { ICapabilityRegistryCore, IRegisteredCapability } from './capability-registry.js';
import { createCallContext, type ICallContext } from './call-context.js';
import type { ICapabilityGate } from './concurrency.js';
import { mergeEnvelope, splitEnvelope } from './envelope.js';
import {
  evaluatePermissions,
  grantsFromSnapshot,
  toAuditRecord,
  type IPermissionEvaluationInput,
} from './permission-evaluator.js';
import type { IPermissionEnvironment } from './qualifiers.js';
import type { ISessionRegistry } from './session-registry.js';
import { createUlidGenerator } from './ulid.js';

/** 内核路由接缝：把能力调用交给 Host 实现（同进程直调或经 Cordis 内核路由）。 */
export interface ICapabilityInvoker {
  execute(
    registration: IRegisteredCapability,
    input: unknown,
    ctx: ICapabilityContext
  ): Promise<unknown>;
}

/**
 * 审计组装注入面（工单046 段一：条目类型收口为 §8.2 权威形状）。
 *
 * @remarks
 * 本波只做条目面收敛——挂点发射与三事件生产者归立项书段三（025③ 判定面统一后落位）；
 * 写入失败不阻塞判定的语义沿袭既有 `writeAudit` 吞失败 + `onDiagnostic` 留痕。
 */
export interface IBridgeAuditOptions {
  /** 投递一条审计条目（同步回调；抛错经 `onDiagnostic` 留痕，不影响判定）。 */
  readonly emit: (entry: IPermissionAuditEntry) => void;
  /**
   * 会话插件版本解析面：§8.2 `pluginVersion` 为运行时必填字段，
   * crate/判定层无版本位，由宿主授权/会话权威侧补挂（RFC §5.3 对齐表）。
   */
  readonly resolvePluginVersion: (session: ISessionSnapshot) => string;
  /** 请求帧未携 `traceId` 时的兜底供给（操作边界就地生成；条目 `traceId` 必填）。 */
  readonly newTraceId: () => string;
  /** 条目 `id` 供给；缺省使用路由器内置单调 ULID 生成器（工单046 段一设施）。 */
  readonly nextEntryId?: () => string;
}

export interface IBridgeRouterOptions {
  readonly sessions: ISessionRegistry;
  readonly registry: ICapabilityRegistryCore;
  readonly gate: ICapabilityGate;
  readonly invoker: ICapabilityInvoker;
  readonly permissionEnvironment: IPermissionEnvironment;
  /** 当前时间（Unix 毫秒）。 */
  readonly now?: () => number;
  /** 判定结果审计（放行/拒绝全量，工单046 裁定一）；缺省不组装条目。 */
  readonly audit?: IBridgeAuditOptions;
  /** 未识别异常诊断出口（写宿主日志，不进入返回）。 */
  readonly onDiagnostic?: (error: unknown) => void;
}

export interface IBridgeRouter {
  /** 处理一次 `bridge:request`；结构非法的请求返回 `BRIDGE_INTERNAL`。 */
  handleRequest(raw: unknown, source: ISessionSource): Promise<IBridgeResponse>;
  /** 中止某能力的在途调用与排队（注销/蓝绿切换）。 */
  cancelCapability(capabilityId: string): void;
  /** 中止某会话的在途调用与排队（会话关闭）。 */
  cancelSession(sessionId: string): void;
  /** 中止全部在途调用（Bridge 关闭）。 */
  dispose(): void;
  readonly inFlightCount: number;
}

interface IInvalidInputDetails {
  capabilityId: string;
  errors: IValidationIssue[];
  truncated: boolean;
}

interface IInFlightCall {
  readonly sessionId: string;
  readonly capabilityId: string;
  readonly callContext: ICallContext;
}

function invalidInputError(
  capabilityId: string,
  errors: readonly IValidationIssue[],
  truncated: boolean
): ChipsError {
  const details: IInvalidInputDetails = {
    capabilityId,
    errors: [...errors],
    truncated,
  };
  return createBridgeError(BRIDGE_ERROR_CODES.invalidInput, {
    message: `能力输入不合法：${capabilityId}`,
    details: details satisfies IInvalidInputDetails,
    retryable: false,
  });
}

function abortReason(signal: AbortSignal): ChipsError {
  if (signal.reason instanceof ChipsError) {
    return signal.reason;
  }
  return createBridgeError(BRIDGE_ERROR_CODES.cancelled);
}

function raceWithAbort(promise: Promise<unknown>, signal: AbortSignal): Promise<unknown> {
  if (signal.aborted) {
    return Promise.reject(abortReason(signal));
  }
  // 中止侧的拒绝原因是 Error（ChipsError）；上游 promise 的拒绝值原样透传，
  // 由调用方统一交给 `normalizeError` 归一（02-Bridge三层设计 §9.1）。
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = (): void => reject(abortReason(signal));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  return Promise.race([promise, aborted]).finally(() => {
    if (onAbort !== undefined) {
      signal.removeEventListener('abort', onAbort);
    }
  });
}

function extractRequestId(raw: unknown): string {
  if (typeof raw === 'object' && raw !== null) {
    const requestId = (raw as { requestId?: unknown }).requestId;
    if (typeof requestId === 'string') {
      return requestId;
    }
  }
  return '';
}

export function createBridgeRouter(options: IBridgeRouterOptions): IBridgeRouter {
  const now = options.now ?? Date.now;
  const inFlight = new Map<string, IInFlightCall>();
  const internalUlid = createUlidGenerator({ now });

  const writeAudit = (entry: IPermissionAuditEntry): void => {
    try {
      options.audit?.emit(entry);
    } catch (error) {
      options.onDiagnostic?.(error);
    }
  };

  const fail = (requestId: string, error: unknown): IBridgeResponse =>
    encodeBridgeResponse({
      requestId,
      ok: false,
      error: normalizeError(error).toPlain(),
    });

  const abortCalls = (predicate: (call: IInFlightCall) => boolean): void => {
    for (const call of inFlight.values()) {
      if (predicate(call)) {
        call.callContext.cancel(createBridgeError(BRIDGE_ERROR_CODES.cancelled));
      }
    }
  };

  const router: IBridgeRouter = {
    async handleRequest(raw: unknown, source: ISessionSource): Promise<IBridgeResponse> {
      let request: IBridgeRequest;
      try {
        request = decodeBridgeRequest(raw);
      } catch (error) {
        return fail(extractRequestId(raw), error);
      }
      const requestId = request.requestId;

      const session = options.sessions.resolve(source);
      if (session === undefined) {
        return fail(requestId, createBridgeError(BRIDGE_ERROR_CODES.sessionUnknown));
      }
      const registration = options.registry.getRegistered(request.capabilityId);
      if (registration === undefined || registration.state !== 'active') {
        return fail(requestId, createBridgeError(BRIDGE_ERROR_CODES.capabilityNotFound));
      }

      const targets: readonly IPermissionTargetRule[] = registration.targets;
      const evaluationInput: IPermissionEvaluationInput = {
        capabilityId: request.capabilityId,
        requiredPermissions: registration.capability.permissions,
        targetRules: targets,
        input: request.input,
        scope: {
          sessionId: session.sessionId,
          pluginId: session.pluginId,
          scopeVersion: session.permissionVersion,
          grants: grantsFromSnapshot(session),
        },
        session,
      };
      const evaluation = evaluatePermissions(evaluationInput, options.permissionEnvironment);
      if (options.audit !== undefined) {
        const audit = options.audit;
        writeAudit(
          toAuditRecord(evaluationInput, evaluation, {
            id: audit.nextEntryId?.() ?? internalUlid.next(),
            timestamp: new Date(now()).toISOString(),
            traceId: request.traceId ?? audit.newTraceId(),
            requestId,
            pluginVersion: audit.resolvePluginVersion(session),
          })
        );
      }
      if (!evaluation.allowed) {
        return fail(
          requestId,
          evaluation.error ?? createBridgeError(BRIDGE_ERROR_CODES.permissionDenied)
        );
      }

      let envelope: ReturnType<typeof splitEnvelope>;
      try {
        envelope = splitEnvelope(request.input ?? {}, registration.compiledSchema);
      } catch (error) {
        return fail(requestId, error);
      }
      const validation = registration.compiledSchema.validate(envelope.json, {
        bin: new Map(Object.entries(envelope.bin)),
      });
      if (!validation.valid) {
        return fail(
          requestId,
          invalidInputError(request.capabilityId, validation.issues, validation.truncated)
        );
      }

      let ticket: Awaited<ReturnType<ICapabilityGate['acquire']>>;
      try {
        ticket = await options.gate.acquire(request.capabilityId, session.sessionId, registration);
      } catch (error) {
        return fail(requestId, error);
      }

      const currentSession = options.sessions.resolveById(session.sessionId);
      if (currentSession === undefined || currentSession.state !== 'active') {
        options.gate.release(ticket);
        return fail(requestId, createBridgeError(BRIDGE_ERROR_CODES.sessionUnknown));
      }

      const callContext = createCallContext({
        sessionId: session.sessionId,
        callerId: session.pluginId,
        timeoutMs: registration.timeoutMs,
        now,
        requestId,
        ...(request.traceId !== undefined ? { traceId: request.traceId } : {}),
        ...(options.sessions.signalFor(session.sessionId) !== undefined
          ? { sessionSignal: options.sessions.signalFor(session.sessionId) as AbortSignal }
          : {}),
      });
      inFlight.set(requestId, {
        sessionId: session.sessionId,
        capabilityId: request.capabilityId,
        callContext,
      });

      try {
        let input: unknown;
        try {
          input = mergeEnvelope(envelope, registration.compiledSchema);
        } catch (error) {
          return fail(requestId, error);
        }
        const result = await raceWithAbort(
          options.invoker.execute(registration, input, callContext.capabilityContext),
          callContext.capabilityContext.signal
        );
        return encodeBridgeResponse({ requestId, ok: true, result });
      } catch (error) {
        if (callContext.capabilityContext.signal.aborted) {
          return fail(requestId, abortReason(callContext.capabilityContext.signal));
        }
        return fail(
          requestId,
          normalizeError(
            error,
            options.onDiagnostic !== undefined ? { onDiagnostic: options.onDiagnostic } : {}
          )
        );
      } finally {
        inFlight.delete(requestId);
        callContext.dispose();
        options.gate.release(ticket);
      }
    },

    cancelCapability(capabilityId: string): void {
      options.gate.cancelCapability(capabilityId);
      abortCalls((call) => call.capabilityId === capabilityId);
    },

    cancelSession(sessionId: string): void {
      options.gate.cancelSession(sessionId);
      abortCalls((call) => call.sessionId === sessionId);
    },

    dispose(): void {
      for (const call of inFlight.values()) {
        call.callContext.cancel(createBridgeError(BRIDGE_ERROR_CODES.cancelled));
      }
      inFlight.clear();
    },

    get inFlightCount(): number {
      return inFlight.size;
    },
  };

  return router;
}
