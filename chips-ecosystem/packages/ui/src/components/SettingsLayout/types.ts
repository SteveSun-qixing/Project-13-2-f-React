import type { ReactNode } from 'react';

/** `SettingsLayout` 属性：设置页骨架。 */
export interface SettingsLayoutProps {
  /** 页面标题。 */
  title?: string;
  /** 页面副标题。 */
  subtitle?: string;
  /** 内容最大宽度，默认 640。 */
  maxWidth?: number;
  children: ReactNode;
}
