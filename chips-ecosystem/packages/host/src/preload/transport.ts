/**
 * preload 传输抽象。
 *
 * 权威：`02-Bridge三层设计` §2.1（渲染进程 preload 仅做转发）、§7.1（通道总表）。
 *
 * @remarks
 * - 传输只做 `ipcRenderer` 的收发适配；通道白名单、订阅登记与错误还原在 `bridge.ts` 与
 *   `subscriptions.ts`，本模块不解释负载语义。
 * - 测试注入替身即可在纯 Node 环境覆盖 preload 全部逻辑。
 */

/** preload 传输口。 */
export interface IPreloadTransport {
  /** 请求-响应调用。 */
  invoke(channel: string, payload: unknown): Promise<unknown>;
  /** 订阅主进程下行消息。 */
  on(channel: string, listener: (payload: unknown) => void): void;
  /** 注销订阅。 */
  off(channel: string, listener: (payload: unknown) => void): void;
}

/** `ipcRenderer` 结构切片。 */
export interface ElectronIpcRendererLike {
  /** 调用主进程处理器。 */
  invoke(channel: string, ...args: readonly unknown[]): Promise<unknown>;
  /** 监听通道消息；首个参数为 IPC 事件。 */
  on(channel: string, listener: (event: unknown, ...args: readonly unknown[]) => void): void;
  /** 移除监听。 */
  removeListener(channel: string, listener: (...args: readonly unknown[]) => void): void;
}

/**
 * 基于 Electron `ipcRenderer` 构造传输。
 *
 * @param ipcRenderer `require('electron').ipcRenderer` 或测试替身。
 * @throws {Error} 缺少 `invoke` / `on` / `removeListener` 时抛出（preload 装配缺陷）。
 */
export function createElectronPreloadTransport(ipcRenderer: ElectronIpcRendererLike): IPreloadTransport {
  if (
    typeof ipcRenderer?.invoke !== 'function' ||
    typeof ipcRenderer.on !== 'function' ||
    typeof ipcRenderer.removeListener !== 'function'
  ) {
    throw new Error('preload 传输初始化失败：ipcRenderer 形状非法');
  }
  const wrapped = new WeakMap<(payload: unknown) => void, (...args: readonly unknown[]) => void>();
  return {
    invoke(channel: string, payload: unknown): Promise<unknown> {
      return ipcRenderer.invoke(channel, payload);
    },
    on(channel: string, listener: (payload: unknown) => void): void {
      const handler = (_event: unknown, ...args: readonly unknown[]): void => {
        listener(args[0]);
      };
      wrapped.set(listener, handler);
      ipcRenderer.on(channel, handler);
    },
    off(channel: string, listener: (payload: unknown) => void): void {
      const handler = wrapped.get(listener);
      if (handler !== undefined) {
        wrapped.delete(listener);
        ipcRenderer.removeListener(channel, handler);
      }
    },
  };
}
