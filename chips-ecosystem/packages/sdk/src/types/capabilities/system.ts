/**
 * 窗口、菜单、托盘、快捷键、系统、电源、通知、剪贴板、对话框与外部打开能力契约类型
 * （04-能力契约规范 §7.4–§7.9、§7.14）。
 */

// === 窗口 window:*（§7.4） ===

export interface IWindowCreateInput {
  title: string;
  width: number;
  height: number;
  resizable?: boolean;
  /** 包内相对路径入口；缺省使用 `ui.surface` 入口。 */
  entry?: string;
}

export interface IWindowCreateOutput {
  /** Electron `webContents.id`。 */
  windowId: number;
}

/** 窗口显示状态。 */
export type WindowDisplayState = 'normal' | 'minimized' | 'maximized' | 'fullscreen';

/** 窗口摘要（`window:list` 输出条目）。 */
export interface IWindowInfo {
  windowId: number;
  title: string;
  state: WindowDisplayState;
  focused: boolean;
}

export interface IWindowListOutput {
  windows: IWindowInfo[];
}

export interface IWindowFocusInput {
  windowId: number;
}

export interface IWindowCloseInput {
  windowId: number;
}

export interface IWindowResizeInput {
  windowId: number;
  width: number;
  height: number;
}

export interface IWindowMoveInput {
  windowId: number;
  x: number;
  y: number;
}

export interface IWindowSetTitleInput {
  windowId: number;
  title: string;
}

export interface IWindowSetStateInput {
  windowId: number;
  state: WindowDisplayState;
}

// === 通知 notification:send（§7.5） ===

export interface INotificationSendInput {
  title: string;
  body?: string;
  /** 图标 `chips-resource://` 引用。 */
  iconUri?: string;
  silent?: boolean;
}

// === 剪贴板 clipboard:*（§7.6） ===

export interface IClipboardReadOutput {
  text: string | null;
}

export interface IClipboardWriteInput {
  text: string;
}

// === 对话框 dialog:*（§7.7） ===

export interface IDialogFileFilter {
  name: string;
  extensions: string[];
}

export interface IDialogOpenInput {
  title?: string;
  multiple?: boolean;
  directory?: boolean;
  filters?: IDialogFileFilter[];
}

export interface IDialogOpenOutput {
  canceled: boolean;
  paths: string[];
}

export interface IDialogSaveInput {
  title?: string;
  defaultPath?: string;
  filters?: IDialogFileFilter[];
}

export interface IDialogSaveOutput {
  canceled: boolean;
  path: string | null;
}

// === 外部打开 shell:openExternal（§7.8） ===

export interface IShellOpenExternalInput {
  /** 仅允许 `http` / `https` / `mailto` scheme。 */
  url: string;
}

// === 菜单、托盘与快捷键 menu:* / tray:* / shortcut:*（§7.9） ===

/** 菜单目标：应用菜单或托盘菜单。 */
export type MenuTarget = 'app' | 'tray';

export interface IMenuItem {
  id: string;
  label: string;
  /** 菜单项触发的运行时命令 ID。 */
  command?: string;
  enabled?: boolean;
  submenu?: IMenuItem[];
}

export interface IMenuSetInput {
  target: MenuTarget;
  items: IMenuItem[];
}

export interface ITraySetInput {
  iconUri?: string;
  tooltip?: string;
  visible?: boolean;
}

export interface IShortcutRegisterInput {
  /** 调用方命名空间内唯一。 */
  shortcutId: string;
  /** 快捷键文法（13-命令系统契约 §2.6）。 */
  accelerator: string;
}

export interface IShortcutUnregisterInput {
  shortcutId: string;
}

// === 系统信息与电源 system:* / power:*（§7.14） ===

export type PlatformId = 'darwin' | 'win32' | 'linux' | 'android' | 'ios';

export type PowerIdleState = 'active' | 'idle' | 'locked' | 'unknown';

export type PowerThermalState = 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown';

export interface ISystemInfoOutput {
  platform: PlatformId;
  osVersion: string;
  arch: string;
  appVersion: string;
  locale: string;
  /** 平台目录变量解析结果。 */
  paths: Record<string, string>;
}

export interface IPowerQueryOutput {
  onBattery: boolean;
  /** 无电池设备为 `null`。 */
  batteryLevel: number | null;
  charging: boolean;
  idleState: PowerIdleState;
  thermalState: PowerThermalState;
}

export interface IPowerPreventSleepInput {
  enabled: boolean;
  reason?: string;
}
