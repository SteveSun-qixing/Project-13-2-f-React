import { describe, expect, it, vi } from 'vitest';

import { startHostMain } from '../src/main/main.js';
import { createHostAssembly } from '../src/main/runtime-provider.js';
import { createFakeElectron } from './helpers/shell-electron.js';
import { createFakeRuntime } from './helpers/fake-runtime.js';
import { createFakePalHost } from './helpers/fake-pal-host.js';
import type { IPlatformRuntime } from '../src/runtime/contracts.js';

const diagnostics = { warn: vi.fn(), error: vi.fn() };

interface Scenario {
  readonly fake: ReturnType<typeof createFakeElectron>;
  readonly fakeRuntime: ReturnType<typeof createFakeRuntime>;
  readonly handle: Awaited<ReturnType<typeof startHostMain>>;
}

async function startScenario(options: { runtime?: IPlatformRuntime; resolveReady?: boolean } = {}): Promise<Scenario> {
  const fake = createFakeElectron();
  const fakeRuntime = createFakeRuntime();
  const promise = startHostMain({
    electronModule: fake.module,
    assembly: createHostAssembly({
      createPalHost: () => createFakePalHost(),
      createRuntime: () => options.runtime ?? fakeRuntime.runtime,
    }),
    preloadPath: '/app/dist/preload/index.js',
    platformRoot: '/app/dist/renderer',
    diagnostics,
  });
  await Promise.resolve();
  if (options.resolveReady !== false) {
    fake.app.resolveReady();
  }
  const handle = await promise;
  return { fake, fakeRuntime, handle };
}

describe('startHostMain', () => {
  it('未取得单实例锁时立即退出返回 null', async () => {
    const fake = createFakeElectron();
    fake.app.lockGranted = false;
    const fakeRuntime = createFakeRuntime();
    const handle = await startHostMain({
      electronModule: fake.module,
      assembly: createHostAssembly({
        createPalHost: () => createFakePalHost(),
        createRuntime: () => fakeRuntime.runtime,
      }),
      preloadPath: '/p.js',
      platformRoot: '/r',
      diagnostics,
    });
    expect(handle).toBeNull();
    expect(fake.app.quitCalls).toBe(1);
    expect(fakeRuntime.calls.start).toHaveLength(0);
  });

  it('取得单实例锁后启动完整壳并暴露句柄', async () => {
    const { fake, fakeRuntime, handle } = await startScenario();
    expect(handle).not.toBeNull();
    expect(handle?.application.state).toBe('running');
    expect(fake.windows).toHaveLength(1);
    expect(fakeRuntime.calls.restorePlugins).toBe(1);
    expect(fake.protocol.schemes).toHaveLength(1);
  });

  it('第二实例参数排队并在平台就绪后投递', async () => {
    const { fake, fakeRuntime } = await startScenario();
    fake.emitSecondInstance(['/work/a.card']);
    await Promise.resolve();
    expect(fakeRuntime.calls.startupInputs).toEqual([[{ kind: 'open-path', path: '/work/a.card' }]]);
  });

  it('启动完成前到达的第二实例参数在就绪后补投', async () => {
    const fake = createFakeElectron();
    const fakeRuntime = createFakeRuntime();
    const promise = startHostMain({
      electronModule: fake.module,
      assembly: createHostAssembly({
        createPalHost: () => createFakePalHost(),
        createRuntime: () => fakeRuntime.runtime,
      }),
      preloadPath: '/p.js',
      platformRoot: '/r',
      diagnostics,
    });
    await Promise.resolve();
    fake.emitSecondInstance(['/work/early.card']);
    fake.app.resolveReady();
    await promise;
    await Promise.resolve();
    expect(fakeRuntime.calls.startupInputs).toEqual([[{ kind: 'open-path', path: '/work/early.card' }]]);
  });

  it('open-file 事件排队投递', async () => {
    const { fake, fakeRuntime } = await startScenario();
    fake.emitOpenFile('/work/b.card');
    await Promise.resolve();
    expect(fakeRuntime.calls.startupInputs).toEqual([[{ kind: 'open-path', path: '/work/b.card' }]]);
  });

  it('before-quit 阻止默认退出并完成逆序收口', async () => {
    const { fake, fakeRuntime } = await startScenario();
    expect(fake.emitBeforeQuit()).toBe(true);
    await vi.waitFor(() => {
      expect(fake.app.exitCodes).toEqual([0]);
    });
    expect(fakeRuntime.calls.stopPlugins).toBe(1);
    expect(fakeRuntime.calls.shutdown).toBe(1);
    expect(fake.emitBeforeQuit()).toBe(false);
  });

  it('activate 时无窗口则重建启动窗口', async () => {
    const { fake, handle } = await startScenario();
    fake.windows[0]!.webContents.destroy();
    expect(handle?.application.windows.size).toBe(0);
    fake.emitActivate();
    await vi.waitFor(() => {
      expect(fake.windows).toHaveLength(2);
    });
  });

  it('window-all-closed 在 macOS 不退出、其他平台退出', async () => {
    const { fake, fakeRuntime } = await startScenario();
    fake.emitWindowAllClosed();
    await Promise.resolve();
    if (process.platform === 'darwin') {
      expect(fakeRuntime.calls.shutdown).toBe(0);
    } else {
      await vi.waitFor(() => {
        expect(fakeRuntime.calls.shutdown).toBe(1);
      });
    }
  });

  it('运行时装配失败时退出码为 1 并抛出', async () => {
    const fake = createFakeElectron();
    const promise = startHostMain({
      electronModule: fake.module,
      assembly: createHostAssembly({
        createPalHost: () => createFakePalHost(),
        createRuntime: () => {
          throw new Error('核心未装配');
        },
      }),
      preloadPath: '/p.js',
      platformRoot: '/r',
      diagnostics,
    });
    await Promise.resolve();
    fake.app.resolveReady();
    await expect(promise).rejects.toThrow('核心未装配');
    expect(fake.app.exitCodes).toEqual([1]);
  });
});
