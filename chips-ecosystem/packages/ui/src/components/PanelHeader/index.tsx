/** 面板标题：标题、说明与操作区。 */

import { Flex, Typography, theme } from '@chips/antd';
import React from 'react';

import type { PanelHeaderProps } from './types';

export const PanelHeader: React.FC<PanelHeaderProps> = ({ title, description, extra }) => {
  const { token } = theme.useToken();

  return (
    <Flex
      justify="space-between"
      align="center"
      gap={token.marginSM}
      style={{ marginBottom: token.marginSM, minHeight: token.controlHeight }}
    >
      <Flex vertical gap={0}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {description === undefined || description.length === 0 ? null : (
          <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {description}
          </Typography.Text>
        )}
      </Flex>
      {extra === undefined ? null : (
        <Flex align="center" gap={token.marginXS}>
          {extra}
        </Flex>
      )}
    </Flex>
  );
};

export type { PanelHeaderProps } from './types';
