/**
 * 菜单目标；与能力契约 `menu:set` 的 `target` 枚举一致。
 *
 * 权威：`04-能力契约规范` §7.9。
 */
export type MenuTarget = 'app' | 'tray';

/**
 * 菜单项；字段与能力契约 `IMenuItem` 一致。
 *
 * 权威：`04-能力契约规范` §7.9。
 */
export interface MenuItem {
  /** 菜单项 ID（调用方命名空间内唯一）。 */
  readonly id: string;
  /** 菜单项文案（简体中文）。 */
  readonly label: string;
  /** 关联命令 ID；触发时经应用命令通道投递。 */
  readonly command?: string;
  /** 是否启用；默认 `true`。 */
  readonly enabled?: boolean;
  /** 子菜单。 */
  readonly submenu?: readonly MenuItem[];
}

/** 菜单项被激活时向壳转发的信号。 */
export interface MenuActivation {
  /** 被激活菜单项的 ID。 */
  readonly id: string;
  /** 关联命令 ID；无命令时为 `null`。 */
  readonly command: string | null;
}

/** 菜单设置选项。 */
export interface MenuSetOptions {
  /** 菜单项激活回调；壳据此以 `source: 'menu'` / `'tray'` 调用命令通道。 */
  readonly onActivate?: (activation: MenuActivation) => void;
}

/**
 * 菜单端口；对应 `menu:set`。
 *
 * 权威：`04-能力契约规范` §7.9、`13-命令系统契约` §5.3。
 *
 * @remarks
 * - 整表替换，空数组表示清空。
 * - macOS 应用菜单自动前置系统应用菜单（`role: 'appMenu'`），保证"关于/隐藏/退出"等
 *   系统级入口存在；插件自定义项不会覆盖系统级入口。
 * - `target: 'tray'` 时托盘实例必须已存在（先经 `tray:set` 创建），否则返回 `MENU_SET_FAILED`。
 */
export interface IPalMenuPort {
  /** 设置应用菜单或托盘菜单。 */
  set(target: MenuTarget, items: readonly MenuItem[], options?: MenuSetOptions): Promise<void>;
}
