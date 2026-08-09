import React from "react";
import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme, ChipsProvider, CommandProvider } from "@chips/ui";
import { AppShell } from "./AppShell";
import { AppRuntimeProvider } from "./AppRuntimeProvider";
import { chipsClient } from "../runtime/chips-client";

export function AppRoot(): React.ReactElement {
  return (
    <ConfigProvider locale={zhCN} theme={appleTheme}>
      <AntdApp>
        <ChipsProvider client={chipsClient}>
          <AppRuntimeProvider>
            <CommandProvider>
              <AppShell />
            </CommandProvider>
          </AppRuntimeProvider>
        </ChipsProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
