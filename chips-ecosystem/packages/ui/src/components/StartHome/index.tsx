/** 统一起始页：图标、标题、说明、打开 / 新建入口与拖放态。 */

import { Button, Typography, theme } from '@chips/antd';
import { FileAddOutlined, FolderOpenOutlined } from '@chips/antd';
import React from 'react';

import type { StartHomeProps } from './types';

export const StartHome: React.FC<StartHomeProps> = ({
  title,
  description,
  formatsText,
  openLabel,
  shortcutText,
  dragActiveText,
  dragActive,
  onOpen,
  icon,
  createLabel,
  onCreate,
}) => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: token.paddingXL,
        boxSizing: 'border-box',
        background: token.colorBgLayout,
        color: token.colorText,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: token.marginSM,
          maxWidth: 420,
          textAlign: 'center',
        }}
      >
        {icon === undefined ? null : (
          <span aria-hidden="true" style={{ display: 'inline-flex', marginBottom: token.marginXS }}>
            {icon}
          </span>
        )}
        <Typography.Title level={2} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        <Typography.Text style={{ color: token.colorTextSecondary }}>{description}</Typography.Text>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: token.marginSM,
            marginTop: token.marginXS,
          }}
        >
          {/* 图标为装饰元素（`aria-hidden` 收口），按钮无障碍名称只取文案。 */}
          <Button
            type="primary"
            size="large"
            icon={<FolderOpenOutlined aria-hidden="true" />}
            onClick={onOpen}
          >
            {openLabel}
          </Button>
          {createLabel === undefined || onCreate === undefined ? null : (
            <Button size="large" icon={<FileAddOutlined aria-hidden="true" />} onClick={onCreate}>
              {createLabel}
            </Button>
          )}
        </div>
        <Typography.Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>
          {formatsText}
        </Typography.Text>
        <Typography.Text style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>
          {shortcutText}
        </Typography.Text>
      </div>
      {dragActive ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            inset: token.padding,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: token.borderRadiusLG,
            border: `2px dashed ${token.colorPrimaryBorder}`,
            background: token.colorPrimaryBg,
            color: token.colorPrimary,
            fontSize: token.fontSizeLG,
            fontWeight: token.fontWeightStrong,
          }}
        >
          {dragActiveText}
        </div>
      ) : null}
    </div>
  );
};

export type { StartHomeProps } from './types';
