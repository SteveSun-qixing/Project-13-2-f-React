import {
  CopyOutlined,
  DeleteOutlined,
  DiffOutlined,
  FileAddOutlined,
  FileImageOutlined,
  FolderOpenOutlined,
  RedoOutlined,
  SaveOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
} from "@ant-design/icons";
import type { CommandItem } from "@chips/ui";
import type { CommandDefinitionInput } from "chips-sdk";

export const APP_PLUGIN_ID = "com.chips.slide";

export const APP_COMMAND_IDS = {
  fileOpen: "com.chips.slide.file.open",
  fileNew: "com.chips.slide.file.new",
  fileSave: "com.chips.slide.file.save",
  fileSaveAs: "com.chips.slide.file.save-as",
  fileExportPng: "com.chips.slide.file.export-png",
  editUndo: "com.chips.slide.edit.undo",
  editRedo: "com.chips.slide.edit.redo",
  viewZoomIn: "com.chips.slide.view.zoom-in",
  viewZoomOut: "com.chips.slide.view.zoom-out",
  viewZoomReset: "com.chips.slide.view.zoom-reset",
  slideAdd: "com.chips.slide.slide.add",
  slideDuplicate: "com.chips.slide.slide.duplicate",
  slideDelete: "com.chips.slide.slide.delete",
} as const;

export type AppCommandId = (typeof APP_COMMAND_IDS)[keyof typeof APP_COMMAND_IDS];

export const APP_COMMAND_ID_SET = new Set<string>(Object.values(APP_COMMAND_IDS));

export interface AppCommandHandlers {
  fileOpen(): void;
  fileNew(): void;
  fileSave(): void;
  fileSaveAs(): void;
  fileExportPng(): void;
  editUndo(): void;
  editRedo(): void;
  viewZoomIn(): void;
  viewZoomOut(): void;
  viewZoomReset(): void;
  slideAdd(): void;
  slideDuplicate(): void;
  slideDelete(): void;
}

/** 宿主侧命令注册元数据（能力协议要求；本地执行经 CommandItem.run）。 */
export const appCommandDefinitions: CommandDefinitionInput[] = [
  {
    commandId: APP_COMMAND_IDS.fileOpen,
    titleKey: "打开文件",
    descriptionKey: "选择并打开一份 .pptx 演示文稿",
    ariaLabelKey: "打开文件",
    icon: { name: "folder-open", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: "file-open",
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.fileNew,
    titleKey: "新建演示文稿",
    descriptionKey: "创建一份空白演示文稿并写入薯片工作区",
    ariaLabelKey: "新建演示文稿",
    icon: { name: "file-add", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: "file-new",
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.fileSave,
    titleKey: "保存",
    descriptionKey: "保存当前演示文稿",
    ariaLabelKey: "保存",
    icon: { name: "save", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: "file-save",
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.fileSaveAs,
    titleKey: "另存为",
    descriptionKey: "将当前演示文稿保存为新文件",
    ariaLabelKey: "另存为",
    icon: { name: "save", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: "file-save-as",
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.fileExportPng,
    titleKey: "导出当前页 PNG",
    descriptionKey: "将当前幻灯片导出为高分辨率 PNG 图片",
    ariaLabelKey: "导出当前页 PNG",
    icon: { name: "image", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: "file-export-png",
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.editUndo,
    titleKey: "撤销",
    descriptionKey: "撤销上一步编辑",
    ariaLabelKey: "撤销",
    icon: { name: "undo", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: "edit-undo",
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.editRedo,
    titleKey: "重做",
    descriptionKey: "恢复被撤销的编辑",
    ariaLabelKey: "重做",
    icon: { name: "redo", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: "edit-redo",
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.viewZoomIn,
    titleKey: "放大",
    descriptionKey: "放大幻灯片视图",
    ariaLabelKey: "放大",
    icon: { name: "zoom-in", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: "view-zoom-in",
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.viewZoomOut,
    titleKey: "缩小",
    descriptionKey: "缩小幻灯片视图",
    ariaLabelKey: "缩小",
    icon: { name: "zoom-out", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: "view-zoom-out",
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.viewZoomReset,
    titleKey: "重置缩放",
    descriptionKey: "恢复适应窗口缩放",
    ariaLabelKey: "重置缩放",
    icon: { name: "expand", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: "view-zoom-reset",
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.slideAdd,
    titleKey: "新建幻灯片",
    descriptionKey: "在当前页之后插入空白幻灯片",
    ariaLabelKey: "新建幻灯片",
    icon: { name: "file-add", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: "slide-add",
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.slideDuplicate,
    titleKey: "复制幻灯片",
    descriptionKey: "复制当前幻灯片",
    ariaLabelKey: "复制幻灯片",
    icon: { name: "copy", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: "slide-duplicate",
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.slideDelete,
    titleKey: "删除幻灯片",
    descriptionKey: "删除当前幻灯片",
    ariaLabelKey: "删除幻灯片",
    icon: { name: "delete", style: "outlined" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: "slide-delete",
    state: { enabled: true, visible: true },
  },
];

/** 命令面板 / 菜单 / 快捷键共用的本地命令表。 */
export function createAppCommands(handlers: AppCommandHandlers): CommandItem[] {
  return [
    {
      id: APP_COMMAND_IDS.fileOpen,
      title: "打开文件",
      shortcut: "Mod+O",
      icon: <FolderOpenOutlined />,
      group: "文件",
      menuId: "file",
      keywords: ["open", "打开", "pptx"],
      run: handlers.fileOpen,
    },
    {
      id: APP_COMMAND_IDS.fileNew,
      title: "新建演示文稿",
      shortcut: "Mod+N",
      icon: <FileAddOutlined />,
      group: "文件",
      menuId: "file",
      keywords: ["new", "新建", "演示文稿"],
      run: handlers.fileNew,
    },
    {
      id: APP_COMMAND_IDS.fileSave,
      title: "保存",
      shortcut: "Mod+S",
      icon: <SaveOutlined />,
      group: "文件",
      menuId: "file",
      keywords: ["save", "保存"],
      run: handlers.fileSave,
    },
    {
      id: APP_COMMAND_IDS.fileSaveAs,
      title: "另存为",
      shortcut: "Mod+Shift+S",
      icon: <DiffOutlined />,
      group: "文件",
      menuId: "file",
      keywords: ["save as", "另存为"],
      run: handlers.fileSaveAs,
    },
    {
      id: APP_COMMAND_IDS.fileExportPng,
      title: "导出当前页 PNG",
      icon: <FileImageOutlined />,
      group: "文件",
      menuId: "file",
      keywords: ["export", "png", "导出", "图片"],
      run: handlers.fileExportPng,
    },
    {
      id: APP_COMMAND_IDS.editUndo,
      title: "撤销",
      shortcut: "Mod+Z",
      icon: <UndoOutlined />,
      group: "编辑",
      menuId: "edit",
      keywords: ["undo", "撤销"],
      run: handlers.editUndo,
    },
    {
      id: APP_COMMAND_IDS.editRedo,
      title: "重做",
      shortcut: "Mod+Shift+Z",
      icon: <RedoOutlined />,
      group: "编辑",
      menuId: "edit",
      keywords: ["redo", "重做"],
      run: handlers.editRedo,
    },
    {
      id: APP_COMMAND_IDS.viewZoomIn,
      title: "放大",
      shortcut: "Mod+=",
      icon: <ZoomInOutlined />,
      group: "视图",
      menuId: "view",
      keywords: ["zoom in", "放大"],
      run: handlers.viewZoomIn,
    },
    {
      id: APP_COMMAND_IDS.viewZoomOut,
      title: "缩小",
      shortcut: "Mod+-",
      icon: <ZoomOutOutlined />,
      group: "视图",
      menuId: "view",
      keywords: ["zoom out", "缩小"],
      run: handlers.viewZoomOut,
    },
    {
      id: APP_COMMAND_IDS.viewZoomReset,
      title: "重置缩放",
      shortcut: "Mod+0",
      icon: <ExpandOutlined />,
      group: "视图",
      menuId: "view",
      keywords: ["zoom reset", "缩放", "适应窗口"],
      run: handlers.viewZoomReset,
    },
    {
      id: APP_COMMAND_IDS.slideAdd,
      title: "新建幻灯片",
      icon: <FileAddOutlined />,
      group: "幻灯片",
      menuId: "slide",
      keywords: ["new slide", "新建", "幻灯片"],
      run: handlers.slideAdd,
    },
    {
      id: APP_COMMAND_IDS.slideDuplicate,
      title: "复制幻灯片",
      icon: <CopyOutlined />,
      group: "幻灯片",
      menuId: "slide",
      keywords: ["duplicate", "复制", "幻灯片"],
      run: handlers.slideDuplicate,
    },
    {
      id: APP_COMMAND_IDS.slideDelete,
      title: "删除幻灯片",
      icon: <DeleteOutlined />,
      group: "幻灯片",
      menuId: "slide",
      keywords: ["delete", "删除", "幻灯片"],
      run: handlers.slideDelete,
    },
  ];
}
