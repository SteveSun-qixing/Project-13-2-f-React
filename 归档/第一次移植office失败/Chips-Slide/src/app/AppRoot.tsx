import React from "react";
import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme, ChipsProvider, CommandProvider } from "@chips/ui";
import { AppRuntimeProvider } from "./AppRuntimeProvider";
import { AppShell } from "./AppShell";
import { DeckProvider } from "../state/deck-store";
import { chipsClient } from "../runtime/chips-client";

export function AppRoot(): React.ReactElement {
  return (
    <ConfigProvider locale={zhCN} theme={appleTheme}>
      <AntdApp>
        <ChipsProvider client={chipsClient}>
          <CommandProvider>
            <AppRuntimeProvider>
              <DeckProvider>
                <AppShell />
              </DeckProvider>
            </AppRuntimeProvider>
          </CommandProvider>
        </ChipsProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
