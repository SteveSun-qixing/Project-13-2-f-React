import type { ReactNode } from 'react';

/** `PanelHeader` 属性：面板标题、说明与操作区。 */
export interface PanelHeaderProps {
  /** 标题（简体中文直写）。 */
  title: string;
  /** 补充说明。 */
  description?: string;
  /** 右侧操作区。 */
  extra?: ReactNode;
}
