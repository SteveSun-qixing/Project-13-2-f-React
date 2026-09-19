import type {
  IPalWindowPort,
  PalSubscription,
  PortCallContext,
  WindowCreateOptions,
  WindowDisplayState,
  WindowPosition,
  WindowSignal,
  WindowSize,
  WindowSummary,
} from '../contracts/index.js';
import { assertCallActive, withCallContext } from '../call-guard.js';
import type {
  ElectronBrowserWindowCtorLike,
  ElectronBrowserWindowLike,
  ElectronBrowserWindowOptionsLike,
} from '../electron/electron-api.js';
import { PAL_ERROR_CODES, PalPortError } from '../errors.js';

/** macOS 窗口端口依赖。 */
export interface MacWindowPortDependencies {
  /** Electron `BrowserWindow` 构造器。 */
  readonly BrowserWindow: ElectronBrowserWindowCtorLike;
}

/** macOS 窗口端口选项。 */
export interface MacWindowPortOptions {
  /**
   * 壳提供的窗口构造参数（preload、附加参数、会话分区等）。
   *
   * 每次创建窗口时调用；PAL 强制安全基线（R17）：
   * `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`、`webSecurity: true`，
   * 壳参数不能覆盖关闭。
   */
  readonly windowOptions?: () => ElectronBrowserWindowOptionsLike;
}

/**
 * 创建 macOS 窗口端口。
 *
 * 权威：`04-能力契约规范` §7.4、`17-跨端Shell与平台抽象设计` §4.2、§3.3 SB-8。
 *
 * @param dependencies Electron `BrowserWindow` 构造器。
 * @param options 壳窗口参数。
 * @returns `window:*` 端口实现。
 *
 * @remarks
 * - `windowId` 为 Electron `webContents.id`（能力契约 §7.4、事件契约 §4.7）。
 * - 窗口 ID 解析基于 `BrowserWindow.getAllWindows()`，不维护第二套窗口注册表。
 * - 系统信号经 `onSignal` 交给壳，端口不发布业务事件（PAL-3）。
 */
export function createMacWindowPort(
  dependencies: MacWindowPortDependencies,
  options: MacWindowPortOptions = {},
): IPalWindowPort {
  const { BrowserWindow } = dependencies;
  const signalListeners = new Set<(signal: WindowSignal) => void>();

  const emitSignal = (kind: WindowSignal['kind'], windowId: number): void => {
    for (const listener of signalListeners) {
      listener({ kind, windowId });
    }
  };

  const requireWindow = (windowId: number): ElectronBrowserWindowLike => {
    const target = BrowserWindow.getAllWindows().find(
      (candidate) => !candidate.isDestroyed() && candidate.webContents.id === windowId,
    );
    if (target === undefined) {
      throw new PalPortError(PAL_ERROR_CODES.WINDOW_NOT_FOUND, undefined, {
        details: { windowId },
      });
    }
    return target;
  };

  const runWindowOperation = <T>(
    windowId: number,
    call: PortCallContext | undefined,
    operation: (window: ElectronBrowserWindowLike) => T,
  ): T => {
    assertCallActive(call);
    try {
      return operation(requireWindow(windowId));
    } catch (error) {
      if (error instanceof PalPortError) {
        throw error;
      }
      throw new PalPortError(PAL_ERROR_CODES.WINDOW_OPERATION_FAILED, undefined, {
        details: { windowId },
        cause: error,
      });
    }
  };

  return {
    async create(createOptions: WindowCreateOptions): Promise<{ windowId: number }> {
      assertCallActive(createOptions);
      const shellOptions = options.windowOptions?.() ?? {};
      const shellWebPreferences = shellOptions.webPreferences ?? {};
      const electronOptions: ElectronBrowserWindowOptionsLike = {
        ...shellOptions,
        title: createOptions.title,
        width: createOptions.width,
        height: createOptions.height,
        resizable: createOptions.resizable ?? true,
        show: false,
        webPreferences: {
          ...shellWebPreferences,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
        },
      };

      let window: ElectronBrowserWindowLike;
      try {
        window = new BrowserWindow(electronOptions);
      } catch (error) {
        throw new PalPortError(PAL_ERROR_CODES.WINDOW_OPERATION_FAILED, undefined, { cause: error });
      }

      const windowId = window.webContents.id;
      let loaded: Promise<void> | void;
      try {
        loaded = window.loadURL(createOptions.url);
      } catch (error) {
        destroyWindow(window);
        throw new PalPortError(PAL_ERROR_CODES.WINDOW_OPERATION_FAILED, undefined, {
          details: { windowId },
          cause: error,
        });
      }

      try {
        await withCallContext(Promise.resolve(loaded), createOptions, () => destroyWindow(window));
      } catch (error) {
        destroyWindow(window);
        throw normalizeWindowError(error, windowId);
      }

      window.on('closed', () => emitSignal('closed', windowId));
      window.on('focus', () => emitSignal('focused', windowId));
      showWhenReady(window);

      return { windowId };
    },

    async list(): Promise<readonly WindowSummary[]> {
      const summaries: WindowSummary[] = [];
      for (const window of BrowserWindow.getAllWindows()) {
        if (window.isDestroyed()) {
          continue;
        }
        summaries.push({
          windowId: window.webContents.id,
          title: window.getTitle(),
          state: readDisplayState(window),
          focused: window.isFocused(),
        });
      }
      return Promise.resolve(summaries);
    },

    async focus(windowId: number, call?: PortCallContext): Promise<void> {
      runWindowOperation(windowId, call, (window) => window.focus());
      return Promise.resolve();
    },

    async close(windowId: number, call?: PortCallContext): Promise<void> {
      runWindowOperation(windowId, call, (window) => window.close());
      return Promise.resolve();
    },

    async resize(windowId: number, size: WindowSize, call?: PortCallContext): Promise<void> {
      runWindowOperation(windowId, call, (window) => window.setSize(size.width, size.height));
      return Promise.resolve();
    },

    async move(windowId: number, position: WindowPosition, call?: PortCallContext): Promise<void> {
      runWindowOperation(windowId, call, (window) => window.setPosition(position.x, position.y));
      return Promise.resolve();
    },

    async setTitle(windowId: number, title: string, call?: PortCallContext): Promise<void> {
      runWindowOperation(windowId, call, (window) => window.setTitle(title));
      return Promise.resolve();
    },

    async setState(windowId: number, state: WindowDisplayState, call?: PortCallContext): Promise<void> {
      runWindowOperation(windowId, call, (window) => applyDisplayState(window, state));
      return Promise.resolve();
    },

    onSignal(listener: (signal: WindowSignal) => void): PalSubscription {
      signalListeners.add(listener);
      let disposed = false;
      return {
        dispose(): void {
          if (disposed) {
            return;
          }
          disposed = true;
          signalListeners.delete(listener);
        },
      };
    },
  };
}

/** 读取窗口显示状态。 */
function readDisplayState(window: ElectronBrowserWindowLike): WindowDisplayState {
  if (window.isFullScreen()) {
    return 'fullscreen';
  }
  if (window.isMinimized()) {
    return 'minimized';
  }
  if (window.isMaximized()) {
    return 'maximized';
  }
  return 'normal';
}

/** 应用窗口显示状态。 */
function applyDisplayState(window: ElectronBrowserWindowLike, state: WindowDisplayState): void {
  switch (state) {
    case 'fullscreen':
      if (!window.isFullScreen()) {
        window.setFullScreen(true);
      }
      return;
    case 'minimized':
      if (!window.isMinimized()) {
        window.minimize();
      }
      return;
    case 'maximized':
      if (window.isFullScreen()) {
        window.setFullScreen(false);
      }
      if (!window.isMaximized()) {
        window.maximize();
      }
      return;
    case 'normal':
      if (window.isFullScreen()) {
        window.setFullScreen(false);
      }
      if (window.isMinimized() || window.isMaximized()) {
        window.restore();
      }
      return;
  }
}

/** 窗口就绪后显示；无 `once` 能力时立即显示。 */
function showWhenReady(window: ElectronBrowserWindowLike): void {
  const show = (): void => {
    if (!window.isDestroyed()) {
      window.show?.();
    }
  };
  if (typeof window.once === 'function') {
    window.once('ready-to-show', show);
  } else {
    show();
  }
}

/** 销毁窗口并吞掉销毁期异常。 */
function destroyWindow(window: ElectronBrowserWindowLike): void {
  try {
    if (!window.isDestroyed()) {
      window.destroy();
    }
  } catch {
    // 窗口可能已随加载失败关闭；保持幂等。
  }
}

/** 归一窗口运行时异常；保留已登记错误码。 */
function normalizeWindowError(error: unknown, windowId: number): PalPortError {
  if (error instanceof PalPortError) {
    return error;
  }
  return new PalPortError(PAL_ERROR_CODES.WINDOW_OPERATION_FAILED, undefined, {
    details: { windowId },
    cause: error,
  });
}
