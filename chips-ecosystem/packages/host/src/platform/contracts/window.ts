import type { PalSubscription, PortCallContext } from './call.js';

/**
 * 窗口显示状态；与能力契约 `window:setState` 的 `state` 枚举一致。
 *
 * 权威：`04-能力契约规范` §7.4。
 */
export type WindowDisplayState = 'normal' | 'minimized' | 'maximized' | 'fullscreen';

/** 窗口创建选项。 */
export interface WindowCreateOptions extends PortCallContext {
  /** 窗口标题。 */
  readonly title: string;
  /** 内容宽度（像素）。 */
  readonly width: number;
  /** 内容高度（像素）。 */
  readonly height: number;
  /** 是否允许用户调整大小；默认 `true`。 */
  readonly resizable?: boolean;
  /**
   * 已由核心解析完成的加载地址（`chips-resource://` 或平台内部地址）。
   *
   * 端口不处理包内相对路径与 `entry` 解析，避免在壳层引入资源语义。
   */
  readonly url: string;
}

/** 窗口尺寸。 */
export interface WindowSize {
  /** 宽度（像素）。 */
  readonly width: number;
  /** 高度（像素）。 */
  readonly height: number;
}

/** 窗口屏幕坐标。 */
export interface WindowPosition {
  /** 屏幕 X 坐标（像素）。 */
  readonly x: number;
  /** 屏幕 Y 坐标（像素）。 */
  readonly y: number;
}

/**
 * 窗口摘要；`windowId` 为 Electron `webContents.id`。
 *
 * 权威：`04-能力契约规范` §7.4、`05-事件契约规范` §4.7。
 */
export interface WindowSummary {
  /** 窗口 ID（Electron `webContents.id`）。 */
  readonly windowId: number;
  /** 当前标题。 */
  readonly title: string;
  /** 当前显示状态。 */
  readonly state: WindowDisplayState;
  /** 是否聚焦。 */
  readonly focused: boolean;
}

/** 窗口端口向壳转发的系统信号种类。 */
export type WindowSignalKind = 'closed' | 'focused';

/** 窗口端口向壳转发的系统信号；壳据此发布 `window:closed` / `window:focused`。 */
export interface WindowSignal {
  /** 信号种类。 */
  readonly kind: WindowSignalKind;
  /** 窗口 ID（Electron `webContents.id`）。 */
  readonly windowId: number;
}

/**
 * 窗口端口；方法与非插件可见的 `window:*` 能力动作一一对应。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §4.2（示例）、`04-能力契约规范` §7.4。
 *
 * @remarks
 * - 端口只做系统适配与系统级约束；参数校验、权限判定由能力层在调用端口前完成。
 * - 端口不创建第二个窗口注册表；`list` 返回应用全部窗口摘要，由核心按会话过滤。
 */
export interface IPalWindowPort {
  /** 创建窗口并加载核心解析后的地址；返回新窗口 ID。 */
  create(options: WindowCreateOptions): Promise<{ readonly windowId: number }>;
  /** 列出应用全部窗口摘要（含非本端口创建的窗口）。 */
  list(): Promise<readonly WindowSummary[]>;
  /** 聚焦窗口；自身窗口免权限判定由核心处理。 */
  focus(windowId: number, call?: PortCallContext): Promise<void>;
  /** 关闭窗口；未保存状态由应用在调用前处理。 */
  close(windowId: number, call?: PortCallContext): Promise<void>;
  /** 调整窗口内容尺寸。 */
  resize(windowId: number, size: WindowSize, call?: PortCallContext): Promise<void>;
  /** 移动窗口到屏幕坐标。 */
  move(windowId: number, position: WindowPosition, call?: PortCallContext): Promise<void>;
  /** 设置窗口标题。 */
  setTitle(windowId: number, title: string, call?: PortCallContext): Promise<void>;
  /** 设置窗口显示状态。 */
  setState(windowId: number, state: WindowDisplayState, call?: PortCallContext): Promise<void>;
  /**
   * 订阅窗口关闭/聚焦信号。
   *
   * 端口自身不发布业务事件（PAL-3）；壳收到信号后经核心事件总线发布对应事件。
   */
  onSignal(listener: (signal: WindowSignal) => void): PalSubscription;
}
