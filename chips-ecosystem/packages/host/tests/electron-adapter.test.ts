import { describe, expect, it, vi } from 'vitest';

import { createElectronRuntime } from '../src/main/electron-adapter.js';
import { HostStartupError } from '../src/shared/errors.js';
import { createFakeElectron, FakeSession } from './helpers/shell-electron.js';

describe('createElectronRuntime：形状校验', () => {
  it('拒绝非对象与缺少必备模块的注入', () => {
    expect(() => createElectronRuntime(null)).toThrow(HostStartupError);
    expect(() => createElectronRuntime({})).toThrow('Electron 模块缺失或形状非法：app');
    const fake = createFakeElectron();
    const withoutApp = { ...fake.module, app: undefined };
    expect(() => createElectronRuntime(withoutApp)).toThrow('Electron 模块缺失或形状非法：app');
    const { BrowserWindow: _browserWindow, ...withoutWindow } = fake.module;
    expect(() => createElectronRuntime(withoutWindow)).toThrow('Electron BrowserWindow 构造器缺失');
  });

  it('缺失 app 方法时给出方法名', () => {
    const fake = createFakeElectron();
    const app = { ...fake.app, getVersion: undefined };
    expect(() => createElectronRuntime({ ...fake.module, app })).toThrow('Electron app 缺少方法：getVersion');
  });
});

describe('createElectronRuntime：app 适配', () => {
  it('第二实例参数剥离可执行文件首项', () => {
    const fake = createFakeElectron();
    const runtime = createElectronRuntime(fake.module);
    const listener = vi.fn();
    runtime.app.onSecondInstance(listener);
    fake.emitSecondInstance(['/work/a.card']);
    expect(listener).toHaveBeenCalledWith(expect.anything(), ['/work/a.card']);
  });

  it('转发 open-file / before-quit / window-all-closed / activate / web-contents-created', () => {
    const fake = createFakeElectron();
    const runtime = createElectronRuntime(fake.module);
    const openFile = vi.fn();
    const beforeQuit = vi.fn();
    const allClosed = vi.fn();
    const activate = vi.fn();
    const contents = vi.fn();
    runtime.app.onOpenFile(openFile);
    runtime.app.onBeforeQuit(beforeQuit);
    runtime.app.onWindowAllClosed(allClosed);
    runtime.app.onActivate(activate);
    runtime.app.onWebContentsCreated(contents);

    fake.emitOpenFile('/work/a.card');
    expect(openFile).toHaveBeenCalledWith(expect.anything(), '/work/a.card');
    fake.emitBeforeQuit();
    expect(beforeQuit).toHaveBeenCalledOnce();
    fake.emitWindowAllClosed();
    expect(allClosed).toHaveBeenCalledOnce();
    fake.emitActivate();
    expect(activate).toHaveBeenCalledOnce();

    const fakeContents = { id: 12, session: new FakeSession('s'), isDestroyed: () => false } as never;
    fake.emitWebContents(fakeContents);
    expect(contents).toHaveBeenCalledOnce();
    expect(contents.mock.calls[0]?.[0]).toMatchObject({ id: 12 });
  });

  it('适配单实例锁、退出与应用信息', () => {
    const fake = createFakeElectron();
    const runtime = createElectronRuntime(fake.module);
    expect(runtime.app.requestSingleInstanceLock()).toBe(true);
    expect(fake.app.lockRequested).toBe(1);
    fake.app.lockGranted = false;
    expect(runtime.app.requestSingleInstanceLock()).toBe(false);
    runtime.app.quit();
    expect(fake.app.quitCalls).toBe(1);
    runtime.app.exit(3);
    expect(fake.app.exitCodes).toEqual([3]);
    expect(runtime.app.getVersion()).toBe('0.1.0');
    expect(runtime.app.getName()).toBe('薯片');
    expect(runtime.app.getLocale()).toBe('zh-CN');
    expect(runtime.app.getPath('userData')).toContain('Chips');
  });

  it('适配全局协议特权注册', () => {
    const fake = createFakeElectron();
    const runtime = createElectronRuntime(fake.module);
    runtime.protocol.registerSchemesAsPrivileged([{ scheme: 'chips-resource', privileges: { secure: true } }]);
    expect(fake.protocol.schemes).toHaveLength(1);
  });
});

describe('createElectronRuntime：窗口工厂', () => {
  it('创建窗口并暴露 webContents.id 作为 windowId', async () => {
    const fake = createFakeElectron();
    const runtime = createElectronRuntime(fake.module);
    const window = runtime.windowFactory.createBrowserWindow({
      title: '测试',
      width: 800,
      height: 600,
      resizable: true,
      show: false,
      webPreferences: { sandbox: true, partition: 'p1' },
    });
    expect(window.windowId).toBe(fake.windows[0]?.webContents.id);
    expect(window.webContents.session.protocol.isProtocolHandled('x')).toBe(false);
    await window.loadURL('chips-resource://platform/shell.html');
    expect(fake.windows[0]?.options['title']).toBe('测试');
    window.show();
    window.setTitle('新标题');
    expect(fake.windows[0]?.shown).toBe(1);
    expect(fake.windows[0]?.title).toBe('新标题');
    expect(window.isDestroyed()).toBe(false);
    window.close();
    expect(fake.windows[0]?.closed).toBe(1);
    window.destroy();
    expect(fake.windows[0]?.destroyed).toBe(1);
    expect(window.isDestroyed()).toBe(true);
  });

  it('同一原始 session 返回稳定包装', () => {
    const fake = createFakeElectron();
    const runtime = createElectronRuntime(fake.module);
    const first = runtime.windowFactory.createBrowserWindow({
      title: 'a',
      width: 1,
      height: 1,
      resizable: false,
      show: false,
      webPreferences: { partition: 'same' },
    });
    const second = runtime.windowFactory.createBrowserWindow({
      title: 'b',
      width: 1,
      height: 1,
      resizable: false,
      show: false,
      webPreferences: { partition: 'same' },
    });
    expect(first.webContents.session).toBe(second.webContents.session);
    expect(first.webContents.session.key).toBe('same');
    const other = runtime.windowFactory.createBrowserWindow({
      title: 'c',
      width: 1,
      height: 1,
      resizable: false,
      show: false,
      webPreferences: { partition: 'other' },
    });
    expect(other.webContents.session).not.toBe(first.webContents.session);
  });

  it('窗口创建失败归一为启动错误', () => {
    const fake = createFakeElectron();
    class ThrowingWindow {
      constructor() {
        throw new Error('窗口系统不可用');
      }
    }
    const runtime = createElectronRuntime({ ...fake.module, BrowserWindow: ThrowingWindow });
    expect(() =>
      runtime.windowFactory.createBrowserWindow({
        title: 'x',
        width: 1,
        height: 1,
        resizable: false,
        show: false,
        webPreferences: { partition: 'p' },
      }),
    ).toThrow('窗口创建失败');
  });
});
