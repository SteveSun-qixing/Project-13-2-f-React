/**
 * PAL Electron 注入面形状校验与启动阶段归因回归测试（任务 #49 hotfix）。
 *
 * @remarks
 * - 覆盖真实 Electron 承载下暴露的 P0 缺陷：`Menu` 等 class 形状模块（静态方法挂在
 *   构造器自身）必须按期望形状如实放行；缺成员 / 成员非可调用 / 原型方法冒充静态等
 *   真非法形状必须继续拒绝（禁止整表放行）。
 * - 覆盖启动失败诊断归因：`PalBootstrapError` 的 `stage` 应为 `pal-host` 而非 `unknown`。
 */

import { describe, expect, it, vi } from 'vitest';

import { startHostMain } from '../src/main/main.js';
import { createHostAssembly } from '../src/main/runtime-provider.js';
import { PalBootstrapError } from '../src/platform/errors.js';
import { createElectronApi } from '../src/platform/electron/electron-api.js';
import { createMacPalHost } from '../src/platform/mac/index.js';
import { HostStartupError } from '../src/shared/errors.js';
import { createMockElectron } from './helpers/electron-mock.js';
import { createFakeElectron } from './helpers/shell-electron.js';
import { createFakePalHost } from './helpers/fake-pal-host.js';
import { createFakeRuntime } from './helpers/fake-runtime.js';

/** 与真实 Electron 一致的 `Menu` class 形状：静态方法挂在构造器自身。 */
class ClassMenu {
  /** 由模板构建菜单。 */
  static buildFromTemplate(template: readonly unknown[]): { items: readonly unknown[] } {
    return { items: [...template] };
  }

  /** 设置应用菜单。 */
  static setApplicationMenu(_menu: unknown): void {
    return undefined;
  }
}

/** 缺少 `setApplicationMenu` 静态成员的 class 形状（真非法）。 */
class ClassMenuMissingStatic {
  /** 由模板构建菜单。 */
  static buildFromTemplate(_template: readonly unknown[]): object {
    return {};
  }
}

/** 静态成员非可调用的 class 形状（真非法）。 */
class ClassMenuBrokenStatic {
  /** `buildFromTemplate` 被替换成字符串（形状被破坏）。 */
  static buildFromTemplate = 'nope';

  /** 设置应用菜单。 */
  static setApplicationMenu(_menu: unknown): void {
    return undefined;
  }
}

/** 方法只挂在实例原型上、静态面缺成员的 class 形状（真非法）。 */
class ClassMenuInstanceOnly {
  /** 实例方法：不属于注入面期望的静态形状。 */
  buildFromTemplate(_template: readonly unknown[]): object {
    return {};
  }

  /** 实例方法：不属于注入面期望的静态形状。 */
  setApplicationMenu(_menu: unknown): void {
    return undefined;
  }
}

describe('createElectronApi：class 形状注入面', () => {
  it('接受 class 形状的 Menu（静态方法挂在构造器上）', () => {
    const mock = createMockElectron();
    const api = createElectronApi({ app: mock.app, Menu: ClassMenu });
    expect(api.Menu).toBe(ClassMenu);
  });

  it('接受函数对象上挂载静态成员的非 class 形状', () => {
    const mock = createMockElectron();
    const fnMenu: Record<string, unknown> = (): void => undefined;
    fnMenu['buildFromTemplate'] = (): object => ({});
    fnMenu['setApplicationMenu'] = (): void => undefined;
    expect(() => createElectronApi({ app: mock.app, Menu: fnMenu })).not.toThrow();
  });

  it('接受 class 形状的 Notification / Tray / BrowserWindow（构造器判定不变）', () => {
    const mock = createMockElectron();
    class NotificationCtor {
      constructor(_options: unknown) {}
    }
    class TrayCtor {
      constructor(_image: unknown) {}
    }
    const api = createElectronApi({
      app: mock.app,
      Notification: NotificationCtor,
      Tray: TrayCtor,
      BrowserWindow: mock.buildApi().BrowserWindow,
    });
    expect(api.Notification).toBeDefined();
    expect(api.Tray).toBeDefined();
    expect(api.BrowserWindow).toBeDefined();
  });

  it('class 形状 Menu 注入后 createMacPalHost 可完整构造（menu 分面可用）', () => {
    const mock = createMockElectron();
    const module: Record<string, unknown> = { ...mock.buildApi(), Menu: ClassMenu };
    const host = createMacPalHost(module, { hostPlatform: 'darwin', arch: 'arm64' });
    expect(host.matrix.menu).toBe(true);
    host.dispose();
  });
});

describe('createElectronApi：真非法形状仍被拒绝', () => {
  it('拒绝缺少静态成员的 class 形状 Menu', () => {
    const mock = createMockElectron();
    expect(() => createElectronApi({ app: mock.app, Menu: ClassMenuMissingStatic })).toThrow(/Menu/);
  });

  it('拒绝静态成员非可调用的 class 形状 Menu', () => {
    const mock = createMockElectron();
    expect(() => createElectronApi({ app: mock.app, Menu: ClassMenuBrokenStatic })).toThrow(/Menu/);
  });

  it('拒绝方法只在实例原型上、静态面缺成员的 class 形状 Menu', () => {
    const mock = createMockElectron();
    expect(() => createElectronApi({ app: mock.app, Menu: ClassMenuInstanceOnly })).toThrow(/Menu/);
  });

  it('拒绝对象与函数宿主之外的形状（数组 / null / 原始值）', () => {
    const mock = createMockElectron();
    expect(() => createElectronApi({ app: mock.app, Menu: ['buildFromTemplate', 'setApplicationMenu'] })).toThrow(
      /Menu/,
    );
    expect(() => createElectronApi({ app: mock.app, Menu: null })).toThrow(/Menu/);
    expect(() => createElectronApi({ app: mock.app, dialog: 'nope' })).toThrow(/dialog/);
    expect(() => createElectronApi({ app: mock.app, clipboard: 42 })).toThrow(/clipboard/);
  });

  it('非法模块整体（非对象）仍被拒绝', () => {
    expect(() => createElectronApi(null)).toThrow(PalBootstrapError);
    expect(() => createElectronApi('electron')).toThrow(PalBootstrapError);
    expect(() => createElectronApi(ClassMenu)).toThrow(PalBootstrapError);
  });
});

describe('startHostMain：启动失败阶段归因', () => {
  /** 启动一个 `createPalHost` 抛出指定错误的场景，返回诊断与退出码记录。 */
  async function startFailingScenario(throwError: () => never): Promise<{
    fake: ReturnType<typeof createFakeElectron>;
    errorCall: [scope: string, message: string, details?: Readonly<Record<string, unknown>>];
  }> {
    const diagnostics = { warn: vi.fn(), error: vi.fn() };
    const fake = createFakeElectron();
    const promise = startHostMain({
      electronModule: fake.module,
      assembly: createHostAssembly({
        createPalHost: throwError,
        createRuntime: () => createFakeRuntime().runtime,
      }),
      preloadPath: '/p.js',
      platformRoot: '/r',
      diagnostics,
    });
    await Promise.resolve();
    fake.app.resolveReady();
    await expect(promise).rejects.toThrow(Error);
    expect(diagnostics.error).toHaveBeenCalledTimes(1);
    return { fake, errorCall: diagnostics.error.mock.calls[0] as [string, string, Record<string, unknown>?] };
  }

  it('PalBootstrapError 归因为 pal-host 阶段', async () => {
    const { fake, errorCall } = await startFailingScenario(() => {
      throw new PalBootstrapError('注入的 Electron 模块形状非法：Menu');
    });
    expect(errorCall[0]).toBe('startup');
    expect(errorCall[2]).toEqual({ stage: 'pal-host' });
    expect(fake.app.exitCodes).toEqual([1]);
  });

  it('HostStartupError 保持自带阶段', async () => {
    const { errorCall } = await startFailingScenario(() => {
      throw new HostStartupError('HOST_STARTUP_FAILED', 'window', '窗口阶段失败（测试注入）');
    });
    expect(errorCall[2]).toEqual({ stage: 'window' });
  });

  it('未识别异常仍归为 unknown', async () => {
    const { errorCall } = await startFailingScenario(() => {
      throw new Error('未识别异常（测试注入）');
    });
    expect(errorCall[2]).toEqual({ stage: 'unknown' });
  });

  it('正常装配不误报启动失败诊断', async () => {
    const diagnostics = { warn: vi.fn(), error: vi.fn() };
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
    fake.app.resolveReady();
    const handle = await promise;
    expect(handle).not.toBeNull();
    expect(diagnostics.error).not.toHaveBeenCalled();
  });
});
