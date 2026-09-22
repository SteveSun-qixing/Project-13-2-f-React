/**
 * 壳的 Electron API 结构切片。
 *
 * @remarks
 * - 壳内部模块只依赖本文件的结构契约；真实 Electron 模块由入口经适配器注入，测试注入替身。
 * - 切片只覆盖壳实际使用的方法，避免与 Electron 大版本类型漂移耦合。
 */

/** 应用生命周期事件。 */
export interface ShellAppEvent {
  /** 阻止默认行为（`before-quit` 会话中用于延迟退出）。 */
  preventDefault(): void;
}

/** 第二实例事件。 */
export interface ShellSecondInstanceEvent {
  /** 阻止默认行为。 */
  preventDefault(): void;
}

/** 应用模块切片。 */
export interface ShellElectronApp {
  /** 应用就绪。 */
  whenReady(): Promise<void>;
  /** 注册 `second-instance` 监听；第二实例参数已剥离可执行文件与脚本参数。 */
  onSecondInstance(listener: (event: ShellSecondInstanceEvent, argv: readonly string[]) => void): void;
  /** 注册 macOS `open-file` 监听。 */
  onOpenFile(listener: (event: ShellAppEvent, path: string) => void): void;
  /** 注册退出前监听；用于阻止默认退出并执行逆序收口。 */
  onBeforeQuit(listener: (event: ShellAppEvent) => void): void;
  /** 注册全部窗口关闭监听。 */
  onWindowAllClosed(listener: () => void): void;
  /** 注册 macOS Dock 激活监听。 */
  onActivate(listener: () => void): void;
  /** 注册 webContents 创建监听；壳据此完成会话绑定与协议处理器注册。 */
  onWebContentsCreated(listener: (webContents: ShellWebContents) => void): void;
  /** 申请单实例锁。 */
  requestSingleInstanceLock(): boolean;
  /** 退出应用（触发 `before-quit`）。 */
  quit(): void;
  /** 强制退出进程；用于收口完成后的最终退出。 */
  exit(code: number): void;
  /** 应用版本。 */
  getVersion(): string;
  /** 应用名称。 */
  getName(): string;
  /** 应用级区域设置。 */
  getLocale(): string;
  /** 读取平台目录路径。 */
  getPath(name: ShellPathName): string;
}

/** 平台目录名（与 Electron `app.getPath` 对齐的常用子集）。 */
export type ShellPathName = 'home' | 'appData' | 'userData' | 'temp' | 'exe' | 'desktop' | 'documents' | 'downloads';

/** webContents 切片。 */
export interface ShellWebContents {
  /** Electron `webContents.id`；即能力契约中的 `windowId`。 */
  readonly id: number;
  /** 所属 session。 */
  readonly session: ShellSession;
  /** 是否已销毁。 */
  isDestroyed(): boolean;
  /** 内容类型（Electron `getType()`）；壳据此排除非窗口内容（DevTools、工具进程宿主）。 */
  getType?(): string;
  /** 向渲染进程发送通道消息。 */
  send(channel: string, payload: unknown): void;
  /** 关闭所属窗口。 */
  close(): void;
  /** 注册销毁监听；用于会话清理与绑定注销。 */
  onDestroyed(listener: () => void): void;
  /**
   * 注册新窗口打开处置器（Electron `setWindowOpenHandler`）；工单043-A4 §四.6 导航拦截位。
   *
   * @remarks 缺位即跳过挂接，只可能是测试替身面：生产路径唯一构造点
   * （`electron-adapter.ts` 的 `adaptWebContents`）恒提供本方法与
   * {@link ShellWebContents.onWillNavigate}，原始 Electron 方法缺失即抛
   * `HostStartupError`——拦截位不得静默消失。
   */
  setWindowOpenHandler?(handler: (details: ShellWindowOpenDetails) => ShellWindowOpenDisposition): void;
  /** 注册 `will-navigate` 监听（同拦截位的同窗导航白名单臂）。 */
  onWillNavigate?(listener: (event: ShellNavigationEvent, url: string) => void): void;
}

/** 新窗口打开请求的壳侧所需字段切片（Electron `setWindowOpenHandler` 详情）。 */
export interface ShellWindowOpenDetails {
  /** 请求打开的地址。 */
  readonly url: string;
}

/**
 * 新窗口打开处置回执。
 *
 * @remarks 壳面窗口创建只有主进程通道一条路（窗口管理器 / 卡片窗口编排器），
 * 因此拦截位的处置只有 `deny` 一臂——渲染进程不得自开窗口。
 */
export interface ShellWindowOpenDisposition {
  /** 处置动作。 */
  readonly action: 'deny';
}

/** 窗口导航事件切片（Electron `will-navigate` 事件）。 */
export interface ShellNavigationEvent {
  /** 阻止本次导航。 */
  preventDefault(): void;
}

/** 自定义协议注册切片（会话级）。 */
export interface ShellSessionProtocol {
  /**
   * 注册 scheme 处理器；返回注销函数。
   *
   * @param scheme 固定为 `chips-resource`。
   * @param handler 请求处理器；返回值必须是 Web `Response`。
   */
  handle(scheme: string, handler: (request: Request) => Response | Promise<Response>): void;
  /** 注销 scheme 处理器（幂等）。 */
  unhandle(scheme: string): void;
  /** 判断 scheme 是否已注册处理器。 */
  isProtocolHandled(scheme: string): boolean;
}

/** session 切片。 */
export interface ShellSession {
  /** session 唯一标识（partition 或 `default`）；用于诊断。 */
  readonly key: string;
  /** 会话级协议注册表。 */
  readonly protocol: ShellSessionProtocol;
}

/** 协议模块切片（全局）。 */
export interface ShellElectronProtocol {
  /** 注册特权 scheme；必须在应用就绪前调用。 */
  registerSchemesAsPrivileged(schemes: readonly ShellCustomScheme[]): void;
}

/** 特权 scheme 声明。 */
export interface ShellCustomScheme {
  /** scheme 名。 */
  readonly scheme: string;
  /** 特权集合。 */
  readonly privileges: Readonly<Record<string, boolean>>;
}

/** ipcMain 切片。 */
export interface ShellIpcMain {
  /** 注册调用通道。 */
  handle(channel: string, listener: (event: ShellIpcInvokeEvent, ...args: readonly unknown[]) => unknown): void;
  /** 注销调用通道（幂等）。 */
  removeHandler(channel: string): void;
}

/** IPC 调用事件切片。 */
export interface ShellIpcInvokeEvent {
  /** 来源 webContents。 */
  readonly sender: { readonly id: number };
  /** 来源主框架；无法解析时为 `null`。 */
  readonly senderFrame: { readonly routingId: number } | null;
}

/** 窗口创建选项切片。 */
export interface ShellWindowOptions {
  /** 窗口标题。 */
  readonly title: string;
  /** 内容宽度。 */
  readonly width: number;
  /** 内容高度。 */
  readonly height: number;
  /** 是否允许调整大小。 */
  readonly resizable: boolean;
  /** 是否在首帧就绪前隐藏。 */
  readonly show: boolean;
  /** webPreferences（必须满足安全基线，由窗口安全模块构造）。 */
  readonly webPreferences: Readonly<Record<string, unknown>>;
}

/** 壳窗口句柄切片。 */
export interface ShellWindow {
  /** 窗口 ID（`webContents.id`）。 */
  readonly windowId: number;
  /** 底层 webContents。 */
  readonly webContents: ShellWebContents;
  /** 加载地址。 */
  loadURL(url: string): Promise<void>;
  /** 关闭窗口（触发关闭流程）。 */
  close(): void;
  /** 强制销毁窗口（收口兜底）。 */
  destroy(): void;
  /** 是否已销毁。 */
  isDestroyed(): boolean;
  /** 显示窗口。 */
  show(): void;
  /** 设置标题。 */
  setTitle(title: string): void;
}

/** 窗口工厂切片。 */
export interface ShellWindowFactory {
  /** 创建窗口。 */
  createBrowserWindow(options: ShellWindowOptions): ShellWindow;
}
