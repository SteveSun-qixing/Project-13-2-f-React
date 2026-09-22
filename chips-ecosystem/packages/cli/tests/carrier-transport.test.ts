/**
 * 承载会话：握手状态机 + NDJSON 帧循环 + 残帧缓冲 + 封套臂（《17-CLI承载链路契约》§2.1、§3.2–§3.6、§5.3–§5.4）。
 *
 * 覆盖必测臂：
 * - 握手失败各定性：`token_invalid` / `protocol_mismatch` / `instanceId` 错位 / 未知码透传 / 握手超时；
 * - 残帧臂：入站半行缓冲至换行到达再解析（握手帧与响应帧各一）；
 * - 连接中途断：握手未成 close → `carrier_unavailable`；就绪后断 → 在途 `connection_lost`；
 * - 封套业务错误透传；R3 内部码透传（不造第二语义）。
 */

import { describe, expect, it } from 'vitest';

import {
  CARRIER_PROTOCOL,
  CARRIER_HANDSHAKE_REASONS,
  type ICarrierDiscoveryRecord,
} from '@chips/bridge';

import { ChipsError, exitCodeForError } from '../src/errors.js';
import { openCarrierSession, type ICarrierSession } from '../src/client/carrier/transport.js';
import { FakeCarrierSocket } from './support/fake-carrier-socket.js';

const CLIENT_ID = 'cli-test-1';

function record(overrides: Partial<ICarrierDiscoveryRecord> = {}): ICarrierDiscoveryRecord {
  return {
    protocol: CARRIER_PROTOCOL,
    instanceId: 'inst-77',
    socketPath: '/userdata/chips-carrier.sock',
    pid: 77,
    startedAt: 2_000,
    bearerToken: 'b'.repeat(64),
    ...overrides,
  };
}

/** 启动会话：返回未 await 的建立 Promise 与驱动用 socket（握手首帧已同步写出）。 */
function start(
  recordValue: ICarrierDiscoveryRecord,
  socket: FakeCarrierSocket,
  timeoutMs = 5000
): Promise<ICarrierSession> {
  const promise = openCarrierSession({
    socketPath: recordValue.socketPath,
    record: recordValue,
    clientId: CLIENT_ID,
    connect: () => socket,
    handshakeTimeoutMs: timeoutMs,
  });
  // 抑制尚未消费的 rejection，避免 unhandledrejection（各用例自行 await）。
  void promise.catch(() => undefined);
  return promise;
}

/** 建立到就绪态的会话。 */
async function ready(
  recordValue = record()
): Promise<{ socket: FakeCarrierSocket; session: ICarrierSession }> {
  const socket = new FakeCarrierSocket();
  const promise = start(recordValue, socket);
  socket.pushHandshakeSuccess(recordValue.instanceId);
  const session = await promise;
  return { socket, session };
}

describe('握手首帧与成功路径', () => {
  it('首帧为握手帧：protocol/clientId/bearerToken 三字段（§3.2）', () => {
    const socket = new FakeCarrierSocket();
    const recordValue = record();
    void start(recordValue, socket, 10);
    expect(socket.handshakeFrame()).toEqual({
      protocol: CARRIER_PROTOCOL,
      clientId: CLIENT_ID,
      bearerToken: recordValue.bearerToken,
    });
  });

  it('握手成功后串行请求/响应，返回 result 负载', async () => {
    const { socket, session } = await ready();
    const requestPromise = session.request<{ commands: unknown[] }>('cli.command.list', { a: 1 });
    const frame = socket.frames()[1] as { requestId: string; capabilityId: string; input: unknown };
    expect(frame).toMatchObject({ requestId: `${CLIENT_ID}:1`, capabilityId: 'cli.command.list' });
    expect(frame.input).toEqual({ a: 1 });
    socket.pushFrame({ requestId: frame.requestId, ok: true, result: { commands: [1, 2] } });
    await expect(requestPromise).resolves.toEqual({ commands: [1, 2] });
  });

  it('input 省略时封套不含 input 键（§3.4）', async () => {
    const { socket, session } = await ready();
    void session.request('cli.command.get');
    const frame = socket.frames()[1] as Record<string, unknown>;
    expect('input' in frame).toBe(false);
  });

  it('requestId 每连接内唯一递增', async () => {
    const { socket, session } = await ready();
    const first = session.request('cli.task.get', {});
    const second = session.request('cli.task.get', {});
    const ids = socket
      .frames()
      .slice(1)
      .map((f) => (f as { requestId: string }).requestId);
    expect(ids[0]).toBe(`${CLIENT_ID}:1`);
    expect(ids[1]).toBe(`${CLIENT_ID}:2`);
    socket.pushFrame({ requestId: ids[0], ok: true, result: null });
    socket.pushFrame({ requestId: ids[1], ok: true, result: null });
    await Promise.all([first, second]);
  });
});

describe('握手失败各定性（§5.3）', () => {
  it('token_invalid → CLI_TARGET_UNAVAILABLE + reason token_invalid（退出码 6）', async () => {
    const socket = new FakeCarrierSocket();
    const recordValue = record();
    const promise = start(recordValue, socket);
    socket.pushFrame({
      protocol: CARRIER_PROTOCOL,
      negotiated: null,
      error: {
        code: 'CLI_TARGET_UNAVAILABLE',
        message: 'token 校验失败',
        details: { reason: CARRIER_HANDSHAKE_REASONS.tokenInvalid },
      },
    });
    const error = await promise.catch((e: unknown) => e as ChipsError);
    expect(error).toBeInstanceOf(ChipsError);
    expect((error as ChipsError).code).toBe('CLI_TARGET_UNAVAILABLE');
    expect((error as ChipsError).details).toMatchObject({ reason: 'token_invalid' });
    expect(exitCodeForError(error as ChipsError)).toBe(6);
  });

  it('protocol_mismatch 失败响应 → reason protocol_mismatch（退出码 3）', async () => {
    const socket = new FakeCarrierSocket();
    const promise = start(record(), socket);
    socket.pushFrame({
      protocol: CARRIER_PROTOCOL,
      negotiated: null,
      error: {
        code: 'CLI_TARGET_UNAVAILABLE',
        message: '协议不匹配',
        details: { reason: CARRIER_HANDSHAKE_REASONS.protocolMismatch },
      },
    });
    const error = (await promise.catch((e: unknown) => e)) as ChipsError;
    expect(error.details).toMatchObject({ reason: 'protocol_mismatch' });
  });

  it('握手成功但 instanceId 错位 → carrier_unavailable（§3.2）', async () => {
    const socket = new FakeCarrierSocket();
    const promise = start(record(), socket);
    socket.pushHandshakeSuccess('different-instance');
    const error = (await promise.catch((e: unknown) => e)) as ChipsError;
    expect(error.code).toBe('CLI_TARGET_UNAVAILABLE');
    expect(error.details).toMatchObject({ reason: 'carrier_unavailable' });
  });

  it('失败响应携带非承载域码 → 原样透传（不折叠 CLI_TARGET_UNAVAILABLE）', async () => {
    const socket = new FakeCarrierSocket();
    const promise = start(record(), socket);
    socket.pushFrame({
      protocol: CARRIER_PROTOCOL,
      negotiated: null,
      error: { code: 'CLI_PERMISSION_DENIED', message: '权限不足', details: {} },
    });
    const error = (await promise.catch((e: unknown) => e)) as ChipsError;
    expect(error.code).toBe('CLI_PERMISSION_DENIED');
    expect(exitCodeForError(error)).toBe(4);
  });

  it('握手超时 → handshake_timeout（§3.3）', async () => {
    const socket = new FakeCarrierSocket();
    const promise = start(record(), socket, 10);
    const error = (await promise.catch((e: unknown) => e)) as ChipsError;
    expect(error.details).toMatchObject({ reason: 'handshake_timeout' });
    expect(socket.destroyed).toBe(true);
  });
});

describe('残帧臂：NDJSON 半行缓冲至换行到达（§2.1-3）', () => {
  it('握手帧分两段入站：首段无换行不成帧，次段补全才就绪', async () => {
    const socket = new FakeCarrierSocket();
    const recordValue = record();
    let settled = false;
    const promise = start(recordValue, socket).then((session) => {
      settled = true;
      return session;
    });
    void promise.catch(() => undefined);
    const full = JSON.stringify({
      protocol: CARRIER_PROTOCOL,
      negotiated: CARRIER_PROTOCOL,
      hostVersion: 'test-host',
      instanceId: recordValue.instanceId,
    });
    socket.pushRaw(full.slice(0, 10));
    await Promise.resolve();
    expect(settled).toBe(false);
    socket.pushRaw(`${full.slice(10)}\n`);
    await expect(promise).resolves.toBeTruthy();
    expect(settled).toBe(true);
  });

  it('响应帧分两段 + 单 chunk 携多帧混合边界', async () => {
    const { socket, session } = await ready();
    const requestPromise = session.request<string>('cli.command.resolve', {});
    const frame = socket.frames()[1] as { requestId: string };
    const response = JSON.stringify({ requestId: frame.requestId, ok: true, result: 'partial' });
    socket.pushRaw(response.slice(0, 15));
    await Promise.resolve();
    let resolved = false;
    void requestPromise.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    socket.pushRaw(`${response.slice(15)}\n`);
    await expect(requestPromise).resolves.toBe('partial');
  });
});

describe('连接关闭收口（§5.3/§5.4）', () => {
  it('握手未成即 close → carrier_unavailable', async () => {
    const socket = new FakeCarrierSocket();
    const promise = start(record(), socket);
    socket.emitClose();
    const error = (await promise.catch((e: unknown) => e)) as ChipsError;
    expect(error.details).toMatchObject({ reason: 'carrier_unavailable' });
  });

  it('error 事件独立触发同样收口', async () => {
    const socket = new FakeCarrierSocket();
    const promise = start(record(), socket);
    socket.emitError();
    const error = (await promise.catch((e: unknown) => e)) as ChipsError;
    expect(error.details).toMatchObject({ reason: 'carrier_unavailable' });
  });

  it('就绪后连接中途断 → 在途请求 connection_lost（退出码 6）', async () => {
    const { socket, session } = await ready();
    const requestPromise = session.request('cli.task.create', {});
    socket.emitClose();
    const error = (await requestPromise.catch((e: unknown) => e)) as ChipsError;
    expect(error.details).toMatchObject({ reason: 'connection_lost' });
    expect(exitCodeForError(error)).toBe(6);
  });

  it('会话关闭后再请求 → connection_lost 拒绝', async () => {
    const { session } = await ready();
    session.close();
    const error = (await session
      .request('cli.command.list')
      .catch((e: unknown) => e)) as ChipsError;
    expect(error.details).toMatchObject({ reason: 'connection_lost' });
  });
});

describe('封套业务错误与 R3 透传（§5.1/§5.3）', () => {
  it('ok:false 业务码原样透传（CLI_TASK_NOT_FOUND → 退出码 1）', async () => {
    const { socket, session } = await ready();
    const requestPromise = session.request('cli.task.get', { taskId: 't' });
    const frame = socket.frames()[1] as { requestId: string };
    socket.pushFrame({
      requestId: frame.requestId,
      ok: false,
      error: { code: 'CLI_TASK_NOT_FOUND', message: '任务不存在' },
    });
    const error = (await requestPromise.catch((e: unknown) => e)) as ChipsError;
    expect(error.code).toBe('CLI_TASK_NOT_FOUND');
    expect(exitCodeForError(error)).toBe(1);
  });

  it('R3 内部码 BRIDGE_INTERNAL 照实透传（CLI 未登记 → 缺省 1，不造第二语义）', async () => {
    const { socket, session } = await ready();
    const requestPromise = session.request('command:invoke', { commandId: 'c' });
    const frame = socket.frames()[1] as { requestId: string };
    socket.pushFrame({
      requestId: frame.requestId,
      ok: false,
      error: { code: 'BRIDGE_INTERNAL', message: 'app 臂未就绪' },
    });
    const error = (await requestPromise.catch((e: unknown) => e)) as ChipsError;
    expect(error.code).toBe('BRIDGE_INTERNAL');
    expect(exitCodeForError(error)).toBe(1);
  });

  it('未知 requestId 响应帧被忽略，不影响在途', async () => {
    const { socket, session } = await ready();
    const requestPromise = session.request<string>('cli.command.list');
    socket.pushFrame({ requestId: 'unrelated', ok: true, result: 'ignored' });
    const frame = socket.frames()[1] as { requestId: string };
    socket.pushFrame({ requestId: frame.requestId, ok: true, result: 'kept' });
    await expect(requestPromise).resolves.toBe('kept');
  });
});
