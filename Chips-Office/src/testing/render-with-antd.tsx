import type { ReactElement, ReactNode } from "react";
import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme, ChipsProvider, CommandProvider } from "@chips/ui";
import type { MockChipsClient } from "chips-sdk/testing";
import { AppRuntimeProvider } from "../app/AppRuntimeProvider";
import { createAppMockClient, OFFICE_MOCK_PERMISSIONS } from "./mock-environment";

export interface RenderWithAntdResult {
  client: MockChipsClient;
  element: ReactElement;
}

export interface RenderWithOfficeOptions {
  permissions?: string[];
  actions?: Record<string, (payload: unknown) => unknown>;
}

export function renderWithAntd(
  children: ReactNode,
  options: RenderWithOfficeOptions = {},
): RenderWithAntdResult {
  const client = createAppMockClient();
  for (const permission of options.permissions ?? OFFICE_MOCK_PERMISSIONS) {
    if (!client.state.permissions.includes(permission)) {
      client.state.permissions.push(permission);
    }
  }
  if (options.actions) {
    for (const [action, handler] of Object.entries(options.actions)) {
      client.mockHost.setActionHandler(action, handler);
    }
  }
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
