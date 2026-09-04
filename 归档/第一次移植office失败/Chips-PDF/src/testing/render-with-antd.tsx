import type { ReactElement, ReactNode } from "react";
import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme, ChipsProvider, CommandProvider } from "@chips/ui";
import { AppRuntimeProvider } from "../app/AppRuntimeProvider";
import { createAppMockClient } from "./mock-environment";

export interface RenderWithAntdResult {
  client: ReturnType<typeof createAppMockClient>;
  element: ReactElement;
}

/** 完整 Provider 包裹（ConfigProvider(zhCN, appleTheme) > AntdApp > ChipsProvider(mock) > CommandProvider > AppRuntimeProvider） */
export function renderWithAntd(children: ReactNode): RenderWithAntdResult {
  const client = createAppMockClient();
  return {
    client,
    element: (
      <ConfigProvider locale={zhCN} theme={appleTheme}>
        <AntdApp>
          <ChipsProvider client={client}>
            <CommandProvider>
              <AppRuntimeProvider>{children}</AppRuntimeProvider>
            </CommandProvider>
          </ChipsProvider>
        </AntdApp>
      </ConfigProvider>
    ),
  };
}
