import type { ReactNode } from 'react';

/** `SettingsRow` 属性：设置行（标签、说明与控件）。 */
export interface SettingsRowProps {
  /** 行标签（简体中文直写）。 */
  label: string;
  /** 行说明。 */
  description?: string;
  /** 右侧控件。 */
  control?: ReactNode;
  /** 整行点击回调；提供时行可键盘操作。 */
  onClick?: () => void;
  /** 禁用整行交互。 */
  disabled?: boolean;
}
