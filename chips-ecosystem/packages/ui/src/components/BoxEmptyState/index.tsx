/** 空箱子占位：错落叠影卡片插画 + 标题 + 说明 + 可选操作。 */

import { theme } from '@chips/antd';
import React from 'react';
import type { CSSProperties } from 'react';

import type { BoxEmptyStateProps } from './types';

/** 插画几何（非视觉数值：不参与配色、间距与圆角体系，由共享层集中定义）。 */
const CARD_WIDTH = 96;
const CARD_HEIGHT = 128;
const ILLUSTRATION_WIDTH = 110;
const ILLUSTRATION_HEIGHT = 132;
const BACK_CARD_OFFSET_X = 42;
const BACK_CARD_OFFSET_Y = 4;
const FRONT_CARD_OFFSET_X = 7;
const FRONT_CARD_OFFSET_Y = 2;
const PLUS_BADGE_SIZE = 30;

export const BoxEmptyState: React.FC<BoxEmptyStateProps> = ({
  title = '这里还没有内容',
  description = '在编辑器中添加卡片或箱子，开始填充这个箱子',
  action,
  compact = false,
}) => {
  const { token } = theme.useToken();
  const scale = compact ? 0.78 : 1;

  const cardBase: CSSProperties = {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    boxShadow: token.boxShadowTertiary,
  };

  return (
    <div
      data-layout-empty
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? token.marginXS : token.margin,
        minHeight: compact ? 160 : 280,
        padding: compact
          ? `${token.paddingMD}px ${token.padding}px`
          : `${token.marginXL}px ${token.paddingLG}px`,
        textAlign: 'center',
        boxSizing: 'border-box',
        color: token.colorTextSecondary,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          width: ILLUSTRATION_WIDTH * scale,
          height: ILLUSTRATION_HEIGHT * scale,
          marginBottom: compact ? 0 : token.marginXXS,
          flexShrink: 0,
        }}
      >
        <span
          data-box-empty-card="back"
          style={{
            ...cardBase,
            background: token.colorFillSecondary,
            borderColor: token.colorBorderSecondary,
            boxShadow: 'none',
            transform: `translate(${-BACK_CARD_OFFSET_X}px, ${BACK_CARD_OFFSET_Y}px) rotate(-10deg) scale(${scale})`,
          }}
        />
        <span
          data-box-empty-card="back"
          style={{
            ...cardBase,
            background: token.colorFillSecondary,
            borderColor: token.colorBorderSecondary,
            boxShadow: 'none',
            transform: `translate(${BACK_CARD_OFFSET_X}px, ${BACK_CARD_OFFSET_Y}px) rotate(10deg) scale(${scale})`,
          }}
        />
        <span
          data-box-empty-card="front"
          style={{
            ...cardBase,
            left: FRONT_CARD_OFFSET_X * scale,
            top: FRONT_CARD_OFFSET_Y * scale,
            transform: `scale(${scale})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: PLUS_BADGE_SIZE * scale,
              height: PLUS_BADGE_SIZE * scale,
              borderRadius: '50%',
              border: `1px dashed ${token.colorBorder}`,
              color: token.colorTextTertiary,
              fontSize: token.fontSizeLG,
              lineHeight: 1,
            }}
          >
            +
          </span>
        </span>
      </div>

      <strong
        data-layout-empty-title
        style={{
          fontSize: compact ? token.fontSize : token.fontSizeLG,
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
          maxWidth: 320,
          fontSize: compact ? token.fontSizeSM : token.fontSize,
          lineHeight: token.lineHeight,
          color: token.colorTextSecondary,
        }}
      >
        {description}
      </span>

      {action === undefined ? null : (
        <div style={{ marginTop: compact ? 0 : token.marginXS }}>{action}</div>
      )}
    </div>
  );
};

export type { BoxEmptyStateProps } from './types';
