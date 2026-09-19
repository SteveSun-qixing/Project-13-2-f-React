/**
 * 应用窗口外壳：内容区 + 命令面板 + 底部区域。
 *
 * 契约：《08-@chips-ui共享层使用指南》§3.3——`paletteShortcut` 只控制面板打开，不注册命令；
 * 窗口内命令快捷键由平台按命令记录的 `shortcut` 派发，组件不自行匹配。
 * 底部区域为「分隔条 + 内容行」两层：分隔条承载分割线与表面底色，内容行承载状态与摘要信息。
 */

import { theme } from '@chips/antd';
import React from 'react';

import { CommandPalette } from '../CommandPalette';
import { DEFAULT_PALETTE_SHORTCUT } from '../CommandPalette';

import type { AppChromeProps } from './types';

export const AppChrome: React.FC<AppChromeProps> = ({
  children,
  paletteShortcut = DEFAULT_PALETTE_SHORTCUT,
  footer,
  immersive = false,
  contentStyle,
}) => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: token.colorBgLayout,
        color: token.colorText,
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: immersive ? 0 : token.padding,
          boxSizing: 'border-box',
          ...contentStyle,
        }}
      >
        {children}
      </div>
      {footer === undefined ? null : (
        <div
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${token.colorSplit}`,
            background: token.colorBgLayout,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: token.marginSM,
              padding: `${token.paddingXS}px ${token.padding}`,
              fontSize: token.fontSizeSM,
              color: token.colorTextSecondary,
            }}
          >
            {footer}
          </div>
        </div>
      )}
      <CommandPalette paletteShortcut={paletteShortcut} />
    </div>
  );
};

export type { AppChromeProps } from './types';
