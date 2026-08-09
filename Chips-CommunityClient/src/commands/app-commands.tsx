import type { ReactNode } from "react";
import { DashboardOutlined, SettingOutlined } from "@ant-design/icons";
import type { CommandItem } from "@chips/ui";
import { appConfig } from "../../config/app-config";

export const APP_PLUGIN_ID = "com.chips.community-client";

export const APP_COMMAND_IDS = {
  openWorkspace: `${appConfig.appId}.open-workspace`,
  openSettings: `${appConfig.appId}.open-settings`,
} as const;

export type AppCommandId = (typeof APP_COMMAND_IDS)[keyof typeof APP_COMMAND_IDS];

export interface AppCommandHandlers {
  openWorkspace: () => void;
  openSettings: () => void;
}

function iconFor(icon: ReactNode): ReactNode {
  return icon;
}

export function createAppCommands(handlers: AppCommandHandlers): CommandItem[] {
  return [
    {
      id: APP_COMMAND_IDS.openWorkspace,
      title: "打开工作区",
      icon: iconFor(<DashboardOutlined />),
      group: "应用",
      menuId: "app",
      toolbarId: "main",
      keywords: ["workspace", "dashboard", "工作区"],
      run: handlers.openWorkspace,
    },
    {
      id: APP_COMMAND_IDS.openSettings,
      title: "打开设置",
      icon: iconFor(<SettingOutlined />),
      group: "应用",
      menuId: "app",
      toolbarId: "main",
      keywords: ["settings", "server", "设置"],
      run: handlers.openSettings,
    },
  ];
}
