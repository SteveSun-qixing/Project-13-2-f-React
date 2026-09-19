import type { PortCallContext } from './call.js';

/**
 * 快捷键端口；方法与非插件可见的 `shortcut:*` 能力动作一一对应。
 *
 * 权威：`04-能力契约规范` §7.9。
 *
 * @remarks
 * - `shortcutId` 由调用方命名空间管理；重复注册同一 ID 覆盖旧绑定。
 * - 文法非法返回 `SHORTCUT_ACCELERATOR_INVALID`；被其他绑定占用返回 `SHORTCUT_CONFLICT`；
 *   系统限制注册失败返回 `SHORTCUT_REGISTER_FAILED`。
 * - `unregister` 幂等，不存在视为成功。
 * - 端口不发布业务事件；触发信号经 `register` 的回调交给壳，由壳发布 `shortcut:triggered`。
 */
export interface IPalShortcutPort {
  /** 注册（或覆盖）全局快捷键。 */
  register(shortcutId: string, accelerator: string, onTrigger: () => void, call?: PortCallContext): Promise<void>;
  /** 注销快捷键；幂等。 */
  unregister(shortcutId: string, call?: PortCallContext): Promise<void>;
}
