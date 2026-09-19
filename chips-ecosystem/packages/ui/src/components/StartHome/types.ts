import type { ReactNode } from 'react';

/** `StartHome` 属性：无打开目标时的统一起始页。 */
export interface StartHomeProps {
  /** 应用名（简体中文直写）。 */
  title: string;
  /** 一句话说明。 */
  description: string;
  /** 支持格式说明。 */
  formatsText: string;
  /** 打开按钮文案。 */
  openLabel: string;
  /** 打开快捷键展示文本（`formatAccelerator` 的输出）。 */
  shortcutText: string;
  /** 拖放态提示文案。 */
  dragActiveText: string;
  /** 是否处于拖放悬停态。 */
  dragActive: boolean;
  /** 打开动作。 */
  onOpen: () => void;
  /** 应用图标。 */
  icon?: ReactNode;
  /** 新建按钮文案；与 `onCreate` 同时提供时渲染新建入口。 */
  createLabel?: string;
  /** 新建动作。 */
  onCreate?: () => void;
}
