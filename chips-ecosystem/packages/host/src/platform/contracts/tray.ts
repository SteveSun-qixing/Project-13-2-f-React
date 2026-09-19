import type { PalSubscription, PortCallContext } from './call.js';

/** 托盘点击按钮；与事件契约 `tray:clicked` 的 `button` 一致。 */
export type TrayClickButton = 'left' | 'right';

/** 托盘设置选项；对应能力契约 `tray:set` 输入。 */
export interface TraySetOptions extends PortCallContext {
  /**
   * 托盘图标路径（绝对路径）。
   *
   * 能力输入 `iconUri`（`chips-resource://`）由能力层解析后传入；缺省时使用端口构造
   * 选项中配置的默认图标，两者都不可用时返回 `TRAY_ICON_INVALID`。
   */
  readonly iconPath?: string;
  /** 悬浮提示（简体中文）。 */
  readonly tooltip?: string;
  /** 是否可见；默认 `true`；`false` 时销毁托盘图标。 */
  readonly visible?: boolean;
}

/**
 * 托盘端口；对应 `tray:set`，并提供壳转发 `tray:clicked` 所需的信号订阅。
 *
 * 权威：`04-能力契约规范` §7.9、`05-事件契约规范` §4.10。
 *
 * @remarks
 * - 首次调用创建托盘图标；后续调用更新图标/提示/可见性。
 * - 图标不可解码或缺失返回 `TRAY_ICON_INVALID`；创建/更新失败返回 `TRAY_SET_FAILED`。
 * - 端口不发布业务事件；壳经 `onClicked` 订阅后发布 `tray:clicked`。
 */
export interface IPalTrayPort {
  /** 创建或更新托盘；`visible: false` 时隐藏（销毁图标）。 */
  set(options: TraySetOptions): Promise<void>;
  /** 订阅托盘点击信号。 */
  onClicked(listener: (button: TrayClickButton) => void): PalSubscription;
}
