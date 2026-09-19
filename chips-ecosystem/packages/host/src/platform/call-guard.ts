import type { PortCallContext } from './contracts/index.js';
import { PAL_ERROR_CODES, PalPortError } from './errors.js';

/**
 * 端口调用上下文守卫。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §4.2 规则 2（所有可能阻塞的端口方法接收
 * `{ signal, deadline }` 并响应取消与截止）。
 */

/**
 * 在端口操作开始前校验调用上下文。
 *
 * @param call 调用上下文。
 * @throws {PalPortError} `signal` 已触发时抛 `BRIDGE_CANCELLED`；`deadline` 已过时抛 `BRIDGE_TIMEOUT`。
 */
export function assertCallActive(call: PortCallContext | undefined): void {
  if (call?.signal?.aborted === true) {
    throw new PalPortError(PAL_ERROR_CODES.BRIDGE_CANCELLED);
  }
  if (call?.deadline !== undefined && Date.now() >= call.deadline) {
    throw new PalPortError(PAL_ERROR_CODES.BRIDGE_TIMEOUT);
  }
}

/**
 * 绑定取消信号到控制器，并在信号触发时中止控制器。
 *
 * @param call 调用上下文。
 * @param controller 目标 AbortController。
 * @returns 解绑函数；调用方在操作完成后释放监听。
 */
export function bindCallSignal(call: PortCallContext | undefined, controller: AbortController): () => void {
  const signal = call?.signal;
  if (signal === undefined) {
    return () => undefined;
  }
  if (signal.aborted) {
    controller.abort();
    return () => undefined;
  }
  const onAbort = (): void => controller.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
}

/**
 * 把截止时间转为定时器；到点触发回调。
 *
 * @param call 调用上下文。
 * @param onExpired 到点回调。
 * @returns 清理函数。
 */
export function scheduleCallDeadline(call: PortCallContext | undefined, onExpired: () => void): () => void {
  if (call?.deadline === undefined) {
    return () => undefined;
  }
  const remaining = call.deadline - Date.now();
  if (remaining <= 0) {
    onExpired();
    return () => undefined;
  }
  const timer = setTimeout(onExpired, remaining);
  timer.unref?.();
  return () => clearTimeout(timer);
}

/**
 * 让一个不可取消的底层 Promise 响应调用上下文的取消与截止。
 *
 * @param operation 底层操作。
 * @param call 调用上下文。
 * @param onAbort 取消/超时时执行的清理（如中止网络请求、销毁窗口）。
 * @returns 操作结果。
 * @throws {PalPortError} `BRIDGE_CANCELLED`（取消）或 `BRIDGE_TIMEOUT`（截止）。
 */
export async function withCallContext<T>(
  operation: Promise<T>,
  call: PortCallContext | undefined,
  onAbort?: () => void,
): Promise<T> {
  assertCallActive(call);
  if (call?.signal === undefined && call?.deadline === undefined) {
    return operation;
  }

  const signal = call.signal;
  let clearDeadline: () => void = () => undefined;
  let rejectAbort: ((error: PalPortError) => void) | undefined;
  let settled = false;

  function onSignalAbort(): void {
    abort(PAL_ERROR_CODES.BRIDGE_CANCELLED);
  }

  const cleanup = (): void => {
    signal?.removeEventListener('abort', onSignalAbort);
    clearDeadline();
  };

  const abort = (code: typeof PAL_ERROR_CODES.BRIDGE_CANCELLED | typeof PAL_ERROR_CODES.BRIDGE_TIMEOUT): void => {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    onAbort?.();
    rejectAbort?.(new PalPortError(code));
  };

  // abortPromise 仅以 PalPortError（Error 子类）拒绝；operation 的失败原因经 Promise.race
  // 原样透传，本函数不再以 unknown 调用 reject，既满足 prefer-promise-reject-errors 也不篡改上游拒绝值。
  const abortPromise = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
    if (signal?.aborted === true) {
      abort(PAL_ERROR_CODES.BRIDGE_CANCELLED);
      return;
    }
    signal?.addEventListener('abort', onSignalAbort, { once: true });
    clearDeadline = scheduleCallDeadline(call, () => abort(PAL_ERROR_CODES.BRIDGE_TIMEOUT));
  });

  try {
    return await Promise.race([operation, abortPromise]);
  } finally {
    settled = true;
    cleanup();
  }
}
