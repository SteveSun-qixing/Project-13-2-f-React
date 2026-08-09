import type { ReactNode } from "react";
import {
  BoldOutlined,
  CopyOutlined,
  ExportOutlined,
  EyeOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  RedoOutlined,
  SaveOutlined,
  SearchOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import type { CommandItem } from "@chips/ui";
import { appConfig } from "../../config/app-config";

export const RICH_TEXT_EDITOR_COMMAND_IDS = {
  newDocument: `${appConfig.appId}.file.new`,
  openFile: `${appConfig.appId}.file.open`,
  save: `${appConfig.appId}.file.save`,
  saveAs: `${appConfig.appId}.file.save-as`,
  exportCard: `${appConfig.appId}.file.export-card`,
  preview: `${appConfig.appId}.document.preview`,
  info: `${appConfig.appId}.document.info`,
  undo: `${appConfig.appId}.edit.undo`,
  redo: `${appConfig.appId}.edit.redo`,
  find: `${appConfig.appId}.edit.find`,
  format: `${appConfig.appId}.format.open`,
} as const;

export type RichTextEditorCommandId =
  (typeof RICH_TEXT_EDITOR_COMMAND_IDS)[keyof typeof RICH_TEXT_EDITOR_COMMAND_IDS];

export interface RichTextEditorCommandState {
  isBusy: boolean;
  hasFilePath: boolean;
  canPreview: boolean;
}

export interface RichTextEditorCommandHandlers {
  newDocument: () => void | Promise<void>;
  openFile: () => void | Promise<void>;
  save: () => void | Promise<void>;
  saveAs: () => void | Promise<void>;
  exportCard: () => void | Promise<void>;
  preview: () => void | Promise<void>;
  info: () => void;
  undo: () => void;
  redo: () => void;
  find: () => void;
  format: () => void;
}

export function createRichTextEditorCommands(
  handlers: RichTextEditorCommandHandlers,
  state: RichTextEditorCommandState,
): CommandItem[] {
  const { isBusy, hasFilePath, canPreview } = state;

  return [
    {
      id: RICH_TEXT_EDITOR_COMMAND_IDS.newDocument,
      title: "新建",
      shortcut: "Mod+N",
      icon: iconFor(<FileAddOutlined />),
      group: "文件",
      menuId: "file",
      toolbarId: "document",
      keywords: ["new", "document", "新建", "文档"],
      enabled: !isBusy,
      run: () => void handlers.newDocument(),
    },
    {
      id: RICH_TEXT_EDITOR_COMMAND_IDS.openFile,
      title: "打开",
      shortcut: "Mod+O",
      icon: iconFor(<FolderOpenOutlined />),
      group: "文件",
      menuId: "file",
      toolbarId: "document",
      keywords: ["open", "card", "打开", "卡片"],
      enabled: !isBusy,
      run: () => void handlers.openFile(),
    },
    {
      id: RICH_TEXT_EDITOR_COMMAND_IDS.save,
      title: "保存",
      shortcut: "Mod+S",
      icon: iconFor(<SaveOutlined />),
      group: "文件",
      menuId: "file",
      toolbarId: "document",
      keywords: ["save", "card", "保存", "卡片"],
      enabled: !isBusy,
      run: () => void handlers.save(),
    },
    {
      id: RICH_TEXT_EDITOR_COMMAND_IDS.saveAs,
      title: "另存为",
      shortcut: "Mod+Shift+S",
      icon: iconFor(<CopyOutlined />),
      group: "文件",
      menuId: "file",
      toolbarId: "document",
      keywords: ["save as", "export", "另存为", "副本"],
      enabled: !isBusy,
      run: () => void handlers.saveAs(),
    },
    {
      id: RICH_TEXT_EDITOR_COMMAND_IDS.exportCard,
      title: "导出",
      icon: iconFor(<ExportOutlined />),
      group: "文件",
      menuId: "file",
      keywords: ["export", "card", "导出", "卡片"],
      enabled: !isBusy,
      run: () => void handlers.exportCard(),
    },
    {
      id: RICH_TEXT_EDITOR_COMMAND_IDS.preview,
      title: "预览",
      shortcut: "Mod+P",
      icon: iconFor(<EyeOutlined />),
      group: "查看",
      menuId: "view",
      toolbarId: "document",
      keywords: ["preview", "view", "预览", "查看"],
      enabled: canPreview && !isBusy,
      run: () => void handlers.preview(),
    },
    {
      id: RICH_TEXT_EDITOR_COMMAND_IDS.info,
      title: "当前信息",
      icon: iconFor(<InfoCircleOutlined />),
      group: "查看",
      menuId: "view",
      toolbarId: "document",
      keywords: ["info", "metadata", "信息", "元数据"],
      run: handlers.info,
    },
    {
      id: RICH_TEXT_EDITOR_COMMAND_IDS.undo,
      title: "撤销",
      shortcut: "Mod+Z",
      icon: iconFor(<UndoOutlined />),
      group: "编辑",
      menuId: "edit",
      keywords: ["undo", "撤销"],
      enabled: false,
      run: handlers.undo,
    },
    {
      id: RICH_TEXT_EDITOR_COMMAND_IDS.redo,
      title: "重做",
      shortcut: "Mod+Shift+Z",
      icon: iconFor(<RedoOutlined />),
      group: "编辑",
      menuId: "edit",
      keywords: ["redo", "重做"],
      enabled: false,
      run: handlers.redo,
    },
    {
      id: RICH_TEXT_EDITOR_COMMAND_IDS.find,
      title: "查找",
      shortcut: "Mod+F",
      icon: iconFor(<SearchOutlined />),
      group: "编辑",
      menuId: "edit",
      keywords: ["find", "search", "查找", "搜索"],
      enabled: false,
      run: handlers.find,
    },
    {
      id: RICH_TEXT_EDITOR_COMMAND_IDS.format,
      title: "格式",
      icon: iconFor(<BoldOutlined />),
      group: "格式",
      menuId: "format",
      keywords: ["format", "markdown", "格式", "加粗"],
      enabled: false,
      run: handlers.format,
    },
  ];
}

function iconFor(icon: ReactNode): ReactNode {
  return icon;
}
