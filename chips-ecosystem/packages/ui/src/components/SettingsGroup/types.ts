import type { ReactNode } from 'react';

/** `SettingsGroup` 属性：设置分组。 */
export interface SettingsGroupProps {
  /** 分组标题。 */
  title?: string;
  /** 分组内容行；可省略以渲染空卡片容器。 */
  children?: ReactNode;
}
