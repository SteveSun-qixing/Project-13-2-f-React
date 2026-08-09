import type { ReactElement, ReactNode } from "react";
import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme, ChipsProvider, CommandProvider } from "@chips/ui";
import { createAppMockClient } from "./mock-environment";

export interface RenderWithChipsResult {
  client: ReturnType<typeof createAppMockClient>;
  element: ReactElement;
}

export function renderWithChips(children: ReactNode): RenderWithChipsResult {
  const client = createAppMockClient();
  return {
    client,
    element: (
      <ConfigProvider locale={zhCN} theme={appleTheme}>
        <AntdApp>
          <ChipsProvider client={client}>
            <CommandProvider>{children}</CommandProvider>
          </ChipsProvider>
        </AntdApp>
      </ConfigProvider>
    ),
  };
}
