import type { ReactNode } from 'react';

/** `Toolbar` 属性：按 `toolbarId` 渲染命令视图按钮组。 */
export interface ToolbarProps {
  /** 与命令定义 `toolbars[].toolbarId` 对应。 */
  toolbarId: string;
  /** 附加区域：非命令形态的自定义控件。 */
  children?: ReactNode;
}
