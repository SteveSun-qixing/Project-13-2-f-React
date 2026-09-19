/**
 * 命令运行时的平台访问端口解析。
 *
 * 默认端口是渲染进程的 `window.chips`（preload 经 `contextBridge` 注入，形状见
 * 《01-Bridge-API规范》§2.1~2.3）；`@chips/ui` 不依赖 `@chips/bridge` / `@chips/sdk`，
 * 只按结构使用其 `request` 与 `subscribe`。端口按需解析（调用时不缓存），
 * 不可用时由运行时以简体中文错误拒绝并记录诊断。
 */

import type { ICommandBridgePort, ICommandSubscription } from './contract';

/** 结构守卫：`window.chips` 至少具备 `request` 与 `subscribe`。 */
function isBridgePort(value: unknown): value is ICommandBridgePort {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { request?: unknown; subscribe?: unknown };
  return typeof candidate.request === 'function' && typeof candidate.subscribe === 'function';
}

/**
 * 解析当前渲染进程的平台 Bridge 端口。
 *
 * @returns 端口；`window.chips` 不可用时返回 `null`
 */
export function resolveCommandBridgePort(): ICommandBridgePort | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  const candidate = (globalThis as { chips?: unknown }).chips;
  if (!isBridgePort(candidate)) {
    return null;
  }
  return {
    request: <TOutput>(capabilityId: string, input?: unknown): Promise<TOutput> =>
      candidate.request<TOutput>(capabilityId, input),
    subscribe: (eventId: string, handler: (payload: unknown) => void): ICommandSubscription =>
      candidate.subscribe(eventId, handler),
  };
}
