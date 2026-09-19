import type { IPalClipboardPort } from './clipboard.js';
import type { IPalDialogPort } from './dialog.js';
import type { IPalHttpPort } from './http.js';
import type { IPalMenuPort } from './menu.js';
import type { IPalNotificationPort } from './notification.js';
import type { IPalPowerPort } from './power.js';
import type { IPalShellOpenPort } from './shell-open.js';
import type { IPalShortcutPort } from './shortcut.js';
import type { IPalStoragePort } from './storage.js';
import type { IPalSystemPort } from './system.js';
import type { IPalTransferPort } from './transfer.js';
import type { IPalTrayPort } from './tray.js';
import type { IPalWindowPort } from './window.js';

/**
 * 壳形态；平台内部标识，不向插件暴露。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §4.2。
 */
export type ShellKind = 'desktop' | 'headless' | 'mobile';

/**
 * 平台标识（内部口径）；对插件可见的平台标识只出现在 `system:info.platform`。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §4.2、§4.4。
 */
export type PlatformId = 'macos' | 'windows' | 'linux' | 'android' | 'ios';

/** 壳信息；平台核心据此建立目录变量与诊断上下文。 */
export interface IShellInfo {
  /** 壳形态。 */
  readonly shell: ShellKind;
  /** 平台标识（内部口径）。 */
  readonly platform: PlatformId;
  /** 操作系统版本。 */
  readonly osVersion: string;
  /** CPU 架构。 */
  readonly arch: string;
  /** 平台应用版本。 */
  readonly appVersion: string;
  /** 当前区域设置。 */
  readonly locale: string;
  /** 目录变量解析结果（键为目录变量名）。 */
  readonly paths: Readonly<Record<string, string>>;
}

/**
 * 壳能力矩阵；只供 Bridge 内置能力注册层消费，不通过 Bridge 暴露。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §4.2、§4.4、§5.1。
 */
export interface IPalCapabilityMatrix {
  /** 窗口分面（`window:*`）。 */
  readonly window: boolean;
  /** 对话框分面（`dialog:*`）。 */
  readonly dialog: boolean;
  /** 通知分面（`notification:send`）。 */
  readonly notification: boolean;
  /** 剪贴板分面（`clipboard:*`）。 */
  readonly clipboard: boolean;
  /** 菜单分面（`menu:set`）。 */
  readonly menu: boolean;
  /** 托盘分面（`tray:set`）。 */
  readonly tray: boolean;
  /** 全局快捷键分面（`shortcut:*`）。 */
  readonly shortcut: boolean;
  /** 电源分面（`power:*`）。 */
  readonly power: boolean;
  /** 系统信息分面（`system:info`）。 */
  readonly systemInfo: boolean;
  /** 传输分面（`transfer:*`）。 */
  readonly transfer: boolean;
  /** 外部打开分面（`shell:openExternal`）。 */
  readonly shellOpen: boolean;
  /** HTTP 分面（`http:request`）。 */
  readonly http: boolean;
}

/**
 * PAL 端口集合。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §4.2。
 *
 * @remarks
 * - `storage` 为必备端口；其余分面按能力矩阵可选。
 * - 端口可选性与矩阵一致，由壳自检保证（`matrix.ts`）。
 */
export interface IPalPorts {
  /** 文件存储端口（必备）。 */
  readonly storage: IPalStoragePort;
  /** 窗口端口。 */
  readonly window?: IPalWindowPort;
  /** 对话框端口。 */
  readonly dialog?: IPalDialogPort;
  /** 通知端口。 */
  readonly notification?: IPalNotificationPort;
  /** 剪贴板端口。 */
  readonly clipboard?: IPalClipboardPort;
  /** 菜单端口。 */
  readonly menu?: IPalMenuPort;
  /** 托盘端口。 */
  readonly tray?: IPalTrayPort;
  /** 快捷键端口。 */
  readonly shortcut?: IPalShortcutPort;
  /** 电源端口。 */
  readonly power?: IPalPowerPort;
  /** 系统信息端口。 */
  readonly system?: IPalSystemPort;
  /** 传输端口。 */
  readonly transfer?: IPalTransferPort;
  /** 外部打开端口。 */
  readonly shellOpen?: IPalShellOpenPort;
  /** HTTP 端口。 */
  readonly http?: IPalHttpPort;
}

/** 无头壳在需要服务端渲染时提供的离屏帧宿主；桌面与移动壳不使用该字段。 */
export interface IPalRenderHost {
  /** 创建离屏帧会话。 */
  createSession(options: Readonly<Record<string, unknown>>): Promise<{ readonly sessionId: string }>;
  /** 释放离屏帧会话。 */
  disposeSession(sessionId: string): Promise<void>;
}

/**
 * PAL 宿主；壳向平台核心提供的唯一平台能力面。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4、§4.2。
 */
export interface IPalHost {
  /** 壳信息。 */
  readonly info: IShellInfo;
  /** 能力矩阵。 */
  readonly matrix: IPalCapabilityMatrix;
  /** 端口集合。 */
  readonly ports: IPalPorts;
  /** 无头壳离屏帧宿主；桌面与移动壳不使用。 */
  readonly render?: IPalRenderHost;
}

/**
 * 能力分面清单；顺序与 `IPalCapabilityMatrix` 字段一致，供矩阵构建与自检遍历。
 */
export const PAL_FACETS = [
  'window',
  'dialog',
  'notification',
  'clipboard',
  'menu',
  'tray',
  'shortcut',
  'power',
  'systemInfo',
  'transfer',
  'shellOpen',
  'http',
] as const;

/** 能力分面名。 */
export type PalFacet = (typeof PAL_FACETS)[number];

/** 分面到端口键的映射；`systemInfo` 分面对应 `system` 端口。 */
export const PAL_FACET_PORT_KEYS: Readonly<Record<PalFacet, keyof IPalPorts>> = {
  window: 'window',
  dialog: 'dialog',
  notification: 'notification',
  clipboard: 'clipboard',
  menu: 'menu',
  tray: 'tray',
  shortcut: 'shortcut',
  power: 'power',
  systemInfo: 'system',
  transfer: 'transfer',
  shellOpen: 'shellOpen',
  http: 'http',
};
