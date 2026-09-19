import type { ReactNode } from 'react';

import type { ChipsUiFailure } from '../../utils';

/** `StateBoundary` 属性：加载 / 错误 / 空态边界。 */
export interface StateBoundaryProps {
  /** 加载中。 */
  loading?: boolean;
  /** 失败信息（与 `ChipsError` 结构兼容）。 */
  error?: ChipsUiFailure | null;
  /** 空态。 */
  empty?: boolean;
  /** 空态说明；缺省“暂无内容”。 */
  emptyText?: string;
  /** 错误态重试回调。 */
  onRetry?: () => void;
  /** 加载 / 空态的最小高度，默认 160。 */
  minHeight?: number;
  /** 边界态之外的正常内容；可省略以渲染纯状态占位。 */
  children?: ReactNode;
}
