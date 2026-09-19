import type { CSSProperties, ReactNode } from 'react';

/** `AppChrome` 属性：应用窗口外壳。 */
export interface AppChromeProps {
  children: ReactNode;
  /** 命令面板打开快捷键；默认 `CommandOrControl+P`。 */
  paletteShortcut?: string;
  /** 底部区域；用于状态或摘要信息。 */
  footer?: ReactNode;
  /** 沉浸式内容区：去掉内容区内边距，交由内容自行布局。 */
  immersive?: boolean;
  /** 内容区附加样式；仅用于布局组合。 */
  contentStyle?: CSSProperties;
}
