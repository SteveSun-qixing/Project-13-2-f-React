/**
 * 客户端传输接缝（02-Bridge三层设计 §7.1）。
 *
 * preload 由宿主实现 `IIpcTransport`（`ipcRenderer.invoke` / `ipcRenderer.on`）；
 * 资源字节不由 IPC 通道承载（§10.3），经 `IResourceByteSource` 注入，由宿主按
 * `chips-resource://` 协议路径提供（本包不实现资源读取，符合"Bridge 不实现 Host 能力"的分工）。
 */

export interface IIpcTransport {
  /** `ipcRenderer.invoke` 语义：发送请求并等待应答；通道固定见 `IPC_CHANNELS`。 */
  invoke(channel: string, payload: unknown): Promise<unknown>;
  /** `ipcRenderer.on` 语义：订阅下行消息；返回退订函数（幂等）。 */
  on(channel: string, listener: (payload: unknown) => void): () => void;
}

/** 资源字节读取接缝：由宿主按 `chips-resource://` 协议（Range 请求）实现。 */
export interface IResourceByteSource {
  /** 读取完整字节（调用方已保证不超过 8 MiB 上限）。 */
  read(uri: string): Promise<Uint8Array>;
  /** 按偏移读取；流打开期间调用由资源管理器返回 `RESOURCE_BUSY`。 */
  readRange(uri: string, offset: number, length: number): Promise<Uint8Array>;
  /** 打开流式读取；同一句柄同时只服务一个流。 */
  openStream(uri: string): ReadableStream<Uint8Array>;
}
