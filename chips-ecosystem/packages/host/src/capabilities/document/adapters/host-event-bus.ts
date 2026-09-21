/**
 * `IDocumentEventsPort` 的宿主事件总线生产适配器（金链路刀4 · 组合根装载段）。
 *
 * 权威：`11-文档服务设计` §7.3（事件发布职责：事件是通知不是状态，发布失败不回滚已完成的
 * 写入、只落宿主诊断日志）、`05-事件契约规范` §4.2（文档事件 payload 口径）与
 * `09-事件系统设计`（下行投递按会话订阅计数）。
 *
 * @remarks
 * - 总线载体：`runtime/host-runtime.ts` 组合根运行时的 `emitEvent` 出口
 *   （`IHostPluginLoaderDeps.emitEvent`）——即宿主侧事件总线的正式下行面（`plugin:*`
 *   生命周期事件走同一出口，经 `event:<eventId>` 通道按订阅投递到渲染进程）；
 *   信封构造与订阅计数在运行时内完成，本适配器只如实转发 `(eventId, payload)` 二元组。
 * - 绑定时序：组合根在构造 `pluginLoaderFactory` 时绑定总线（工厂于
 *   `createHostRuntime` 构造期同步执行，先于 `start` 注册、先于任何能力调用可达），
 *   不存在「能力已注册而总线未绑定」的调用窗口；未绑定期限内发布以在册码
 *   `BRIDGE_INTERNAL` 诚实拒绝（服务侧按 §7.3 落诊断、不改变已完成的调用结果），
 *   不静默丢弃、不伪造成功。
 * - payload 字段口径由服务侧按 `05-事件契约规范` §4.2 组装（`descriptors.ts` 头注：
 *   不走 `ctx.emit` 按会话投递通道，避免同一事件双路发布）；本适配器不加工 payload。
 */

import { BRIDGE_ERROR_CODES, createBridgeError } from '@chips/bridge';

import type { IDocumentEventsPort } from '../ports.js';

/** 宿主事件总线发布出口（与 `IHostPluginLoaderDeps.emitEvent` 同形状）。 */
export type HostEventBusPublisher = (eventId: string, payload: unknown) => void;

/** 事件总线适配器句柄：端口本体 + 组合根绑定入口。 */
export interface IDocumentHostEventBusPort {
  /** 交予 `createDocumentService` 的事件发布端口。 */
  readonly port: IDocumentEventsPort;
  /** 绑定宿主事件总线出口（组合根在 `pluginLoaderFactory` 构造时调用；重复调用以最新出口为准）。 */
  bind(publisher: HostEventBusPublisher): void;
  /** 总线是否已绑定（组合根诊断面）。 */
  readonly bound: boolean;
}

/**
 * 构造宿主事件总线的文档事件端口适配器。
 *
 * @returns 端口与绑定句柄（组合根持有；端口随服务构造注入，绑定发生在运行时装配期）。
 */
export function createDocumentHostEventBusPort(): IDocumentHostEventBusPort {
  let publisher: HostEventBusPublisher | null = null;
  return {
    get bound(): boolean {
      return publisher !== null;
    },
    bind(next: HostEventBusPublisher): void {
      publisher = next;
    },
    port: {
      publish(eventId: string, payload: Readonly<Record<string, unknown>>): Promise<void> {
        if (publisher === null) {
          return Promise.reject(
            createBridgeError(BRIDGE_ERROR_CODES.internal, {
              message: '宿主事件总线未绑定，文档事件发布被诚实拒绝',
              details: { eventId },
            }),
          );
        }
        try {
          publisher(eventId, payload);
        } catch (error: unknown) {
          // 非 Error 抛出归一为 Error 后以 rejection 交付（端口异步失败语义，与
          // `document-fake-ports` 替身口径一致），不吞异常、不改写已完成的调用结果。
          return Promise.reject(error instanceof Error ? error : new Error(String(error)));
        }
        return Promise.resolve();
      },
    },
  };
}
