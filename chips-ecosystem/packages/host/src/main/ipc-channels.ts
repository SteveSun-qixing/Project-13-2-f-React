/**
 * 主进程 IPC 通道注册。
 *
 * 权威：`02-Bridge三层设计` §2.1（主进程适配层职责：通道注册、会话注册表、IPC 编解码、
 * 不承载授权逻辑）、§7.1（通道总表）、§7.2（消息格式）。
 */

import {
  BRIDGE_REQUEST_CHANNEL,
  BRIDGE_RESOURCE_CHANNEL,
  EVENT_CONTROL_CHANNEL,
  RENDERER_TO_MAIN_CHANNELS,
} from '../protocol/channels.js';
import {
  isBridgeRequest,
  isEventControlRequest,
  isResourceControlRequest,
  toWireError,
  type IBridgeRequest,
  type IBridgeResponse,
  type IEventControlResponse,
  type IResourceControlResponse,
  type IWireChipsError,
} from '../protocol/wire.js';
import type { IPlatformRuntime, ISessionSource } from '../runtime/contracts.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import { getHostTrace, type IHostTrace } from '../shared/host-trace.js';
import type { ShellIpcInvokeEvent, ShellIpcMain } from './shell-api.js';
import { BRIDGE_SESSION_UNKNOWN_ERROR, resolveIpcSession } from './session-resolver.js';

/**
 * 落一条 `bridge` 类别执行记录（《调试指南》§5.2 在册字段：`requestId` / `channel` /
 * `direction` / `capabilityId` / `phase` / `outcome` / `errorCode` / `retryable` /
 * `durationMs`＝收到请求到返回结果的耗时；§2.3 公共字段 `traceId` 取自请求帧横切键，
 * 工单046 段一链路贯通后以 `InvocationContext` 同源值落行，帧上缺位时按 §2.5
 * 操作边界就地生成兜底）。`sessionId` 在本层未解析（会话身份归 Bridge 核心段解析），
 * 按 §2.3「适用时」口径缺位。
 */
function recordBridgeRequestTrace(
  trace: IHostTrace,
  request: IBridgeRequest,
  session: ISessionSource,
  startedAtMs: number,
  response: IBridgeResponse,
): void {
  const traceId = request.traceId ?? trace.newTraceId();
  if (response.ok) {
    trace.record({
      category: 'bridge',
      phase: 'execute',
      traceId,
      windowId: session.windowId,
      requestId: request.requestId,
      channel: BRIDGE_REQUEST_CHANNEL,
      direction: 'in',
      capabilityId: request.capabilityId,
      outcome: 'ok',
      durationMs: Math.max(0, performance.now() - startedAtMs),
    });
    return;
  }
  trace.record({
    category: 'bridge',
    phase: 'execute',
    traceId,
    windowId: session.windowId,
    requestId: request.requestId,
    channel: BRIDGE_REQUEST_CHANNEL,
    direction: 'in',
    capabilityId: request.capabilityId,
    outcome: 'error',
    errorCode: response.error.code,
    ...(response.error.retryable === undefined ? {} : { retryable: response.error.retryable }),
    durationMs: Math.max(0, performance.now() - startedAtMs),
  });
}

/** 通道注册依赖。 */
export interface IpcChannelDeps {
  /** `ipcMain` 切片。 */
  readonly ipcMain: ShellIpcMain;
  /** 平台运行时（IPC 端点）。 */
  readonly runtime: IPlatformRuntime;
  /** 窗口存活判定。 */
  readonly isWindowAlive: (windowId: number) => boolean;
  /** 诊断口。 */
  readonly diagnostics: DiagnosticsSink;
}

/** 固定错误：载荷格式非法。 */
const MALFORMED_REQUEST_ERROR: IWireChipsError = {
  code: 'BRIDGE_INTERNAL',
  message: '调用请求格式非法',
  retryable: false,
};

/** 读取请求负载中的关联键（`requestId` / `controlId`）；仅用于错误回执关联，不作身份判定。 */
function readCorrelationId(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as { requestId?: unknown; controlId?: unknown };
    if (typeof record.requestId === 'string' && record.requestId.length > 0) {
      return record.requestId;
    }
    if (typeof record.controlId === 'string' && record.controlId.length > 0) {
      return record.controlId;
    }
  }
  return '';
}

/**
 * 注册三个渲染 → 主通道。
 *
 * @param deps 依赖。
 * @returns 注销函数（幂等）。
 */
export function registerIpcChannels(deps: IpcChannelDeps): () => void {
  const { ipcMain, runtime, isWindowAlive, diagnostics } = deps;
  let disposed = false;

  const resolveSession = (event: ShellIpcInvokeEvent): ISessionSource | null => resolveIpcSession(event, isWindowAlive);

  ipcMain.handle(BRIDGE_REQUEST_CHANNEL, async (event, ...args): Promise<IBridgeResponse> => {
    const payload = args[0];
    if (!isBridgeRequest(payload)) {
      diagnostics.warn('ipc', '丢弃非法能力调用请求');
      return { requestId: readCorrelationId(payload), ok: false, error: MALFORMED_REQUEST_ERROR };
    }
    const request: IBridgeRequest = payload;
    const session = resolveSession(event);
    if (session === null) {
      return { requestId: request.requestId, ok: false, error: BRIDGE_SESSION_UNKNOWN_ERROR };
    }
    // Bridge 调用追踪（《调试指南》§5.1/§5.2：主进程适配层为在册追踪位置；
    // `durationMs` = Bridge 收到请求到返回结果的耗时，即本包裹段）。
    const trace = getHostTrace();
    const traceEnabled = trace.enabled('bridge');
    const startedAtMs = performance.now();
    try {
      const response = await runtime.ipc.handleRequest(session, request);
      if (traceEnabled) {
        recordBridgeRequestTrace(trace, request, session, startedAtMs, response);
      }
      return response;
    } catch (error) {
      diagnostics.error('ipc', '能力调用处理异常', { windowId: session.windowId });
      const response: IBridgeResponse = {
        requestId: request.requestId,
        ok: false,
        error: toWireError(error),
      };
      if (traceEnabled) {
        recordBridgeRequestTrace(trace, request, session, startedAtMs, response);
      }
      return response;
    }
  });

  ipcMain.handle(BRIDGE_RESOURCE_CHANNEL, async (event, ...args): Promise<IResourceControlResponse> => {
    const payload = args[0];
    if (!isResourceControlRequest(payload)) {
      diagnostics.warn('ipc', '丢弃非法资源控制请求');
      return { requestId: readCorrelationId(payload), ok: false, error: MALFORMED_REQUEST_ERROR };
    }
    const request = payload;
    const session = resolveSession(event);
    if (session === null) {
      return { requestId: request.requestId, ok: false, error: BRIDGE_SESSION_UNKNOWN_ERROR };
    }
    try {
      return await runtime.ipc.handleResourceControl(session, request);
    } catch (error) {
      diagnostics.error('ipc', '资源控制处理异常', { windowId: session.windowId });
      return { requestId: request.requestId, ok: false, error: toWireError(error) };
    }
  });

  ipcMain.handle(EVENT_CONTROL_CHANNEL, async (event, ...args): Promise<IEventControlResponse> => {
    const payload = args[0];
    if (!isEventControlRequest(payload)) {
      diagnostics.warn('ipc', '丢弃非法事件控制请求');
      return { controlId: readCorrelationId(payload), ok: false, error: MALFORMED_REQUEST_ERROR };
    }
    const request = payload;
    const session = resolveSession(event);
    if (session === null) {
      return { controlId: request.controlId, ok: false, error: BRIDGE_SESSION_UNKNOWN_ERROR };
    }
    try {
      return await runtime.ipc.handleEventControl(session, request);
    } catch (error) {
      diagnostics.error('ipc', '事件控制处理异常', { windowId: session.windowId });
      return { controlId: request.controlId, ok: false, error: toWireError(error) };
    }
  });

  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    for (const channel of RENDERER_TO_MAIN_CHANNELS) {
      ipcMain.removeHandler(channel);
    }
  };
}
