import { describe, expect, it, vi } from 'vitest';

import { createElectronPreloadTransport } from '../src/preload/transport.js';

describe('createElectronPreloadTransport', () => {
  it('形状非法时拒绝初始化', () => {
    expect(() => createElectronPreloadTransport({} as never)).toThrow('preload 传输初始化失败');
    expect(() =>
      createElectronPreloadTransport({ invoke: () => Promise.resolve(), on: () => undefined } as never),
    ).toThrow('preload 传输初始化失败');
  });

  it('invoke 透传通道与负载', async () => {
    const ipcRenderer = {
      invoke: vi.fn().mockResolvedValue({ ok: true }),
      on: vi.fn(),
      removeListener: vi.fn(),
    };
    const transport = createElectronPreloadTransport(ipcRenderer);
    await expect(transport.invoke('bridge:request', { requestId: 'r1' })).resolves.toEqual({ ok: true });
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('bridge:request', { requestId: 'r1' });
  });

  it('on 剥离 IPC 事件参数并把首个负载参数交给监听器', () => {
    const handlers = new Map<string, (...args: readonly unknown[]) => void>();
    const ipcRenderer = {
      invoke: vi.fn(),
      on: vi.fn((channel: string, handler: (...args: readonly unknown[]) => void) => {
        handlers.set(channel, handler);
      }),
      removeListener: vi.fn(),
    };
    const transport = createElectronPreloadTransport(ipcRenderer);
    const listener = vi.fn();
    transport.on('event:window:closed', listener);
    handlers.get('event:window:closed')?.({ senderId: 1 }, { eventId: 'window:closed' });
    expect(listener).toHaveBeenCalledWith({ eventId: 'window:closed' });
  });

  it('off 移除同一监听器且幂等', () => {
    const registered: Array<(...args: readonly unknown[]) => void> = [];
    const removed: Array<(...args: readonly unknown[]) => void> = [];
    const ipcRenderer = {
      invoke: vi.fn(),
      on: vi.fn((_channel: string, handler: (...args: readonly unknown[]) => void) => {
        registered.push(handler);
      }),
      removeListener: vi.fn((_channel: string, handler: (...args: readonly unknown[]) => void) => {
        removed.push(handler);
      }),
    };
    const transport = createElectronPreloadTransport(ipcRenderer);
    const listener = vi.fn();
    transport.on('c', listener);
    transport.off('c', listener);
    transport.off('c', listener);
    expect(removed).toEqual([registered[0]]);
  });
});
