/** `CommandPalette` 属性：命令面板。 */
export interface CommandPaletteProps {
  /** 受控开关；省略时组件自行管理开关与快捷键。 */
  open?: boolean;
  /** 关闭回调；受控与非受控模式都会调用。 */
  onClose?: () => void;
  /** 面板打开快捷键；默认 `CommandOrControl+P`；只控制面板开关，不注册命令。 */
  paletteShortcut?: string;
  /** 搜索框占位文案。 */
  placeholder?: string;
  /** 无匹配结果时的文案。 */
  emptyText?: string;
}
