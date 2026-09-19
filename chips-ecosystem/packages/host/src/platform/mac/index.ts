import { release as readOsRelease } from 'node:os';
import type {
  DirectoryVariableName,
  IPalCapabilityMatrix,
  IPalHost,
  IPalPorts,
  IShellInfo,
} from '../contracts/index.js';
import { DIRECTORY_VARIABLE_NAMES } from '../contracts/index.js';
import { PalBootstrapError } from '../errors.js';
import { assemblePalHost } from '../matrix.js';
import { createElectronApi, type IElectronApi } from '../electron/electron-api.js';
import { createChildProcessCommandRunner, type CommandRunner } from './command-runner.js';
import { createMacClipboardPort } from './clipboard-port.js';
import { createMacDialogPort } from './dialog-port.js';
import { createMacHttpPort } from './http-port.js';
import { createMacMenuPort } from './menu-port.js';
import { createMacNotificationPort } from './notification-port.js';
import { createMacPowerPort } from './power-port.js';
import { createMacShellOpenPort } from './shell-open-port.js';
import { createMacShortcutPort } from './shortcut-port.js';
import { createMacStoragePort } from './storage-port.js';
import { createMacSystemPort, DIRECTORY_PATH_NAMES } from './system-port.js';
import { createMacTransferPort } from './transfer-port.js';
import { createMacTrayController, type MacTrayController } from './tray-port.js';
import { createMacWindowPort, type MacWindowPortOptions } from './window-port.js';
import type { NetworkLimits } from './net-request.js';
import type { ElectronBrowserWindowOptionsLike } from '../electron/electron-api.js';

/** macOS PAL 宿主构造选项。 */
export interface MacPalHostOptions {
  /** 宿主平台标识（默认 `process.platform`）；非 `darwin` 时拒绝构造。 */
  readonly hostPlatform?: NodeJS.Platform;
  /** 壳提供的窗口构造参数（preload、附加参数等）；安全基线由端口强制。 */
  readonly windowOptions?: MacWindowPortOptions['windowOptions'];
  /** 默认托盘图标路径；`tray:set` 未提供图标时使用。 */
  readonly trayDefaultIconPath?: string;
  /** 命令执行器（`pmset`）；默认 `child_process.execFile`。 */
  readonly runCommand?: CommandRunner;
  /** 网络限制覆盖；默认资源管理设计 §8.2 基线。 */
  readonly networkLimits?: Partial<NetworkLimits>;
  /** 传输进度回调最小间隔（毫秒）；默认 200。 */
  readonly progressIntervalMs?: number;
  /** Electron `process.getSystemVersion()`；缺省回退 `os.release()`。 */
  readonly getSystemVersion?: () => string;
  /** 进程架构覆盖（测试用）；默认 `process.arch`。 */
  readonly arch?: string;
}

/** macOS PAL 宿主；在 `IPalHost` 之上提供壳资源释放入口。 */
export interface MacPalHost extends IPalHost {
  /**
   * 释放壳持有的系统资源（托盘、抑制句柄等）。
   *
   * @remarks 壳退出时调用，幂等；不影响端口契约。
   */
  dispose(): void;
}

/**
 * 创建 macOS PAL 宿主。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4、§4.2、§5.1。
 *
 * @param electronModule `require('electron')` 返回值或测试注入的 mock。
 * @param options 壳选项。
 * @returns 完成自检的 `MacPalHost`。
 * @throws {PalBootstrapError} 平台不是 macOS、Electron 模块形状非法、
 * 或能力矩阵与端口实现不一致时抛出（终止壳启动）。
 */
export function createMacPalHost(electronModule: unknown, options: MacPalHostOptions = {}): MacPalHost {
  const hostPlatform = options.hostPlatform ?? process.platform;
  if (hostPlatform !== 'darwin') {
    throw new PalBootstrapError('该 PAL 实现仅适用于 macOS', { hostPlatform });
  }

  const electron = createElectronApi(electronModule);

  const availability: IPalCapabilityMatrix = {
    window: electron.BrowserWindow !== undefined,
    dialog: electron.dialog !== undefined,
    notification: electron.Notification !== undefined,
    clipboard: electron.clipboard !== undefined,
    menu: electron.Menu !== undefined,
    tray: electron.Tray !== undefined && electron.nativeImage !== undefined,
    shortcut: electron.globalShortcut !== undefined,
    power: electron.powerMonitor !== undefined && electron.powerSaveBlocker !== undefined,
    systemInfo: true,
    transfer: electron.net !== undefined,
    shellOpen: electron.shell !== undefined,
    http: electron.net !== undefined,
  };

  const trayController = createTrayController(electron, options);
  const ports = {
    storage: createMacStoragePort(),
    ...(availability.window && electron.BrowserWindow !== undefined
      ? {
          window: createMacWindowPort(
            { BrowserWindow: electron.BrowserWindow },
            options.windowOptions !== undefined ? { windowOptions: options.windowOptions } : {},
          ),
        }
      : {}),
    ...(availability.dialog && electron.dialog !== undefined ? { dialog: createMacDialogPort(electron.dialog) } : {}),
    ...(availability.notification && electron.Notification !== undefined
      ? { notification: createMacNotificationPort(electron.Notification) }
      : {}),
    ...(availability.clipboard && electron.clipboard !== undefined
      ? { clipboard: createMacClipboardPort(electron.clipboard) }
      : {}),
    ...(availability.menu && electron.Menu !== undefined
      ? {
          menu: createMacMenuPort({
            Menu: electron.Menu,
            setTrayContextMenu: (menu) => trayController?.setContextMenu(menu) ?? false,
          }),
        }
      : {}),
    ...(availability.tray && trayController !== null ? { tray: trayController.port } : {}),
    ...(availability.shortcut && electron.globalShortcut !== undefined
      ? { shortcut: createMacShortcutPort(electron.globalShortcut) }
      : {}),
    ...(availability.power && electron.powerMonitor !== undefined && electron.powerSaveBlocker !== undefined
      ? {
          power: createMacPowerPort({
            powerMonitor: electron.powerMonitor,
            powerSaveBlocker: electron.powerSaveBlocker,
            runCommand: options.runCommand ?? createChildProcessCommandRunner(),
          }),
        }
      : {}),
    system: createMacSystemPort({
      app: electron.app,
      ...(options.arch !== undefined ? { arch: options.arch } : {}),
      ...(options.getSystemVersion !== undefined ? { getSystemVersion: options.getSystemVersion } : {}),
    }),
    ...(availability.transfer && electron.net !== undefined
      ? {
          transfer: createMacTransferPort({
            net: electron.net,
            ...(options.networkLimits !== undefined ? { limits: options.networkLimits } : {}),
            ...(options.progressIntervalMs !== undefined ? { progressIntervalMs: options.progressIntervalMs } : {}),
          }),
        }
      : {}),
    ...(availability.shellOpen && electron.shell !== undefined
      ? { shellOpen: createMacShellOpenPort(electron.shell) }
      : {}),
    ...(availability.http && electron.net !== undefined
      ? {
          http: createMacHttpPort({
            net: electron.net,
            ...(options.networkLimits !== undefined ? { limits: options.networkLimits } : {}),
          }),
        }
      : {}),
  } satisfies Partial<IPalPorts>;

  const info = buildShellInfo(electron, options);
  const host = assemblePalHost(info, availability, ports);
  return {
    ...host,
    dispose(): void {
      trayController?.dispose();
    },
  };
}

/** 构造壳信息；任一必需信息读取失败视为启动失败。 */
function buildShellInfo(electron: IElectronApi, options: MacPalHostOptions): IShellInfo {
  try {
    const osVersion = options.getSystemVersion !== undefined ? options.getSystemVersion() : readSystemVersion();
    const paths = {} as Record<DirectoryVariableName, string>;
    for (const variable of DIRECTORY_VARIABLE_NAMES) {
      paths[variable] = electron.app.getPath(DIRECTORY_PATH_NAMES[variable]);
    }
    return {
      shell: 'desktop',
      platform: 'macos',
      osVersion,
      arch: options.arch ?? process.arch,
      appVersion: electron.app.getVersion(),
      locale: electron.app.getLocale(),
      paths,
    };
  } catch (error) {
    throw new PalBootstrapError('壳信息初始化失败', { cause: error });
  }
}

/** 读取系统版本；优先 Electron `process.getSystemVersion()`。 */
function readSystemVersion(): string {
  const nodeProcess = process as NodeJS.Process & { getSystemVersion?: () => string };
  if (typeof nodeProcess.getSystemVersion === 'function') {
    return nodeProcess.getSystemVersion();
  }
  return readOsRelease();
}

/** 创建托盘控制器；依赖缺失时返回 `null`（矩阵同步为 `false`）。 */
function createTrayController(electron: IElectronApi, options: MacPalHostOptions): MacTrayController | null {
  if (electron.Tray === undefined || electron.nativeImage === undefined) {
    return null;
  }
  return createMacTrayController(
    { Tray: electron.Tray, nativeImage: electron.nativeImage },
    options.trayDefaultIconPath !== undefined ? { defaultIconPath: options.trayDefaultIconPath } : {},
  );
}

/** 未使用的窗口选项类型别名，保持公开类型面可推导。 */
export type MacWindowOptionsLike = ElectronBrowserWindowOptionsLike;
