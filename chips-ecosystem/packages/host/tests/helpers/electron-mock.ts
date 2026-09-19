import { EventEmitter } from 'node:events';
import type {
  ElectronAppLike,
  ElectronBrowserWindowLike,
  ElectronBrowserWindowOptionsLike,
  ElectronClientRequestLike,
  ElectronClipboardLike,
  ElectronDialogLike,
  ElectronIncomingMessageLike,
  ElectronMenuLike,
  ElectronMenuItemTemplateLike,
  ElectronMenuStaticLike,
  ElectronNativeImageLike,
  ElectronNativeImageModuleLike,
  ElectronNetLike,
  ElectronNotificationCtorLike,
  ElectronNotificationLike,
  ElectronNotificationOptionsLike,
  ElectronOpenDialogResultLike,
  ElectronPathName,
  ElectronPowerMonitorLike,
  ElectronPowerSaveBlockerLike,
  ElectronRedirectHeadersLike,
  ElectronSaveDialogResultLike,
  ElectronShortcutLike,
  ElectronShellLike,
  ElectronTrayCtorLike,
  ElectronTrayLike,
  ElectronWebContentsLike,
  IElectronApi,
} from '../../src/platform/electron/electron-api.js';

/**
 * 测试专用 Electron 替身（仅存在于 `tests/`）。
 *
 * @remarks
 * - 覆盖 PAL 使用的全部 Electron 模块切片，行为可编程（结果、延迟、失败注入）。
 * - `IElectronApi` 是结构契约：mock 与真实 Electron 遵循同一形状，测试不依赖 Electron 运行时。
 * - 生产代码不引用本文件；`createMacPalHost` 由壳入口注入真实模块。
 */

/** 可被省略的 Electron 模块名（用于能力矩阵/降级测试）。 */
export type MockElectronModuleName =
  | 'dialog'
  | 'Notification'
  | 'clipboard'
  | 'Menu'
  | 'Tray'
  | 'nativeImage'
  | 'globalShortcut'
  | 'powerMonitor'
  | 'powerSaveBlocker'
  | 'BrowserWindow'
  | 'net'
  | 'shell';

/** `MockElectron.buildApi` 选项。 */
export interface MockElectronBuildOptions {
  /** 从注入模块中省略的模块键。 */
  readonly omit?: readonly MockElectronModuleName[];
}

/** `app` 模块替身。 */
export class MockApp implements ElectronAppLike {
  /** 应用版本。 */
  version = '0.1.0-test';
  /** 区域设置。 */
  locale = 'zh-CN';
  /** 目录路径表。 */
  readonly paths: Record<ElectronPathName, string> = {
    home: '/Users/tester',
    appData: '/Users/tester/Library/Application Support',
    userData: '/Users/tester/Library/Application Support/Chips',
    temp: '/var/folders/chips-test',
    exe: '/Applications/Chips.app/Contents/MacOS/Chips',
    desktop: '/Users/tester/Desktop',
    documents: '/Users/tester/Documents',
    downloads: '/Users/tester/Downloads',
    music: '/Users/tester/Music',
    pictures: '/Users/tester/Pictures',
    videos: '/Users/tester/Movies',
  };
  /** 注入 `app.getPath` 失败。 */
  failGetPath = false;
  /** 指定返回空字符串的目录名（模拟异常值）。 */
  emptyPathName: ElectronPathName | null = null;

  getVersion(): string {
    return this.version;
  }

  getLocale(): string {
    return this.locale;
  }

  getPath(name: ElectronPathName): string {
    if (this.failGetPath) {
      throw new Error('app.getPath 失败（测试注入）');
    }
    if (this.emptyPathName === name) {
      return '';
    }
    return this.paths[name];
  }
}

/** `dialog` 模块替身。 */
export class MockDialogModule implements ElectronDialogLike {
  /** `showOpenDialog` 默认结果。 */
  openResult: ElectronOpenDialogResultLike = { canceled: true, filePaths: [] };
  /** `showSaveDialog` 默认结果。 */
  saveResult: ElectronSaveDialogResultLike = { canceled: true };
  /** 结果队列；非空时逐个弹出，优先于默认结果。 */
  readonly openQueue: ElectronOpenDialogResultLike[] = [];
  /** `showOpenDialog` 注入异常。 */
  openError: Error | null = null;
  /** `showSaveDialog` 注入异常。 */
  saveError: Error | null = null;
  /** 最近一次打开对话框选项。 */
  lastOpenOptions: Readonly<Record<string, unknown>> | null = null;
  /** 最近一次保存对话框选项。 */
  lastSaveOptions: Readonly<Record<string, unknown>> | null = null;

  showOpenDialog(
    options: Readonly<Record<string, unknown>>,
  ): Promise<ElectronOpenDialogResultLike> | ElectronOpenDialogResultLike {
    this.lastOpenOptions = options;
    if (this.openError !== null) {
      throw this.openError;
    }
    return this.openQueue.shift() ?? this.openResult;
  }

  showSaveDialog(
    options: Readonly<Record<string, unknown>>,
  ): Promise<ElectronSaveDialogResultLike> | ElectronSaveDialogResultLike {
    this.lastSaveOptions = options;
    if (this.saveError !== null) {
      throw this.saveError;
    }
    return this.saveResult;
  }
}

/** 通知实例替身。 */
export class MockNotificationInstance implements ElectronNotificationLike {
  /** 已构造实例。 */
  static instances: MockNotificationInstance[] = [];
  /** `isSupported()` 返回值；`undefined` 表示不提供该方法。 */
  static supported: boolean | undefined = true;
  /** `show()` 注入异常。 */
  static showError: Error | null = null;

  /** 重置静态状态（跨测试隔离），并恢复可能被删除的 `isSupported`。 */
  static reset(): void {
    MockNotificationInstance.instances = [];
    MockNotificationInstance.supported = true;
    MockNotificationInstance.showError = null;
    Object.defineProperty(MockNotificationInstance, 'isSupported', {
      value: (): boolean => MockNotificationInstance.supported === true,
      configurable: true,
      writable: true,
    });
  }

  /** 当前平台是否支持通知。 */
  static isSupported(): boolean {
    return MockNotificationInstance.supported === true;
  }

  /** 构造选项。 */
  readonly options: ElectronNotificationOptionsLike;
  /** `show` 调用次数。 */
  showCount = 0;
  /** `close` 调用次数。 */
  closeCount = 0;

  constructor(options: ElectronNotificationOptionsLike) {
    this.options = options;
    MockNotificationInstance.instances.push(this);
  }

  show(): void {
    if (MockNotificationInstance.showError !== null) {
      throw MockNotificationInstance.showError;
    }
    this.showCount += 1;
  }

  close(): void {
    this.closeCount += 1;
  }
}

/** `Notification` 构造器替身与状态视图。 */
export class MockNotificationModule {
  /** `Notification` 构造器。 */
  readonly Notification: ElectronNotificationCtorLike = MockNotificationInstance;

  /** 已构造实例。 */
  get instances(): MockNotificationInstance[] {
    return MockNotificationInstance.instances;
  }

  /** `isSupported()` 返回值；`undefined` 表示不提供该方法。 */
  get supported(): boolean | undefined {
    return MockNotificationInstance.supported;
  }

  set supported(value: boolean | undefined) {
    MockNotificationInstance.supported = value;
  }

  /** `show()` 注入异常。 */
  get showError(): Error | null {
    return MockNotificationInstance.showError;
  }

  set showError(value: Error | null) {
    MockNotificationInstance.showError = value;
  }

  /** 移除 `isSupported`（模拟旧版不支持探测的 Electron）。 */
  withoutIsSupported(): void {
    delete (MockNotificationInstance as { isSupported?: unknown }).isSupported;
  }
}

/** `clipboard` 模块替身。 */
export class MockClipboardModule implements ElectronClipboardLike {
  /** 当前文本。 */
  text = '';
  /** `readText` 注入异常。 */
  failRead = false;
  /** `writeText` 注入异常。 */
  failWrite = false;
  /** `readText` 调用次数。 */
  readCount = 0;
  /** `writeText` 调用次数。 */
  writeCount = 0;

  readText(): string {
    if (this.failRead) {
      throw new Error('clipboard.readText 失败（测试注入）');
    }
    this.readCount += 1;
    return this.text;
  }

  writeText(text: string): void {
    if (this.failWrite) {
      throw new Error('clipboard.writeText 失败（测试注入）');
    }
    this.writeCount += 1;
    this.text = text;
  }
}

/** 菜单替身。 */
export class MockMenu implements ElectronMenuLike {
  /** 构建菜单使用的模板。 */
  readonly items: readonly ElectronMenuItemTemplateLike[];

  constructor(items: readonly ElectronMenuItemTemplateLike[]) {
    this.items = items;
  }
}

/** `Menu` 模块替身。 */
export class MockMenuModule implements ElectronMenuStaticLike {
  /** 最近一次设置的应用菜单。 */
  applicationMenu: MockMenu | null = null;
  /** 全部构建模板。 */
  readonly templates: ElectronMenuItemTemplateLike[][] = [];
  /** `buildFromTemplate` 注入异常。 */
  failBuild = false;

  buildFromTemplate(template: readonly ElectronMenuItemTemplateLike[]): ElectronMenuLike {
    if (this.failBuild) {
      throw new Error('Menu.buildFromTemplate 失败（测试注入）');
    }
    const copy = [...template];
    this.templates.push(copy);
    return new MockMenu(copy);
  }

  setApplicationMenu(menu: ElectronMenuLike | null): void {
    this.applicationMenu = menu instanceof MockMenu ? menu : null;
  }
}

/** 托盘实例替身。 */
export class MockTrayInstance implements ElectronTrayLike {
  /** 已构造托盘实例。 */
  static instances: MockTrayInstance[] = [];
  /** 构造注入异常。 */
  static failConstruct = false;
  /** `setImage` 注入异常。 */
  static failSetImage = false;

  /** 重置静态状态（跨测试隔离）。 */
  static reset(): void {
    MockTrayInstance.instances = [];
    MockTrayInstance.failConstruct = false;
    MockTrayInstance.failSetImage = false;
  }

  /** 当前图标。 */
  image: ElectronNativeImageLike | string;
  /** 当前悬浮提示。 */
  tooltip = '';
  /** 当前上下文菜单。 */
  contextMenu: ElectronMenuLike | null = null;
  /** 是否已销毁。 */
  destroyed = false;
  private readonly listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor(image: ElectronNativeImageLike | string) {
    if (MockTrayInstance.failConstruct) {
      throw new Error('Tray 构造失败（测试注入）');
    }
    this.image = image;
    MockTrayInstance.instances.push(this);
  }

  setImage(image: ElectronNativeImageLike | string): void {
    if (MockTrayInstance.failSetImage) {
      throw new Error('Tray.setImage 失败（测试注入）');
    }
    this.image = image;
  }

  setToolTip(text: string): void {
    this.tooltip = text;
  }

  setContextMenu(menu: ElectronMenuLike | null): void {
    this.contextMenu = menu;
  }

  destroy(): void {
    this.destroyed = true;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  on(event: 'click' | 'right-click', listener: (event: unknown) => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  /** 触发点击事件（测试驱动）。 */
  emitClick(button: 'click' | 'right-click'): void {
    for (const listener of this.listeners.get(button) ?? []) {
      listener({});
    }
  }
}

/** `Tray` 构造器替身与状态视图。 */
export class MockTrayModule {
  /** `Tray` 构造器。 */
  readonly Tray: ElectronTrayCtorLike = MockTrayInstance;

  /** 已构造托盘实例。 */
  get instances(): MockTrayInstance[] {
    return MockTrayInstance.instances;
  }

  /** 构造注入异常。 */
  get failConstruct(): boolean {
    return MockTrayInstance.failConstruct;
  }

  set failConstruct(value: boolean) {
    MockTrayInstance.failConstruct = value;
  }

  /** `setImage` 注入异常。 */
  get failSetImage(): boolean {
    return MockTrayInstance.failSetImage;
  }

  set failSetImage(value: boolean) {
    MockTrayInstance.failSetImage = value;
  }
}

/** `nativeImage` 模块替身。 */
export class MockNativeImageModule implements ElectronNativeImageModuleLike {
  /** 已解析路径。 */
  readonly createdPaths: string[] = [];
  /** 视为空图像的路径集合。 */
  readonly invalidPaths = new Set<string>();
  /** `createFromPath` 注入异常。 */
  failCreate = false;

  createFromPath(path: string): ElectronNativeImageLike {
    this.createdPaths.push(path);
    if (this.failCreate) {
      throw new Error('nativeImage.createFromPath 失败（测试注入）');
    }
    const invalid = this.invalidPaths.has(path);
    return {
      isEmpty: (): boolean => invalid,
      setTemplateImage: (): void => undefined,
      getSize: (): { width: number; height: number } => (invalid ? { width: 0, height: 0 } : { width: 16, height: 16 }),
    };
  }
}

/** `globalShortcut` 模块替身。 */
export class MockShortcutModule implements ElectronShortcutLike {
  /** 已注册快捷键与回调。 */
  readonly registered = new Map<string, () => void>();
  /** `register` 返回值；`false` 模拟系统拒绝。 */
  registerResult = true;
  /** `register` 注入异常。 */
  registerError: Error | null = null;
  /** `unregister` 注入异常。 */
  unregisterError: Error | null = null;

  register(accelerator: string, callback: () => void): boolean {
    if (this.registerError !== null) {
      throw this.registerError;
    }
    if (!this.registerResult) {
      return false;
    }
    this.registered.set(accelerator, callback);
    return true;
  }

  unregister(accelerator: string): void {
    if (this.unregisterError !== null) {
      throw this.unregisterError;
    }
    this.registered.delete(accelerator);
  }

  isRegistered(accelerator: string): boolean {
    return this.registered.has(accelerator);
  }

  unregisterAll(): void {
    this.registered.clear();
  }

  /** 触发已注册快捷键（测试驱动）。 */
  trigger(accelerator: string): void {
    this.registered.get(accelerator)?.();
  }
}

/** `powerMonitor` 模块替身。 */
export class MockPowerMonitor implements ElectronPowerMonitorLike {
  /** 是否由电池供电。 */
  onBattery = false;
  /** 空闲状态。 */
  idleState: 'active' | 'idle' | 'locked' | 'unknown' = 'active';
  /** 空闲秒数。 */
  idleTime = 0;
  /** 热状态。 */
  thermal: 'unknown' | 'nominal' | 'fair' | 'serious' | 'critical' = 'nominal';
  /** 读取注入异常。 */
  fail = false;

  isOnBatteryPower(): boolean {
    this.ensureOk();
    return this.onBattery;
  }

  getSystemIdleState(_idleThresholdSeconds: number): 'active' | 'idle' | 'locked' | 'unknown' {
    this.ensureOk();
    return this.idleState;
  }

  getSystemIdleTime(): number {
    this.ensureOk();
    return this.idleTime;
  }

  getCurrentThermalState(): 'unknown' | 'nominal' | 'fair' | 'serious' | 'critical' {
    this.ensureOk();
    return this.thermal;
  }

  private ensureOk(): void {
    if (this.fail) {
      throw new Error('powerMonitor 失败（测试注入）');
    }
  }
}

/** `powerSaveBlocker` 模块替身。 */
export class MockPowerSaveBlocker implements ElectronPowerSaveBlockerLike {
  /** 生效中的抑制句柄。 */
  readonly started = new Set<number>();
  /** 最近一次抑制类型。 */
  lastType: 'prevent-app-suspension' | 'prevent-display-sleep' | null = null;
  /** `start` 注入异常。 */
  failStart = false;
  /** `start` 返回未生效句柄（模拟系统忽略抑制）。 */
  ineffectiveStart = false;
  /** `isStarted` 注入异常。 */
  failIsStarted = false;
  /** `stop` 注入异常。 */
  failStop = false;
  private nextId = 1;

  start(type: 'prevent-app-suspension' | 'prevent-display-sleep'): number {
    if (this.failStart) {
      throw new Error('powerSaveBlocker.start 失败（测试注入）');
    }
    this.lastType = type;
    const id = this.nextId;
    this.nextId += 1;
    if (!this.ineffectiveStart) {
      this.started.add(id);
    }
    return id;
  }

  stop(id: number): boolean {
    if (this.failStop) {
      throw new Error('powerSaveBlocker.stop 失败（测试注入）');
    }
    return this.started.delete(id);
  }

  isStarted(id: number): boolean {
    if (this.failIsStarted) {
      throw new Error('powerSaveBlocker.isStarted 失败（测试注入）');
    }
    return this.started.has(id);
  }
}

/** `BrowserWindow` 实例替身。 */
export class MockBrowserWindow extends EventEmitter implements ElectronBrowserWindowLike {
  /** 全部已构造窗口（测试驱动）。 */
  static windows: MockBrowserWindow[] = [];
  /** `loadURL` 行为；返回 Promise 时可由测试注入失败。 */
  static loadPlan: (url: string) => Promise<void> | void = () => undefined;
  /** 是否在加载完成后自动发出 `ready-to-show`。 */
  static autoReadyToShow = true;
  private static nextWebContentsId = 1;

  /** 窗口 ID（= `webContents.id`）。 */
  readonly id: number;
  /** 网页内容。 */
  readonly webContents: ElectronWebContentsLike;
  /** 构造选项。 */
  readonly options: ElectronBrowserWindowOptionsLike;
  /** 最近一次加载地址。 */
  lastLoadedUrl: string | null = null;
  /** 窗口尺寸。 */
  size: { width: number; height: number };
  /** 窗口位置。 */
  position = { x: 0, y: 0 };
  /** 当前标题。 */
  title: string;
  /** 是否已销毁。 */
  destroyed = false;
  /** 最小化状态。 */
  minimized = false;
  /** 最大化状态。 */
  maximized = false;
  /** 全屏状态。 */
  fullscreen = false;
  /** 聚焦状态。 */
  focused = false;
  /** `show` 调用次数。 */
  showCount = 0;
  /** `hide` 调用次数。 */
  hideCount = 0;

  constructor(options: ElectronBrowserWindowOptionsLike) {
    super();
    this.options = options;
    const id = MockBrowserWindow.nextWebContentsId;
    MockBrowserWindow.nextWebContentsId += 1;
    this.id = id;
    this.webContents = { id };
    this.title = options.title ?? '';
    this.size = { width: options.width ?? 0, height: options.height ?? 0 };
    MockBrowserWindow.windows.push(this);
  }

  /** 重置静态状态。 */
  static reset(): void {
    MockBrowserWindow.windows = [];
    MockBrowserWindow.loadPlan = () => undefined;
    MockBrowserWindow.autoReadyToShow = true;
    MockBrowserWindow.nextWebContentsId = 1;
  }

  static getAllWindows(): readonly MockBrowserWindow[] {
    return [...MockBrowserWindow.windows];
  }

  loadURL(url: string): Promise<void> {
    this.lastLoadedUrl = url;
    return Promise.resolve(MockBrowserWindow.loadPlan(url)).then(() => {
      if (MockBrowserWindow.autoReadyToShow) {
        setImmediate(() => {
          if (!this.destroyed) {
            this.emit('ready-to-show');
          }
        });
      }
    });
  }

  focus(): void {
    this.focused = true;
    this.emit('focus');
  }

  show(): void {
    this.showCount += 1;
  }

  hide(): void {
    this.hideCount += 1;
  }

  setSize(width: number, height: number): void {
    this.size = { width, height };
  }

  setPosition(x: number, y: number): void {
    this.position = { x, y };
  }

  setTitle(title: string): void {
    this.title = title;
  }

  getTitle(): string {
    return this.title;
  }

  isFocused(): boolean {
    return this.focused;
  }

  isMinimized(): boolean {
    return this.minimized;
  }

  isMaximized(): boolean {
    return this.maximized;
  }

  isFullScreen(): boolean {
    return this.fullscreen;
  }

  minimize(): void {
    this.minimized = true;
  }

  maximize(): void {
    this.minimized = false;
    this.maximized = true;
  }

  unmaximize(): void {
    this.maximized = false;
  }

  restore(): void {
    this.minimized = false;
    this.maximized = false;
  }

  setFullScreen(flag: boolean): void {
    this.fullscreen = flag;
  }

  close(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.emit('closed');
  }

  destroy(): void {
    this.close();
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }
}

/** 响应消息替身。 */
export class MockIncomingMessage extends EventEmitter implements ElectronIncomingMessageLike {
  /** 状态码。 */
  readonly statusCode: number;
  /** 响应头。 */
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  /** 是否已中止。 */
  aborted = false;
  /** 是否已结束。 */
  ended = false;

  constructor(statusCode: number, headers: Readonly<Record<string, string | readonly string[] | undefined>>) {
    super();
    this.statusCode = statusCode;
    this.headers = headers;
  }

  /** 发出数据块（测试驱动）。 */
  emitData(chunk: Buffer): void {
    this.emit('data', chunk);
  }

  /** 发出结束（测试驱动）。 */
  emitEnd(): void {
    if (this.ended || this.aborted) {
      return;
    }
    this.ended = true;
    this.emit('end');
  }

  /** 发出错误（测试驱动）。 */
  emitError(error: Error): void {
    this.emit('error', error);
  }

  /** 标记中止并发事件。 */
  markAborted(): void {
    if (this.ended || this.aborted) {
      return;
    }
    this.aborted = true;
    this.emit('aborted');
  }
}

/** 单跳请求计划；由测试函数式返回。 */
export interface MockNetResponsePlan {
  /** 状态码；默认 200。 */
  readonly status?: number;
  /** 响应头。 */
  readonly headers?: Readonly<Record<string, string | readonly string[] | undefined>>;
  /** 响应体数据块。 */
  readonly chunks?: readonly (Uint8Array | string)[];
  /** 数据块间隔（毫秒）；默认 0。 */
  readonly chunkIntervalMs?: number;
  /** 响应头延迟（毫秒）；用于连接超时/截止测试。 */
  readonly responseDelayMs?: number;
  /** 重定向响应。 */
  readonly redirect?: { readonly status?: number; readonly location: string };
  /** 请求错误。 */
  readonly error?: Error;
  /** 响应体错误（响应头之后）。 */
  readonly responseError?: Error;
  /** 数据块发送完后不发出 `end`（用于空闲超时/取消测试）。 */
  readonly holdBeforeEnd?: boolean;
}

/** 请求计划解析器。 */
export type MockNetPlanResolver = (request: MockClientRequest) => MockNetResponsePlan;

/** 客户端请求替身。 */
export class MockClientRequest extends EventEmitter implements ElectronClientRequestLike {
  /** 创建请求时的选项。 */
  readonly options: Readonly<Record<string, unknown>>;
  /** 已设置请求头（保持调用方大小写）。 */
  readonly headers: Record<string, string> = {};
  /** `end` 提交的请求体。 */
  body: Buffer | null = null;
  /** 是否已提交。 */
  ended = false;
  /** 是否已中止。 */
  aborted = false;
  /** 是否调用过 `followRedirect`。 */
  followRedirectCalled = false;
  /** 已收到的响应（若已到达响应头阶段）。 */
  response: MockIncomingMessage | null = null;
  private finished = false;

  constructor(
    options: Readonly<Record<string, unknown>>,
    private readonly planProvider: MockNetPlanResolver,
  ) {
    super();
    this.options = options;
  }

  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  end(chunk?: Buffer | string): void {
    this.ended = true;
    this.body = chunk === undefined ? null : Buffer.from(chunk);
    const plan = this.planProvider(this);
    if (plan.error !== undefined) {
      schedule(() => this.emit('error', plan.error));
      return;
    }
    const delay = plan.responseDelayMs ?? 0;
    if (delay > 0) {
      setTimeout(() => this.respond(plan), delay).unref?.();
    } else {
      schedule(() => this.respond(plan));
    }
  }

  abort(): void {
    if (this.aborted) {
      return;
    }
    this.aborted = true;
    const response = this.response;
    if (response !== null) {
      response.markAborted();
    }
    this.emit('abort');
  }

  followRedirect(): void {
    this.followRedirectCalled = true;
  }

  /** 响应头到达（或重定向/结束）。 */
  private respond(plan: MockNetResponsePlan): void {
    if (this.aborted || this.finished) {
      return;
    }
    if (plan.redirect !== undefined) {
      this.finished = true;
      const status = plan.redirect.status ?? 302;
      const redirectHeaders: Record<string, string | readonly string[]> = {};
      for (const [name, value] of Object.entries(plan.headers ?? {})) {
        if (value !== undefined) {
          redirectHeaders[name] = value;
        }
      }
      const headers: ElectronRedirectHeadersLike = redirectHeaders;
      const method = typeof this.options['method'] === 'string' ? this.options['method'] : 'GET';
      this.emit('redirect', status, method, plan.redirect.location, headers);
      return;
    }

    const response = new MockIncomingMessage(plan.status ?? 200, plan.headers ?? {});
    this.response = response;
    this.finished = true;
    this.emit('response', response);

    if (plan.responseError !== undefined) {
      schedule(() => {
        if (!this.aborted) {
          response.emitError(plan.responseError as Error);
        }
      });
      return;
    }

    const chunks = plan.chunks ?? [];
    const interval = plan.chunkIntervalMs ?? 0;
    const emitNext = (index: number): void => {
      if (this.aborted || response.aborted) {
        return;
      }
      const chunk = chunks[index];
      if (chunk === undefined) {
        if (plan.holdBeforeEnd !== true) {
          response.emitEnd();
        }
        return;
      }
      response.emitData(toBuffer(chunk));
      setTimeout(() => emitNext(index + 1), interval).unref?.();
    };
    // 首块经宏任务投递，确保消费方在 `response` 事件后完成监听注册（与真实 Electron 一致）。
    setTimeout(() => emitNext(0), 0).unref?.();
  }
}

/** `net` 模块替身。 */
export class MockNetModule implements ElectronNetLike {
  /** 已创建请求。 */
  readonly requests: MockClientRequest[] = [];
  /** 请求计划解析器；测试可随时替换。 */
  plan: MockNetPlanResolver = () => ({ status: 200, chunks: [] });
  /** `request` 注入异常。 */
  requestError: Error | null = null;

  request(options: Readonly<Record<string, unknown>>): ElectronClientRequestLike {
    if (this.requestError !== null) {
      throw this.requestError;
    }
    const request = new MockClientRequest(options, (current) => this.plan(current));
    this.requests.push(request);
    return request;
  }

  /** 最近一次创建的请求。 */
  get lastRequest(): MockClientRequest | undefined {
    return this.requests[this.requests.length - 1];
  }

  /** 清空请求记录。 */
  reset(): void {
    this.requests.length = 0;
  }
}

/** `shell` 模块替身。 */
export class MockShellModule implements ElectronShellLike {
  /** 已打开的外部地址。 */
  readonly opened: string[] = [];
  /** `openExternal` 注入异常。 */
  openError: Error | null = null;

  openExternal(url: string): Promise<void> {
    if (this.openError !== null) {
      return Promise.reject(this.openError);
    }
    this.opened.push(url);
    return Promise.resolve();
  }
}

/** Electron 替身聚合；按需拼装 `IElectronApi`。 */
export class MockElectron {
  /** `app` 模块。 */
  readonly app = new MockApp();
  /** `dialog` 模块。 */
  readonly dialog = new MockDialogModule();
  /** `Notification` 模块与构造器。 */
  readonly notification = new MockNotificationModule();
  /** `clipboard` 模块。 */
  readonly clipboard = new MockClipboardModule();
  /** `Menu` 模块。 */
  readonly menu = new MockMenuModule();
  /** `Tray` 模块与构造器。 */
  readonly tray = new MockTrayModule();
  /** `nativeImage` 模块。 */
  readonly nativeImage = new MockNativeImageModule();
  /** `globalShortcut` 模块。 */
  readonly shortcut = new MockShortcutModule();
  /** `powerMonitor` 模块。 */
  readonly powerMonitor = new MockPowerMonitor();
  /** `powerSaveBlocker` 模块。 */
  readonly powerSaveBlocker = new MockPowerSaveBlocker();
  /** `net` 模块。 */
  readonly net = new MockNetModule();
  /** `shell` 模块。 */
  readonly shell = new MockShellModule();

  /** 按选项拼装注入模块。 */
  buildApi(options: MockElectronBuildOptions = {}): IElectronApi {
    const omit = new Set(options.omit ?? []);
    const api: Record<string, unknown> = { app: this.app };
    if (!omit.has('dialog')) {
      api['dialog'] = this.dialog;
    }
    if (!omit.has('Notification')) {
      api['Notification'] = this.notification.Notification;
    }
    if (!omit.has('clipboard')) {
      api['clipboard'] = this.clipboard;
    }
    if (!omit.has('Menu')) {
      api['Menu'] = this.menu;
    }
    if (!omit.has('Tray')) {
      api['Tray'] = this.tray.Tray;
    }
    if (!omit.has('nativeImage')) {
      api['nativeImage'] = this.nativeImage;
    }
    if (!omit.has('globalShortcut')) {
      api['globalShortcut'] = this.shortcut;
    }
    if (!omit.has('powerMonitor')) {
      api['powerMonitor'] = this.powerMonitor;
    }
    if (!omit.has('powerSaveBlocker')) {
      api['powerSaveBlocker'] = this.powerSaveBlocker;
    }
    if (!omit.has('BrowserWindow')) {
      api['BrowserWindow'] = MockBrowserWindow;
    }
    if (!omit.has('net')) {
      api['net'] = this.net;
    }
    if (!omit.has('shell')) {
      api['shell'] = this.shell;
    }
    return api as unknown as IElectronApi;
  }
}

/** 创建一份隔离的 Electron 替身（重置全部静态状态）。 */
export function createMockElectron(): MockElectron {
  MockBrowserWindow.reset();
  MockNotificationInstance.reset();
  MockTrayInstance.reset();
  return new MockElectron();
}

/** 微任务调度；统一走 `setTimeout(0)` 便于中止竞态测试。 */
function schedule(action: () => void): void {
  setTimeout(action, 0);
}

/** 字符串按 UTF-8 转为 Buffer。 */
function toBuffer(chunk: Uint8Array | string): Buffer {
  return typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : Buffer.from(chunk);
}
