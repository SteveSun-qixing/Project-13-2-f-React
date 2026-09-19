/**
 * preload 测试用传输替身（仅测试代码）。
 */

import type { IPreloadTransport } from '../../src/preload/transport.js';

/** 传输替身；可注入响应与下行事件。 */
export class FakeTransport implements IPreloadTransport {
  readonly invocations: Array<{ channel: string; payload: unknown }> = [];
  readonly listeners = new Map<string, Set<(payload: unknown) => void>>();
  /** 响应工厂；返回值或 Promise 均可，`invoke` 统一包装为 Promise。 */
  responder: (channel: string, payload: unknown) => unknown = (channel) => {
    throw new Error(`未配置响应：${channel}`);
  };

  invoke(channel: string, payload: unknown): Promise<unknown> {
    this.invocations.push({ channel, payload });
    try {
      return Promise.resolve(this.responder(channel, payload));
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  on(channel: string, listener: (payload: unknown) => void): void {
    let set = this.listeners.get(channel);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(channel, set);
    }
    set.add(listener);
  }

  off(channel: string, listener: (payload: unknown) => void): void {
    this.listeners.get(channel)?.delete(listener);
  }

  /** 下行一条消息。 */
  emit(channel: string, payload: unknown): void {
    for (const listener of [...(this.listeners.get(channel) ?? [])]) {
      listener(payload);
    }
  }

  /** 某通道当前监听数量。 */
  listenerCount(channel: string): number {
    return this.listeners.get(channel)?.size ?? 0;
  }
}
