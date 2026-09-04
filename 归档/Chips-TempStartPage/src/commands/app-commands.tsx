import { FolderOpenOutlined, SettingOutlined } from "@ant-design/icons";
import type { CommandItem } from "@chips/ui";
import type {
  CommandDefinitionInput,
  CommandInvokedEvent,
  CommandSource,
} from "chips-sdk";

export const APP_PLUGIN_ID = "com.chips.temp-start-page";

export const APP_COMMAND_IDS = {
  openWorkspace: "com.chips.temp-start-page.open-workspace",
  openSettings: "com.chips.temp-start-page.open-settings",
} as const;

export const APP_COMMAND_HANDLER_IDS = {
  openWorkspace: "open-workspace",
  openSettings: "open-settings",
} as const;

const APP_COMMAND_ID_SET = new Set<string>(Object.values(APP_COMMAND_IDS));

export const appCommandDefinitions: CommandDefinitionInput[] = [
  {
    commandId: APP_COMMAND_IDS.openWorkspace,
    titleKey: "打开工作区",
    descriptionKey: "聚焦主应用场景",
    ariaLabelKey: "打开工作区",
    icon: { name: "dashboard", style: "rounded" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.openWorkspace,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 10 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 10 }],
    paletteKeywords: ["workspace", "dashboard", "main"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.openSettings,
    titleKey: "打开设置",
    descriptionKey: "聚焦设置场景",
    ariaLabelKey: "打开设置",
    icon: { name: "settings", style: "rounded" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.openSettings,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 20 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "secondary", order: 20 }],
    paletteKeywords: ["settings", "preferences"],
    state: { enabled: true, visible: true },
  },
];

export type AppCommandId = (typeof APP_COMMAND_IDS)[keyof typeof APP_COMMAND_IDS];
export type AppCommandHandlerId = (typeof APP_COMMAND_HANDLER_IDS)[keyof typeof APP_COMMAND_HANDLER_IDS];

export interface AppCommandHandlers {
  openWorkspace: () => void;
  openSettings: () => void;
}

export function createAppCommands(handlers: AppCommandHandlers): CommandItem[] {
  return [
    {
      id: APP_COMMAND_IDS.openWorkspace,
      title: "打开工作区",
      shortcut: "Mod+1",
      icon: <FolderOpenOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "main",
      keywords: ["workspace", "dashboard", "main", "打开工作区"],
      run: handlers.openWorkspace,
    },
    {
      id: APP_COMMAND_IDS.openSettings,
      title: "打开设置",
      shortcut: "Mod+,",
      icon: <SettingOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "main",
      keywords: ["settings", "preferences", "打开设置"],
      run: handlers.openSettings,
    },
  ];
}

export interface AppCommandStatus {
  commandId: string;
  handlerId: AppCommandHandlerId;
  source: CommandSource;
  invocationId?: string;
  payload?: Record<string, unknown>;
  context?: CommandInvokedEvent["context"];
}

export function isAppCommandInvokedEvent(event: CommandInvokedEvent): boolean {
  if (!APP_COMMAND_ID_SET.has(event.commandId)) {
    return false;
  }
  return event.ownerPluginId === undefined || event.ownerPluginId === APP_PLUGIN_ID;
}

export function getAppCommandHandlerId(event: CommandInvokedEvent): AppCommandHandlerId | null {
  const handlerId = event.handlerId;
  if (handlerId === APP_COMMAND_HANDLER_IDS.openWorkspace) {
    return handlerId;
  }
  if (handlerId === APP_COMMAND_HANDLER_IDS.openSettings) {
    return handlerId;
  }
  return null;
}

export function createAppCommandStatus(
  event: CommandInvokedEvent,
  handlerId: AppCommandHandlerId,
): AppCommandStatus {
  return {
    commandId: event.commandId,
    handlerId,
    source: event.source ?? "api",
    invocationId: event.invocationId,
    payload: event.payload,
    context: event.context,
  };
}
