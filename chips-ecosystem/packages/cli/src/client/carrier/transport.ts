/**
 * 承载连接与封套帧循环（《17-CLI承载链路契约》§2.1 帧分界、§3.2–§3.6 握手与封套、§5.3–§5.4 错误面）。
 *
 * 单一事实源纪律：封套别名 `ICarrierRequest`/`ICarrierResponse`、握手帧类型、协议字面量、
 * 握手超时常量、`reason` 词表一律 import `@chips/bridge`（《17》§6.1-1）；序列化纪律
 * JSON/camelCase/epoch 毫秒、无裸换行（§3.5）。
 *
 * @remarks
 * - 一次连接一个会话（§3.6）：握手 → 串行请求/响应 → 用完即关，无多路复用、无服务端推送帧。
 * - 帧分界：换行分隔 JSON（每行一个完整帧），残帧缓冲至换行到达再解析（§2.1-3）。
 * - token 不落日志、不进错误 `details`（§2.8）；握手失败/`instanceId` 错位按 §5.3 定性。
 */

import {
  CARRIER_HANDSHAKE_REASONS,
  CARRIER_HANDSHAKE_TIMEOUT_MS,
  CARRIER_PROTOCOL,
  type ChipsError,
  type ICarrierDiscoveryRecord,
  type ICarrierHandshakeResponse,
  type ICarrierRequest,
  type ICarrierResponse,
} from '@chips/bridge';

import {
  carrierConnectionLostError,
  carrierHandshakeTimeoutError,
  carrierTokenInvalidError,
  carrierUnavailableError,
  carrierWireErrorToCliError,
} from './errors.js';

/** 承载 socket 最小事件面（`node:net.Socket` 结构上满足；测试注入可控替身）。 */
export interface ICarrierSocket {
  write(data: string): unknown;
  destroy(): unknown;
  on(event: 'data', listener: (chunk: Buffer | string) => void): this;
  on(event: 'close' | 'error', listener: (error?: Error) => void): this;
  on(event: 'connect' | 'ready' | 'unknown', listener: (...args: unknown[]) => void): this;
}

/** 端点连接工厂：POSIX UDS 与 win32 命名管道统一收敛为 `path` 型连接（§2.1-1）。 */
export type CarrierSocketFactory = (socketPath: string) => ICarrierSocket;

/** 承载会话端口：握手后按在册 `routeId` 串行发起封套请求。 */
export interface ICarrierSession {
  request<TOutput>(routeId: string, input?: unknown): Promise<TOutput>;
  close(): void;
}

/** 建立承载会话所需输入（发现记录与端点值）。 */
export interface ICarrierSessionInput {
  readonly socketPath: string;
  readonly record: ICarrierDiscoveryRecord;
  /** CLI 进程实例标识（握手诊断关联，不参与授权，《17》§3.2）。 */
  readonly clientId: string;
  readonly connect: CarrierSocketFactory;
  /** 握手超时注入位（缺省恒为契约字面量，测试等形不放宽默认值，§3.3）。 */
  readonly handshakeTimeoutMs?: number;
}

/** 握手完成 Promise 的解析/拒绝挂点。 */
interface IHandshakeGate {
  resolve: (record: ICarrierDiscoveryRecord) => void;
  reject: (error: ChipsError) => void;
}

/** 在途请求挂点。 */
interface IPendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: ChipsError) => void;
}

/**
 * 建立承载会话：连接 → 首帧握手 → 校验成功响应 → 返回可发起封套请求的会话。
 *
 * @throws 传输/握手层失败以 `@chips/cli` 错误面透出（`carrierTransportError` 系列，《17》§5.3）。
 */
export async function openCarrierSession(input: ICarrierSessionInput): Promise<ICarrierSession> {
  const handshakeTimeoutMs = input.handshakeTimeoutMs ?? CARRIER_HANDSHAKE_TIMEOUT_MS;
  const socket = input.connect(input.socketPath);

  const session = new CarrierSession(socket, input.record, input.clientId);
  await session.awaitHandshake(handshakeTimeoutMs);
  return session;
}

/** 承载会话实现：帧循环 + 握手状态机 + 在途请求关联。 */
class CarrierSession implements ICarrierSession {
  private buffer = '';
  private phase: 'handshaking' | 'ready' | 'closed' = 'handshaking';
  private requestSequence = 0;
  private readonly pending = new Map<string, IPendingRequest>();
  private handshakeGate: IHandshakeGate | null = null;
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  private attached = false;

  constructor(
    private readonly socket: ICarrierSocket,
    private readonly record: ICarrierDiscoveryRecord,
    private readonly clientId: string
  ) {}

  /** 挂接 socket 事件并发送握手首帧，返回握手结果 Promise。 */
  public awaitHandshake(timeoutMs: number): Promise<void> {
    this.attach();
    const handshake = new Promise<void>((resolve, reject) => {
      this.handshakeGate = {
        resolve: () => resolve(),
        reject: (error: ChipsError) => reject(error),
      };
      this.handshakeTimer = setTimeout(() => {
        this.failHandshake(carrierHandshakeTimeoutError());
      }, timeoutMs);
      this.writeFrame({
        protocol: CARRIER_PROTOCOL,
        clientId: this.clientId,
        bearerToken: this.record.bearerToken,
      });
    });
    return handshake;
  }

  public request<TOutput>(routeId: string, input?: unknown): Promise<TOutput> {
    if (this.phase === 'closed') {
      return Promise.reject(carrierConnectionLostError());
    }
    const requestId = this.nextRequestId();
    const frame: ICarrierRequest = {
      requestId,
      capabilityId: routeId,
      ...(input === undefined ? {} : { input }),
    };
    return new Promise<TOutput>((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: (result: unknown) => resolve(result as TOutput),
        reject,
      });
      this.writeFrame(frame);
    });
  }

  public close(): void {
    if (this.phase === 'closed') {
      return;
    }
    this.teardown();
  }

  private attach(): void {
    if (this.attached) {
      return;
    }
    this.attached = true;
    this.socket.on('data', (chunk) => this.onData(chunk));
    this.socket.on('close', () => this.onSocketGone());
    this.socket.on('error', () => this.onSocketGone());
  }

  private onData(chunk: Buffer | string): void {
    this.buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    let newline = this.buffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (line.length > 0) {
        this.handleLine(line);
      }
      newline = this.buffer.indexOf('\n');
    }
  }

  private handleLine(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      // 会话期坏帧无可靠关联键，按连接丢失收口在途（§3.4/§5.4）；握手期坏帧拒绝握手。
      if (this.phase === 'handshaking') {
        this.failHandshake(carrierUnavailableError());
        return;
      }
      this.failAllPending(carrierConnectionLostError());
      return;
    }
    if (this.phase === 'handshaking') {
      this.handleHandshakeFrame(parsed);
      return;
    }
    this.handleResponseFrame(parsed as ICarrierResponse);
  }

  private handleHandshakeFrame(parsed: unknown): void {
    const frame = parsed as Partial<ICarrierHandshakeResponse> | null;
    if (typeof frame !== 'object' || frame === null || !('negotiated' in frame)) {
      this.failHandshake(carrierUnavailableError());
      return;
    }
    if (frame.negotiated === null) {
      const failure = frame as Extract<ICarrierHandshakeResponse, { negotiated: null }>;
      this.failHandshake(this.mapHandshakeFailure(failure));
      return;
    }
    const success = frame as Extract<ICarrierHandshakeResponse, { negotiated: string }>;
    if (success.protocol !== CARRIER_PROTOCOL || success.negotiated !== CARRIER_PROTOCOL) {
      this.failHandshake(carrierUnavailableError());
      return;
    }
    if (success.instanceId !== this.record.instanceId) {
      // `instanceId` 错位：错位登记防御，按 carrier_unavailable 收口并关连接（§3.2/§5.3）。
      this.failHandshake(carrierUnavailableError());
      return;
    }
    this.clearHandshakeTimer();
    this.phase = 'ready';
    const gate = this.handshakeGate;
    this.handshakeGate = null;
    gate?.resolve(this.record);
  }

  private mapHandshakeFailure(failure: {
    error?: { code?: string; message?: string; details?: unknown };
  }): ChipsError {
    const reason = (failure.error as { details?: { reason?: string } } | undefined)?.details
      ?.reason;
    if (reason === CARRIER_HANDSHAKE_REASONS.tokenInvalid) {
      return carrierTokenInvalidError();
    }
    if (reason === CARRIER_HANDSHAKE_REASONS.protocolMismatch) {
      return carrierWireErrorToCliError({
        code: 'CLI_TARGET_UNAVAILABLE',
        message: '承载协议字面量不匹配',
        details: { reason: CARRIER_HANDSHAKE_REASONS.protocolMismatch },
      });
    }
    // 其余失败响应（含未知 reason）以封套错误原样透传，退出码走既有旁表（§5.1/§5.3）。
    const error = failure.error;
    if (typeof error?.code === 'string' && typeof error?.message === 'string') {
      return carrierWireErrorToCliError({
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
        retryable: false,
      });
    }
    return carrierUnavailableError();
  }

  private handleResponseFrame(response: ICarrierResponse): void {
    const requestId = typeof response?.requestId === 'string' ? response.requestId : '';
    const entry = this.pending.get(requestId);
    if (entry === undefined) {
      return;
    }
    this.pending.delete(requestId);
    if (response.ok === true) {
      entry.resolve(response.result);
      return;
    }
    entry.reject(carrierWireErrorToCliError(response.error));
  }

  private failHandshake(error: ChipsError): void {
    if (this.phase !== 'handshaking') {
      return;
    }
    this.clearHandshakeTimer();
    const gate = this.handshakeGate;
    this.handshakeGate = null;
    this.teardown();
    gate?.reject(error);
  }

  private failAllPending(error: ChipsError): void {
    for (const entry of this.pending.values()) {
      entry.reject(error);
    }
    this.pending.clear();
  }

  private onSocketGone(): void {
    if (this.phase === 'handshaking') {
      // 握手未成即连接消失（端点不可达、连接被拒、socket 覆盖直连但端点亡）：
      // §5.3 定性为 `carrier_unavailable`（发现阶段 → 3），非 `connection_lost`。
      this.failHandshake(carrierUnavailableError());
      return;
    }
    if (this.phase === 'ready') {
      // 已建会话后连接中途断（宿主崩溃/重启）：在途请求以 `connection_lost` 拒绝（§5.4 → 6）。
      this.failAllPending(carrierConnectionLostError());
    }
    this.phase = 'closed';
  }

  private teardown(): void {
    this.phase = 'closed';
    this.clearHandshakeTimer();
    this.failAllPending(carrierConnectionLostError());
    this.socket.destroy();
  }

  private clearHandshakeTimer(): void {
    if (this.handshakeTimer !== null) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
  }

  private nextRequestId(): string {
    this.requestSequence += 1;
    return `${this.clientId}:${String(this.requestSequence)}`;
  }

  private writeFrame(frame: unknown): void {
    this.socket.write(`${JSON.stringify(frame)}\n`);
  }
}
