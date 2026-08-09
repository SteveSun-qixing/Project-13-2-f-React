import React from "react";
import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme, ChipsProvider, CommandProvider } from "@chips/ui";
import { getChipsClient } from "../shared/runtime/client";
import { AppRuntimeProvider } from "./AppRuntimeProvider";
import { AppShell } from "./AppShell";
import { I18nProvider } from "./providers/I18nProvider";
import { RuntimeProvider, useRuntimeContext } from "./providers/RuntimeProvider";

function SettingsRuntimeBridge({ children }: React.PropsWithChildren): React.ReactElement {
  const runtime = useRuntimeContext();

  return (
    <AppRuntimeProvider
      client={runtime.client}
      eventSource={runtime.eventSource}
      ready={runtime.ready}
      runtimeError={runtime.runtimeError}
      refreshRuntimeState={runtime.refreshRuntimeState}
    >
      <I18nProvider>{children}</I18nProvider>
    </AppRuntimeProvider>
  );
}

export function AppRoot(): React.ReactElement {
  return (
    <ConfigProvider locale={zhCN} theme={appleTheme}>
      <AntdApp>
        <ChipsProvider client={getChipsClient()}>
          <CommandProvider>
            <RuntimeProvider>
              <SettingsRuntimeBridge>
                <AppShell />
              </SettingsRuntimeBridge>
            </RuntimeProvider>
          </CommandProvider>
        </ChipsProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
