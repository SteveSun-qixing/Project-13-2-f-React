/**
 * 生产装配与 §5.5 devHost 并轨锁测（工单039 波 3）。
 *
 * 覆盖：
 * - 《17》§2.2 跨平台 `userData` 布局唯一实现点 `resolveDefaultUserdataRoot`
 *   （darwin/linux(XDG)/win32(APPDATA) 三平台 + 必需环境根缺失 → `null` 无承载定性）；
 * - `createProductionClient` 装配链：根解析入参、发现消费路径、dispose 会话收口、
 *   根解析不出回退 `createLocalClient` 静态无承载定性；
 * - §5.5/Q8(a) `devHost` 并轨臂：经同一在册传输端口触达、无第二套 dev 端点；
 *   装载投递面（R3）未装配如实收口 6，严格环境面（5/2）与拉起预算面（9）原样透传。
 */

import { describe, expect, it } from 'vitest';

import { CARRIER_PROTOCOL, type ICarrierDiscoveryRecord } from '@chips/bridge';

import { ChipsError, cliError, exitCodeForError } from '../src/errors.js';
import { createLocalClient } from '../src/runtime/local-client.js';
import { createProductionClient } from '../src/runtime/production-client.js';
import { HOST_PRODUCT_NAME, resolveDefaultUserdataRoot } from '../src/client/carrier/userdata.js';
import { createCarrierInvoker } from '../src/client/carrier/client.js';
import { createServiceRouterClient } from '../src/client/service-router.js';
import type { ICliDevHostOperations, ICliInvoker } from '../src/client/types.js';
import { MemoryFileSystem } from './support/memory-file-system.js';
import { FakeCarrierSocket } from './support/fake-carrier-socket.js';

const TOKEN = 'd'.repeat(64);

function record(instanceId: string): ICarrierDiscoveryRecord {
  return {
    protocol: CARRIER_PROTOCOL,
    instanceId,
    socketPath: '/home/t/.config/Chips/chips-carrier.sock',
    pid: 999,
    startedAt: 1_000,
    bearerToken: TOKEN,
  };
}

describe('§2.2 userData 布局唯一实现：resolveDefaultUserdataRoot', () => {
  it('darwin：$HOME/Library/Application Support/Chips', () => {
    expect(
      resolveDefaultUserdataRoot('darwin', { HOME: '/Users/tester', XDG_CONFIG_HOME: '/ignored' })
    ).toBe('/Users/tester/Library/Application Support/Chips');
  });

  it('linux：XDG_CONFIG_HOME 优先', () => {
    expect(
      resolveDefaultUserdataRoot('linux', { HOME: '/home/t', XDG_CONFIG_HOME: '/xdg/cfg' })
    ).toBe(`/xdg/cfg/${HOST_PRODUCT_NAME}`);
  });

  it('linux：XDG 未设置回落 ~/.config', () => {
    expect(resolveDefaultUserdataRoot('linux', { HOME: '/home/t' })).toBe('/home/t/.config/Chips');
  });

  it('win32：%APPDATA%\\Chips；APPDATA 缺失 → null（不伪造根）', () => {
    expect(resolveDefaultUserdataRoot('win32', { APPDATA: 'C:\\Users\\t\\AppData\\Roaming' })).toBe(
      'C:\\Users\\t\\AppData\\Roaming\\Chips'
    );
    expect(resolveDefaultUserdataRoot('win32', {})).toBeNull();
  });

  it('空串环境值按未设置处理（POSIX HOME 缺失走 os.homedir 兜底）', () => {
    const resolved = resolveDefaultUserdataRoot('linux', { HOME: '', XDG_CONFIG_HOME: '' });
    expect(resolved).not.toBeNull();
    expect(resolved?.endsWith('/.config/Chips')).toBe(true);
  });
});

describe('createProductionClient 装配链', () => {
  it('userdataRoot 显式注入：发现文件读取路径 = bridge 派生落点，握手后经会话返回', async () => {
    const root = '/Users/tester/Library/Application Support/Chips';
    const discoveryFile = `${root}/chips-carrier.json`;
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeDirectory(root);
    fileSystem.writeText(
      discoveryFile,
      JSON.stringify({
        ...record('inst-prod'),
        socketPath: `${root}/chips-carrier.sock`,
      })
    );
    let connectedPath: string | null = null;
    const sockets: FakeCarrierSocket[] = [];
    const client = createProductionClient({
      userdataRoot: root,
      env: {},
      fileSystem,
      pidProbe: { pidAlive: () => true, processCreatedAt: () => null },
      connect: (socketPath) => {
        connectedPath = socketPath;
        const socket = new FakeCarrierSocket();
        sockets.push(socket);
        return socket;
      },
      launch: { resolveHostExecutable: () => null, spawnHost: () => undefined },
    });
    const pending = client.cliCommand.list();
    for (let i = 0; i < 50 && sockets.length === 0; i += 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
    expect(connectedPath).toBe(`${root}/chips-carrier.sock`);
    const socket = sockets[0];
    if (socket === undefined) {
      throw new Error('未建连');
    }
    socket.pushHandshakeSuccess('inst-prod');
    for (let i = 0; i < 50 && socket.frames().length < 2; i += 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
    const requestFrame = socket.frames()[1] as { requestId: string; capabilityId: string };
    expect(requestFrame.capabilityId).toBe('cli.command.list');
    socket.pushFrame({
      requestId: requestFrame.requestId,
      ok: true,
      result: { index: { demo: ['e1'] }, commands: [] },
    });
    await expect(pending).resolves.toEqual({ index: { demo: ['e1'] }, commands: [] });
    // bin 生命周期：dispose 收口会话 socket，不留悬挂连接。
    void client.dispose?.();
    expect(socket.destroyed).toBe(true);
  });

  it('env 驱动的根解析：HOME 覆盖进入 §2.2 派生（挂账①装配路径）', async () => {
    const home = '/home/w166';
    const root = `${home}/.config/${HOST_PRODUCT_NAME}`;
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeDirectory(root);
    let read = false;
    const trackingFs = new Proxy(fileSystem, {
      get(target, prop, receiver): unknown {
        if (prop === 'exists') {
          return (file: string): boolean => {
            if (file === `${root}/chips-carrier.json`) {
              read = true;
            }
            return target.exists(file);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const client = createProductionClient({
      hostPlatform: 'linux',
      env: { HOME: home },
      fileSystem: trackingFs,
      pidProbe: { pidAlive: () => true, processCreatedAt: () => null },
      connect: () => new FakeCarrierSocket(),
      launch: { resolveHostExecutable: () => null, spawnHost: () => undefined },
    });
    const error = (await client.cliCommand.list().catch((e: unknown) => e)) as ChipsError;
    expect(read).toBe(true);
    expect(error.code).toBe('CLI_TARGET_UNAVAILABLE');
    expect(error.details).toMatchObject({ reason: 'carrier_unavailable' });
    expect(exitCodeForError(error)).toBe(3);
  });

  it('根解析不出（win32 无 APPDATA）→ 回退 createLocalClient 静态无承载定性', async () => {
    const fallback = createLocalClient();
    const client = createProductionClient({
      hostPlatform: 'win32',
      env: {},
      fileSystem: new MemoryFileSystem(),
    });
    const error = (await client.cliCommand.list().catch((e: unknown) => e)) as ChipsError;
    expect(error.code).toBe('CLI_TARGET_UNAVAILABLE');
    expect(error.details).toMatchObject({ route: 'cli.command.list' });
    expect(client.dispose).toBeUndefined();
    expect(await fallback.cliCommand.get({ entryId: 'x' }).catch(() => 'rejected')).toBe(
      'rejected'
    );
  });
});

/** §5.5 并轨臂：以受控 invoker 驱动 devHost 缺省臂（无适配器注入位）。 */
function devHostWith(invoker: ICliInvoker): ICliDevHostOperations {
  return createServiceRouterClient({ invoker }).devHost;
}

describe('§5.5/Q8(a) devHost 并轨臂（dev 宿主 = 同一 carrier 协议实例）', () => {
  it('探针触达在册路由 cli.command.list：装载投递面未就绪 → 6（R3 如实挂账，不临时投递凑绿）', async () => {
    const seen: string[] = [];
    const invoker: ICliInvoker = {
      request<T>(id: string): Promise<T> {
        seen.push(id);
        return Promise.resolve({ index: {}, commands: [] } as unknown as T);
      },
    };
    const error = (await devHostWith(invoker)
      .runPlugin({ dir: '/dev-app', workspace: '/ws' })
      .catch((e: unknown) => e)) as ChipsError;
    expect(seen).toEqual(['cli.command.list']);
    expect(error.code).toBe('CLI_TARGET_UNAVAILABLE');
    expect(error.details).toMatchObject({ method: 'devHost.runPlugin', dir: '/dev-app' });
    expect(exitCodeForError(error)).toBe(6);
  });

  it('发现阶段失败（carrier_unavailable，旁表 3）→ 并轨臂收口 6（07.04 §4.2 承载不可用定性）', async () => {
    const invoker: ICliInvoker = {
      request: (): Promise<never> =>
        Promise.reject(
          cliError('CLI_TARGET_UNAVAILABLE', '承载不可用', { reason: 'carrier_unavailable' })
        ),
    };
    const error = (await devHostWith(invoker)
      .runPlugin({ dir: '/dev-app', workspace: '/ws' })
      .catch((e: unknown) => e)) as ChipsError;
    expect(error.code).toBe('CLI_TARGET_UNAVAILABLE');
    expect(exitCodeForError(error)).toBe(6);
  });

  it('严格环境面 CLI_PATH_INVALID（5）与拉起预算面 CLI_TIMEOUT（9）原样透传', async () => {
    const pathError = cliError('CLI_PATH_INVALID', '路径非法');
    const timeoutError = cliError('CLI_TIMEOUT', '超预算');
    const cases: readonly [ChipsError, number][] = [
      [pathError, 5],
      [timeoutError, 9],
    ];
    for (const [cause, expected] of cases) {
      const invoker: ICliInvoker = { request: (): Promise<never> => Promise.reject(cause) };
      const error = (await devHostWith(invoker)
        .runPlugin({ dir: '/dev-app', workspace: '/ws' })
        .catch((e: unknown) => e)) as ChipsError;
      expect(error.code).toBe(cause.code);
      expect(exitCodeForError(error)).toBe(expected);
    }
  });

  it('显式 devHost 适配器注入优先（并轨不夺嵌入面）', async () => {
    const invoker: ICliInvoker = {
      request: (): Promise<never> => Promise.reject(new Error('不该触达')),
    };
    const client = createServiceRouterClient({
      invoker,
      devHost: {
        runPlugin: (input): Promise<unknown> => Promise.resolve({ ok: true, dir: input.dir }),
      },
    });
    await expect(client.devHost.runPlugin({ dir: '/x', workspace: '/ws' })).resolves.toEqual({
      ok: true,
      dir: '/x',
    });
  });

  it('carrier invoker 组装位：DISABLE 离线条下 devHost 同为 6（并轨面同一条实现）', async () => {
    const fileSystem = new MemoryFileSystem();
    const invoker = createCarrierInvoker({
      userdataRoot: '/Users/u/Library/Application Support/Chips',
      env: { CHIPS_CARRIER_DISABLE: '1' },
      fileSystem,
      pidProbe: { pidAlive: () => true, processCreatedAt: () => null },
      connect: () => new FakeCarrierSocket(),
    });
    const client = createServiceRouterClient({ invoker });
    const error = (await client.devHost
      .runPlugin({ dir: '/dev-app', workspace: '/ws' })
      .catch((e: unknown) => e)) as ChipsError;
    expect(error.code).toBe('CLI_TARGET_UNAVAILABLE');
    expect(exitCodeForError(error)).toBe(6);
  });
});
