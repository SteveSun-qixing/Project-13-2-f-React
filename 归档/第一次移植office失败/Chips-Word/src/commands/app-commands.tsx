import {
  FileAddOutlined,
  FolderOpenOutlined,
  PrinterOutlined,
  SaveOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import type { CommandItem } from "@chips/ui";
import type {
  CommandDefinitionInput,
  CommandInvokedEvent,
  CommandSource,
} from "chips-sdk";
import { formatMessage } from "../lib/messages";

export const APP_PLUGIN_ID = "com.chips.word";

export const APP_COMMAND_IDS = {
  fileNew: "com.chips.word.file.new",
  fileOpen: "com.chips.word.file.open",
  fileSave: "com.chips.word.file.save",
  fileSaveAs: "com.chips.word.file.save-as",
  filePrint: "com.chips.word.file.print",
  viewZoomIn: "com.chips.word.view.zoom-in",
  viewZoomOut: "com.chips.word.view.zoom-out",
  viewZoomReset: "com.chips.word.view.zoom-reset",
} as const;

export const APP_COMMAND_HANDLER_IDS = {
  fileNew: "file.new",
  fileOpen: "file.open",
  fileSave: "file.save",
  fileSaveAs: "file.save-as",
  filePrint: "file.print",
  viewZoomIn: "view.zoom-in",
  viewZoomOut: "view.zoom-out",
  viewZoomReset: "view.zoom-reset",
} as const;

const APP_COMMAND_ID_SET = new Set<string>(Object.values(APP_COMMAND_IDS));

export const appCommandDefinitions: CommandDefinitionInput[] = [
  {
    commandId: APP_COMMAND_IDS.fileNew,
    titleKey: formatMessage("start-home.actions.create"),
    descriptionKey: formatMessage("start-home.description"),
    ariaLabelKey: formatMessage("start-home.actions.create"),
    icon: { name: "file-add", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.fileNew,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 5 }],
    paletteKeywords: ["new", "docx", "新建"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.fileOpen,
    titleKey: formatMessage("command.file.open.title"),
    descriptionKey: formatMessage("command.file.open.description"),
    ariaLabelKey: formatMessage("command.file.open.title"),
    icon: { name: "folder-open", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.fileOpen,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 10 }],
    paletteKeywords: ["open", "docx", "打开"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.fileSave,
    titleKey: formatMessage("command.file.save.title"),
    descriptionKey: formatMessage("command.file.save.description"),
    ariaLabelKey: formatMessage("command.file.save.title"),
    icon: { name: "save", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.fileSave,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 20 }],
    paletteKeywords: ["save", "保存"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.fileSaveAs,
    titleKey: formatMessage("command.file.saveAs.title"),
    descriptionKey: formatMessage("command.file.saveAs.description"),
    ariaLabelKey: formatMessage("command.file.saveAs.title"),
    icon: { name: "save", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.fileSaveAs,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 30 }],
    paletteKeywords: ["save as", "另存为"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.filePrint,
    titleKey: formatMessage("command.file.print.title"),
    descriptionKey: formatMessage("command.file.print.description"),
    ariaLabelKey: formatMessage("command.file.print.title"),
    icon: { name: "printer", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.filePrint,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 40 }],
    paletteKeywords: ["print", "打印"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.viewZoomIn,
    titleKey: formatMessage("command.view.zoomIn.title"),
    descriptionKey: formatMessage("command.view.zoomIn.description"),
    ariaLabelKey: formatMessage("command.view.zoomIn.title"),
    icon: { name: "zoom-in", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.viewZoomIn,
    menuPlacement: [{ menuId: "view", groupId: "zoom", order: 10 }],
    paletteKeywords: ["zoom", "放大"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.viewZoomOut,
    titleKey: formatMessage("command.view.zoomOut.title"),
    descriptionKey: formatMessage("command.view.zoomOut.description"),
    ariaLabelKey: formatMessage("command.view.zoomOut.title"),
    icon: { name: "zoom-out", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.viewZoomOut,
    menuPlacement: [{ menuId: "view", groupId: "zoom", order: 20 }],
    paletteKeywords: ["zoom", "缩小"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.viewZoomReset,
    titleKey: formatMessage("command.view.zoomReset.title"),
    descriptionKey: formatMessage("command.view.zoomReset.description"),
    ariaLabelKey: formatMessage("command.view.zoomReset.title"),
    icon: { name: "zoom-out", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.viewZoomReset,
    menuPlacement: [{ menuId: "view", groupId: "zoom", order: 30 }],
    paletteKeywords: ["zoom", "缩放", "重置"],
    state: { enabled: true, visible: true },
  },
];

export type AppCommandId = (typeof APP_COMMAND_IDS)[keyof typeof APP_COMMAND_IDS];
export type AppCommandHandlerId =
  (typeof APP_COMMAND_HANDLER_IDS)[keyof typeof APP_COMMAND_HANDLER_IDS];

export interface AppCommandHandlers {
  fileNew: () => void;
  fileOpen: () => void;
  fileSave: () => void;
  fileSaveAs: () => void;
  filePrint: () => void;
  viewZoomIn: () => void;
  viewZoomOut: () => void;
  viewZoomReset: () => void;
}

export function createAppCommands(handlers: AppCommandHandlers): CommandItem[] {
  return [
    {
      id: APP_COMMAND_IDS.fileNew,
      title: formatMessage("start-home.actions.create"),
      icon: <FileAddOutlined />,
      group: formatMessage("command.group.file"),
      menuId: "file",
      keywords: ["new", "docx", "新建"],
      run: handlers.fileNew,
    },
    {
      id: APP_COMMAND_IDS.fileOpen,
      title: formatMessage("command.file.open.title"),
      shortcut: "Mod+O",
      icon: <FolderOpenOutlined />,
      group: formatMessage("command.group.file"),
      menuId: "file",
      keywords: ["open", "docx", "打开"],
      run: handlers.fileOpen,
    },
    {
      id: APP_COMMAND_IDS.fileSave,
      title: formatMessage("command.file.save.title"),
      shortcut: "Mod+S",
      icon: <SaveOutlined />,
      group: formatMessage("command.group.file"),
      menuId: "file",
      keywords: ["save", "保存"],
      run: handlers.fileSave,
    },
    {
      id: APP_COMMAND_IDS.fileSaveAs,
      title: formatMessage("command.file.saveAs.title"),
      shortcut: "Mod+Shift+S",
      icon: <FileAddOutlined />,
      group: formatMessage("command.group.file"),
      menuId: "file",
      keywords: ["save as", "另存为"],
      run: handlers.fileSaveAs,
    },
    {
      id: APP_COMMAND_IDS.filePrint,
      title: formatMessage("command.file.print.title"),
      icon: <PrinterOutlined />,
      group: formatMessage("command.group.file"),
      menuId: "file",
      keywords: ["print", "打印"],
      run: handlers.filePrint,
    },
    {
      id: APP_COMMAND_IDS.viewZoomIn,
      title: formatMessage("command.view.zoomIn.title"),
      shortcut: "Mod+=",
      icon: <ZoomInOutlined />,
      group: formatMessage("command.group.view"),
      menuId: "view",
      keywords: ["zoom", "放大"],
      run: handlers.viewZoomIn,
    },
    {
      id: APP_COMMAND_IDS.viewZoomOut,
      title: formatMessage("command.view.zoomOut.title"),
      shortcut: "Mod+-",
      icon: <ZoomOutOutlined />,
      group: formatMessage("command.group.view"),
      menuId: "view",
      keywords: ["zoom", "缩小"],
      run: handlers.viewZoomOut,
    },
    {
      id: APP_COMMAND_IDS.viewZoomReset,
      title: formatMessage("command.view.zoomReset.title"),
      shortcut: "Mod+0",
      icon: <ZoomOutOutlined />,
      group: formatMessage("command.group.view"),
      menuId: "view",
      keywords: ["zoom", "缩放", "重置"],
      run: handlers.viewZoomReset,
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
  const handlerId = event.handlerId ?? "";
  const handlerMap: Record<string, AppCommandHandlerId> = {
    [APP_COMMAND_HANDLER_IDS.fileNew]: APP_COMMAND_HANDLER_IDS.fileNew,
    [APP_COMMAND_HANDLER_IDS.fileOpen]: APP_COMMAND_HANDLER_IDS.fileOpen,
    [APP_COMMAND_HANDLER_IDS.fileSave]: APP_COMMAND_HANDLER_IDS.fileSave,
    [APP_COMMAND_HANDLER_IDS.fileSaveAs]: APP_COMMAND_HANDLER_IDS.fileSaveAs,
    [APP_COMMAND_HANDLER_IDS.filePrint]: APP_COMMAND_HANDLER_IDS.filePrint,
    [APP_COMMAND_HANDLER_IDS.viewZoomIn]: APP_COMMAND_HANDLER_IDS.viewZoomIn,
    [APP_COMMAND_HANDLER_IDS.viewZoomOut]: APP_COMMAND_HANDLER_IDS.viewZoomOut,
    [APP_COMMAND_HANDLER_IDS.viewZoomReset]: APP_COMMAND_HANDLER_IDS.viewZoomReset,
  };
  return handlerMap[handlerId] ?? null;
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
