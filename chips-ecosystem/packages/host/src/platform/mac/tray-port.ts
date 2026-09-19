import type { IPalTrayPort, PalSubscription, TrayClickButton, TraySetOptions } from '../contracts/index.js';
import { assertCallActive } from '../call-guard.js';
import type {
  ElectronMenuLike,
  ElectronNativeImageLike,
  ElectronNativeImageModuleLike,
  ElectronTrayCtorLike,
  ElectronTrayLike,
} from '../electron/electron-api.js';
import { PAL_ERROR_CODES, PalPortError } from '../errors.js';

/** macOS 托盘控制器依赖。 */
export interface MacTrayDependencies {
  /** Electron `Tray` 构造器。 */
  readonly Tray: ElectronTrayCtorLike;
  /** Electron `nativeImage` 模块。 */
  readonly nativeImage: ElectronNativeImageModuleLike;
}

/** 托盘控制器选项。 */
export interface MacTrayControllerOptions {
  /** 默认托盘图标路径；`tray:set` 未提供图标且已有图标未被设置时使用。 */
  readonly defaultIconPath?: string;
}

/** 托盘控制器；同时提供端口与菜单端口所需的上下文菜单入口。 */
export interface MacTrayController {
  /** 托盘端口（`tray:set` + 点击订阅）。 */
  readonly port: IPalTrayPort;
  /**
   * 设置托盘上下文菜单。
   *
   * @param menu 已构建的 Electron 菜单。
   * @returns 托盘实例存在并设置成功时为 `true`；托盘未创建时为 `false`（调用方返回 `MENU_SET_FAILED`）。
   */
  setContextMenu(menu: ElectronMenuLike): boolean;
  /** 释放托盘；壳退出时调用，幂等。 */
  dispose(): void;
}

/**
 * 创建 macOS 托盘控制器。
 *
 * 权威：`04-能力契约规范` §7.9、`05-事件契约规范` §4.10。
 *
 * @param dependencies Electron `Tray` / `nativeImage` 切片。
 * @param options 默认图标等选项。
 */
export function createMacTrayController(
  dependencies: MacTrayDependencies,
  options: MacTrayControllerOptions = {},
): MacTrayController {
  const { Tray, nativeImage } = dependencies;
  const listeners = new Set<(button: TrayClickButton) => void>();
  let tray: ElectronTrayLike | null = null;
  let currentIconPath: string | null = options.defaultIconPath ?? null;
  let currentTooltip = '';
  let currentMenu: ElectronMenuLike | null = null;

  const emitClick = (button: TrayClickButton): void => {
    for (const listener of listeners) {
      listener(button);
    }
  };

  const destroyTray = (): void => {
    if (tray === null) {
      return;
    }
    try {
      if (tray.isDestroyed?.() !== true) {
        tray.destroy();
      }
    } catch {
      // 托盘已随进程退出销毁；忽略销毁期异常，保持幂等。
    }
    tray = null;
  };

  const decodeIcon = (iconPath: string): ElectronNativeImageLike => {
    let image: ElectronNativeImageLike;
    try {
      image = nativeImage.createFromPath(iconPath);
    } catch (error) {
      throw new PalPortError(PAL_ERROR_CODES.TRAY_ICON_INVALID, undefined, { cause: error });
    }
    if (image.isEmpty?.() === true) {
      throw new PalPortError(PAL_ERROR_CODES.TRAY_ICON_INVALID);
    }
    return image;
  };

  const port: IPalTrayPort = {
    async set(trayOptions: TraySetOptions): Promise<void> {
      assertCallActive(trayOptions);
      const visible = trayOptions.visible ?? true;
      if (!visible) {
        destroyTray();
        return Promise.resolve();
      }

      if (trayOptions.iconPath !== undefined) {
        currentIconPath = trayOptions.iconPath;
      }
      if (trayOptions.tooltip !== undefined) {
        currentTooltip = trayOptions.tooltip;
      }

      try {
        if (tray === null) {
          if (currentIconPath === null) {
            throw new PalPortError(PAL_ERROR_CODES.TRAY_ICON_INVALID);
          }
          const created = new Tray(decodeIcon(currentIconPath));
          created.on('click', () => emitClick('left'));
          created.on('right-click', () => emitClick('right'));
          created.setToolTip(currentTooltip);
          if (currentMenu !== null) {
            created.setContextMenu(currentMenu);
          }
          tray = created;
          return Promise.resolve();
        }

        if (trayOptions.iconPath !== undefined) {
          tray.setImage(decodeIcon(trayOptions.iconPath));
        }
        if (trayOptions.tooltip !== undefined) {
          tray.setToolTip(currentTooltip);
        }
      } catch (error) {
        if (error instanceof PalPortError) {
          throw error;
        }
        throw new PalPortError(PAL_ERROR_CODES.TRAY_SET_FAILED, undefined, { cause: error });
      }
      return Promise.resolve();
    },

    onClicked(listener: (button: TrayClickButton) => void): PalSubscription {
      listeners.add(listener);
      let disposed = false;
      return {
        dispose(): void {
          if (disposed) {
            return;
          }
          disposed = true;
          listeners.delete(listener);
        },
      };
    },
  };

  return {
    port,
    setContextMenu(menu: ElectronMenuLike): boolean {
      currentMenu = menu;
      if (tray === null) {
        return false;
      }
      tray.setContextMenu(menu);
      return true;
    },
    dispose(): void {
      listeners.clear();
      destroyTray();
    },
  };
}
