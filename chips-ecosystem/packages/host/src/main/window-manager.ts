/**
 * 壳窗口创建。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（窗口创建与协议就绪）、
 * `ADR-002` §安全配置、`05-渲染引擎设计` §3.1（渲染进程安全基线）。
 *
 * @remarks
 * - 壳窗口只加载 `chips-resource://` 规范 URI（`window-security.isAllowedWindowLoadUrl`）。
 * - 每个窗口分配独立 session partition，作为协议路径来源会话解析的依据（见 `window-bindings`）。
 * - 窗口创建后立即绑定会话与协议处理器，再执行 `loadURL`，保证首个资源请求即可被处理。
 */

import { HostStartupError } from '../shared/errors.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import type { ShellWindowFactory } from './shell-api.js';
import type { WebContentsBinder } from './web-contents-binder.js';
import { assertSecureWebPreferences, buildWindowWebPreferences, isAllowedWindowLoadUrl } from './window-security.js';
import type { WindowRecord, WindowRegistry } from './window-registry.js';

/** 壳窗口创建参数。 */
export interface ShellWindowCreateOptions {
  /** 窗口标题。 */
  readonly title: string;
  /** 内容宽度。 */
  readonly width: number;
  /** 内容高度。 */
  readonly height: number;
  /** 是否允许调整大小；默认 `true`。 */
  readonly resizable?: boolean;
  /** 加载地址（必须是 `chips-resource://` 规范 URI）。 */
  readonly url: string;
  /** 会话 partition；缺省按窗口序号生成独立 partition。 */
  readonly partition?: string;
  /** 加载完成后是否显示；默认 `true`。 */
  readonly show?: boolean;
}

/** 窗口管理器依赖。 */
export interface ShellWindowManagerDeps {
  /** 窗口工厂（Electron `BrowserWindow` 切片）。 */
  readonly factory: ShellWindowFactory;
  /** preload 脚本绝对路径。 */
  readonly preloadPath: string;
  /** 窗口内容绑定器。 */
  readonly binder: WebContentsBinder;
  /** 窗口注册表。 */
  readonly registry: WindowRegistry;
  /** 诊断口。 */
  readonly diagnostics: DiagnosticsSink;
  /** partition 前缀；默认 `chips-window-`。 */
  readonly partitionPrefix?: string;
}

/** 壳窗口管理器。 */
export class ShellWindowManager {
  private readonly deps: ShellWindowManagerDeps;
  private sequence = 0;

  constructor(deps: ShellWindowManagerDeps) {
    this.deps = deps;
  }

  /**
   * 创建并加载壳窗口。
   *
   * @param options 创建参数。
   * @returns 已加载并注册的窗口记录。
   * @throws {HostStartupError} 加载地址非法、窗口创建失败或加载失败时抛出。
   */
  async createWindow(options: ShellWindowCreateOptions): Promise<WindowRecord> {
    if (!isAllowedWindowLoadUrl(options.url)) {
      throw new HostStartupError(
        'HOST_STARTUP_FAILED',
        'window',
        '壳窗口加载地址非法：仅允许 chips-resource:// 规范 URI',
      );
    }
    this.sequence += 1;
    const partition = options.partition ?? `${this.deps.partitionPrefix ?? 'chips-window-'}${this.sequence}`;
    const webPreferences = buildWindowWebPreferences({
      preload: this.deps.preloadPath,
      partition,
    });
    assertSecureWebPreferences(webPreferences);

    const window = this.deps.factory.createBrowserWindow({
      title: options.title,
      width: options.width,
      height: options.height,
      resizable: options.resizable ?? true,
      show: false,
      webPreferences,
    });

    const record = this.deps.binder.bind(window.webContents, window);
    if (record === null) {
      window.destroy();
      throw new HostStartupError('HOST_STARTUP_FAILED', 'window', '窗口内容不属于窗口类型，已终止创建');
    }

    try {
      await window.loadURL(options.url);
    } catch (error) {
      this.deps.diagnostics.error('window', '壳窗口加载失败', { windowId: record.windowId });
      this.deps.binder.unbind(record.windowId);
      window.destroy();
      throw new HostStartupError('HOST_STARTUP_FAILED', 'window', '壳窗口加载失败', { cause: error });
    }

    if (options.show !== false) {
      window.show();
    }
    return record;
  }
}
