import React from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { appleTheme, ChipsProvider, CommandProvider } from '@chips/ui';
import { AppProviders as EditingEngineStateProviders } from '../context';
import { AppRuntimeProvider } from '../runtime/AppRuntimeProvider';
import { getEditingEngineClient } from '../runtime/chips-client';
import { AppShell } from './AppShell';

export function AppRoot(): React.ReactElement {
  return (
    <ConfigProvider locale={zhCN} theme={appleTheme}>
      <AntdApp>
        <ChipsProvider client={getEditingEngineClient()}>
          <CommandProvider>
            <AppRuntimeProvider>
              <EditingEngineStateProviders>
                <AppShell />
              </EditingEngineStateProviders>
            </AppRuntimeProvider>
          </CommandProvider>
        </ChipsProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
