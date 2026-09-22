/**
 * 按需启动锁测（工单039 波 3，《17-CLI承载链路契约》§5.2，立项评估 Q6 裁定采 (c)）：
 *
 * - §5.2-2 固定布局解析：锚点 = CLI 入口 realpath 目录，向上至多 6 级；darwin
 *   `<D>/Contents/MacOS/Chips`、win32 `<D>\Chips.exe`、linux `<D>/Chips`；非可执行候选跳过；
 * - §5.2 触发闸：仅发现阶段失败（缺失/陈旧/连接失败收口 `carrier_unavailable`）进拉起链；
 *   离线条、`CHIPS_CARRIER_SOCKET` 覆盖态、`protocol_mismatch`、`token_invalid` 不拉起；
 * - §5.2-1 解析不出 → 原定性透错（无承载回退）；spawn 失败同定性收口；
 * - §5.2-4 就绪轮询预算 = 30s（`LIFECYCLE_APPLY_TIMEOUT_MS`），超时 → `CLI_TIMEOUT`（9）；
 * - 常量锁：预算字面量与既有启动等待常量同源。
 */

import { describe, expect, it } from 'vitest';

import { CARRIER_PROTOCOL, type ICarrierDiscoveryRecord } from '@chips/bridge';

import { ChipsError, exitCodeForError } from '../src/errors.js';
import { LIFECYCLE_APPLY_TIMEOUT_MS } from '../src/constants.js';
import { createCarrierInvoker, type ICarrierInvoker } from '../src/client/carrier/client.js';
import {
  HOST_BIN_UPWARD_LEVELS,
  HOST_LAUNCH_READY_BUDGET_MS,
  HOST_LAUNCH_READY_POLL_MS,
  resolveHostExecutable,
} from '../src/client/carrier/launch.js';
import type { IPidProbe } from '../src/client/carrier/discovery.js';
import type { ICarrierSocket } from '../src/client/carrier/transport.js';
import { MemoryFileSystem } from './support/memory-file-system.js';
import { FakeCarrierSocket } from './support/fake-carrier-socket.js';

const ROOT = '/userdata';
const DISCOVERY_FILE = '/userdata/chips-carrier.json';
const TOKEN = 'a'.repeat(64);

function record(overrides: Partial<ICarrierDiscoveryRecord> = {}): ICarrierDiscoveryRecord {
  return {
    protocol: CARRIER_PROTOCOL,
    instanceId: 'inst-launch',
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

function emptyFs(): MemoryFileSystem {
  const fileSystem = new MemoryFileSystem();
  fileSystem.writeDirectory(ROOT);
  return fileSystem;
}

function fsWithDiscovery(value: ICarrierDiscoveryRecord): MemoryFileSystem {
  const fileSystem = emptyFs();
  fileSystem.writeText(DISCOVERY_FILE, JSON.stringify(value));
  return fileSystem;
}

/** 微任务/定时器驱动等待。 */
async function tick(times = 20): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

describe('§5.2-2 固定布局解析：候选、层级上限与可执行判据', () => {
  it('darwin：锚点向上第 4 级命中 Contents/MacOS/Chips（发行 bundle 布局）', () => {
    // 锚点 /bundle/Chips.app/Contents/Helpers/bin/dist（realpath 目录本身为第 0 级）。
    const anchor = '/bundle/Chips.app/Contents/Helpers/bin/dist';
    const hit = '/bundle/Chips.app/Contents/MacOS/Chips';
    const found = resolveHostExecutable({
      cliEntryFile: `${anchor}/bin.js`,
      platform: 'darwin',
      isExecutableFile: (file) => file === hit,
      realpath: (file) => file,
    });
    expect(found).toBe(hit);
  });

  it('win32：候选 <D>\\Chips.exe，向上探测命中', () => {
    const hit = 'C:\\apps\\Chips.exe';
    const found = resolveHostExecutable({
      cliEntryFile: 'C:\\apps\\resources\\cli\\dist\\bin.js',
      platform: 'win32',
      isExecutableFile: (file) => file === hit,
      realpath: (file) => file,
    });
    expect(found).toBe(hit);
  });

  it('linux：锚点同级 <D>/Chips（第 0 级）即命中', () => {
    const found = resolveHostExecutable({
      cliEntryFile: '/opt/chips/bin/dist/bin.js',
      platform: 'linux',
      isExecutableFile: (file) => file === '/opt/chips/bin/dist/Chips',
      realpath: (file) => file,
    });
    expect(found).toBe('/opt/chips/bin/dist/Chips');
  });

  it('超出 6 级上限的候选不命中（禁漂移条款），常量锁 = 6', () => {
    expect(HOST_BIN_UPWARD_LEVELS).toBe(6);
    // 锚点第 0 级起 7 层之上的文件：任何层级探测都不应命中。
    const found = resolveHostExecutable({
      cliEntryFile: '/a/b/c/d/e/f/g/Chips-dist/bin.js',
      platform: 'linux',
      isExecutableFile: (file) => file === '/a/Chips', // 第 6 级父目录再向上的第 7 级
      realpath: (file) => file,
    });
    expect(found).toBeNull();
    // 恰好在第 6 级（锚点 /a/b/c/d/e/f/g/h → level0=h,1=g,2=f,3=e,4=d,5=c,6=b）→ /a/b/Chips 命中。
    const atLimit = resolveHostExecutable({
      cliEntryFile: '/a/b/c/d/e/f/g/h/bin.js',
      platform: 'linux',
      isExecutableFile: (file) => file === '/a/b/Chips',
      realpath: (file) => file,
    });
    expect(atLimit).toBe('/a/b/Chips');
  });

  it('候选存在但不可执行（X_OK 探针拒）→ 继续向上；全落空返回 null', () => {
    const seen: string[] = [];
    const found = resolveHostExecutable({
      cliEntryFile: '/app/dist/bin.js',
      platform: 'linux',
      isExecutableFile: (file) => {
        seen.push(file);
        return false;
      },
      realpath: (file) => file,
    });
    expect(found).toBeNull();
    // 锚点 + 向上各级都被探测过（POSIX 根止）。
    expect(seen).toContain('/app/dist/Chips');
    expect(seen).toContain('/app/Chips');
    expect(seen).toContain('/Chips');
  });

  it('realpath 抛错（入口文件不存在）→ null，不猜测安装位置', () => {
    const found = resolveHostExecutable({
      cliEntryFile: '/nowhere/bin.js',
      platform: 'linux',
      isExecutableFile: () => true,
      realpath: () => {
        throw new Error('ENOENT');
      },
    });
    expect(found).toBeNull();
  });
});

describe('§5.2 常量同源', () => {
  it('就绪预算 = LIFECYCLE_APPLY_TIMEOUT_MS（30s 既有启动等待常量）', () => {
    expect(HOST_LAUNCH_READY_BUDGET_MS).toBe(LIFECYCLE_APPLY_TIMEOUT_MS);
    expect(HOST_LAUNCH_READY_BUDGET_MS).toBe(30_000);
    expect(HOST_LAUNCH_READY_POLL_MS).toBeGreaterThan(0);
  });
});

/** 拉起链组装：记录调用次数的 launch 配置 + 可驱动 fake socket。 */
function launchHarness(input: {
  fileSystem: MemoryFileSystem;
  env?: Readonly<Record<string, string | undefined>>;
  probe?: IPidProbe;
  resolveResult?: string | null;
  spawnImpl?: (executable: string) => void;
  readyBudgetMs?: number;
  now?: () => number;
}): {
  invoker: ICarrierInvoker;
  calls: { resolve: number; spawn: string[] };
  sockets: FakeCarrierSocket[];
  lastSocket: () => FakeCarrierSocket | null;
} {
  const calls = { resolve: 0, spawn: [] as string[] };
  const sockets: FakeCarrierSocket[] = [];
  const invoker = createCarrierInvoker({
    userdataRoot: ROOT,
    fileSystem: input.fileSystem,
    pidProbe: input.probe ?? freshProbe(),
    env: input.env ?? {},
    connect: () => {
      const socket = new FakeCarrierSocket();
      sockets.push(socket);
      return socket;
    },
    clientId: 'cli-launch',
    launch: {
      resolveHostExecutable: () => {
        calls.resolve += 1;
        return input.resolveResult === undefined
          ? '/apps/Chips.app/Contents/MacOS/Chips'
          : input.resolveResult;
      },
      spawnHost:
        input.spawnImpl ??
        ((executable: string): void => {
          calls.spawn.push(executable);
        }),
      ...(input.readyBudgetMs === undefined ? {} : { readyBudgetMs: input.readyBudgetMs }),
      ...(input.now === undefined ? {} : { now: input.now }),
      sleep: async () => {
        await Promise.resolve();
      },
    },
  });
  return {
    invoker,
    calls,
    sockets,
    lastSocket: () => (sockets.length === 0 ? null : (sockets[sockets.length - 1] ?? null)),
  };
}

describe('§5.2 拉起触发闸：覆盖态与定性面不拉起', () => {
  it('离线条（DISABLE=1）→ 不拉起，定性 carrier_unavailable（3）', async () => {
    const h = launchHarness({
      fileSystem: fsWithDiscovery(record()),
      env: { CHIPS_CARRIER_DISABLE: '1' },
    });
    const error = (await h.invoker
      .request('cli.command.list')
      .catch((e: unknown) => e)) as ChipsError;
    expect(error.code).toBe('CLI_TARGET_UNAVAILABLE');
    expect(error.details).toMatchObject({ reason: 'carrier_unavailable' });
    expect(exitCodeForError(error)).toBe(3);
    expect(h.calls.resolve).toBe(0);
    expect(h.calls.spawn).toEqual([]);
  });

  it('SOCKET 覆盖态发现失败 → 不拉起（§2.6/§5.2 覆盖态跳过拉起）', async () => {
    const h = launchHarness({
      fileSystem: emptyFs(),
      env: { CHIPS_CARRIER_SOCKET: '/userdata/override.sock' },
    });
    const error = (await h.invoker
      .request('cli.command.list')
      .catch((e: unknown) => e)) as ChipsError;
    expect(exitCodeForError(error)).toBe(3);
    expect(h.calls.resolve).toBe(0);
  });

  it('protocol_mismatch（发现文件协议不匹配）→ 不拉起（§5.2 触发清单外）', async () => {
    const h = launchHarness({ fileSystem: fsWithDiscovery(record({ protocol: 'other/9' })) });
    const error = (await h.invoker
      .request('cli.command.list')
      .catch((e: unknown) => e)) as ChipsError;
    expect(error.details).toMatchObject({ reason: 'protocol_mismatch' });
    expect(exitCodeForError(error)).toBe(3);
    expect(h.calls.resolve).toBe(0);
  });

  it('未配置 launch（波 2 组装面）发现失败 → 原定性透错（3），行为不变', async () => {
    let connected = false;
    const invoker = createCarrierInvoker({
      userdataRoot: ROOT,
      fileSystem: emptyFs(),
      pidProbe: freshProbe(),
      env: {},
      connect: (): ICarrierSocket => {
        connected = true;
        return new FakeCarrierSocket();
      },
      clientId: 'cli-launch',
    });
    const error = (await invoker
      .request('cli.command.list')
      .catch((e: unknown) => e)) as ChipsError;
    expect(exitCodeForError(error)).toBe(3);
    expect(connected).toBe(false);
  });
});

describe('§5.2 拉起链：解析、spawn、就绪轮询与收口', () => {
  it('发现缺失 → 解析成功 → detached 拉起 → 就绪轮询握手成功 → 请求返回', async () => {
    const fileSystem = emptyFs();
    const h = launchHarness({
      fileSystem,
      spawnImpl: (executable) => {
        h.calls.spawn.push(executable);
        // 宿主拉起后写出发现文件（就绪信号）。
        fileSystem.writeText(DISCOVERY_FILE, JSON.stringify(record()));
      },
    });
    const pending = h.invoker.request<unknown>('cli.command.list', {});
    await tick();
    const socket = h.lastSocket();
    expect(h.calls.spawn).toEqual(['/apps/Chips.app/Contents/MacOS/Chips']);
    expect(socket).not.toBeNull();
    socket?.pushHandshakeSuccess('inst-launch');
    await tick();
    const frames = socket?.frames() ?? [];
    expect(frames[1]).toMatchObject({ capabilityId: 'cli.command.list' });
    const requestId = (frames[1] as { requestId: string }).requestId;
    socket?.pushFrame({ requestId, ok: true, result: { index: {}, commands: [] } });
    await expect(pending).resolves.toEqual({ index: {}, commands: [] });
  });

  it('解析不出 → 原定性透错（carrier_unavailable/3），不 spawn', async () => {
    const h = launchHarness({ fileSystem: emptyFs(), resolveResult: null });
    const error = (await h.invoker
      .request('cli.command.list')
      .catch((e: unknown) => e)) as ChipsError;
    expect(error.details).toMatchObject({ reason: 'carrier_unavailable' });
    expect(exitCodeForError(error)).toBe(3);
    expect(h.calls.resolve).toBe(1);
    expect(h.calls.spawn).toEqual([]);
  });

  it('spawn 抛错（进程表拒绝）→ 与解析不出同定性收口（3）', async () => {
    const h = launchHarness({
      fileSystem: emptyFs(),
      spawnImpl: () => {
        throw new Error('EACCES');
      },
    });
    const error = (await h.invoker
      .request('cli.command.list')
      .catch((e: unknown) => e)) as ChipsError;
    expect(exitCodeForError(error)).toBe(3);
    expect(h.calls.resolve).toBe(1);
  });

  it('就绪后 token_invalid → 如实收口（6）不再重试', async () => {
    const fileSystem = emptyFs();
    const h = launchHarness({
      fileSystem,
      spawnImpl: (executable) => {
        h.calls.spawn.push(executable);
        fileSystem.writeText(
          DISCOVERY_FILE,
          JSON.stringify(record({ bearerToken: 'b'.repeat(64) }))
        );
      },
    });
    const pending = h.invoker.request<unknown>('cli.command.list', {});
    await tick();
    const socket = h.lastSocket();
    socket?.pushFrame({
      protocol: CARRIER_PROTOCOL,
      negotiated: null,
      error: {
        code: 'CLI_TARGET_UNAVAILABLE',
        message: 'token 校验失败',
        details: { reason: 'token_invalid' },
        retryable: false,
      },
    });
    const error = (await pending.catch((e: unknown) => e)) as ChipsError;
    expect(error.details).toMatchObject({ reason: 'token_invalid' });
    expect(exitCodeForError(error)).toBe(6);
    // 恰一次建连（拉起后首次就绪探测），无重试风暴。
    expect(h.sockets.length).toBe(1);
  });

  it('就绪轮询超预算 → CLI_TIMEOUT（9），预算入 details', async () => {
    const clock = [0, 60_000];
    const h = launchHarness({
      fileSystem: emptyFs(),
      readyBudgetMs: 30_000,
      now: () => clock.shift() ?? 120_000,
    });
    const error = (await h.invoker
      .request('cli.command.list')
      .catch((e: unknown) => e)) as ChipsError;
    expect(error.code).toBe('CLI_TIMEOUT');
    expect(error.details).toMatchObject({ budgetMs: 30_000, path: DISCOVERY_FILE });
    expect(exitCodeForError(error)).toBe(9);
    expect(h.calls.spawn).toEqual(['/apps/Chips.app/Contents/MacOS/Chips']);
  });

  it('发现陈旧（pid_dead）→ 拉起触发（同发现阶段失败臂）', async () => {
    const h = launchHarness({
      fileSystem: fsWithDiscovery(record()),
      probe: freshProbe({ pidAlive: () => false }),
      resolveResult: null,
    });
    const error = (await h.invoker
      .request('cli.command.list')
      .catch((e: unknown) => e)) as ChipsError;
    expect(exitCodeForError(error)).toBe(3);
    // 陈旧属触发清单：解析被调用（解析不出后原定性回退）。
    expect(h.calls.resolve).toBe(1);
  });
});
