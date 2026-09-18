import React from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { appleTheme, ChipsProvider, CommandProvider } from '@chips/ui';
import { AppRuntimeProvider } from '../runtime/AppRuntimeProvider';
import { getEditingEngineClient } from '../runtime/chips-client';
import { AppShell } from './AppShell';
import { NotebookProvider } from '../context/NotebookContext';
import { NoteProvider } from '../context/NoteContext';

export function AppRoot(): React.ReactElement {
  return (
    <ConfigProvider locale={zhCN} theme={appleTheme}>
      <AntdApp>
        <ChipsProvider client={getEditingEngineClient()}>
          <CommandProvider>
            <AppRuntimeProvider>
              <NotebookProvider>
                <NoteProvider>
                  <AppShell />
                </NoteProvider>
              </NotebookProvider>
            </AppRuntimeProvider>
          </CommandProvider>
        </ChipsProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
