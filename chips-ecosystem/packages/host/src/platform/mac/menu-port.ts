import type { IPalMenuPort, MenuActivation, MenuItem, MenuSetOptions, MenuTarget } from '../contracts/index.js';
import type {
  ElectronMenuLike,
  ElectronMenuItemTemplateLike,
  ElectronMenuStaticLike,
} from '../electron/electron-api.js';
import { PAL_ERROR_CODES, PalPortError } from '../errors.js';

/** macOS 菜单端口依赖。 */
export interface MacMenuDependencies {
  /** Electron `Menu` 模块切片。 */
  readonly Menu: ElectronMenuStaticLike;
  /** 托盘上下文菜单接收器；由托盘控制器提供。 */
  readonly setTrayContextMenu: (menu: ElectronMenuLike) => boolean;
}

/**
 * 创建 macOS 菜单端口。
 *
 * 权威：`04-能力契约规范` §7.9、`13-命令系统契约` §5.3。
 *
 * @param dependencies Electron `Menu` 与托盘菜单接收器。
 * @returns `menu:set` 端口实现。
 *
 * @remarks
 * - 菜单模板按能力契约字段逐项转换；`command` 存在时点击经 `onActivate` 交给壳，
 *   由壳以 `source: 'menu'` / `'tray'` 调用命令通道。
 * - macOS 应用菜单自动前置 `{ role: 'appMenu' }`，保留"关于 / 隐藏 / 退出"系统入口。
 * - `target: 'tray'` 时托盘未创建返回 `MENU_SET_FAILED`。
 */
export function createMacMenuPort(dependencies: MacMenuDependencies): IPalMenuPort {
  const { Menu, setTrayContextMenu } = dependencies;

  return {
    async set(target: MenuTarget, items: readonly MenuItem[], options?: MenuSetOptions): Promise<void> {
      try {
        const onActivate = options?.onActivate;
        const template: ElectronMenuItemTemplateLike[] = [];
        if (target === 'app') {
          template.push({ role: 'appMenu' });
        }
        template.push(...items.map((item) => toTemplateItem(item, onActivate)));

        const menu = Menu.buildFromTemplate(template);
        if (target === 'app') {
          Menu.setApplicationMenu(menu);
          return Promise.resolve();
        }
        if (!setTrayContextMenu(menu)) {
          throw new PalPortError(PAL_ERROR_CODES.MENU_SET_FAILED, undefined, {
            details: { reason: 'tray-not-created' },
          });
        }
      } catch (error) {
        if (error instanceof PalPortError) {
          throw error;
        }
        throw new PalPortError(PAL_ERROR_CODES.MENU_SET_FAILED, undefined, { cause: error });
      }
      return Promise.resolve();
    },
  };
}

/** 转换单个菜单项为 Electron 模板项。 */
function toTemplateItem(
  item: MenuItem,
  onActivate: ((activation: MenuActivation) => void) | undefined,
): ElectronMenuItemTemplateLike {
  const template: ElectronMenuItemTemplateLike = {
    id: item.id,
    label: item.label,
    enabled: item.enabled ?? true,
  };

  if (item.submenu !== undefined && item.submenu.length > 0) {
    template.submenu = item.submenu.map((child) => toTemplateItem(child, onActivate));
  } else if (item.command !== undefined && onActivate !== undefined) {
    const command = item.command;
    template.click = () => onActivate({ id: item.id, command });
  }

  return template;
}
