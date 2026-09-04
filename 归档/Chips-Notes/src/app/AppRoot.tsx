/**
 * 应用根组件
 *
 * antd 中文环境 + @chips/ui 苹果主题 + SDK 客户端 + 命令系统。
 */

import React from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { appleTheme, ChipsProvider, CommandProvider } from '@chips/ui';
import { chipsClient } from '../runtime/chips-client';
import { App } from './App';

export function AppRoot(): React.ReactElement {
  return (
    <ConfigProvider locale={zhCN} theme={appleTheme}>
      <AntdApp>
        <ChipsProvider client={chipsClient}>
          <CommandProvider>
            <App />
          </CommandProvider>
        </ChipsProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
