import type { CSSProperties, ReactNode } from 'react';

/** `SkeletonBlock` 属性：骨架原子——封面 / 卡片轮廓块。 */
export interface SkeletonBlockProps {
  width?: number | string;
  height?: number | string;
  /** 圆角，默认 10。 */
  radius?: number;
  /** 虚线轮廓：表示可放置内容的空槽位。 */
  dashed?: boolean;
  style?: CSSProperties;
}

/** `SkeletonLine` 属性：骨架原子——文本行。 */
export interface SkeletonLineProps {
  width?: number | string;
  /** 行高，默认 10。 */
  height?: number;
  /** 圆角，默认 5。 */
  radius?: number;
  style?: CSSProperties;
}

/** `SkeletonDot` 属性：骨架原子——时间线节点 / 地图钉。 */
export interface SkeletonDotProps {
  /** 直径，默认 12。 */
  size?: number;
  style?: CSSProperties;
}

/** `EmptyHint` 属性：骨架上的空态小字提示。 */
export interface EmptyHintProps {
  title?: string;
  description?: string;
  align?: 'start' | 'center' | 'end';
  style?: CSSProperties;
}

/** `LayoutSkeleton` 属性：布局骨架容器。 */
export interface LayoutSkeletonProps {
  children: ReactNode;
  /** 顶部提示区（通常为 `EmptyHint`）。 */
  hint?: ReactNode;
  /** 最小高度，默认 280。 */
  minHeight?: number;
}
