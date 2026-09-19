/**
 * 壳测试用 Electron 替身（仅测试代码）。
 *
 * @remarks
 * 覆盖 `electron-adapter` 与主进程编排实际使用的模块切片：`app` / `protocol` / `ipcMain` /
 * `BrowserWindow`；事件用最小发射器模拟 Electron 行为。
 */

import type { ShellIpcInvokeEvent } from '../../src/main/shell-api.js';

interface Listener {
  (...args: unknown[]): void;
}

/** 最小事件发射器。 */
export class FakeEmitter {
  private readonly listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener): this {
    let set = this.listeners.get(event);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event === undefined) {
      this.listeners.clear();
    } else {
      this.listeners.delete(event);
    }
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (set === undefined) {
      return;
    }
    for (const listener of [...set]) {
      listener(...args);
    }
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

/** 伪造 session 级协议注册表。 */
export class FakeSessionProtocol {
  readonly handled = new Map<string, (request: Request) => Response | Promise<Response>>();
  readonly privileges: string[] = [];

  handle(scheme: string, handler: (request: Request) => Response | Promise<Response>): void {
    if (this.handled.has(scheme)) {
      throw new Error(`协议处理器重复注册：${scheme}`);
    }
    this.handled.set(scheme, handler);
    this.privileges.push(scheme);
  }

  unhandle(scheme: string): void {
    this.handled.delete(scheme);
  }

  isProtocolHandled(scheme: string): boolean {
    return this.handled.has(scheme);
  }

  count(): number {
    return this.handled.size;
  }
}

/** 伪造 Electron Session。 */
export class FakeSession {
  readonly protocol = new FakeSessionProtocol();

  constructor(readonly key: string) {}
}

/** 伪造 webContents。 */
export class FakeWebContents extends FakeEmitter {
  readonly id: number;
  readonly sessionValue: FakeSession;
  type = 'window';
  sent: Array<{ channel: string; payload: unknown }> = [];
  destroyed = false;
  closeCalls = 0;

  constructor(id: number, session: FakeSession) {
    super();
    this.id = id;
    this.sessionValue = session;
  }

  get session(): FakeSession {
    return this.sessionValue;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  send(channel: string, payload: unknown): void {
    if (this.destroyed) {
      throw new Error('webContents 已销毁');
    }
    this.sent.push({ channel, payload });
  }

  onDestroyed(listener: () => void): void {
    this.on('destroyed', listener);
  }

  close(): void {
    this.closeCalls += 1;
    this.destroy();
  }

  getType(): string {
    return this.type;
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.emit('destroyed');
  }
}

/** 伪造 BrowserWindow。 */
export class FakeBrowserWindow extends FakeEmitter {
  readonly options: Readonly<Record<string, unknown>>;
  readonly webContentsValue: FakeWebContents;
  title = '';
  shown = 0;
  closed = 0;
  destroyed = 0;
  loadURL: (url: string) => Promise<void> = () => Promise.resolve();

  constructor(id: number, session: FakeSession, options: Readonly<Record<string, unknown>>) {
    super();
    this.options = options;
    this.webContentsValue = new FakeWebContents(id, session);
  }

  get webContents(): FakeWebContents {
    return this.webContentsValue;
  }

  isDestroyed(): boolean {
    return this.webContentsValue.destroyed;
  }

  show(): void {
    this.shown += 1;
  }

  setTitle(title: string): void {
    this.title = title;
  }

  close(): void {
    this.closed += 1;
  }

  destroy(): void {
    this.destroyed += 1;
    this.webContentsValue.destroy();
    this.emit('closed');
  }
}

/** 伪造 `ipcMain`。 */
export class FakeIpcMain {
  readonly handlers = new Map<string, (event: ShellIpcInvokeEvent, ...args: readonly unknown[]) => unknown>();

  handle(channel: string, listener: (event: ShellIpcInvokeEvent, ...args: readonly unknown[]) => unknown): void {
    this.handlers.set(channel, listener);
  }

  removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  /** 模拟渲染进程 `invoke`。 */
  async invoke(
    channel: string,
    event: { sender: { id: number }; senderFrame: { routingId: number } | null },
    ...args: readonly unknown[]
  ): Promise<unknown> {
    const handler = this.handlers.get(channel);
    if (handler === undefined) {
      throw new Error(`通道未注册：${channel}`);
    }
    return Promise.resolve(handler(event, ...args));
  }
}

/** 伪造 `app`。 */
export class FakeApp extends FakeEmitter {
  lockGranted = true;
  lockRequested = 0;
  quitCalls = 0;
  exitCodes: number[] = [];
  readyResolvers: Array<() => void> = [];
  paths = new Map<string, string>([
    ['home', '/Users/tester'],
    ['userData', '/Users/tester/Library/Application Support/Chips'],
    ['temp', '/tmp'],
    ['documents', '/Users/tester/Documents'],
    ['downloads', '/Users/tester/Downloads'],
    ['desktop', '/Users/tester/Desktop'],
    ['appData', '/Users/tester/Library/Application Support'],
    ['exe', '/Applications/Chips.app/Contents/MacOS/Chips'],
  ]);

  whenReady(): Promise<void> {
    return new Promise((resolve) => {
      this.readyResolvers.push(resolve);
    });
  }

  resolveReady(): void {
    for (const resolve of this.readyResolvers.splice(0, this.readyResolvers.length)) {
      resolve();
    }
  }

  requestSingleInstanceLock(): boolean {
    this.lockRequested += 1;
    return this.lockGranted;
  }

  quit(): void {
    this.quitCalls += 1;
    this.emit('quit');
  }

  exit(code: number): void {
    this.exitCodes.push(code);
  }

  getVersion(): string {
    return '0.1.0';
  }

  getName(): string {
    return '薯片';
  }

  getLocale(): string {
    return 'zh-CN';
  }

  getPath(name: string): string {
    const path = this.paths.get(name);
    if (path === undefined) {
      throw new Error(`未定义的目录名：${name}`);
    }
    return path;
  }
}

/** 伪造 Electron 模块。 */
export interface FakeElectronModule {
  readonly module: Record<string, unknown>;
  readonly app: FakeApp;
  readonly protocol: { registerSchemesAsPrivileged(schemes: readonly unknown[]): void; schemes: readonly unknown[][] };
  readonly ipcMain: FakeIpcMain;
  readonly windows: FakeBrowserWindow[];
  /** 触发 `web-contents-created`。 */
  emitWebContents(webContents: FakeWebContents): void;
  /** 触发 `second-instance`。 */
  emitSecondInstance(argv: readonly string[]): void;
  /** 触发 `open-file`。 */
  emitOpenFile(path: string): void;
  /** 触发 `window-all-closed`。 */
  emitWindowAllClosed(): void;
  /** 触发 `activate`。 */
  emitActivate(): void;
  /** 触发 `before-quit`（返回 preventDefault 是否被调用）。 */
  emitBeforeQuit(): boolean;
  /** 让指定地址的 `loadURL` 失败。 */
  failLoadURL(url: string): void;
}

/** 构造 Electron 模块替身。 */
export function createFakeElectron(): FakeElectronModule {
  const app = new FakeApp();
  const ipcMain = new FakeIpcMain();
  const windows: FakeBrowserWindow[] = [];
  const registered: unknown[][] = [];
  const protocol = {
    registerSchemesAsPrivileged(schemes: readonly unknown[]): void {
      registered.push([...schemes]);
    },
    schemes: registered,
  };

  let nextWindowId = 100;
  let sessionSequence = 0;
  const sessions = new Map<string, FakeSession>();
  const failLoadUrls = new Set<string>();
  class BrowserWindow extends FakeBrowserWindow {
    constructor(options: Readonly<Record<string, unknown>>) {
      const webPreferences = options['webPreferences'] as Record<string, unknown> | undefined;
      const declaredPartition = webPreferences?.['partition'];
      const partition = typeof declaredPartition === 'string' ? declaredPartition : `session-${sessionSequence++}`;
      let session = sessions.get(partition);
      if (session === undefined) {
        session = new FakeSession(partition);
        sessions.set(partition, session);
      }
      super(nextWindowId++, session, options);
      this.loadURL = (url: string) =>
        failLoadUrls.has(url) ? Promise.reject(new Error(`加载失败：${url}`)) : Promise.resolve();
      windows.push(this);
    }

    static getAllWindows(): readonly FakeBrowserWindow[] {
      return windows;
    }
  }

  const fake: FakeElectronModule = {
    module: { app, protocol, ipcMain, BrowserWindow },
    app,
    protocol,
    ipcMain,
    windows,
    emitWebContents(webContents: FakeWebContents): void {
      app.emit('web-contents-created', {}, webContents);
    },
    emitSecondInstance(argv: readonly string[]): void {
      app.emit('second-instance', {}, ['/Applications/Chips.app/Contents/MacOS/Chips', ...argv], '/tmp');
    },
    emitOpenFile(path: string): void {
      app.emit('open-file', {}, path);
    },
    emitWindowAllClosed(): void {
      app.emit('window-all-closed');
    },
    emitActivate(): void {
      app.emit('activate');
    },
    emitBeforeQuit(): boolean {
      let prevented = false;
      app.emit('before-quit', {
        preventDefault(): void {
          prevented = true;
        },
      });
      return prevented;
    },
    failLoadURL(url: string): void {
      failLoadUrls.add(url);
    },
  };
  return fake;
}
