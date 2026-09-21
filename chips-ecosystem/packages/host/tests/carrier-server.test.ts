/**
 * 承载服务端握手与派发测试（《17-CLI承载链路契约》§3.1–§3.5、§2.5、§5.3）。
 *
 * 以真实本机 UDS 连接验证服务端行为面（进程内 socket，非 CLI 真进程 E2E——真进程臂归波 2/3）：
 * 握手四类臂（protocol_mismatch / token_invalid / handshake_timeout / 成功回显 instanceId）、
 * 封套请求往返、停机顺序与发现文件归属守卫。
 */

import net from 'node:net';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { CARRIER_PROTOCOL, deriveCarrierEndpoints, type ICarrierDiscoveryRecord } from '@chips/bridge';
import { afterEach, describe, expect, it } from 'vitest';

import { createCliCommandIndex } from '../src/carrier/command-index.js';
import { readDiscoveryRecord, writeDiscoveryRecordTo } from '../src/carrier/discovery.js';
import { createCarrierRouteTable } from '../src/carrier/routes.js';
import { createCarrierServer, type ICarrierServer } from '../src/carrier/server.js';
import { createCliTaskStore } from '../src/carrier/task-store.js';

const tempRoots: string[] = [];
const openServers: ICarrierServer[] = [];

afterEach(async () => {
  while (openServers.length > 0) {
    await openServers.pop()?.close();
  }
  for (const dir of tempRoots.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const quietDiagnostics = { debug(): void {}, info(): void {}, warn(): void {}, error(): void {} };

interface ITestHarness {
  readonly server: ICarrierServer;
  readonly endpoints: ReturnType<typeof deriveCarrierEndpoints>;
  readonly closedSessions: string[];
  readonly token: string;
}

function makeHarness(options: { handshakeTimeoutMs?: number } = {}): ITestHarness {
  const root = mkdtempSync(path.join(tmpdir(), 'chips-carrier-srv-'));
  tempRoots.push(root);
  const endpoints = deriveCarrierEndpoints(root);
  const token = 'a'.repeat(64);
  const closedSessions: string[] = [];
  const index = createCliCommandIndex({ plugins: () => [], diagnostics: quietDiagnostics });
  const routes = createCarrierRouteTable({
    index,
    tasks: createCliTaskStore({ now: () => Date.now() }),
    diagnostics: quietDiagnostics,
  });
  const server = createCarrierServer({
    endpoints,
    instanceId: 'inst-test-1',
    bearerToken: token,
    hostVersion: '9.9.9-test',
    startedAt: 1700000000000,
    routes,
    sessions: {
      open: (input: { carrierId: string; clientId: string }): { sessionId: string; signal: AbortSignal } => ({
        sessionId: `session:carrier:${input.carrierId}`,
        signal: new AbortController().signal,
      }),
      close: (sessionId: string): void => {
        closedSessions.push(sessionId);
      },
    },
    diagnostics: quietDiagnostics,
    ...(options.handshakeTimeoutMs === undefined ? {} : { handshakeTimeoutMs: options.handshakeTimeoutMs }),
  });
  openServers.push(server);
  return { server, endpoints, closedSessions, token };
}

function connect(socketPath: string): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath, () => resolve(socket));
    socket.once('error', reject);
  });
}

function createReader(socket: net.Socket): {
  next(timeoutMs?: number): Promise<Record<string, unknown>>;
} {
  let buffer = '';
  const queue: string[] = [];
  const waiters: ((line: string) => void)[] = [];
  const rejecters: ((error: Error) => void)[] = [];
  socket.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline < 0) {
        break;
      }
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line.length === 0) {
        continue;
      }
      const waiter = waiters.shift();
      if (waiter !== undefined) {
        waiter(line);
      } else {
        queue.push(line);
      }
    }
  });
  socket.on('close', () => {
    for (const reject of rejecters.splice(0)) {
      reject(new Error('socket closed'));
    }
  });
  return {
    next(timeoutMs = 3000): Promise<Record<string, unknown>> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('frame timeout')), timeoutMs);
        const finish = (line: string): void => {
          clearTimeout(timer);
          resolve(JSON.parse(line) as Record<string, unknown>);
        };
        const rejectWith = (error: Error): void => {
          clearTimeout(timer);
          reject(error);
        };
        const queued = queue.shift();
        if (queued !== undefined) {
          finish(queued);
          return;
        }
        waiters.push(finish);
        rejecters.push(rejectWith);
      });
    },
  };
}

function writeLine(socket: net.Socket, frame: unknown): void {
  socket.write(`${JSON.stringify(frame)}\n`);
}

describe('承载服务端握手面（《17》§3.2–§3.3、§5.3）', () => {
  it('成功臂：token 命中 → 回显 protocol、negotiated、instanceId 与发现文件一致', async () => {
    const h = makeHarness();
    await h.server.open();
    expect(h.server.report().listening).toBe(true);
    const discovery = readDiscoveryRecord(h.endpoints.discoveryFile);
    expect(discovery).not.toBeNull();
    const socket = await connect(h.endpoints.socketPath);
    const reader = createReader(socket);
    writeLine(socket, { protocol: CARRIER_PROTOCOL, clientId: 'cli-x', bearerToken: h.token });
    const frame = await reader.next();
    expect(frame).toEqual({
      protocol: CARRIER_PROTOCOL,
      negotiated: CARRIER_PROTOCOL,
      hostVersion: '9.9.9-test',
      instanceId: discovery?.instanceId,
    });
    socket.destroy();
  });

  it('protocol_mismatch：非支持字面量 → 失败帧回显声称协议 + reason 词表值', async () => {
    const h = makeHarness();
    await h.server.open();
    const socket = await connect(h.endpoints.socketPath);
    const reader = createReader(socket);
    writeLine(socket, { protocol: 'chips-cli-carrier/999', clientId: 'c', bearerToken: h.token });
    const frame = await reader.next();
    expect(frame.protocol).toBe('chips-cli-carrier/999');
    expect(frame.negotiated).toBeNull();
    const error = frame.error as { code: string; details: { reason: string } };
    expect(error.code).toBe('CLI_TARGET_UNAVAILABLE');
    expect(error.details.reason).toBe('protocol_mismatch');
    socket.destroy();
  });

  it('token_invalid：错误 token 常量时间比较不等 → 失败帧并断连', async () => {
    const h = makeHarness();
    await h.server.open();
    const socket = await connect(h.endpoints.socketPath);
    const reader = createReader(socket);
    writeLine(socket, { protocol: CARRIER_PROTOCOL, clientId: 'c', bearerToken: 'b'.repeat(64) });
    const frame = await reader.next();
    const error = frame.error as { details: { reason: string } };
    expect(error.details.reason).toBe('token_invalid');
    await expect(reader.next(500)).rejects.toThrow('socket closed');
    socket.destroy();
  });

  it('handshake_timeout：超时窗口到（注入 100ms 等形，默认值不放宽）→ 失败帧 + 会话零登记', async () => {
    const h = makeHarness({ handshakeTimeoutMs: 100 });
    await h.server.open();
    const socket = await connect(h.endpoints.socketPath);
    const reader = createReader(socket);
    const frame = await reader.next();
    const error = frame.error as { details: { reason: string } };
    expect(error.details.reason).toBe('handshake_timeout');
    expect(h.closedSessions).toEqual([]);
    socket.destroy();
  });

  it('封套往返与取消链：握手后请求-响应逐帧；连接关闭即会话关闭（§5.4 CLI 先死）', async () => {
    const h = makeHarness();
    await h.server.open();
    const socket = await connect(h.endpoints.socketPath);
    const reader = createReader(socket);
    writeLine(socket, { protocol: CARRIER_PROTOCOL, clientId: 'cli-y', bearerToken: h.token });
    await reader.next();
    writeLine(socket, {
      requestId: 'req-1',
      capabilityId: 'cli.task.create',
      input: { pluginId: 'com.test.srv', commandId: 'srv.run' },
    });
    const response = await reader.next();
    expect(response.requestId).toBe('req-1');
    expect(response.ok).toBe(true);
    const closed = new Promise<void>((resolve) => socket.on('close', () => resolve()));
    socket.destroy();
    await closed;
    // 服务端侧 `close` 事件在客户端 FIN 之后异步到达：等形轮询，不改断言口径。
    for (let i = 0; i < 40 && h.closedSessions.length === 0; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(h.closedSessions).toHaveLength(1);
    expect(h.closedSessions[0]).toMatch(/^session:carrier:inst-test-1#\d+$/);
  });
});

describe('承载服务端生命周期与发现文件治理（《17》§2.4–§2.5）', () => {
  it('open 写盘权限 0600；close 后 socket 文件与发现文件均移除（§2.5-5 顺序）', async () => {
    const h = makeHarness();
    await h.server.open();
    expect(statSync(h.endpoints.discoveryFile).mode & 0o777).toBe(0o600);
    if (process.platform !== 'win32') {
      expect(statSync(h.endpoints.socketPath).mode & 0o777).toBe(0o600);
    }
    await h.server.close();
    expect(readDiscoveryRecord(h.endpoints.discoveryFile)).toBeNull();
    if (process.platform !== 'win32') {
      expect(statSyncThrows(h.endpoints.socketPath)).toBe(true);
    }
    expect(h.server.report().listening).toBe(false);
    openServers.splice(openServers.indexOf(h.server), 1);
  });

  it('崩溃残留治理：陈旧发现文件（假死 PID）被双判据识别并在 bind 前清理', async () => {
    const h = makeHarness();
    const ghost: ICarrierDiscoveryRecord = {
      protocol: CARRIER_PROTOCOL,
      instanceId: 'ghost',
      socketPath: h.endpoints.socketPath,
      pid: 999999,
      startedAt: 1,
      bearerToken: 'f'.repeat(64),
    };
    writeDiscoveryRecordTo(h.endpoints.discoveryFile, ghost);
    await h.server.open();
    const discovery = readDiscoveryRecord(h.endpoints.discoveryFile);
    expect(discovery?.instanceId).toBe('inst-test-1');
    await h.server.close();
    openServers.splice(openServers.indexOf(h.server), 1);
  });
});

function statSyncThrows(target: string): boolean {
  try {
    statSync(target);
    return false;
  } catch {
    return true;
  }
}
