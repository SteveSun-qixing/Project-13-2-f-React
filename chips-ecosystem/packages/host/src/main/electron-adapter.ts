/**
 * 真实 Electron 模块到壳内部结构切片的适配器。
 *
 * 权威：`ADR-002` §进程模型 / §IPC 通信 / §窗口管理 / §现状注记、
 * `17-跨端Shell与平台抽象设计` §3.3 SB-8、`05-渲染引擎设计` §3.1。
 *
 * @remarks
 * - 壳内部模块只依赖 `shell-api.ts` 的结构契约；本模块是唯一把真实 Electron 模块适配为
 *   结构切片的位置，测试注入替身即可覆盖全部壳逻辑。
 * - 适配器在构造期校验模块形状：缺失必备模块或方法时抛出 {@link HostStartupError}，
 *   启动失败快速暴露（不静默降级）。
 * - 第二实例参数已剥离可执行文件参数（首项）；`open-file` 事件原样传递路径。
 */

import { HostStartupError } from '../shared/errors.js';
import type {
  ShellAppEvent,
  ShellCustomScheme,
  ShellElectronApp,
  ShellElectronProtocol,
  ShellIpcInvokeEvent,
  ShellIpcMain,
  ShellPathName,
  ShellSecondInstanceEvent,
  ShellSession,
  ShellSessionProtocol,
  ShellWebContents,
  ShellWindow,
  ShellWindowFactory,
  ShellWindowOptions,
} from './shell-api.js';

/** 壳使用的 Electron 运行时切片集合。 */
export interface ShellElectronRuntime {
  /** `app` 模块切片。 */
  readonly app: ShellElectronApp;
  /** 全局 `protocol` 模块切片（`registerSchemesAsPrivileged`）。 */
  readonly protocol: ShellElectronProtocol;
  /** `ipcMain` 切片。 */
  readonly ipcMain: ShellIpcMain;
  /** `BrowserWindow` 工厂切片。 */
  readonly windowFactory: ShellWindowFactory;
}

/** 判断值是否为普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 读取对象上的函数属性；不存在时返回 `null`。 */
function readFunction(target: Record<string, unknown>, key: string): ((...args: unknown[]) => unknown) | null {
  const value = target[key];
  return typeof value === 'function' ? (value as (...args: unknown[]) => unknown) : null;
}

/** 判断方法名在对象上的实际形态：可调用 / 显式存在但非法 / 完全缺失。 */
function inspectMethod(target: Record<string, unknown>, key: string): 'callable' | 'present' | 'absent' {
  if (!(key in target)) {
    return 'absent';
  }
  return readFunction(target, key) === null ? 'present' : 'callable';
}

/** 要求对象存在并具备指定方法；缺失时抛出启动错误。 */
function requireTarget(module: unknown, moduleName: string, methods: readonly string[]): Record<string, unknown> {
  if (!isRecord(module)) {
    throw new HostStartupError('HOST_STARTUP_FAILED', 'pal-host', `Electron 模块缺失或形状非法：${moduleName}`);
  }
  // 诊断优先级：显式存在但不可调用的方法（真实形状被破坏）先于完全缺失的方法命名，
  // 避免替身对象丢失原型方法时把所有缺失方法归为同一个错误。
  const absent: string[] = [];
  for (const method of methods) {
    const shape = inspectMethod(module, method);
    if (shape === 'callable') {
      continue;
    }
    if (shape === 'present') {
      throw new HostStartupError('HOST_STARTUP_FAILED', 'pal-host', `Electron ${moduleName} 缺少方法：${method}`);
    }
    absent.push(method);
  }
  if (absent.length > 0) {
    throw new HostStartupError(
      'HOST_STARTUP_FAILED',
      'pal-host',
      `Electron ${moduleName} 缺少方法：${absent.join('、')}`,
    );
  }
  return module;
}

/** 读取指定方法；缺失时抛出启动错误。 */
function requireFunction(
  target: Record<string, unknown>,
  method: string,
  moduleName: string,
  stage: 'pal-host' | 'window' | 'ipc' = 'pal-host',
): (...args: unknown[]) => unknown {
  const fn = readFunction(target, method);
  if (fn === null) {
    throw new HostStartupError('HOST_STARTUP_FAILED', stage, `Electron ${moduleName} 缺少方法：${method}`);
  }
  return fn;
}

/** 适配后的 session 包装；同一原始 session 返回同一包装（身份稳定）。 */
const sessionWrappers = new WeakMap<object, ShellSession>();
let sessionCounter = 0;

/** 适配 session 级协议注册表。 */
function adaptSessionProtocol(raw: unknown): ShellSessionProtocol {
  const protocol = requireTarget(raw, 'session.protocol', ['handle', 'unhandle', 'isProtocolHandled']);
  const handle = requireFunction(protocol, 'handle', 'session.protocol');
  const unhandle = requireFunction(protocol, 'unhandle', 'session.protocol');
  const isProtocolHandled = requireFunction(protocol, 'isProtocolHandled', 'session.protocol');
  return {
    handle(scheme: string, handler: (request: Request) => Response | Promise<Response>): void {
      handle.call(protocol, scheme, handler);
    },
    unhandle(scheme: string): void {
      unhandle.call(protocol, scheme);
    },
    isProtocolHandled(scheme: string): boolean {
      return Boolean(isProtocolHandled.call(protocol, scheme));
    },
  };
}

/** 适配 Electron `Session`。 */
function adaptSession(raw: unknown): ShellSession {
  if (!isRecord(raw)) {
    throw new HostStartupError('HOST_STARTUP_FAILED', 'pal-host', 'Electron session 形状非法');
  }
  const cached = sessionWrappers.get(raw);
  if (cached !== undefined) {
    return cached;
  }
  const key = raw['key'];
  const session: ShellSession = {
    key: typeof key === 'string' && key.length > 0 ? key : `session-${sessionCounter++}`,
    protocol: adaptSessionProtocol(raw['protocol']),
  };
  sessionWrappers.set(raw, session);
  return session;
}

/** 适配 Electron `WebContents`。 */
function adaptWebContents(raw: unknown): ShellWebContents {
  if (!isRecord(raw)) {
    throw new HostStartupError('HOST_STARTUP_FAILED', 'pal-host', 'Electron webContents 形状非法');
  }
  const id = raw['id'];
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    throw new HostStartupError('HOST_STARTUP_FAILED', 'pal-host', 'Electron webContents 缺少整数 id');
  }
  const send = readFunction(raw, 'send');
  const close = readFunction(raw, 'close');
  const isDestroyed = readFunction(raw, 'isDestroyed');
  const on = readFunction(raw, 'on');
  const getType = readFunction(raw, 'getType');
  return {
    id,
    session: adaptSession(raw['session']),
    isDestroyed(): boolean {
      return isDestroyed === null ? false : Boolean(isDestroyed.call(raw));
    },
    send(channel: string, payload: unknown): void {
      if (send === null) {
        throw new HostStartupError('HOST_STARTUP_FAILED', 'ipc', 'Electron webContents 缺少 send 方法');
      }
      send.call(raw, channel, payload);
    },
    close(): void {
      if (close === null) {
        throw new HostStartupError('HOST_STARTUP_FAILED', 'window', 'Electron webContents 缺少 close 方法');
      }
      close.call(raw);
    },
    onDestroyed(listener: () => void): void {
      if (on === null) {
        return;
      }
      on.call(raw, 'destroyed', listener);
    },
    ...(getType !== null
      ? {
          getType(): string {
            return String(getType.call(raw));
          },
        }
      : {}),
  };
}

/** 适配 Electron `BrowserWindow` 实例。 */
function adaptWindow(raw: unknown, windowId: number, webContents: ShellWebContents): ShellWindow {
  if (!isRecord(raw)) {
    throw new HostStartupError('HOST_STARTUP_FAILED', 'window', 'Electron BrowserWindow 形状非法');
  }
  const loadURL = readFunction(raw, 'loadURL');
  const close = readFunction(raw, 'close');
  const destroy = readFunction(raw, 'destroy');
  const isDestroyed = readFunction(raw, 'isDestroyed');
  const show = readFunction(raw, 'show');
  const setTitle = readFunction(raw, 'setTitle');
  return {
    windowId,
    webContents,
    async loadURL(url: string): Promise<void> {
      if (loadURL === null) {
        throw new HostStartupError('HOST_STARTUP_FAILED', 'window', 'Electron BrowserWindow 缺少 loadURL 方法');
      }
      await Promise.resolve(loadURL.call(raw, url));
    },
    close(): void {
      if (close !== null) {
        close.call(raw);
      }
    },
    destroy(): void {
      if (destroy !== null) {
        destroy.call(raw);
      }
    },
    isDestroyed(): boolean {
      return isDestroyed === null ? false : Boolean(isDestroyed.call(raw));
    },
    show(): void {
      if (show !== null) {
        show.call(raw);
      }
    },
    setTitle(title: string): void {
      if (setTitle !== null) {
        setTitle.call(raw, title);
      }
    },
  };
}

/** 适配 `BrowserWindow` 工厂。 */
function adaptWindowFactory(raw: unknown): ShellWindowFactory {
  if (typeof raw !== 'function') {
    throw new HostStartupError('HOST_STARTUP_FAILED', 'pal-host', 'Electron BrowserWindow 构造器缺失');
  }
  const ctor = raw as new (options: Readonly<Record<string, unknown>>) => { webContents: unknown };
  return {
    createBrowserWindow(options: ShellWindowOptions): ShellWindow {
      let instance: { webContents: unknown };
      try {
        instance = new ctor(options as unknown as Readonly<Record<string, unknown>>);
      } catch (error) {
        throw new HostStartupError('HOST_STARTUP_FAILED', 'window', '窗口创建失败', { cause: error });
      }
      const webContents = adaptWebContents(instance.webContents);
      return adaptWindow(instance, webContents.id, webContents);
    },
  };
}

/**
 * 把注入的 Electron 模块适配为壳运行时切片。
 *
 * @param module `require('electron')` 返回值或测试替身。
 * @throws {HostStartupError} `app` / `protocol` / `ipcMain` / `BrowserWindow` 缺失或形状非法时抛出。
 */
export function createElectronRuntime(module: unknown): ShellElectronRuntime {
  if (!isRecord(module)) {
    throw new HostStartupError('HOST_STARTUP_FAILED', 'pal-host', '注入的 Electron 模块无效：不是对象');
  }
  const appRaw = requireTarget(module['app'], 'app', [
    'whenReady',
    'on',
    'requestSingleInstanceLock',
    'quit',
    'exit',
    'getVersion',
    'getName',
    'getLocale',
    'getPath',
  ]);
  const protocolRaw = requireTarget(module['protocol'], 'protocol', ['registerSchemesAsPrivileged']);
  const ipcMainRaw = requireTarget(module['ipcMain'], 'ipcMain', ['handle', 'removeHandler']);
  const windowCtor = module['BrowserWindow'];

  const appOn = requireFunction(appRaw, 'on', 'app');

  const app: ShellElectronApp = {
    whenReady(): Promise<void> {
      return Promise.resolve(requireFunction(appRaw, 'whenReady', 'app').call(appRaw)).then(() => undefined);
    },
    onSecondInstance(listener: (event: ShellSecondInstanceEvent, argv: readonly string[]) => void): void {
      appOn.call(appRaw, 'second-instance', (event: ShellSecondInstanceEvent, argv: string[]) => {
        listener(event, argv.slice(1));
      });
    },
    onOpenFile(listener: (event: ShellAppEvent, path: string) => void): void {
      appOn.call(appRaw, 'open-file', listener);
    },
    onBeforeQuit(listener: (event: ShellAppEvent) => void): void {
      appOn.call(appRaw, 'before-quit', listener);
    },
    onWindowAllClosed(listener: () => void): void {
      appOn.call(appRaw, 'window-all-closed', listener);
    },
    onActivate(listener: () => void): void {
      appOn.call(appRaw, 'activate', listener);
    },
    onWebContentsCreated(listener: (webContents: ShellWebContents) => void): void {
      appOn.call(appRaw, 'web-contents-created', (_event: unknown, webContents: unknown) => {
        listener(adaptWebContents(webContents));
      });
    },
    requestSingleInstanceLock(): boolean {
      return Boolean(requireFunction(appRaw, 'requestSingleInstanceLock', 'app').call(appRaw));
    },
    quit(): void {
      requireFunction(appRaw, 'quit', 'app').call(appRaw);
    },
    exit(code: number): void {
      requireFunction(appRaw, 'exit', 'app').call(appRaw, code);
    },
    getVersion(): string {
      return String(requireFunction(appRaw, 'getVersion', 'app').call(appRaw));
    },
    getName(): string {
      return String(requireFunction(appRaw, 'getName', 'app').call(appRaw));
    },
    getLocale(): string {
      return String(requireFunction(appRaw, 'getLocale', 'app').call(appRaw));
    },
    getPath(name: ShellPathName): string {
      return String(requireFunction(appRaw, 'getPath', 'app').call(appRaw, name));
    },
  };

  const protocol: ShellElectronProtocol = {
    registerSchemesAsPrivileged(schemes: readonly ShellCustomScheme[]): void {
      requireFunction(protocolRaw, 'registerSchemesAsPrivileged', 'protocol').call(protocolRaw, schemes);
    },
  };

  const ipcMain: ShellIpcMain = {
    handle(channel: string, listener: (event: ShellIpcInvokeEvent, ...args: readonly unknown[]) => unknown): void {
      requireFunction(ipcMainRaw, 'handle', 'ipcMain').call(ipcMainRaw, channel, listener);
    },
    removeHandler(channel: string): void {
      requireFunction(ipcMainRaw, 'removeHandler', 'ipcMain').call(ipcMainRaw, channel);
    },
  };

  return { app, protocol, ipcMain, windowFactory: adaptWindowFactory(windowCtor) };
}
