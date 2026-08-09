import { FileImageOutlined, ThunderboltOutlined } from "@ant-design/icons";
import type { CommandItem } from "@chips/ui";
import type {
  CommandDefinitionInput,
  CommandInvokedEvent,
  CommandSource,
} from "chips-sdk";

export const APP_PLUGIN_ID = "com.chips.iconmaker";

export const APP_COMMAND_IDS = {
  focusImporter: "com.chips.iconmaker.focus-importer",
  generateIcons: "com.chips.iconmaker.generate-icons",
} as const;

export const APP_COMMAND_HANDLER_IDS = {
  focusImporter: "iconmaker:focus-importer",
  generateIcons: "iconmaker:generate-icons",
} as const;

const APP_COMMAND_ID_SET = new Set<string>(Object.values(APP_COMMAND_IDS));

export const appCommandDefinitions: CommandDefinitionInput[] = [
  {
    commandId: APP_COMMAND_IDS.focusImporter,
    titleKey: "选择源图",
    descriptionKey: "聚焦源图导入入口",
    ariaLabelKey: "选择源图",
    icon: { name: "add_photo_alternate", style: "rounded" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.focusImporter,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 10 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 10 }],
    paletteKeywords: ["file", "import", "image", "svg", "png"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.generateIcons,
    titleKey: "生成图标",
    descriptionKey: "按当前设置生成图标资源",
    ariaLabelKey: "生成图标",
    icon: { name: "auto_awesome", style: "rounded" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.generateIcons,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 20 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 20 }],
    paletteKeywords: ["generate", "icon", "ico", "icns", "png"],
    state: { enabled: true, visible: true },
  },
];

export type AppCommandId = (typeof APP_COMMAND_IDS)[keyof typeof APP_COMMAND_IDS];
export type AppCommandHandlerId = (typeof APP_COMMAND_HANDLER_IDS)[keyof typeof APP_COMMAND_HANDLER_IDS];

export interface AppCommandHandlers {
  focusImporter: () => void;
  generateIcons: () => void;
}

export function createAppCommands(handlers: AppCommandHandlers): CommandItem[] {
  return [
    {
      id: APP_COMMAND_IDS.focusImporter,
      title: "选择源图",
      icon: <FileImageOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "main",
      keywords: ["file", "import", "image", "svg", "png", "选择源图"],
      run: handlers.focusImporter,
    },
    {
      id: APP_COMMAND_IDS.generateIcons,
      title: "生成图标",
      icon: <ThunderboltOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "main",
      keywords: ["generate", "icon", "ico", "icns", "png", "生成图标"],
      run: handlers.generateIcons,
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
  if (handlerId === APP_COMMAND_HANDLER_IDS.focusImporter) {
    return handlerId;
  }
  if (handlerId === APP_COMMAND_HANDLER_IDS.generateIcons) {
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
