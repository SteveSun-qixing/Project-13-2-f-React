/**
 * preload contextBridge 错误面·跨桥错误唯一归一点（工单038 修复）。
 *
 * 权威：`01-Bridge-API规范` §2.5（「跨上下文（IPC、contextBridge、跨包边界）传回的恒为普通对象，
 * 唯一权威判定是结构守卫 `isChipsError`」「跨边界传输前一律经实例方法 `toPlain()` 归一为普通对象」）、
 * 《RFC-ChipsError统一裁定》§4.2 条 3（跨 Realm 判定双轨口径，`instanceof` 禁用于跨界判定）与
 * §4.3（`toPlain()` 为跨 IPC / contextBridge 的唯一传输形态：`code`/`message`/`retryable` 恒输出，
 * `details` 仅在有值时输出）。
 *
 * @remarks
 * - 缺陷机理（工单038，Electron 40 `shell/renderer/api/electron_api_context_bridge.cc` 源码级坐实）：
 *   `Error` 族实例（含 `ChipsError` 自定义子类）作为 Promise 拒绝值跨 contextBridge 时命中
 *   `IsNativeError()` 分支，被替换为目标世界里按消息重建的匿名 `Error`——`code` / `retryable` /
 *   `details` 与原型全部丢失（跨 context 读取 `message` 失败时消息一并清空，渲染侧实测收到
 *   `Error('')`）。纯数据对象走代理臂（`CreateProxyForAPI`），自有可枚举属性完整保真送达。
 * - 因此 `window.chips` 挂载面上**任何**失败臂的异常必须先经本模块归一为 `toPlain()` 同构的
 *   纯数据错误对象再跨界；渲染侧以 `isChipsError` 结构守卫判定、`ChipsError.fromPlain` 还原
 *   （还原点唯一入口），按 `code` 分支为契约承诺。
 * - 冻结面红线：本模块只做错误归一，不增删 `request` / `subscribe` / `resource` 键集，不新增
 *   `contextBridge` 暴露面，不向任何错误对象挂 `ipcRenderer` / `invoke` 等原生通道引用。
 * - 同步抛出臂（`resource` 预检）在真实 Electron 桥上的原生行为是「仅透 `message` 重建 Error」
 *   （`ProxyFunctionCallback` 异常臂），contextBridge 机制不承载自定义字段；本模块仍按同一
 *   口径归一抛出值，使纯数据错误在单元测试与序列化边界模拟中字段完整，并保证消息与主进程侧
 *   同源非空。渲染侧对同步臂的判定同样走 `isChipsError`（结构守卫对缺失字段容忍）。
 */

import { normalizeError } from '@chips/bridge';
import type { IChipsError } from '@chips/bridge';

import type { IPreloadBridge } from './bridge.js';
import type { IResourceHandle, ResourceState } from './resource-handle.js';
import type { ISubscription } from './subscriptions.js';

/** contextBridge 错误面形状：与 `ChipsError.toPlain()` 输出同构（《RFC-ChipsError统一裁定》§4.3 唯一传输形态）。 */
export type IBridgeSurfaceError = IChipsError;

/**
 * 把任意跨界异常归一为结构化克隆友好的纯数据错误对象。
 *
 * @param error 挂载面捕获到的任意异常（`ChipsError` 实例、`toPlain()` 同构普通对象或未识别值）。
 * @returns `code`/`message`/`retryable` 恒有值、`details` 仅在原异常携带时输出的普通对象。
 */
export function toBridgeSurfaceError(error: unknown): IBridgeSurfaceError {
  return normalizeError(error).toPlain();
}

/** `window.chips` 经 contextBridge 挂载的面（`IPreloadBridge` 去掉平台内部 `dispose` 的冻结三方法投影）。 */
export interface IPreloadContextBridgeSurface {
  /** 能力调用；失败以 {@link IBridgeSurfaceError} 纯数据错误拒绝。 */
  request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput>;
  /** 事件订阅；返回可跨界的退订句柄。 */
  subscribe(eventId: string, handler: (payload: unknown) => void): ISubscription;
  /** 资源句柄；返回逐臂归一错误的可跨界句柄投影。 */
  resource(uri: string): IResourceHandle;
}

/** 异步臂守卫：调用内同步/异步抛出的异常一律经 {@link toBridgeSurfaceError} 归一后拒绝。 */
async function guardAsyncCall<TOutput>(call: () => TOutput | Promise<TOutput>): Promise<TOutput> {
  try {
    return await call();
  } catch (error) {
    // 工单038 定案形态：跨界拒绝值必须是 `toPlain()` 同构纯数据对象（`Error` 实例过桥即被
    // contextBridge 克隆为无字段匿名 Error）；渲染侧以 `isChipsError` 结构守卫判定。
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw toBridgeSurfaceError(error);
  }
}

/** 同步臂守卫：抛出的异常经归一后原臂继续同步抛出（不吞错、不改为异步语义）。 */
function guardSyncCall<TOutput>(call: () => TOutput): TOutput {
  try {
    return call();
  } catch (error) {
    // 同 `guardAsyncCall`：抛出值归一为纯数据错误对象（《01-Bridge-API规范》§2.5 跨界恒普通对象）。
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw toBridgeSurfaceError(error);
  }
}

/** 订阅句柄守卫：`dispose` 行为透传，异常经归一口收敛。 */
function guardSubscription(subscription: ISubscription): ISubscription {
  return {
    dispose(): void {
      guardSyncCall(() => subscription.dispose());
    },
  };
}

/**
 * 资源句柄守卫：逐臂包装桥面句柄，使全部失败路径（异步拒绝与同步抛出）在跨界前完成错误归一。
 *
 * @param handle 桥内构造的真实句柄（预检失败在到达本函数前已抛出，由 `resource` 臂守卫收敛）。
 */
export function guardResourceHandleForContextBridge(handle: IResourceHandle): IResourceHandle {
  return {
    uri: handle.uri,
    get state(): ResourceState {
      return handle.state;
    },
    metadata: () => guardAsyncCall(() => handle.metadata()),
    read: () => guardAsyncCall(() => handle.read()),
    readRange: (offset: number, length: number) => guardAsyncCall(() => handle.readRange(offset, length)),
    stream: () => guardAsyncCall(() => handle.stream()),
    release: () => guardSyncCall(() => handle.release()),
    onInvalidate: (handler) => guardSyncCall(() => guardSubscription(handle.onInvalidate(handler))),
  };
}

/**
 * 创建 `window.chips` 的 contextBridge 挂载面（工单038 修复形态：桥面失败臂统一纯数据错误）。
 *
 * @param bridge 桥内实现的 `IPreloadBridge`（协议语义与预检口径全部保持在 bridge 层）。
 * @returns 键集恰为 `request` / `subscribe` / `resource` 的冻结三方法面；`dispose` 属平台内部，
 *          不进入挂载面（挂载层卸载时直接调用 `bridge` 实例）。
 */
export function createContextBridgeSurface(bridge: IPreloadBridge): IPreloadContextBridgeSurface {
  return {
    request: <TOutput>(capabilityId: string, input?: unknown): Promise<TOutput> =>
      guardAsyncCall(() => bridge.request<TOutput>(capabilityId, input)),
    subscribe: (eventId: string, handler: (payload: unknown) => void): ISubscription =>
      guardSyncCall(() => guardSubscription(bridge.subscribe(eventId, handler))),
    resource: (uri: string): IResourceHandle =>
      guardSyncCall(() => guardResourceHandleForContextBridge(bridge.resource(uri))),
  };
}
