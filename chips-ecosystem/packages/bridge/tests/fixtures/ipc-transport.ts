/**
 * 测试夹具：内存版 `IIpcTransport`（不进入覆盖率统计，仅供单测与集成测试使用）。
 */

import type { IIpcTransport } from '../../src/client/transport.js';

export interface IFakeInvocation {
  channel: string;
  payload: unknown;
}

export interface IFakeTransport {
  readonly transport: IIpcTransport;
  readonly invocations: IFakeInvocation[];
  /** 注册通道响应器；未注册的通道调用将 reject。 */
  onInvoke(channel: string, responder: (payload: unknown) => unknown | Promise<unknown>): void;
  /** 模拟主进程下行推送。 */
  emit(channel: string, payload: unknown): void;
  listenerCount(channel: string): number;
  channels(): string[];
}

export function createFakeTransport(): IFakeTransport {
  const invocations: IFakeInvocation[] = [];
  const responders = new Map<string, (payload: unknown) => unknown | Promise<unknown>>();
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  const transport: IIpcTransport = {
    async invoke(channel: string, payload: unknown): Promise<unknown> {
      invocations.push({ channel, payload });
      const responder = responders.get(channel);
      if (responder === undefined) {
        throw new Error(`测试传输未注册通道响应器：${channel}`);
      }
      return responder(payload);
    },
    on(channel: string, listener: (payload: unknown) => void): () => void {
      const set = listeners.get(channel) ?? new Set<(payload: unknown) => void>();
      set.add(listener);
      listeners.set(channel, set);
      let disposed = false;
      return () => {
        if (disposed) {
          return;
        }
        disposed = true;
        set.delete(listener);
        if (set.size === 0) {
          listeners.delete(channel);
        }
      };
    },
  };

  return {
    transport,
    invocations,
    onInvoke(channel, responder) {
      responders.set(channel, responder);
    },
    emit(channel, payload) {
      const set = listeners.get(channel);
      if (set === undefined) {
        return;
      }
      for (const listener of [...set]) {
        listener(payload);
      }
    },
    listenerCount(channel) {
      return listeners.get(channel)?.size ?? 0;
    },
    channels() {
      return [...listeners.keys()];
    },
  };
}

/** 等待一个宏任务与全部微任务落定（用于订阅回执等异步过程）。 */
export async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
