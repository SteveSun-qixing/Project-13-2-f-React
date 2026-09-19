import type { PortCallContext } from './call.js';

/** 通知发送选项。 */
export interface NotificationSendOptions extends PortCallContext {
  /** 通知标题。 */
  readonly title: string;
  /** 通知正文。 */
  readonly body?: string;
  /**
   * 图标路径（绝对路径）。
   *
   * 能力输入 `iconUri`（`chips-resource://`）由能力层解析为本地路径后传入；
   * 端口不感知资源协议。
   */
  readonly iconPath?: string;
  /** 是否静音；默认 `false`。 */
  readonly silent?: boolean;
}

/**
 * 通知端口；对应 `notification:send`。
 *
 * 权威：`04-能力契约规范` §7.5。
 *
 * @remarks
 * 系统通知不可用时返回 `NOTIFICATION_UNAVAILABLE`（能力仍注册，见 17 号文档 §5.2）；
 * 发送失败返回 `NOTIFICATION_FAILED`。
 */
export interface IPalNotificationPort {
  /** 发送系统通知。 */
  send(options: NotificationSendOptions): Promise<void>;
}
