/**
 * 布局骨架族：骨架容器、骨架原子（块 / 行 / 点）与骨架上的空态提示。
 *
 * 契约：《08-@chips-ui共享层使用指南》§2.1、§2.2；视觉规则见《08-产品与交互/07-官方布局视觉细则》§五。
 * 骨架元素一律 `aria-hidden`（纯装饰），提示文案对屏幕阅读器可读；数值取 Design Tokens。
 */

import { theme } from '@chips/antd';
import type { GlobalToken } from '@chips/antd';
import React from 'react';
import type { CSSProperties } from 'react';

import type {
  EmptyHintProps,
  LayoutSkeletonProps,
  SkeletonBlockProps,
  SkeletonDotProps,
  SkeletonLineProps,
} from './types';

/** 骨架底色：浅色系统灰 6 与深色三级系统填充（《统一视觉规范》§2.8 映射）。 */
function skeletonFill(token: GlobalToken): string {
  return token.colorFillSecondary;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width,
  height,
  radius = 10,
  dashed = false,
  style,
}) => {
  const { token } = theme.useToken();
  const fill = skeletonFill(token);
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        boxSizing: 'border-box',
        width,
        height,
        borderRadius: radius,
        border: dashed ? `1px dashed ${token.colorBorder}` : undefined,
        background: dashed ? 'transparent' : fill,
        ...style,
      }}
    />
  );
};

export const SkeletonLine: React.FC<SkeletonLineProps> = ({
  width,
  height = 10,
  radius = 5,
  style,
}) => {
  const { token } = theme.useToken();
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        boxSizing: 'border-box',
        width,
        height,
        borderRadius: radius,
        background: skeletonFill(token),
        ...style,
      }}
    />
  );
};

export const SkeletonDot: React.FC<SkeletonDotProps> = ({ size = 12, style }) => {
  const { token } = theme.useToken();
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        boxSizing: 'border-box',
        width: size,
        height: size,
        borderRadius: '50%',
        background: skeletonFill(token),
        ...style,
      }}
    />
  );
};

const ALIGNMENT: Readonly<Record<NonNullable<EmptyHintProps['align']>, string>> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

export const EmptyHint: React.FC<EmptyHintProps> = ({
  title = '这里还没有内容',
  description = '在编辑器中添加卡片或箱子，开始填充这个箱子',
  align = 'center',
  style,
}) => {
  const { token } = theme.useToken();
  const alignItems = ALIGNMENT[align];
  const textAlign: CSSProperties['textAlign'] =
    align === 'start' ? 'left' : align === 'end' ? 'right' : 'center';

  return (
    <div
      data-layout-empty-hint
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginXXS,
        alignItems,
        textAlign,
        padding: `${token.paddingSM}px ${token.padding}px`,
        ...style,
      }}
    >
      <strong
        data-layout-empty-title
        style={{
          fontSize: token.fontSize,
          fontWeight: token.fontWeightStrong,
          lineHeight: token.lineHeight,
          color: token.colorText,
        }}
      >
        {title}
      </strong>
      <span
        data-layout-empty-text
        style={{
          fontSize: token.fontSizeSM,
          lineHeight: token.lineHeight,
          color: token.colorTextSecondary,
        }}
      >
        {description}
      </span>
    </div>
  );
};

export const LayoutSkeleton: React.FC<LayoutSkeletonProps> = ({
  children,
  hint,
  minHeight = 280,
}) => {
  const { token } = theme.useToken();

  return (
    <div
      data-layout-skeleton
      aria-label="空箱子预览"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: token.marginSM,
        minHeight,
        padding: `${token.marginXL}px ${token.paddingLG}px`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        background: token.colorBgContainer,
      }}
    >
      {hint}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
};

export type {
  EmptyHintProps,
  LayoutSkeletonProps,
  SkeletonBlockProps,
  SkeletonDotProps,
  SkeletonLineProps,
} from './types';
