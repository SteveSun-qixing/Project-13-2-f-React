import {
  DownloadOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  SaveOutlined,
  SaveFilled,
} from "@ant-design/icons";
import type { CommandItem } from "@chips/ui";
import type { CommandDefinitionInput, CommandInvokedEvent, CommandSource } from "chips-sdk";

export const APP_PLUGIN_ID = "com.chips.sheet";

export const APP_COMMAND_IDS = {
  fileOpen: "com.chips.sheet.file.open",
  fileSave: "com.chips.sheet.file.save",
  fileSaveAs: "com.chips.sheet.file.save-as",
  fileNew: "com.chips.sheet.file.new",
  fileExportCsv: "com.chips.sheet.file.export-csv",
} as const;

export const APP_COMMAND_HANDLER_IDS = {
  fileOpen: "file.open",
  fileSave: "file.save",
  fileSaveAs: "file.save-as",
  fileNew: "file.new",
  fileExportCsv: "file.export-csv",
} as const;

const APP_COMMAND_ID_SET = new Set<string>(Object.values(APP_COMMAND_IDS));

export const appCommandDefinitions: CommandDefinitionInput[] = [
  {
    commandId: APP_COMMAND_IDS.fileOpen,
    titleKey: "打开表格文件",
    descriptionKey: "从本地选择 .xlsx / .xlsm / .csv 文件",
    ariaLabelKey: "打开表格文件",
    icon: { name: "folder-open", style: "rounded" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.fileOpen,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 10 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 10 }],
    paletteKeywords: ["open", "file", "xlsx", "xlsm", "csv", "打开", "文件"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.fileSave,
    titleKey: "保存",
    descriptionKey: "把当前工作簿保存回原文件",
    ariaLabelKey: "保存",
    icon: { name: "save", style: "rounded" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.fileSave,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 20 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 20 }],
    paletteKeywords: ["save", "保存"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.fileSaveAs,
    titleKey: "另存为",
    descriptionKey: "把当前工作簿保存为新文件",
    ariaLabelKey: "另存为",
    icon: { name: "save-as", style: "rounded" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.fileSaveAs,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 30 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 30 }],
    paletteKeywords: ["save as", "另存为"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.fileNew,
    titleKey: "新建空白工作簿",
    descriptionKey: "创建一个空白表格并开始编辑",
    ariaLabelKey: "新建空白工作簿",
    icon: { name: "file-add", style: "rounded" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.fileNew,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 40 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 40 }],
    paletteKeywords: ["new", "blank", "新建", "空白"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.fileExportCsv,
    titleKey: "导出活动工作表为 CSV",
    descriptionKey: "以值形式导出当前活动工作表（UTF-8 带 BOM）",
    ariaLabelKey: "导出活动工作表为 CSV",
    icon: { name: "download", style: "rounded" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.fileExportCsv,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 50 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "secondary", order: 50 }],
    paletteKeywords: ["export", "csv", "导出"],
    state: { enabled: true, visible: true },
  },
];

export type AppCommandId = (typeof APP_COMMAND_IDS)[keyof typeof APP_COMMAND_IDS];
export type AppCommandHandlerId =
  (typeof APP_COMMAND_HANDLER_IDS)[keyof typeof APP_COMMAND_HANDLER_IDS];

export interface AppCommandHandlers {
  fileOpen: () => void;
  fileSave: () => void;
  fileSaveAs: () => void;
  fileNew: () => void;
  fileExportCsv: () => void;
}

export function createAppCommands(handlers: AppCommandHandlers): CommandItem[] {
  return [
    {
      id: APP_COMMAND_IDS.fileOpen,
      title: "打开表格文件",
      shortcut: "Mod+O",
      icon: <FolderOpenOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "main",
      keywords: ["open", "file", "xlsx", "xlsm", "csv", "打开", "文件"],
      run: handlers.fileOpen,
    },
    {
      id: APP_COMMAND_IDS.fileSave,
      title: "保存",
      shortcut: "Mod+S",
      icon: <SaveOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "main",
      keywords: ["save", "保存"],
      run: handlers.fileSave,
    },
    {
      id: APP_COMMAND_IDS.fileSaveAs,
      title: "另存为",
      shortcut: "Mod+Shift+S",
      icon: <SaveFilled />,
      group: "文件",
      menuId: "file",
      toolbarId: "main",
      keywords: ["save as", "另存为"],
      run: handlers.fileSaveAs,
    },
    {
      id: APP_COMMAND_IDS.fileNew,
      title: "新建空白工作簿",
      shortcut: "Mod+N",
      icon: <FileAddOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "main",
      keywords: ["new", "blank", "新建", "空白"],
      run: handlers.fileNew,
    },
    {
      id: APP_COMMAND_IDS.fileExportCsv,
      title: "导出活动工作表为 CSV",
      icon: <DownloadOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "main",
      keywords: ["export", "csv", "导出"],
      run: handlers.fileExportCsv,
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
  switch (event.handlerId) {
    case APP_COMMAND_HANDLER_IDS.fileOpen:
      return APP_COMMAND_HANDLER_IDS.fileOpen;
    case APP_COMMAND_HANDLER_IDS.fileSave:
      return APP_COMMAND_HANDLER_IDS.fileSave;
    case APP_COMMAND_HANDLER_IDS.fileSaveAs:
      return APP_COMMAND_HANDLER_IDS.fileSaveAs;
    case APP_COMMAND_HANDLER_IDS.fileNew:
      return APP_COMMAND_HANDLER_IDS.fileNew;
    case APP_COMMAND_HANDLER_IDS.fileExportCsv:
      return APP_COMMAND_HANDLER_IDS.fileExportCsv;
    default:
      return null;
  }
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
