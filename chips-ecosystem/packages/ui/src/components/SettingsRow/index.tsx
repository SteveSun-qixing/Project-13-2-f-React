/** 设置行：标签 / 说明与右侧控件；提供 `onClick` 时可点击并支持键盘。 */

import { Typography, theme } from '@chips/antd';
import React from 'react';

import type { SettingsRowProps } from './types';

export const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  description,
  control,
  onClick,
  disabled = false,
}) => {
  const { token } = theme.useToken();
  const interactive = onClick !== undefined && !disabled;

  const handleClick = React.useCallback((): void => {
    if (disabled) {
      return;
    }
    onClick?.();
  }, [disabled, onClick]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      if (!interactive || (event.key !== 'Enter' && event.key !== ' ')) {
        return;
      }
      event.preventDefault();
      onClick?.();
    },
    [interactive, onClick]
  );

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-disabled={disabled ? true : undefined}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: token.marginSM,
        padding: `${token.paddingXS}px ${token.padding}px`,
        cursor: interactive ? 'pointer' : 'default',
        opacity: disabled ? 0.5 : 1,
        color: token.colorText,
      }}
    >
      <span
        style={{ flex: 1, minWidth: 0, fontSize: token.fontSizeLG, lineHeight: token.lineHeight }}
      >
        {label}
        {description === undefined ? null : (
          <Typography.Text
            style={{
              display: 'block',
              fontSize: token.fontSizeSM,
              lineHeight: token.lineHeight,
              color: token.colorTextSecondary,
            }}
          >
            {description}
          </Typography.Text>
        )}
      </span>
      {control === undefined ? null : (
        <span style={{ flexShrink: 0, color: token.colorTextSecondary }}>{control}</span>
      )}
    </div>
  );
};

export type { SettingsRowProps } from './types';
