/**
 * 调用上下文组装（02-Bridge三层设计 §3.2、§8.1、§8.2）。
 *
 * - `deadline` 为发起时刻加注册项 `timeoutMs`；
 * - `signal` 链接会话销毁、超时、能力注销与 Bridge 关闭四种取消来源；
 * - `ctx.signal` / `ctx.deadline` 如实传给 Host 实现，Bridge 按 `requestId` 丢弃迟到结果。
 */

import { BRIDGE_ERROR_CODES, createBridgeError } from '../protocol/errors.js';
import type { ChipsError } from '../protocol/errors.js';
import type { ICapabilityContext } from '../protocol/capability.js';

export interface ICallContextOptions {
  readonly sessionId: string;
  readonly callerId: string;
  readonly timeoutMs: number;
  /** 会话取消信号（会话销毁时触发）。 */
  readonly sessionSignal?: AbortSignal;
  /** 当前时间（Unix 毫秒）。 */
  readonly now: () => number;
  /** 横切链路追踪 ID（工单046 段一，`bridge:request` 透传）。 */
  readonly traceId?: string;
  /** 本次调用请求关联键（透传）。 */
  readonly requestId?: string;
}

export interface ICallContext {
  readonly capabilityContext: ICapabilityContext;
  /** 主动取消（能力注销、Bridge 关闭）；幂等。 */
  cancel(error?: ChipsError): void;
  /** 触发超时取消（幂等）。 */
  timeout(): void;
  /** 清理监听与定时器（无论成败都必须调用）。 */
  dispose(): void;
  readonly timedOut: boolean;
}

export function createCallContext(options: ICallContextOptions): ICallContext {
  const controller = new AbortController();
  const deadline = options.now() + options.timeoutMs;
  let timedOut = false;

  const timeoutError = createBridgeError(BRIDGE_ERROR_CODES.timeout, { retryable: true });
  const sessionAbortListener = (): void => {
    controller.abort(
      options.sessionSignal?.reason ?? createBridgeError(BRIDGE_ERROR_CODES.cancelled)
    );
  };

  if (options.sessionSignal !== undefined) {
    if (options.sessionSignal.aborted) {
      sessionAbortListener();
    } else {
      options.sessionSignal.addEventListener('abort', sessionAbortListener, { once: true });
    }
  }

  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    timedOut = true;
    controller.abort(timeoutError);
  }, options.timeoutMs);

  return {
    capabilityContext: {
      signal: controller.signal,
      deadline,
      sessionId: options.sessionId,
      callerId: options.callerId,
      ...(options.traceId !== undefined ? { traceId: options.traceId } : {}),
      ...(options.requestId !== undefined ? { requestId: options.requestId } : {}),
    },
    cancel(error: ChipsError = createBridgeError(BRIDGE_ERROR_CODES.cancelled)): void {
      if (!controller.signal.aborted) {
        controller.abort(error);
      }
    },
    timeout(): void {
      if (!controller.signal.aborted) {
        timedOut = true;
        controller.abort(timeoutError);
      }
    },
    dispose(): void {
      clearTimeout(timer);
      if (options.sessionSignal !== undefined) {
        options.sessionSignal.removeEventListener('abort', sessionAbortListener);
      }
    },
    get timedOut(): boolean {
      return timedOut;
    },
  };
}
