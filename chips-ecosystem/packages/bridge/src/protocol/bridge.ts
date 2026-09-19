/**
 * Bridge 对外唯一形状（02-Bridge三层设计 §3.1、01-Bridge-API规范 §2）。
 *
 * 形状冻结：`IChipsBridge` 仅有 `request` / `subscribe` / `resource` 三个方法，不含 `context()`；
 * 方法面新增/删除必须走 RFC 与评审，实现不得私自扩展。
 */

import type { IResourceHandle } from './resource.js';

/** JSON Schema 值（Draft 2020-12 平台子集；允许关键字见 04-能力契约规范 §5）。 */
export type JSONSchema = Readonly<Record<string, unknown>>;

/** 可退订句柄；`dispose()` 必须幂等。 */
export interface ISubscription {
  dispose(): void;
}

export interface IChipsBridge {
  /**
   * 唯一能力调用入口。
   *
   * @param capabilityId 能力 ID（`<domain>:<action>[:<target>]`）。
   * @param input 能力输入；先经会话、注册表、权限、Schema 校验。
   * @returns 能力输出；失败以 `ChipsError` reject。
   */
  request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput>;

  /**
   * 订阅标准事件；同一 `(eventId, handler)` 多次订阅各自独立。
   *
   * 订阅校验失败（未登记、不满足可见性）时该订阅不建立；回执失败记录审计，订阅不重试。
   */
  subscribe(eventId: string, handler: (payload: unknown) => void): ISubscription;

  /**
   * 同步创建 `chips-resource://` 懒打开代理句柄；预检失败立即抛出 `ChipsError`。
   */
  resource(uri: string): IResourceHandle;
}
