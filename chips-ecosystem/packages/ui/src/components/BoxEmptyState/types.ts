import type { ReactNode } from 'react';

/** `BoxEmptyState` 属性：布局插件空箱子占位。 */
export interface BoxEmptyStateProps {
  /** 主提示文案；缺省“这里还没有内容”。 */
  title?: string;
  /** 说明文案；缺省引导去编辑器添加内容。 */
  description?: string;
  /** 可选操作区（通常为按钮）。 */
  action?: ReactNode;
  /** 紧凑形态：缩小插画与间距。 */
  compact?: boolean;
}
