/**
 * 承载服务端：UDS / win32 命名管道监听、握手校验与 bearer token 核验、NDJSON 封套派发
 * （《17-CLI承载链路契约》§2.1–§2.5、§3.1–§3.5、§5.3–§5.4）。
 *
 * 权威：端点值一律来自 `deriveCarrierEndpoints`（单一派生源，本模块禁止第二处推导）；
 * 握手帧与封套形状权威在 `@chips/bridge` carrier 分件；`details.reason` 取 §5.3 封闭词表。
 *
 * @remarks
 * - 承载面 fail-closed（§2.3-3、§2.5-2）：缩短后 socket 路径仍超 `sun_path` 上限、
 *   bind 冲突不可清等场景下，宿主正常启动、不监听、不写发现文件，只落诊断计数；
 *   `open()` 不抛出，定性通过 {@link ICarrierServerReport.failClosedReason} 透出。
 * - 停机顺序（§2.5-5）：先关监听（拒新、在途取消）→ 移除 socket 文件 → 移除发现文件；
 *   发现文件删除受 `instanceId` 归属守卫（只删自己写的）。
 * - 握手超时 {@link CARRIER_HANDSHAKE_TIMEOUT_MS} 双向 fail-closed：服务端计时到即
 *   下发 `handshake_timeout` 失败帧并断连（超时窗口注入化仅供测试等形，默认值不放宽）。
 * - token 比较走常量时间（`timingSafeEqual` 对 SHA-256 摘要比较，长度不等不泄漏时序）；
 *   token 不落日志（§2.8）。
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { chmodSync } from 'node:fs';
import net from 'node:net';

import {
  CARRIER_ENDPOINT_FILE_MODE,
  CARRIER_HANDSHAKE_TIMEOUT_MS,
  CARRIER_PROTOCOL,
  CARRIER_SOCKET_PATH_MAX_BYTES,
  type ICarrierEndpoints,
  type CarrierHandshakeReason,
} from '@chips/bridge';

import { isBridgeRequest, type IBridgeRequest } from '../protocol/wire.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import {
  judgeDiscoveryStaleness,
  readDiscoveryRecord,
  removeQuiet,
  writeDiscoveryRecordTo,
  buildDiscoveryRecord,
  type IPidProbe,
  createSystemPidProbe,
} from './discovery.js';
import type { ICarrierRouteTable } from './routes.js';
import { carrierReasonError, type ICarrierCallContext } from './types.js';

/** 承载会话端口：由组合根接入统一会话注册表（禁止第二会话表，《17》§4.4 红线）。 */
export interface ICarrierSessionPort {
  /** 握手成功后登记承载会话；返回注册表会话键与连接级取消信号。 */
  open(input: { readonly carrierId: string; readonly clientId: string }): {
    readonly sessionId: string;
    readonly signal: AbortSignal;
  };
  /** 连接关闭即会话关闭（幂等；触发在途取消，《17》§5.4「CLI 先死」语义）。 */
  close(sessionId: string): void;
}

/** 承载服务端报告（进宿主 `report()` 诊断面；不含 token，§2.8）。 */
export interface ICarrierServerReport {
  readonly listening: boolean;
  readonly failClosedReason: string | null;
  readonly activeConnections: number;
  readonly socketPath: string;
}

/** 承载服务端接口。 */
export interface ICarrierServer {
  /** 打开监听并原子写发现文件（先做 §2.5 崩溃残留双判据清理）；fail-closed 不抛出。 */
  open(): Promise<void>;
  /** 按 §2.5-5 顺序停机：关监听→移除 socket→移除自有发现文件。 */
  close(): Promise<void>;
  report(): ICarrierServerReport;
}

/** 承载服务端依赖。 */
export interface ICarrierServerDeps {
  readonly endpoints: ICarrierEndpoints;
  readonly instanceId: string;
  readonly bearerToken: string;
  readonly hostVersion: string;
  readonly startedAt: number;
  readonly routes: ICarrierRouteTable;
  readonly sessions: ICarrierSessionPort;
  readonly diagnostics: DiagnosticsSink;
  /** 握手超时注入位（测试等形；缺省恒为契约字面量 {@link CARRIER_HANDSHAKE_TIMEOUT_MS}）。 */
  readonly handshakeTimeoutMs?: number;
  /** 进程判据探针注入位（缺省走系统 `ps` / `Get-Process`）。 */
  readonly pidProbe?: IPidProbe;
}

/** 连接级状态机。 */
interface IConnectionState {
  phase: 'handshaking' | 'ready';
  buffer: string;
  clientId: string;
  sessionId: string | null;
  signal: AbortSignal | null;
  timer: ReturnType<typeof setTimeout> | null;
  disposed: boolean;
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** 常量时间 token 比较：先各自 SHA-256 定长摘要，长度不等不提前返回（§3.3）。 */
function tokenEquals(expected: string, provided: string): boolean {
  const digestOf = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digestOf(expected), digestOf(provided));
}

function writeFrame(socket: net.Socket, frame: unknown): void {
  socket.write(`${JSON.stringify(frame)}\n`);
}

/** 创建承载服务端。 */
export function createCarrierServer(deps: ICarrierServerDeps): ICarrierServer {
  const { endpoints, instanceId, bearerToken, hostVersion, startedAt, routes, sessions, diagnostics } = deps;
  const handshakeTimeoutMs = deps.handshakeTimeoutMs ?? CARRIER_HANDSHAKE_TIMEOUT_MS;
  const probe = deps.pidProbe ?? createSystemPidProbe(() => Date.now());
  const isWin32 = process.platform === 'win32';

  const connections = new Map<net.Socket, IConnectionState>();
  let server: net.Server | null = null;
  let listening = false;
  let closing = false;
  let failClosedReason: string | null = null;
  let connectionCounter = 0;

  const failFrame = (protocol: string, reason: CarrierHandshakeReason): unknown => ({
    protocol,
    negotiated: null,
    error: carrierReasonError(reason),
  });

  const destroyConnection = (socket: net.Socket): void => {
    const state = connections.get(socket);
    if (state !== undefined) {
      state.disposed = true;
      if (state.timer !== null) {
        clearTimeout(state.timer);
        state.timer = null;
      }
    }
    socket.destroy();
  };

  const handleHandshakeLine = (socket: net.Socket, line: string): void => {
    const state = connections.get(socket);
    if (state === undefined || state.phase !== 'handshaking') {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      // 首帧非 JSON：无 `protocol` 可回显，静默断连（§3.2 帧形状不成立）。
      diagnostics.warn('carrier', '握手首帧非合法 JSON，静默断连', {});
      destroyConnection(socket);
      return;
    }
    const frame = parsed as Partial<{
      protocol: unknown;
      clientId: unknown;
      bearerToken: unknown;
    }> | null;
    const claimedProtocol =
      typeof frame === 'object' && frame !== null && typeof frame.protocol === 'string' ? frame.protocol : null;
    if (claimedProtocol === null) {
      diagnostics.warn('carrier', '握手首帧缺少 protocol 字段，静默断连', {});
      destroyConnection(socket);
      return;
    }
    if (claimedProtocol !== CARRIER_PROTOCOL) {
      writeFrame(socket, failFrame(claimedProtocol, 'protocol_mismatch'));
      destroyConnection(socket);
      return;
    }
    if (typeof frame !== 'object' || frame === null || typeof frame.bearerToken !== 'string') {
      writeFrame(socket, failFrame(claimedProtocol, 'token_invalid'));
      destroyConnection(socket);
      return;
    }
    if (!tokenEquals(bearerToken, frame.bearerToken)) {
      diagnostics.warn('carrier', '握手 token 校验失败', {});
      writeFrame(socket, failFrame(claimedProtocol, 'token_invalid'));
      destroyConnection(socket);
      return;
    }
    connectionCounter += 1;
    const clientId = typeof frame.clientId === 'string' ? frame.clientId : '';
    const carrierId = `${instanceId}#${String(connectionCounter)}`;
    const opened = sessions.open({ carrierId, clientId });
    state.phase = 'ready';
    state.clientId = clientId;
    state.sessionId = opened.sessionId;
    state.signal = opened.signal;
    if (state.timer !== null) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    const success: unknown = {
      protocol: claimedProtocol,
      negotiated: CARRIER_PROTOCOL,
      hostVersion,
      instanceId,
    };
    writeFrame(socket, success);
  };

  const handleReadyLine = (socket: net.Socket, line: string): void => {
    const state = connections.get(socket);
    if (state === undefined || state.phase !== 'ready' || state.sessionId === null) {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      parsed = undefined;
    }
    if (!isBridgeRequest(parsed)) {
      // 会话期坏帧：无可靠 `requestId` 可回显关联，断连收口（§3.4/§5.4）。
      diagnostics.warn('carrier', '承载会话期收到非法封套帧，断连收口', {});
      destroyConnection(socket);
      return;
    }
    const request: IBridgeRequest = parsed;
    const context: ICarrierCallContext = {
      sessionId: state.sessionId,
      clientId: state.clientId,
      signal: state.signal ?? new AbortController().signal,
    };
    void routes
      .dispatch(request, context)
      .then((response) => {
        if (state.disposed || socket.destroyed) {
          return;
        }
        writeFrame(socket, response);
      })
      .catch((error: unknown) => {
        diagnostics.error('carrier', '承载派发未知异常', {
          reason: error instanceof Error ? error.message : typeof error,
        });
        destroyConnection(socket);
      });
  };

  const onConnection = (socket: net.Socket): void => {
    if (closing) {
      socket.destroy();
      return;
    }
    const state: IConnectionState = {
      phase: 'handshaking',
      buffer: '',
      clientId: '',
      sessionId: null,
      signal: null,
      timer: null,
      disposed: false,
    };
    connections.set(socket, state);
    const timer = setTimeout(() => {
      if (state.phase === 'handshaking') {
        // 服务端超时窗口：失败帧以本端唯一支持协议字面量回显（§3.3 双向 fail-closed）。
        writeFrame(socket, failFrame(CARRIER_PROTOCOL, 'handshake_timeout'));
        destroyConnection(socket);
      }
    }, handshakeTimeoutMs);
    state.timer = timer;
    socket.on('data', (chunk: Buffer) => {
      state.buffer += chunk.toString('utf8');
      let newline = state.buffer.indexOf('\n');
      while (newline >= 0) {
        const line = state.buffer.slice(0, newline).trim();
        state.buffer = state.buffer.slice(newline + 1);
        if (line.length > 0) {
          if (state.phase === 'handshaking') {
            handleHandshakeLine(socket, line);
          } else {
            handleReadyLine(socket, line);
          }
        }
        newline = state.buffer.indexOf('\n');
      }
    });
    socket.on('error', () => {
      destroyConnection(socket);
    });
    socket.on('close', () => {
      if (state.timer !== null) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      state.disposed = true;
      connections.delete(socket);
      if (state.sessionId !== null) {
        sessions.close(state.sessionId);
      }
    });
  };

  return {
    async open(): Promise<void> {
      if (!isWin32 && utf8Length(endpoints.socketPath) > CARRIER_SOCKET_PATH_MAX_BYTES) {
        // §2.3 第 3 条：缩短形态仍超限 → 承载面 fail-closed（宿主正常启动）。
        failClosedReason = 'socket_path_exceeds_sun_path';
        diagnostics.error('carrier', '承载端点路径超 sun_path 上限，承载面 fail-closed（宿主正常启动）', {
          byteLength: utf8Length(endpoints.socketPath),
        });
        return;
      }
      const existing = readDiscoveryRecord(endpoints.discoveryFile);
      if (existing !== null) {
        const verdict = judgeDiscoveryStaleness(existing, probe);
        if (verdict.stale) {
          diagnostics.warn('carrier', '清理崩溃残留的陈旧承载登记', { reason: verdict.reason });
          removeQuiet(endpoints.discoveryFile);
          if (!isWin32) {
            removeQuiet(existing.socketPath);
          }
        }
      }
      await new Promise<void>((resolve) => {
        const created = net.createServer(onConnection);
        created.on('error', (error: Error) => {
          if (!listening) {
            // §2.5-2：活宿主持端点 → 承载面 fail-closed，不影响宿主主体。
            failClosedReason = 'endpoint_bind_failed';
            diagnostics.error('carrier', '承载端点 bind 失败，承载面 fail-closed（宿主正常启动）', {
              reason: error.message,
            });
            resolve();
          } else {
            diagnostics.error('carrier', '承载监听运行期错误', { reason: error.message });
          }
        });
        created.on('listening', () => {
          server = created;
          listening = true;
          if (!isWin32) {
            try {
              chmodSync(endpoints.socketPath, CARRIER_ENDPOINT_FILE_MODE);
            } catch {
              diagnostics.warn('carrier', 'socket 文件权限位设置失败', {});
            }
          }
          writeDiscoveryRecordTo(
            endpoints.discoveryFile,
            buildDiscoveryRecord({
              instanceId,
              socketPath: endpoints.socketPath,
              pid: process.pid,
              startedAt,
              bearerToken,
            }),
          );
          resolve();
        });
        created.listen(endpoints.socketPath);
      });
    },

    async close(): Promise<void> {
      closing = true;
      // §2.5-5 步 1：关监听（拒新连接；在途经会话关闭触发取消）。
      if (server !== null) {
        const current = server;
        await new Promise<void>((resolve) => {
          current.close(() => {
            resolve();
          });
        });
        server = null;
      }
      for (const socket of [...connections.keys()]) {
        destroyConnection(socket);
      }
      // 步 2：移除 socket 文件（POSIX，仅本实例监听过时）。
      if (listening && !isWin32) {
        removeQuiet(endpoints.socketPath);
      }
      // 步 3：移除发现文件（`instanceId` 归属守卫，绝不删他实例登记）。
      const own = readDiscoveryRecord(endpoints.discoveryFile);
      if (own !== null && own.instanceId === instanceId) {
        removeQuiet(endpoints.discoveryFile);
      }
      listening = false;
    },

    report(): ICarrierServerReport {
      return {
        listening,
        failClosedReason,
        activeConnections: connections.size,
        socketPath: endpoints.socketPath,
      };
    },
  };
}
