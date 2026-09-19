import { PalBootstrapError } from '../errors.js';

/**
 * 可注入的 Electron API 结构契约。
 *
 * @remarks
 * - PAL 只依赖本文件的结构切片；真实 Electron 模块由壳入口注入，测试注入 mock。
 * - 结构契约与 Electron 40 类型定义对齐（ADR-002 §现状注记）；不使用 `electron` 包类型，
 *   以保证在纯 Node 测试环境中无 Electron 运行时也能编译与执行。
 */

/** Electron `app.getPath` 接受的目录名（与 Electron 40 类型对齐）。 */
export type ElectronPathName =
  | 'home'
  | 'appData'
  | 'userData'
  | 'temp'
  | 'exe'
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos';

/** `app` 模块可用切片。 */
export interface ElectronAppLike {
  /** 应用版本。 */
  getVersion(): string;
  /** 当前区域设置。 */
  getLocale(): string;
  /** 目录路径。 */
  getPath(name: ElectronPathName): string;
}

/** 打开对话框结果。 */
export interface ElectronOpenDialogResultLike {
  /** 是否取消。 */
  canceled?: boolean;
  /** 选中路径。 */
  filePaths?: readonly string[];
}

/** 保存对话框结果。 */
export interface ElectronSaveDialogResultLike {
  /** 是否取消。 */
  canceled?: boolean;
  /** 选中路径。 */
  filePath?: string;
}

/** 对话框模块可用切片；允许同步或异步返回。 */
export interface ElectronDialogLike {
  /** 展示打开对话框。 */
  showOpenDialog(
    options: Readonly<Record<string, unknown>>,
  ): Promise<ElectronOpenDialogResultLike> | ElectronOpenDialogResultLike;
  /** 展示保存对话框。 */
  showSaveDialog(
    options: Readonly<Record<string, unknown>>,
  ): Promise<ElectronSaveDialogResultLike> | ElectronSaveDialogResultLike;
}

/** 通知构造选项切片。 */
export interface ElectronNotificationOptionsLike {
  /** 标题。 */
  title?: string;
  /** 正文。 */
  body?: string;
  /** 是否静音。 */
  silent?: boolean;
  /** 图标路径或图像对象。 */
  icon?: string | ElectronNativeImageLike;
}

/** 通知实例切片。 */
export interface ElectronNotificationLike {
  /** 展示通知。 */
  show(): void;
  /** 关闭通知。 */
  close?(): void;
}

/** 通知构造器切片。 */
export interface ElectronNotificationCtorLike {
  new (options: ElectronNotificationOptionsLike): ElectronNotificationLike;
  /** 当前平台是否支持系统通知。 */
  isSupported?(): boolean;
}

/** 剪贴板模块可用切片。 */
export interface ElectronClipboardLike {
  /** 读取文本。 */
  readText(): string;
  /** 写入文本。 */
  writeText(text: string): void;
}

/** 原生图像切片。 */
export interface ElectronNativeImageLike {
  /** 是否为空图像。 */
  isEmpty?(): boolean;
  /** 是否为模板图像（macOS 菜单栏）。 */
  setTemplateImage?(template: boolean): void;
  /** 尺寸。 */
  getSize?(): { width: number; height: number };
}

/** 原生图像模块切片。 */
export interface ElectronNativeImageModuleLike {
  /** 从路径创建图像。 */
  createFromPath(path: string): ElectronNativeImageLike;
}

/** 菜单模板项切片；`click` 由 PAL 注入。 */
export interface ElectronMenuItemTemplateLike {
  /** 菜单项 ID。 */
  id?: string;
  /** 菜单项文案。 */
  label?: string;
  /** 系统角色（如 `appMenu`）。 */
  role?: string;
  /** 是否启用。 */
  enabled?: boolean;
  /** 子菜单。 */
  submenu?: readonly ElectronMenuItemTemplateLike[];
  /** 点击回调。 */
  click?: () => void;
}

/** 菜单实例切片。 */
export interface ElectronMenuLike {
  /** 菜单项数量（便于测试与诊断）。 */
  readonly items?: readonly unknown[];
}

/** 菜单模块切片。 */
export interface ElectronMenuStaticLike {
  /** 由模板构建菜单。 */
  buildFromTemplate(template: readonly ElectronMenuItemTemplateLike[]): ElectronMenuLike;
  /** 设置应用菜单。 */
  setApplicationMenu(menu: ElectronMenuLike | null): void;
}

/** 托盘实例切片。 */
export interface ElectronTrayLike {
  /** 设置图标。 */
  setImage(image: ElectronNativeImageLike | string): void;
  /** 设置悬浮提示。 */
  setToolTip(text: string): void;
  /** 设置上下文菜单。 */
  setContextMenu(menu: ElectronMenuLike | null): void;
  /** 销毁托盘。 */
  destroy(): void;
  /** 是否已销毁。 */
  isDestroyed?(): boolean;
  /** 监听点击。 */
  on(event: 'click' | 'right-click', listener: (event: unknown) => void): void;
  /** 移除监听。 */
  removeAllListeners?(event?: string): void;
}

/** 托盘构造器切片。 */
export interface ElectronTrayCtorLike {
  new (image: ElectronNativeImageLike | string): ElectronTrayLike;
}

/** 全局快捷键模块切片。 */
export interface ElectronShortcutLike {
  /** 注册快捷键；返回是否成功。 */
  register(accelerator: string, callback: () => void): boolean;
  /** 注销快捷键。 */
  unregister(accelerator: string): void;
  /** 是否已注册。 */
  isRegistered(accelerator: string): boolean;
  /** 注销全部快捷键。 */
  unregisterAll?(): void;
}

/** `powerMonitor` 模块切片。 */
export interface ElectronPowerMonitorLike {
  /** 是否由电池供电。 */
  isOnBatteryPower(): boolean;
  /** 系统空闲状态。 */
  getSystemIdleState(idleThresholdSeconds: number): 'active' | 'idle' | 'locked' | 'unknown';
  /** 系统空闲秒数。 */
  getSystemIdleTime(): number;
  /** 当前热状态（macOS）。 */
  getCurrentThermalState?(): 'unknown' | 'nominal' | 'fair' | 'serious' | 'critical';
}

/** `powerSaveBlocker` 模块切片。 */
export interface ElectronPowerSaveBlockerLike {
  /** 开启抑制；返回抑制句柄 ID。 */
  start(type: 'prevent-app-suspension' | 'prevent-display-sleep'): number;
  /** 停止抑制。 */
  stop(id: number): boolean;
  /** 抑制是否生效。 */
  isStarted(id: number): boolean;
}

/** `webPreferences` 壳可配置切片（安全基线由 PAL 强制覆盖）。 */
export interface ElectronWebPreferencesLike {
  /** 预加载脚本路径。 */
  preload?: string;
  /** 附加启动参数。 */
  additionalArguments?: readonly string[];
  /** 会话分区。 */
  partition?: string;
  /** 其余 Electron 选项由壳自行声明。 */
  [key: string]: unknown;
}

/** 窗口构造选项切片。 */
export interface ElectronBrowserWindowOptionsLike {
  /** 标题。 */
  title?: string;
  /** 宽度。 */
  width?: number;
  /** 高度。 */
  height?: number;
  /** 是否可调整大小。 */
  resizable?: boolean;
  /** 是否初始显示。 */
  show?: boolean;
  /** 网页偏好。 */
  webPreferences?: ElectronWebPreferencesLike;
  /** 其余 Electron 选项由壳自行声明。 */
  [key: string]: unknown;
}

/** `webContents` 切片；`id` 即窗口 ID。 */
export interface ElectronWebContentsLike {
  /** webContents ID。 */
  id: number;
}

/** 窗口实例切片。 */
export interface ElectronBrowserWindowLike {
  /** 窗口 ID（BrowserWindow 自身 ID）。 */
  id: number;
  /** 网页内容。 */
  webContents: ElectronWebContentsLike;
  /** 聚焦。 */
  focus(): void;
  /** 显示。 */
  show?(): void;
  /** 隐藏。 */
  hide?(): void;
  /** 设置尺寸。 */
  setSize(width: number, height: number): void;
  /** 设置位置。 */
  setPosition(x: number, y: number): void;
  /** 设置标题。 */
  setTitle(title: string): void;
  /** 读取标题。 */
  getTitle(): string;
  /** 是否聚焦。 */
  isFocused(): boolean;
  /** 是否最小化。 */
  isMinimized(): boolean;
  /** 是否最大化。 */
  isMaximized(): boolean;
  /** 是否全屏。 */
  isFullScreen(): boolean;
  /** 最小化。 */
  minimize(): void;
  /** 最大化。 */
  maximize(): void;
  /** 取消最大化。 */
  unmaximize?(): void;
  /** 恢复。 */
  restore(): void;
  /** 设置全屏。 */
  setFullScreen(flag: boolean): void;
  /** 关闭。 */
  close(): void;
  /** 销毁。 */
  destroy(): void;
  /** 是否已销毁。 */
  isDestroyed(): boolean;
  /** 加载地址。 */
  loadURL(url: string): Promise<void> | void;
  /** 监听窗口事件。 */
  on(event: 'closed' | 'focus' | 'ready-to-show', listener: (...args: unknown[]) => void): void;
  /** 监听一次窗口事件。 */
  once?(event: 'closed' | 'focus' | 'ready-to-show', listener: (...args: unknown[]) => void): void;
  /** 移除监听。 */
  removeAllListeners?(event?: string): void;
}

/** 窗口构造器切片。 */
export interface ElectronBrowserWindowCtorLike {
  new (options: ElectronBrowserWindowOptionsLike): ElectronBrowserWindowLike;
  /** 全部窗口。 */
  getAllWindows(): readonly ElectronBrowserWindowLike[];
}

/** 重定向事件中的响应头。 */
export type ElectronRedirectHeadersLike = Readonly<Record<string, string | readonly string[]>>;

/** 响应消息切片。 */
export interface ElectronIncomingMessageLike {
  /** 状态码。 */
  statusCode: number;
  /** 响应头。 */
  headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  /** 监听响应事件。 */
  on(event: 'data', listener: (chunk: Buffer) => void): void;
  /** 监听结束。 */
  on(event: 'end', listener: () => void): void;
  /** 监听错误。 */
  on(event: 'error', listener: (error: Error) => void): void;
  /** 监听中止。 */
  on(event: 'aborted', listener: () => void): void;
}

/** 客户端请求切片。 */
export interface ElectronClientRequestLike {
  /** 监听响应。 */
  on(event: 'response', listener: (response: ElectronIncomingMessageLike) => void): void;
  /** 监听重定向（`redirect: 'manual'` 时不自动跟随）。 */
  on(
    event: 'redirect',
    listener: (
      statusCode: number,
      method: string,
      redirectUrl: string,
      responseHeaders: ElectronRedirectHeadersLike,
    ) => void,
  ): void;
  /** 监听错误。 */
  on(event: 'error', listener: (error: Error) => void): void;
  /** 监听中止。 */
  on(event: 'abort', listener: () => void): void;
  /** 结束请求；可携带请求体。 */
  end(chunk?: Buffer | string): void;
  /** 中止请求。 */
  abort(): void;
  /** 设置请求头。 */
  setHeader(name: string, value: string): void;
  /** 跟随重定向（仅 `redirect` 事件内同步调用有效）。 */
  followRedirect(): void;
}

/** `net` 模块切片。 */
export interface ElectronNetLike {
  /** 创建请求。 */
  request(options: Readonly<Record<string, unknown>>): ElectronClientRequestLike;
}

/** `shell` 模块切片。 */
export interface ElectronShellLike {
  /** 用系统默认程序打开 URL。 */
  openExternal(url: string): Promise<void> | void;
}

/**
 * PAL 可注入的 Electron API 切片。
 *
 * @remarks
 * `app` 为必备模块；其余模块缺失时对应分面矩阵为 `false`（17 号文档 §5.1 构建期/启动期判定）。
 */
export interface IElectronApi {
  /** `app` 模块（必备）。 */
  readonly app: ElectronAppLike;
  /** `dialog` 模块；缺失时 `dialog` 分面不可用。 */
  readonly dialog?: ElectronDialogLike;
  /** `Notification` 构造器；缺失时 `notification` 分面不可用。 */
  readonly Notification?: ElectronNotificationCtorLike;
  /** `clipboard` 模块；缺失时 `clipboard` 分面不可用。 */
  readonly clipboard?: ElectronClipboardLike;
  /** `Menu` 模块；缺失时 `menu` 分面不可用。 */
  readonly Menu?: ElectronMenuStaticLike;
  /** `Tray` 构造器；缺失时 `tray` 分面不可用。 */
  readonly Tray?: ElectronTrayCtorLike;
  /** `nativeImage` 模块；托盘图标解码依赖。 */
  readonly nativeImage?: ElectronNativeImageModuleLike;
  /** `globalShortcut` 模块；缺失时 `shortcut` 分面不可用。 */
  readonly globalShortcut?: ElectronShortcutLike;
  /** `powerMonitor` 模块；缺失时 `power` 分面不可用。 */
  readonly powerMonitor?: ElectronPowerMonitorLike;
  /** `powerSaveBlocker` 模块；缺失时 `power` 分面不可用。 */
  readonly powerSaveBlocker?: ElectronPowerSaveBlockerLike;
  /** `BrowserWindow` 构造器；缺失时 `window` 分面不可用。 */
  readonly BrowserWindow?: ElectronBrowserWindowCtorLike;
  /** `net` 模块；缺失时 `http` / `transfer` 分面不可用。 */
  readonly net?: ElectronNetLike;
  /** `shell` 模块；缺失时 `shellOpen` 分面不可用。 */
  readonly shell?: ElectronShellLike;
}

/** 判断值是否为普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 读取对象上的函数属性。 */
function readFunction(target: Record<string, unknown>, key: string): ((...args: never[]) => unknown) | null {
  const value = target[key];
  return typeof value === 'function' ? (value as (...args: never[]) => unknown) : null;
}

/** 判断对象是否具备全部指定函数。 */
function hasFunctions(value: unknown, keys: readonly string[]): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return keys.every((key) => readFunction(value, key) !== null);
}

/** 已提供可选模块的形状校验表。 */
const OPTIONAL_MODULE_VALIDATORS: ReadonlyArray<{
  readonly key: keyof IElectronApi;
  readonly validate: (value: unknown) => boolean;
}> = [
  { key: 'dialog', validate: (value) => hasFunctions(value, ['showOpenDialog', 'showSaveDialog']) },
  { key: 'Notification', validate: (value) => typeof value === 'function' },
  { key: 'clipboard', validate: (value) => hasFunctions(value, ['readText', 'writeText']) },
  { key: 'Menu', validate: (value) => hasFunctions(value, ['buildFromTemplate', 'setApplicationMenu']) },
  { key: 'Tray', validate: (value) => typeof value === 'function' },
  { key: 'nativeImage', validate: (value) => hasFunctions(value, ['createFromPath']) },
  {
    key: 'globalShortcut',
    validate: (value) => hasFunctions(value, ['register', 'unregister', 'isRegistered']),
  },
  {
    key: 'powerMonitor',
    validate: (value) => hasFunctions(value, ['isOnBatteryPower', 'getSystemIdleState', 'getSystemIdleTime']),
  },
  { key: 'powerSaveBlocker', validate: (value) => hasFunctions(value, ['start', 'stop', 'isStarted']) },
  { key: 'BrowserWindow', validate: (value) => typeof value === 'function' },
  { key: 'net', validate: (value) => hasFunctions(value, ['request']) },
  { key: 'shell', validate: (value) => hasFunctions(value, ['openExternal']) },
];

/**
 * 校验并归一注入的 Electron 模块为 {@link IElectronApi}。
 *
 * @param module `require('electron')` 的返回值或测试 mock。
 * @returns 通过校验的 Electron API 切片。
 * @throws {PalBootstrapError} `app` 模块缺失或任一已提供模块形状非法时抛出（启动期失败快速暴露）。
 */
export function createElectronApi(module: unknown): IElectronApi {
  if (!isRecord(module)) {
    throw new PalBootstrapError('注入的 Electron 模块无效：不是对象', {
      received: typeof module,
    });
  }

  const app = module['app'];
  if (!isRecord(app)) {
    throw new PalBootstrapError('注入的 Electron 模块缺少 app 模块');
  }
  for (const method of ['getVersion', 'getLocale', 'getPath'] as const) {
    if (readFunction(app, method) === null) {
      throw new PalBootstrapError(`Electron app 缺少方法：${method}`);
    }
  }

  for (const { key, validate } of OPTIONAL_MODULE_VALIDATORS) {
    const value = module[key as string];
    if (value === undefined) {
      continue;
    }
    if (!validate(value)) {
      throw new PalBootstrapError(`注入的 Electron 模块形状非法：${key as string}`);
    }
  }

  return module as unknown as IElectronApi;
}
