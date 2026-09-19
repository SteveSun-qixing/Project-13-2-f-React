/**
 * 壳应用编排：启动、窗口、IPC/协议就绪与退出收口。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（启动与退出顺序）、§3.2（唯一交互面）、
 * `02-Bridge三层设计` §7（IPC 通道）、`06-资源协议规范` §5.3（协议处理器）。
 *
 * @remarks
 * - 壳只把"已按来源解析的会话 + 已编解码的消息"交给核心；会话有效性、权限、schema 与
 *   错误归一全部在核心（SB-1/SB-2/SB-6）。
 * - 平台核心经构造注入的 {@link IPlatformRuntime} 端口消费；壳不实现第二个能力注册表与
 *   第二套权限判定。
 * - 退出严格按逆序：停用插件 → 注销事件下行 → 关闭窗口 → 注销 IPC → 核心停机 → 释放 PAL。
 */

import type { IPalHost } from '../platform/contracts/index.js';
import { validatePalHost } from '../platform/matrix.js';
import { eventChannel, SESSION_PERMISSIONS_CHANNEL } from '../protocol/channels.js';
import type { ISessionPermissionsUpdate } from '../protocol/wire.js';
import type { IPlatformRuntime, IPlatformStartupInput } from '../runtime/contracts.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import { createStderrDiagnostics } from '../shared/diagnostics.js';
import { HostStartupError, type HostStartupStage } from '../shared/errors.js';
import type { ShellElectronRuntime } from './electron-adapter.js';
import { registerIpcChannels } from './ipc-channels.js';
import { pushSessionPermissions } from './session-resolver.js';
import { WindowBindings } from './window-bindings.js';
import { WebContentsBinder } from './web-contents-binder.js';
import { WindowRegistry, type WindowRecord } from './window-registry.js';
import { ShellWindowManager } from './window-manager.js';

/** 壳应用状态。 */
export type HostApplicationState = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped';

/** 启动窗口参数。 */
export interface BootstrapWindowOptions {
  /** 窗口标题；默认取应用名。 */
  readonly title?: string;
  /** 内容宽度；默认 1200。 */
  readonly width?: number;
  /** 内容高度；默认 800。 */
  readonly height?: number;
  /** 是否允许调整大小；默认 `true`。 */
  readonly resizable?: boolean;
  /** 壳页面地址；默认 `chips-resource://platform/shell.html`。 */
  readonly url?: string;
}

/** 壳应用选项。 */
export interface HostApplicationOptions {
  /** Electron 运行时切片。 */
  readonly electron: ShellElectronRuntime;
  /** 壳自检通过的 PAL 宿主。 */
  readonly palHost: IPalHost;
  /** 平台运行时端口（核心装配由组合根注入）。 */
  readonly runtime: IPlatformRuntime;
  /** preload 脚本绝对路径。 */
  readonly preloadPath: string;
  /** 启动窗口参数。 */
  readonly bootstrapWindow?: BootstrapWindowOptions;
  /** 诊断口；默认写 `process.stderr`。 */
  readonly diagnostics?: DiagnosticsSink;
}

/** 壳默认启动页。 */
export const DEFAULT_BOOTSTRAP_URL = 'chips-resource://platform/shell.html';

/** 壳应用编排。 */
export class HostApplication {
  private readonly options: HostApplicationOptions;
  private readonly diagnostics: DiagnosticsSink;
  private readonly registry = new WindowRegistry();
  private readonly bindings = new WindowBindings();
  private readonly binder: WebContentsBinder;
  private readonly windowManager: ShellWindowManager;
  private detachIpc: (() => void) | null = null;
  private detachEvents: (() => void) | null = null;
  private coreStarted = false;
  private currentState: HostApplicationState = 'idle';

  constructor(options: HostApplicationOptions) {
    this.options = options;
    this.diagnostics = options.diagnostics ?? createStderrDiagnostics();
    this.binder = new WebContentsBinder({
      registry: this.registry,
      bindings: this.bindings,
      backend: options.runtime.resources,
      diagnostics: this.diagnostics,
      onClosed: (windowId) => {
        this.options.runtime.ipc.handleWindowClosed(windowId);
      },
    });
    this.windowManager = new ShellWindowManager({
      factory: options.electron.windowFactory,
      preloadPath: options.preloadPath,
      binder: this.binder,
      registry: this.registry,
      diagnostics: this.diagnostics,
    });
  }

  /** 当前状态。 */
  get state(): HostApplicationState {
    return this.currentState;
  }

  /** 窗口注册表（只读消费）。 */
  get windows(): WindowRegistry {
    return this.registry;
  }

  /**
   * 启动壳应用。
   *
   * @remarks 顺序：PAL 自检 → 核心启动（内核 → Bridge 能力注册）→ IPC 通道 → 窗口内容绑定 →
   * 启动窗口 → 事件下行 → 插件恢复。任一阶段失败即按逆序回滚已完成的阶段并抛出。
   */
  async start(): Promise<void> {
    if (this.currentState !== 'idle') {
      throw new HostStartupError('HOST_STARTUP_FAILED', 'pal-host', `壳应用无法从当前状态启动：${this.currentState}`);
    }
    this.currentState = 'starting';
    let stage: HostStartupStage = 'pal-host';
    try {
      stage = 'pal-host';
      this.validatePal();
      stage = 'core-start';
      await this.options.runtime.start(this.options.palHost, {
        pushSessionPermissions: (windowId, update) => {
          this.pushPermissions(windowId, update);
        },
      });
      this.coreStarted = true;
      stage = 'ipc';
      this.detachIpc = registerIpcChannels({
        ipcMain: this.options.electron.ipcMain,
        runtime: this.options.runtime,
        isWindowAlive: (windowId) => this.registry.isAlive(windowId),
        diagnostics: this.diagnostics,
      });
      stage = 'protocol';
      this.options.electron.app.onWebContentsCreated((webContents) => {
        this.binder.bind(webContents);
      });
      stage = 'window';
      await this.createBootstrapWindow();
      stage = 'plugin-restore';
      this.detachEvents = this.options.runtime.forwardEvents({
        deliver: (windowId, envelope) => {
          const record = this.registry.get(windowId);
          if (record === undefined || record.webContents.isDestroyed()) {
            return;
          }
          record.webContents.send(eventChannel(envelope.eventId), envelope);
        },
      });
      await this.options.runtime.restorePlugins();
      this.currentState = 'running';
    } catch (error) {
      await this.rollback();
      throw normalizeStartupError(error, stage);
    }
  }

  /**
   * 确保存在启动窗口（macOS Dock 激活时重建）。
   *
   * @returns 新建的窗口 ID；已有窗口时返回 `null`。
   */
  async ensureBootstrapWindow(): Promise<number | null> {
    if (this.currentState !== 'running' || this.registry.size > 0) {
      return null;
    }
    const record = await this.createBootstrapWindow();
    return record.windowId;
  }

  /**
   * 投递启动输入（操作系统打开事件、第二实例参数、工作区开关）。
   *
   * @param inputs 结构化启动输入。
   */
  async dispatchStartupInputs(inputs: readonly IPlatformStartupInput[]): Promise<void> {
    if (inputs.length === 0) {
      return;
    }
    try {
      await this.options.runtime.handleStartupInputs(inputs);
    } catch (error) {
      this.diagnostics.error('startup', '启动输入投递失败', {
        count: inputs.length,
        reason: error instanceof Error ? error.message : typeof error,
      });
    }
  }

  /**
   * 逆序收口并停机。
   *
   * @remarks 幂等：重复调用直接返回；强制退出路径由调用方在超时后结束进程。
   */
  async shutdown(): Promise<void> {
    if (this.currentState === 'idle' || this.currentState === 'stopped' || this.currentState === 'stopping') {
      return;
    }
    this.currentState = 'stopping';
    await this.stopPlugins();
    this.unregisterEvents();
    this.closeWindows();
    this.unregisterIpc();
    await this.shutdownCore();
    this.disposePal();
    this.currentState = 'stopped';
  }

  /** PAL 自检：矩阵与端口集合一致、storage 端口存在。 */
  private validatePal(): void {
    try {
      validatePalHost(this.options.palHost);
    } catch (error) {
      throw normalizeStartupError(error, 'pal-host');
    }
  }

  /** 创建启动窗口。 */
  private async createBootstrapWindow(): Promise<WindowRecord> {
    const config = this.options.bootstrapWindow ?? {};
    return this.windowManager.createWindow({
      title: config.title ?? this.options.electron.app.getName(),
      width: config.width ?? 1200,
      height: config.height ?? 800,
      url: config.url ?? DEFAULT_BOOTSTRAP_URL,
      ...(config.resizable !== undefined ? { resizable: config.resizable } : {}),
    });
  }

  /** 推送会话权限快照到窗口 preload。 */
  private pushPermissions(windowId: number, update: ISessionPermissionsUpdate): void {
    const record = this.registry.get(windowId);
    if (record === undefined) {
      return;
    }
    pushSessionPermissions(record.webContents, SESSION_PERMISSIONS_CHANNEL, update);
  }

  /** 停用插件；核心尚未启动时跳过。 */
  private async stopPlugins(): Promise<void> {
    if (!this.coreStarted) {
      return;
    }
    try {
      await this.options.runtime.stopPlugins();
    } catch (error) {
      this.diagnostics.error('shutdown', '插件停用失败', { reason: describe(error) });
    }
  }

  /** 注销事件下行。 */
  private unregisterEvents(): void {
    const detach = this.detachEvents;
    this.detachEvents = null;
    if (detach === null) {
      return;
    }
    try {
      detach();
    } catch (error) {
      this.diagnostics.error('shutdown', '事件下行注销失败', { reason: describe(error) });
    }
  }

  /** 关闭全部窗口并释放绑定。 */
  private closeWindows(): void {
    this.registry.closeAll();
    this.registry.destroyAll();
    this.binder.disposeAll();
  }

  /** 注销 IPC 通道。 */
  private unregisterIpc(): void {
    const detach = this.detachIpc;
    this.detachIpc = null;
    if (detach === null) {
      return;
    }
    try {
      detach();
    } catch (error) {
      this.diagnostics.error('shutdown', 'IPC 通道注销失败', { reason: describe(error) });
    }
  }

  /** 核心停机。 */
  private async shutdownCore(): Promise<void> {
    if (!this.coreStarted) {
      return;
    }
    this.coreStarted = false;
    try {
      await this.options.runtime.shutdown();
    } catch (error) {
      this.diagnostics.error('shutdown', '平台核心停机失败', { reason: describe(error) });
    }
  }

  /** 释放 PAL 持有的系统资源（托盘、抑制句柄等）。 */
  private disposePal(): void {
    const disposable = this.options.palHost as { dispose?: () => void };
    if (typeof disposable.dispose !== 'function') {
      return;
    }
    try {
      disposable.dispose();
    } catch (error) {
      this.diagnostics.error('shutdown', 'PAL 资源释放失败', { reason: describe(error) });
    }
  }

  /** 启动失败回滚：逆序释放已完成阶段（尽力而为，不掩盖原始错误）。 */
  private async rollback(): Promise<void> {
    this.unregisterEvents();
    this.closeWindows();
    this.unregisterIpc();
    await this.shutdownCore();
    this.disposePal();
    this.currentState = 'idle';
  }
}

/** 读取异常可读描述。 */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : typeof error;
}

/** 把启动阶段异常归一为 {@link HostStartupError}。 */
function normalizeStartupError(error: unknown, stage: HostStartupStage): HostStartupError {
  if (error instanceof HostStartupError) {
    return error;
  }
  return new HostStartupError('HOST_STARTUP_FAILED', stage, error instanceof Error ? error.message : '壳启动失败', {
    cause: error,
  });
}
