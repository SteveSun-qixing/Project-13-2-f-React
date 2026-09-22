import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_BOOTSTRAP_URL, HostApplication } from '../src/main/application.js';
import { createElectronRuntime } from '../src/main/electron-adapter.js';
import { isHostStartupError } from '../src/shared/errors.js';
import { createFakeElectron, FakeSession, FakeWebContents } from './helpers/shell-electron.js';
import { createFakeRuntime } from './helpers/fake-runtime.js';
import { createFakePalHost, EMPTY_MATRIX } from './helpers/fake-pal-host.js';
import type { IPalHost } from '../src/platform/contracts/index.js';

function createApplication(overrides: { palHost?: IPalHost; runtime?: ReturnType<typeof createFakeRuntime> } = {}): {
  application: HostApplication;
  fake: ReturnType<typeof createFakeElectron>;
  runtime: ReturnType<typeof createFakeRuntime>;
} {
  const fake = createFakeElectron();
  const electron = createElectronRuntime(fake.module);
  const runtime = overrides.runtime ?? createFakeRuntime();
  const application = new HostApplication({
    electron,
    palHost: overrides.palHost ?? createFakePalHost(),
    runtime: runtime.runtime,
    preloadPath: '/app/dist/preload/index.js',
    bootstrapWindow: { title: '薯片 · 壳自检' },
    diagnostics: { warn: vi.fn(), error: vi.fn() },
  });
  return { application, fake, runtime };
}

describe('HostApplication.start', () => {
  it('按顺序完成 PAL 自检 → 核心启动 → IPC → 协议/窗口 → 事件 → 插件恢复', async () => {
    const { application, fake, runtime } = createApplication();
    await application.start();

    expect(application.state).toBe('running');
    expect(runtime.calls.start).toHaveLength(1);
    expect(runtime.calls.start[0]?.host.info.shell).toBe('desktop');
    expect([...fake.ipcMain.handlers.keys()].sort()).toEqual([
      'bridge:request',
      'bridge:resource',
      'card-window-init:request',
      'event:control',
    ]);
    expect(fake.windows).toHaveLength(1);
    expect(fake.windows[0]?.options['title']).toBe('薯片 · 壳自检');
    expect(runtime.calls.forwarded).toBe(1);
    expect(runtime.calls.restorePlugins).toBe(1);
    expect(application.windows.isAlive(fake.windows[0]!.webContents.id)).toBe(true);
  });

  it('使用默认启动页与尺寸', async () => {
    const { application, fake } = createApplication();
    await application.start();
    expect(fake.windows[0]?.options['width']).toBe(1200);
    expect(fake.windows[0]?.options['height']).toBe(800);
    expect(DEFAULT_BOOTSTRAP_URL).toBe('chips-resource://platform/shell.html');
  });

  it('PAL 矩阵与端口不一致时终止启动', async () => {
    const palHost = createFakePalHost({ matrix: { ...EMPTY_MATRIX, window: true } });
    const { application, runtime } = createApplication({ palHost });
    await expect(application.start()).rejects.toSatisfy(
      (error: unknown) => isHostStartupError(error) && error.stage === 'pal-host',
    );
    expect(application.state).toBe('idle');
    expect(runtime.calls.start).toHaveLength(0);
  });

  it('核心启动失败时回滚且不创建窗口', async () => {
    const runtime = createFakeRuntime();
    const failing = {
      ...runtime.runtime,
      start: async (): Promise<void> => Promise.reject(new Error('能力注册校验失败')),
    };
    const fake = createFakeElectron();
    const application = new HostApplication({
      electron: createElectronRuntime(fake.module),
      palHost: createFakePalHost(),
      runtime: failing,
      preloadPath: '/app/dist/preload/index.js',
      diagnostics: { warn: vi.fn(), error: vi.fn() },
    });
    await expect(application.start()).rejects.toSatisfy(
      (error: unknown) => isHostStartupError(error) && error.stage === 'core-start',
    );
    expect(application.state).toBe('idle');
    expect(fake.windows).toHaveLength(0);
  });

  it('重复启动被拒绝', async () => {
    const { application } = createApplication();
    await application.start();
    await expect(application.start()).rejects.toThrow('壳应用无法从当前状态启动');
  });

  it('绑定内核经 PAL 创建的窗口（web-contents-created）', async () => {
    const { application, fake } = createApplication();
    await application.start();
    const contents = new FakeWebContents(999, new FakeSession('pal-window'));
    fake.emitWebContents(contents);
    expect(application.windows.isAlive(999)).toBe(true);
  });
});

describe('HostApplication：权限下行与事件下行', () => {
  it('把权限快照推送到目标窗口', async () => {
    const { application, fake, runtime } = createApplication();
    await application.start();
    const windowId = fake.windows[0]!.webContents.id;
    runtime.pushPermissions(windowId, {
      sessionId: 's1',
      grantedPermissions: ['resources:read'],
      permissionVersion: 3,
    });
    expect(fake.windows[0]?.webContents.sent).toEqual([
      {
        channel: 'session:permissions',
        payload: { sessionId: 's1', grantedPermissions: ['resources:read'], permissionVersion: 3 },
      },
    ]);
  });

  it('事件下行按窗口投递，窗口不存在时静默丢弃', async () => {
    const { application, fake, runtime } = createApplication();
    await application.start();
    const windowId = fake.windows[0]!.webContents.id;
    runtime.calls.sink?.deliver(windowId, { eventId: 'window:closed', payload: { windowId }, emittedAt: 1 });
    runtime.calls.sink?.deliver(123456, { eventId: 'window:closed', payload: {}, emittedAt: 2 });
    expect(fake.windows[0]?.webContents.sent).toEqual([
      { channel: 'event:window:closed', payload: { eventId: 'window:closed', payload: { windowId }, emittedAt: 1 } },
    ]);
  });

  it('窗口销毁通知核心清理会话', async () => {
    const { application, fake, runtime } = createApplication();
    await application.start();
    const windowId = fake.windows[0]!.webContents.id;
    fake.windows[0]!.webContents.destroy();
    expect(runtime.calls.windowClosed).toEqual([windowId]);
  });

  it('启动输入投递失败时不抛出并记诊断', async () => {
    const runtime = createFakeRuntime();
    const failing: typeof runtime.runtime = {
      ...runtime.runtime,
      handleStartupInputs: async (): Promise<void> => Promise.reject(new Error('路由不可用')),
    };
    const fake = createFakeElectron();
    const diagnostics = { warn: vi.fn(), error: vi.fn() };
    const application = new HostApplication({
      electron: createElectronRuntime(fake.module),
      palHost: createFakePalHost(),
      runtime: failing,
      preloadPath: '/p.js',
      diagnostics,
    });
    await application.start();
    await application.dispatchStartupInputs([{ kind: 'open-path', path: '/tmp/a.card' }]);
    expect(diagnostics.error).toHaveBeenCalledOnce();
  });

  it('启动输入为空时跳过', async () => {
    const { application, runtime } = createApplication();
    await application.start();
    await application.dispatchStartupInputs([]);
    expect(runtime.calls.startupInputs).toEqual([]);
  });
});

describe('HostApplication.ensureBootstrapWindow', () => {
  it('已有窗口时不重建', async () => {
    const { application } = createApplication();
    await application.start();
    await expect(application.ensureBootstrapWindow()).resolves.toBeNull();
  });

  it('窗口全部关闭后重建', async () => {
    const { application, fake } = createApplication();
    await application.start();
    fake.windows[0]!.webContents.destroy();
    expect(application.windows.size).toBe(0);
    const created = await application.ensureBootstrapWindow();
    expect(created).not.toBeNull();
    expect(fake.windows).toHaveLength(2);
  });

  it('未运行时返回 null', async () => {
    const { application } = createApplication();
    await expect(application.ensureBootstrapWindow()).resolves.toBeNull();
  });
});

describe('HostApplication.shutdown', () => {
  it('逆序收口并释放 PAL 资源', async () => {
    const calls: string[] = [];
    const palHost = createFakePalHost({
      dispose: (): void => {
        calls.push('pal-dispose');
      },
    });
    const runtime = createFakeRuntime();
    const tracked: typeof runtime.runtime = {
      ...runtime.runtime,
      stopPlugins: async (): Promise<void> => {
        calls.push('stop-plugins');
        await runtime.runtime.stopPlugins();
      },
      shutdown: async (): Promise<void> => {
        calls.push('core-shutdown');
        await runtime.runtime.shutdown();
      },
    };
    const fake = createFakeElectron();
    const application = new HostApplication({
      electron: createElectronRuntime(fake.module),
      palHost,
      runtime: tracked,
      preloadPath: '/p.js',
      diagnostics: { warn: vi.fn(), error: vi.fn() },
    });
    await application.start();
    await application.shutdown();
    expect(calls).toEqual(['stop-plugins', 'core-shutdown', 'pal-dispose']);
    expect(runtime.calls.detached).toBe(1);
    // 任务 #200 收口口径：装载投递通道不注销、置旗拒载常驻（其余 `ipc` 段通道照常逆序注销，
    // 在册键集恰为装载投递一条——精确键集断言，非空集放宽）。
    expect([...fake.ipcMain.handlers.keys()]).toEqual(['card-window-init:request']);
    expect(application.state).toBe('stopped');
    expect(application.windows.size).toBe(0);
    await application.shutdown();
    expect(runtime.calls.shutdown).toBe(1);
  });

  it('未启动时 shutdown 为空操作', async () => {
    const { application, runtime } = createApplication();
    await application.shutdown();
    expect(runtime.calls.shutdown).toBe(0);
    expect(application.state).toBe('idle');
  });
});
