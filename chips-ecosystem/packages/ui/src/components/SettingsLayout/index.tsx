/** 设置页骨架：标题、副标题与居中内容列。 */

import { Typography, theme } from '@chips/antd';
import React from 'react';

import type { SettingsLayoutProps } from './types';

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  title,
  subtitle,
  maxWidth = 640,
  children,
}) => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        maxWidth,
        margin: '0 auto',
        padding: `${token.paddingLG}px ${token.paddingLG}px ${token.marginXXL}px`,
        boxSizing: 'border-box',
      }}
    >
      {title === undefined ? null : (
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
      )}
      {subtitle === undefined ? null : (
        <Typography.Text
          style={{
            display: 'block',
            marginTop: token.marginXXS,
            marginBottom: token.marginLG,
            color: token.colorTextSecondary,
          }}
        >
          {subtitle}
        </Typography.Text>
      )}
      {children}
    </div>
  );
};

export type { SettingsLayoutProps } from './types';
