import { describe, expect, it } from 'vitest';

import { ShellWindowManager } from '../src/main/window-manager.js';
import { WebContentsBinder } from '../src/main/web-contents-binder.js';
import { WindowBindings } from '../src/main/window-bindings.js';
import { WindowRegistry } from '../src/main/window-registry.js';
import type { DiagnosticsSink } from '../src/shared/diagnostics.js';
import type { IResourceBackend } from '../src/runtime/contracts.js';
import { createFakeElectron } from './helpers/shell-electron.js';
import { createWireError } from './helpers/wire-error.js';
import { createElectronRuntime } from '../src/main/electron-adapter.js';

const backend: IResourceBackend = {
  async read() {
    return Promise.reject(createWireError('RESOURCE_NOT_FOUND', '资源不存在'));
  },
};

const diagnostics: DiagnosticsSink = { warn: () => undefined, error: () => undefined };

function createManager(): {
  manager: ShellWindowManager;
  fake: ReturnType<typeof createFakeElectron>;
  registry: WindowRegistry;
} {
  const fake = createFakeElectron();
  const runtime = createElectronRuntime(fake.module);
  const registry = new WindowRegistry();
  const binder = new WebContentsBinder({
    registry,
    bindings: new WindowBindings(),
    backend,
    diagnostics,
    onClosed: () => undefined,
  });
  const manager = new ShellWindowManager({
    factory: runtime.windowFactory,
    preloadPath: '/app/dist/preload/index.js',
    binder,
    registry,
    diagnostics,
  });
  return { manager, fake, registry };
}

describe('ShellWindowManager', () => {
  it('按安全基线创建窗口、绑定会话并显示', async () => {
    const { manager, fake, registry } = createManager();
    const record = await manager.createWindow({
      title: '薯片 · 壳自检',
      width: 1200,
      height: 800,
      url: 'chips-resource://platform/shell.html',
    });
    const preferences = fake.windows[0]?.options['webPreferences'] as Record<string, unknown>;
    expect(preferences['preload']).toBe('/app/dist/preload/index.js');
    expect(preferences['sandbox']).toBe(true);
    expect(preferences['contextIsolation']).toBe(true);
    expect(preferences['nodeIntegration']).toBe(false);
    expect(registry.isAlive(record.windowId)).toBe(true);
    expect(fake.windows[0]?.shown).toBe(1);
    expect(record.webContents.session.protocol.isProtocolHandled('chips-resource')).toBe(true);
  });

  it('show: false 时不显示窗口', async () => {
    const { manager, fake } = createManager();
    await manager.createWindow({
      title: '隐藏',
      width: 100,
      height: 100,
      url: 'chips-resource://platform/shell.html',
      show: false,
    });
    expect(fake.windows[0]?.shown).toBe(0);
  });

  it('每个窗口获得独立 session partition', async () => {
    const { manager, fake } = createManager();
    await manager.createWindow({ title: 'a', width: 1, height: 1, url: 'chips-resource://platform/a.html' });
    await manager.createWindow({ title: 'b', width: 1, height: 1, url: 'chips-resource://platform/b.html' });
    const partitions = fake.windows.map(
      (window) => (window.options['webPreferences'] as Record<string, unknown>)['partition'],
    );
    expect(new Set(partitions).size).toBe(2);
  });

  it('拒绝非 chips-resource 加载地址', async () => {
    const { manager, fake } = createManager();
    await expect(manager.createWindow({ title: 'x', width: 1, height: 1, url: 'https://example.com' })).rejects.toThrow(
      '壳窗口加载地址非法',
    );
    expect(fake.windows).toHaveLength(0);
  });

  it('加载失败时解绑并销毁窗口', async () => {
    const { manager, fake, registry } = createManager();
    fake.failLoadURL('chips-resource://platform/missing.html');
    await expect(
      manager.createWindow({
        title: 'x',
        width: 1,
        height: 1,
        url: 'chips-resource://platform/missing.html',
      }),
    ).rejects.toThrow('壳窗口加载失败');
    expect(registry.size).toBe(0);
    expect(fake.windows).toHaveLength(1);
    expect(fake.windows[0]?.destroyed).toBe(1);
  });
});
