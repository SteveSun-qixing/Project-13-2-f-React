/** 设置分组：卡片容器 + 分组标题，行之间由 1px 分隔线区分。 */

import { Typography, theme } from '@chips/antd';
import React from 'react';

import type { SettingsGroupProps } from './types';

export const SettingsGroup: React.FC<SettingsGroupProps> = ({ title, children }) => {
  const { token } = theme.useToken();
  const items = React.Children.toArray(children);

  return (
    <>
      {title === undefined ? null : (
        <Typography.Text
          style={{
            display: 'block',
            marginTop: token.marginMD,
            marginBottom: token.marginXS,
            paddingInline: token.padding,
            fontSize: token.fontSizeSM,
            color: token.colorTextSecondary,
          }}
        >
          {title}
        </Typography.Text>
      )}
      <div
        style={{
          background: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowTertiary,
          overflow: 'hidden',
        }}
      >
        {items.map((item, index) => (
          <div
            key={React.isValidElement(item) && typeof item.key === 'string' ? item.key : index}
            style={index === 0 ? undefined : { borderTop: `1px solid ${token.colorSplit}` }}
          >
            {item}
          </div>
        ))}
      </div>
    </>
  );
};

export type { SettingsGroupProps } from './types';
