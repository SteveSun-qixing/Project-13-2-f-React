import type { IPalNotificationPort, NotificationSendOptions } from '../contracts/index.js';
import { assertCallActive } from '../call-guard.js';
import type { ElectronNotificationCtorLike, ElectronNotificationOptionsLike } from '../electron/electron-api.js';
import { PAL_ERROR_CODES, PalPortError } from '../errors.js';

/**
 * 创建 macOS 通知端口。
 *
 * 权威：`04-能力契约规范` §7.5、`17-跨端Shell与平台抽象设计` §5.2。
 *
 * @param Notification Electron `Notification` 构造器切片。
 * @returns `notification:send` 端口实现。
 *
 * @remarks
 * 分面存在但环境不可用（系统不支持通知）时返回 `NOTIFICATION_UNAVAILABLE`（可重试）；
 * 发送失败返回 `NOTIFICATION_FAILED`。端口不伪造成功、不记录通知内容。
 */
export function createMacNotificationPort(Notification: ElectronNotificationCtorLike): IPalNotificationPort {
  return {
    async send(options: NotificationSendOptions): Promise<void> {
      assertCallActive(options);
      if (Notification.isSupported?.() === false) {
        throw new PalPortError(PAL_ERROR_CODES.NOTIFICATION_UNAVAILABLE);
      }
      try {
        const payload: ElectronNotificationOptionsLike = {
          title: options.title,
        };
        if (options.body !== undefined) {
          payload.body = options.body;
        }
        if (options.silent !== undefined) {
          payload.silent = options.silent;
        }
        if (options.iconPath !== undefined) {
          payload.icon = options.iconPath;
        }
        new Notification(payload).show();
        return Promise.resolve();
      } catch (error) {
        throw new PalPortError(PAL_ERROR_CODES.NOTIFICATION_FAILED, undefined, { cause: error });
      }
    },
  };
}
