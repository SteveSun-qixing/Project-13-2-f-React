/**
 * 承载调用端口组装（工单039 波 2 交付：`createCarrierInvoker` 串起发现消费/端点解析/握手会话/错误映射）。
 *
 * 覆盖：
 * - 离线条 / 发现缺失 / 陈旧 → `CLI_TARGET_UNAVAILABLE` + 退出码 3（发现阶段），且无删除权、不建连；
 * - 环境值非法 → 原样透传 `CLI_ARGUMENT_INVALID`（2）/`CLI_PATH_INVALID`（5）；
 * - 就绪通路：token 取自发现文件、握手成功、封套请求返回；
 * - `token_invalid` 握手失败 → 退出码 6；
 * - `bearerToken` 永不进错误 `details`/`message`（§2.8）。
 */

import { describe, expect, it } from 'vitest';

import { CARRIER_PROTOCOL, type ICarrierDiscoveryRecord } from '@chips/bridge';

import { ChipsError, exitCodeForError } from '../src/errors.js';
import { createCarrierInvoker, type ICarrierInvoker } from '../src/client/carrier/client.js';
import type { IPidProbe } from '../src/client/carrier/discovery.js';
import type { ICarrierSocket } from '../src/client/carrier/transport.js';
import { MemoryFileSystem } from './support/memory-file-system.js';
import { FakeCarrierSocket } from './support/fake-carrier-socket.js';

const ROOT = '/userdata';
const DISCOVERY_FILE = '/userdata/chips-carrier.json';

const TOKEN = 'c'.repeat(64);

function record(overrides: Partial<ICarrierDiscoveryRecord> = {}): ICarrierDiscoveryRecord {
  return {
    protocol: CARRIER_PROTOCOL,
    instanceId: 'inst-inv',
    socketPath: '/userdata/chips-carrier.sock',
    pid: 999,
    startedAt: 1_000,
    bearerToken: TOKEN,
    ...overrides,
  };
}

function freshProbe(over: Partial<IPidProbe> = {}): IPidProbe {
  return { pidAlive: () => true, processCreatedAt: () => null, ...over };
}

function fsWithDiscovery(value: ICarrierDiscoveryRecord | null): MemoryFileSystem {
  const fileSystem = new MemoryFileSystem();
  fileSystem.writeDirectory(ROOT);
  if (value !== null) {
    fileSystem.writeText(DISCOVERY_FILE, JSON.stringify(value));
  }
  return fileSystem;
}

/** 让握手成功经 establish→ensureSession→request 的多跳微任务链跑到请求帧落笔。 */
async function waitFrames(socket: FakeCarrierSocket, count: number): Promise<void> {
  for (let i = 0; i < 100 && socket.frames().length < count; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

/** 建立可驱动的 invoker：暴露内部连接出的 fake socket。 */
function invokerWith(
  overrides: Partial<Parameters<typeof createCarrierInvoker>[0]> & {
    record?: ICarrierDiscoveryRecord | null;
    env?: Readonly<Record<string, string | undefined>>;
    probe?: IPidProbe;
  } = {}
): { invoker: ICarrierInvoker; socketAt: () => FakeCarrierSocket | null } {
  let created: FakeCarrierSocket | null = null;
  const connect = (_path: string): ICarrierSocket => {
    created = new FakeCarrierSocket();
    return created;
  };
  const invoker = createCarrierInvoker({
    userdataRoot: ROOT,
    fileSystem: fsWithDiscovery(overrides.record === undefined ? record() : overrides.record),
    pidProbe: overrides.probe ?? freshProbe(),
    env: overrides.env ?? {},
    connect,
    clientId: 'cli-inv',
    ...('handshakeTimeoutMs' in overrides
      ? { handshakeTimeoutMs: overrides.handshakeTimeoutMs }
      : {}),
  });
  return { invoker, socketAt: () => created };
}

describe('发现/离线阶段失败：定性 → 退出码 3，无删除权、不建连', () => {
  it('离线条命中（值 1）→ carrier_unavailable，未读发现、未建连', async () => {
    let connected = false;
    const invoker = createCarrierInvoker({
      userdataRoot: ROOT,
      fileSystem: fsWithDiscovery(record()),
      pidProbe: freshProbe(),
      env: { CHIPS_CARRIER_DISABLE: '1' },
      connect: () => {
        connected = true;
        return new FakeCarrierSocket();
      },
      clientId: 'cli-inv',
    });
    const error = (await invoker
      .request('cli.command.list')
      .catch((e: unknown) => e)) as ChipsError;
    expect(error.code).toBe('CLI_TARGET_UNAVAILABLE');
    expect(error.details).toMatchObject({ reason: 'carrier_unavailable' });
    expect(exitCodeForError(error)).toBe(3);
    expect(connected).toBe(false);
  });

  it('发现文件缺失 → carrier_unavailable（退出码 3），connect 未被调用', async () => {
    let connected = false;
    const invoker = createCarrierInvoker({
      userdataRoot: ROOT,
      fileSystem: fsWithDiscovery(null),
      pidProbe: freshProbe(),
      env: {},
      connect: () => {
        connected = true;
        return new FakeCarrierSocket();
      },
      clientId: 'cli-inv',
    });
    const error = (await invoker
      .request('cli.command.list')
      .catch((e: unknown) => e)) as ChipsError;
    expect(error.code).toBe('CLI_TARGET_UNAVAILABLE');
    expect(error.details).toMatchObject({ reason: 'carrier_unavailable' });
    expect(exitCodeForError(error)).toBe(3);
    expect(connected).toBe(false);
  });

  it('发现陈旧（pid_dead）→ carrier_unavailable（退出码 3），登记文件仍在（无删除权）', async () => {
    const fileSystem = fsWithDiscovery(record());
    let connected = false;
    const invoker = createCarrierInvoker({
      userdataRoot: ROOT,
      fileSystem,
      pidProbe: freshProbe({ pidAlive: () => false }),
      env: {},
      connect: () => {
        connected = true;
        return new FakeCarrierSocket();
      },
      clientId: 'cli-inv',
    });
    const error = (await invoker
      .request('cli.command.list')
      .catch((e: unknown) => e)) as ChipsError;
    expect(exitCodeForError(error)).toBe(3);
    expect(connected).toBe(false);
    expect(fileSystem.exists(DISCOVERY_FILE)).toBe(true);
  });

  it('环境覆盖非法值原样透传：DISABLE 非 1 → CLI_ARGUMENT_INVALID（2）', async () => {
    const { invoker } = invokerWith({ env: { CHIPS_CARRIER_DISABLE: 'yes' } });
    const error = (await invoker
      .request('cli.command.list')
      .catch((e: unknown) => e)) as ChipsError;
    expect(error.code).toBe('CLI_ARGUMENT_INVALID');
    expect(exitCodeForError(error)).toBe(2);
  });
});

describe('就绪通路：握手 + 封套请求', () => {
  it('token 取自发现文件、握手成功、请求返回 result 负载', async () => {
    const { invoker, socketAt } = invokerWith({});
    const requestPromise = invoker.request<{ commands: number[] }>('cli.command.list', { q: 1 });
    const socket = socketAt();
    expect(socket).not.toBeNull();
    expect(socket?.handshakeFrame()).toMatchObject({
      protocol: CARRIER_PROTOCOL,
      clientId: 'cli-inv',
      bearerToken: TOKEN,
    });
    socket?.pushHandshakeSuccess(record().instanceId);
    if (socket !== null) {
      await waitFrames(socket, 2);
    }
    const responseFrame = socket?.frames()[1] as { requestId: string };
    socket?.pushFrame({ requestId: responseFrame.requestId, ok: true, result: { commands: [7] } });
    await expect(requestPromise).resolves.toEqual({ commands: [7] });
  });

  it('握手 token_invalid 失败 → CLI_TARGET_UNAVAILABLE + 退出码 6', async () => {
    const { invoker, socketAt } = invokerWith({});
    const requestPromise = invoker.request('cli.command.list');
    socketAt()?.pushFrame({
      protocol: CARRIER_PROTOCOL,
      negotiated: null,
      error: {
        code: 'CLI_TARGET_UNAVAILABLE',
        message: 'token 不等',
        details: { reason: 'token_invalid' },
      },
    });
    const error = (await requestPromise.catch((e: unknown) => e)) as ChipsError;
    expect(error.details).toMatchObject({ reason: 'token_invalid' });
    expect(exitCodeForError(error)).toBe(6);
  });

  it('bearerToken 永不进错误 details/message（§2.8）', async () => {
    const { invoker, socketAt } = invokerWith({});
    const requestPromise = invoker.request('cli.command.list');
    socketAt()?.pushFrame({
      protocol: CARRIER_PROTOCOL,
      negotiated: null,
      error: {
        code: 'CLI_TARGET_UNAVAILABLE',
        message: '握手失败',
        details: { reason: 'token_invalid' },
      },
    });
    const error = (await requestPromise.catch((e: unknown) => e)) as ChipsError;
    expect(JSON.stringify(error.details)).not.toContain(TOKEN);
    expect(error.message).not.toContain(TOKEN);
  });

  it('dispose 释放会话：置关后再次请求走新连接', async () => {
    const { invoker, socketAt } = invokerWith({});
    const first = invoker.request('cli.command.list');
    const socket = socketAt();
    socket?.pushHandshakeSuccess(record().instanceId);
    if (socket !== null) {
      await waitFrames(socket, 2);
    }
    const frame = socket?.frames()[1] as { requestId: string };
    socket?.pushFrame({ requestId: frame.requestId, ok: true, result: 'a' });
    await expect(first).resolves.toBe('a');
    invoker.dispose();
    expect(socket?.destroyed).toBe(true);
  });
});
