import React from "react";
import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme, ChipsProvider, CommandProvider } from "@chips/ui";
import { chipsClient } from "../runtime/chips-client";
import { AppRuntimeProvider } from "./AppRuntimeProvider";
import { AppShell } from "./AppShell";

export function AppRoot(): React.ReactElement {
  return (
    <ConfigProvider locale={zhCN} theme={appleTheme}>
      <AntdApp>
        <ChipsProvider client={chipsClient}>
          <CommandProvider>
            <AppRuntimeProvider>
              <AppShell />
            </AppRuntimeProvider>
          </CommandProvider>
        </ChipsProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
