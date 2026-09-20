/**
 * 事件订阅与资源句柄控制（02-Bridge三层设计 §7.4、09-事件系统设计 §下行、06-资源协议规范 §5.3）。
 *
 * 权威：`02-Bridge三层设计` §7（事件控制与订阅计数）、`09-事件系统设计` §下行（按窗口订阅投递）。
 *
 * @remarks
 * - 订阅以「会话 + 事件 ID」为单位计数，会话关闭时整批回收；投递按窗口聚合。
 * - 资源句柄以「会话 + URI」为单位持有，会话关闭或窗口关闭时释放；本模块只维护持有关系，
 *   字节读取经 `IResourceBackend`（作用域判定由后端承担）。
 */

import type { IWireResourceMetadata } from '../../protocol/wire.js';

/** 事件订阅记录。 */
interface IEventSubscription {
  readonly eventId: string;
  count: number;
}

/** 事件订阅中心。 */
export interface IEventSubscriptionCenter {
  /** 订阅；返回该会话该事件的当前计数。 */
  subscribe(sessionId: string, eventId: string): number;
  /** 退订；计数归零时移除，返回剩余计数。 */
  unsubscribe(sessionId: string, eventId: string): number;
  /** 某会话某事件是否已订阅。 */
  isSubscribed(sessionId: string, eventId: string): boolean;
  /** 已订阅该事件的全部窗口（去重）。 */
  windowsFor(eventId: string, windowOf: (sessionId: string) => number | undefined): number[];
  /** 会话关闭：回收其全部订阅，返回受影响的事件 ID 集合。 */
  releaseSession(sessionId: string): readonly string[];
  /** 当前订阅总数（会话 × 事件）。 */
  readonly size: number;
}

/** 创建事件订阅中心。 */
export function createEventSubscriptionCenter(): IEventSubscriptionCenter {
  const bySession = new Map<string, Map<string, IEventSubscription>>();

  const sessionMap = (sessionId: string): Map<string, IEventSubscription> | undefined => bySession.get(sessionId);

  return {
    subscribe(sessionId: string, eventId: string): number {
      let map = sessionMap(sessionId);
      if (map === undefined) {
        map = new Map();
        bySession.set(sessionId, map);
      }
      const record = map.get(eventId);
      if (record === undefined) {
        map.set(eventId, { eventId, count: 1 });
        return 1;
      }
      record.count += 1;
      return record.count;
    },
    unsubscribe(sessionId: string, eventId: string): number {
      const map = sessionMap(sessionId);
      if (map === undefined) {
        return 0;
      }
      const record = map.get(eventId);
      if (record === undefined) {
        return 0;
      }
      record.count -= 1;
      if (record.count <= 0) {
        map.delete(eventId);
      }
      if (map.size === 0) {
        bySession.delete(sessionId);
      }
      return record.count > 0 ? record.count : 0;
    },
    isSubscribed(sessionId: string, eventId: string): boolean {
      return sessionMap(sessionId)?.has(eventId) ?? false;
    },
    windowsFor(eventId: string, windowOf: (sessionId: string) => number | undefined): number[] {
      const windows = new Set<number>();
      for (const [sessionId, map] of bySession) {
        if (map.has(eventId)) {
          const windowId = windowOf(sessionId);
          if (windowId !== undefined) {
            windows.add(windowId);
          }
        }
      }
      return [...windows];
    },
    releaseSession(sessionId: string): readonly string[] {
      const map = sessionMap(sessionId);
      if (map === undefined) {
        return [];
      }
      const events = [...map.keys()];
      bySession.delete(sessionId);
      return events;
    },
    get size(): number {
      let total = 0;
      for (const map of bySession.values()) {
        total += map.size;
      }
      return total;
    },
  };
}

/** 资源句柄持有中心。 */
export interface IResourceHandleCenter {
  /** 打开或复用句柄。 */
  acquire(sessionId: string, uri: string, metadata: IWireResourceMetadata): void;
  /** 释放句柄；不存在返回 `false`。 */
  release(sessionId: string, uri: string): boolean;
  /** 某会话某 URI 是否持有句柄。 */
  holds(sessionId: string, uri: string): boolean;
  /** 会话关闭：释放其全部句柄。 */
  releaseSession(sessionId: string): void;
  /** 当前句柄总数。 */
  readonly size: number;
}

/** 创建资源句柄持有中心。 */
export function createResourceHandleCenter(): IResourceHandleCenter {
  const bySession = new Map<string, Set<string>>();
  let total = 0;

  return {
    acquire(sessionId: string, uri: string, _metadata: IWireResourceMetadata): void {
      let set = bySession.get(sessionId);
      if (set === undefined) {
        set = new Set();
        bySession.set(sessionId, set);
      }
      if (!set.has(uri)) {
        set.add(uri);
        total += 1;
      }
    },
    release(sessionId: string, uri: string): boolean {
      const set = bySession.get(sessionId);
      if (set === undefined || !set.has(uri)) {
        return false;
      }
      set.delete(uri);
      total -= 1;
      if (set.size === 0) {
        bySession.delete(sessionId);
      }
      return true;
    },
    holds(sessionId: string, uri: string): boolean {
      return bySession.get(sessionId)?.has(uri) ?? false;
    },
    releaseSession(sessionId: string): void {
      const set = bySession.get(sessionId);
      if (set === undefined) {
        return;
      }
      total -= set.size;
      bySession.delete(sessionId);
    },
    get size(): number {
      return total;
    },
  };
}
