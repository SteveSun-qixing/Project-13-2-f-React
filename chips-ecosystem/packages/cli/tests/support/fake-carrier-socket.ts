/**
 * 承载 socket 测试替身（工单039 波 2）：内存实现 {@link ICarrierSocket} 最小事件面，
 * 供握手/帧循环/残帧臂在零真机宿主下可测（真机配对 E2E 归波 3，《17》§5.6）。
 */

import { CARRIER_PROTOCOL, type ICarrierHandshakeResponse } from '@chips/bridge';

import type { ICarrierSocket } from '../../src/client/carrier/transport.js';

type DataListener = (chunk: Buffer | string) => void;
type CloseListener = (error?: Error) => void;
type OtherListener = (...args: unknown[]) => void;

/** 可控承载 socket：记录写出帧、由测试驱动入站数据/关闭/错误。 */
export class FakeCarrierSocket implements ICarrierSocket {
  /** 已写出的原始帧文本（含结尾 `\n`）。 */
  readonly written: string[] = [];

  destroyed = false;

  private readonly dataListeners: DataListener[] = [];

  private readonly closeListeners: CloseListener[] = [];

  private readonly errorListeners: CloseListener[] = [];

  private readonly otherListeners = new Map<string, OtherListener[]>();

  public write(data: string): unknown {
    this.written.push(data);
    return true;
  }

  public destroy(): unknown {
    this.destroyed = true;
    return this;
  }

  public on(event: 'data', listener: (chunk: Buffer | string) => void): this;
  public on(event: 'close' | 'error', listener: (error?: Error) => void): this;
  public on(event: 'connect' | 'ready' | 'unknown', listener: (...args: unknown[]) => void): this;
  public on(event: string, listener: (...args: never[]) => void): this {
    if (event === 'data') {
      this.dataListeners.push(listener as DataListener);
    } else if (event === 'close') {
      this.closeListeners.push(listener as CloseListener);
    } else if (event === 'error') {
      this.errorListeners.push(listener as CloseListener);
    } else {
      const bucket = this.otherListeners.get(event) ?? [];
      bucket.push(listener as OtherListener);
      this.otherListeners.set(event, bucket);
    }
    return this;
  }

  /** 解析测试侧写出帧（去尾换行后 JSON.parse）。 */
  public frames(): unknown[] {
    return this.written.map((raw) => JSON.parse(raw.replace(/\n$/, '')) as unknown);
  }

  /** 握手首帧对象。 */
  public handshakeFrame(): { protocol: string; clientId: string; bearerToken: string } {
    return this.frames()[0] as { protocol: string; clientId: string; bearerToken: string };
  }

  /** 原样推入一段入站数据（可为残帧、半行）。 */
  public pushRaw(chunk: string): void {
    for (const listener of [...this.dataListeners]) {
      listener(chunk);
    }
  }

  /** 推入一个完整 NDJSON 帧对象。 */
  public pushFrame(frame: unknown): void {
    this.pushRaw(`${JSON.stringify(frame)}\n`);
  }

  /** 推入握手成功帧。 */
  public pushHandshakeSuccess(instanceId: string): void {
    const frame: ICarrierHandshakeResponse = {
      protocol: CARRIER_PROTOCOL,
      negotiated: CARRIER_PROTOCOL,
      hostVersion: 'test-host',
      instanceId,
    };
    this.pushFrame(frame);
  }

  /** 触发 close 事件。 */
  public emitClose(): void {
    for (const listener of [...this.closeListeners]) {
      listener();
    }
  }

  /** 触发 error 事件（真实 net 会紧随 close，这里独立驱动以覆盖 error 收口臂）。 */
  public emitError(): void {
    for (const listener of [...this.errorListeners]) {
      listener(new Error('socket error'));
    }
  }
}
