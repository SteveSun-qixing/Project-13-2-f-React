/**
 * 承载 socket 的 Node 实现工厂（《17-CLI承载链路契约》§2.1-1）。
 *
 * POSIX UDS 与 win32 named pipe 在 `node:net` 侧统一收敛为 `path` 型连接：客户端只认
 * `socketPath` 值（POSIX 绝对路径 / `\\\\.\\pipe\\` 前缀 pipe 名），传输形态差异由 `node:net` 内部
 * 依值形态消解，本工厂不做第二份平台分支（单一事实源，《17》§6.1-1）。
 *
 * @remarks 连接失败（`ECONNREFUSED`/`ENOENT` 等）在 socket 面上表现为 `error` 紧随 `close`，
 * 由承载会话按 §5.3 统一收口为 `carrier_unavailable`（握手未成）或 `connection_lost`（会话中断）；
 * 本工厂不吞异常、不自造错误。
 */

import { connect, type Socket } from 'node:net';

import type { CarrierSocketFactory, ICarrierSocket } from './transport.js';

/**
 * `node:net.Socket` 的薄适配：只透出承载会话依赖的 `write`/`destroy` 与 data/close/error 事件面，
 * 避免 Socket 其余 API 泄漏进会话（事件签名逐一对齐 {@link ICarrierSocket} 重载）。
 */
class NetCarrierSocket implements ICarrierSocket {
  public constructor(private readonly socket: Socket) {
    this.socket.setNoDelay(true);
  }

  public write(data: string): unknown {
    return this.socket.write(data);
  }

  public destroy(): unknown {
    return this.socket.destroy();
  }

  public on(event: 'data', listener: (chunk: Buffer | string) => void): this;
  public on(event: 'close' | 'error', listener: (error?: Error) => void): this;
  public on(event: 'connect' | 'ready' | 'unknown', listener: (...args: unknown[]) => void): this;
  public on(event: string, listener: (...args: never[]) => void): this {
    this.socket.on(event, listener as (...args: unknown[]) => void);
    return this;
  }
}

/**
 * 建立到承载端点的 `path` 型连接并适配为会话所需最小事件面。
 *
 * @param socketPath 端点值：POSIX socket 绝对路径或 win32 named pipe 名。
 */
export function connectCarrierSocket(socketPath: string): ICarrierSocket {
  return new NetCarrierSocket(connect({ path: socketPath }));
}

/** 承载 socket 工厂（缺省连接实现，注入位见 `createCarrierInvoker`）。 */
export const nodeCarrierSocketFactory: CarrierSocketFactory = connectCarrierSocket;
