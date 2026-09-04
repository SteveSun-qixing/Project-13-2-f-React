import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DownloadOutlined,
  EditOutlined,
  FolderOpenOutlined,
  HighlightOutlined,
  MenuFoldOutlined,
  SearchOutlined,
  RollbackOutlined,
  SaveOutlined,
  SelectOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import type { CommandItem } from "@chips/ui";
import type { CommandDefinitionInput, CommandInvokedEvent, CommandSource } from "chips-sdk";
import type { PdfViewerBridge } from "./viewer-bridge";

export const APP_PLUGIN_ID = "com.chips.pdf";

export const APP_COMMAND_MENU_IDS = {
  file: "file",
  view: "view",
  annotate: "annotate",
} as const;

export const PDF_COMMAND_IDS = {
  fileOpen: "com.chips.pdf.file.open",
  fileSave: "com.chips.pdf.file.save",
  fileSaveAs: "com.chips.pdf.file.save-as",
  viewZoomIn: "com.chips.pdf.view.zoom-in",
  viewZoomOut: "com.chips.pdf.view.zoom-out",
  viewZoomReset: "com.chips.pdf.view.zoom-reset",
  viewNextPage: "com.chips.pdf.view.next-page",
  viewPrevPage: "com.chips.pdf.view.prev-page",
  viewFind: "com.chips.pdf.view.find",
  viewSidebar: "com.chips.pdf.view.sidebar",
  toolSelect: "com.chips.pdf.tool.select",
  toolDraw: "com.chips.pdf.tool.draw",
  toolNote: "com.chips.pdf.tool.note",
} as const;

export type PdfCommandId = (typeof PDF_COMMAND_IDS)[keyof typeof PDF_COMMAND_IDS];

export const PDF_COMMAND_HANDLER_IDS: Record<PdfCommandId, string> = {
  [PDF_COMMAND_IDS.fileOpen]: "file.open",
  [PDF_COMMAND_IDS.fileSave]: "file.save",
  [PDF_COMMAND_IDS.fileSaveAs]: "file.save-as",
  [PDF_COMMAND_IDS.viewZoomIn]: "view.zoom-in",
  [PDF_COMMAND_IDS.viewZoomOut]: "view.zoom-out",
  [PDF_COMMAND_IDS.viewZoomReset]: "view.zoom-reset",
  [PDF_COMMAND_IDS.viewNextPage]: "view.next-page",
  [PDF_COMMAND_IDS.viewPrevPage]: "view.prev-page",
  [PDF_COMMAND_IDS.viewFind]: "view.find",
  [PDF_COMMAND_IDS.viewSidebar]: "view.sidebar",
  [PDF_COMMAND_IDS.toolSelect]: "tool.select",
  [PDF_COMMAND_IDS.toolDraw]: "tool.draw",
  [PDF_COMMAND_IDS.toolNote]: "tool.note",
};

const PDF_COMMAND_ID_SET = new Set<string>(Object.values(PDF_COMMAND_IDS));

const COMMAND_META: {
  id: PdfCommandId;
  titleKey: string;
  descriptionKey: string;
  iconName: string;
  menu: { menuId: string; groupId: string; order: number };
  toolbarId?: string;
  keywords: string[];
}[] = [
  {
    id: PDF_COMMAND_IDS.fileOpen,
    titleKey: "app.commands.file.open.title",
    descriptionKey: "app.commands.file.open.description",
    iconName: "folder-open",
    menu: { menuId: "file", groupId: "primary", order: 10 },
    keywords: ["open", "打开", "文档"],
  },
  {
    id: PDF_COMMAND_IDS.fileSave,
    titleKey: "app.commands.file.save.title",
    descriptionKey: "app.commands.file.save.description",
    iconName: "save",
    menu: { menuId: "file", groupId: "primary", order: 20 },
    keywords: ["save", "保存"],
  },
  {
    id: PDF_COMMAND_IDS.fileSaveAs,
    titleKey: "app.commands.file.saveAs.title",
    descriptionKey: "app.commands.file.saveAs.description",
    iconName: "download",
    menu: { menuId: "file", groupId: "primary", order: 30 },
    keywords: ["save as", "另存为"],
  },
  {
    id: PDF_COMMAND_IDS.viewZoomIn,
    titleKey: "app.commands.view.zoomIn.title",
    descriptionKey: "app.commands.view.zoomIn.description",
    iconName: "zoom-in",
    menu: { menuId: "view", groupId: "zoom", order: 10 },
    keywords: ["zoom", "放大"],
  },
  {
    id: PDF_COMMAND_IDS.viewZoomOut,
    titleKey: "app.commands.view.zoomOut.title",
    descriptionKey: "app.commands.view.zoomOut.description",
    iconName: "zoom-out",
    menu: { menuId: "view", groupId: "zoom", order: 20 },
    keywords: ["zoom", "缩小"],
  },
  {
    id: PDF_COMMAND_IDS.viewZoomReset,
    titleKey: "app.commands.view.zoomReset.title",
    descriptionKey: "app.commands.view.zoomReset.description",
    iconName: "undo",
    menu: { menuId: "view", groupId: "zoom", order: 30 },
    keywords: ["zoom", "重置", "100%"],
  },
  {
    id: PDF_COMMAND_IDS.viewNextPage,
    titleKey: "app.commands.view.nextPage.title",
    descriptionKey: "app.commands.view.nextPage.description",
    iconName: "arrow-right",
    menu: { menuId: "view", groupId: "page", order: 10 },
    keywords: ["next", "下一页"],
  },
  {
    id: PDF_COMMAND_IDS.viewPrevPage,
    titleKey: "app.commands.view.prevPage.title",
    descriptionKey: "app.commands.view.prevPage.description",
    iconName: "arrow-left",
    menu: { menuId: "view", groupId: "page", order: 20 },
    keywords: ["prev", "上一页"],
  },
  {
    id: PDF_COMMAND_IDS.viewFind,
    titleKey: "app.commands.view.find.title",
    descriptionKey: "app.commands.view.find.description",
    iconName: "search",
    menu: { menuId: "view", groupId: "panel", order: 10 },
    keywords: ["find", "search", "查找", "搜索"],
  },
  {
    id: PDF_COMMAND_IDS.viewSidebar,
    titleKey: "app.commands.view.sidebar.title",
    descriptionKey: "app.commands.view.sidebar.description",
    iconName: "menu",
    menu: { menuId: "view", groupId: "panel", order: 20 },
    keywords: ["sidebar", "侧栏"],
  },
  {
    id: PDF_COMMAND_IDS.toolSelect,
    titleKey: "app.commands.tool.select.title",
    descriptionKey: "app.commands.tool.select.description",
    iconName: "select",
    menu: { menuId: "annotate", groupId: "tool", order: 10 },
    keywords: ["select", "选择"],
  },
  {
    id: PDF_COMMAND_IDS.toolDraw,
    titleKey: "app.commands.tool.draw.title",
    descriptionKey: "app.commands.tool.draw.description",
    iconName: "edit",
    menu: { menuId: "annotate", groupId: "tool", order: 20 },
    keywords: ["draw", "ink", "绘图"],
  },
  {
    id: PDF_COMMAND_IDS.toolNote,
    titleKey: "app.commands.tool.note.title",
    descriptionKey: "app.commands.tool.note.description",
    iconName: "message",
    menu: { menuId: "annotate", groupId: "tool", order: 30 },
    keywords: ["note", "便签", "批注"],
  },
];

/** 提交宿主命令系统的可序列化命令定义 */
export const pdfCommandDefinitions: CommandDefinitionInput[] = COMMAND_META.map((meta) => ({
  commandId: meta.id,
  titleKey: meta.titleKey,
  descriptionKey: meta.descriptionKey,
  ariaLabelKey: meta.titleKey,
  icon: { name: meta.iconName, style: "rounded" },
  scope: { kind: "app", appId: APP_PLUGIN_ID },
  handlerId: PDF_COMMAND_HANDLER_IDS[meta.id],
  menuPlacement: [meta.menu],
  ...(meta.toolbarId ? { toolbarPlacement: [{ toolbarId: meta.toolbarId }] } : {}),
  paletteKeywords: meta.keywords,
  state: { enabled: true, visible: true },
}));

export function isPdfCommandInvokedEvent(event: CommandInvokedEvent): boolean {
  if (!PDF_COMMAND_ID_SET.has(event.commandId)) {
    return false;
  }
  return event.ownerPluginId === undefined || event.ownerPluginId === APP_PLUGIN_ID;
}

export function getPdfCommandId(event: CommandInvokedEvent): PdfCommandId | null {
  return (PDF_COMMAND_ID_SET.has(event.commandId)
    ? (event.commandId as PdfCommandId)
    : null);
}

/** 由查看器桥构造本地命令表（CommandItem 供菜单/工具栏/快捷键/命令面板消费） */
export function createPdfCommands(bridge: PdfViewerBridge | null): CommandItem[] {
  const call = (invoke: (b: PdfViewerBridge) => void | Promise<void>): (() => void) => {
    return () => {
      if (!bridge) return;
      void invoke(bridge);
    };
  };

  return [
    {
      id: PDF_COMMAND_IDS.fileOpen,
      title: "打开文档",
      shortcut: "Mod+O",
      icon: <FolderOpenOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "main",
      keywords: ["open", "打开", "文档"],
      run: call((b) => b.openDocument()),
    },
    {
      id: PDF_COMMAND_IDS.fileSave,
      title: "保存",
      shortcut: "Mod+S",
      icon: <SaveOutlined />,
      group: "文件",
      menuId: "file",
      toolbarId: "main",
      keywords: ["save", "保存"],
      run: call((b) => b.saveDocument()),
    },
    {
      id: PDF_COMMAND_IDS.fileSaveAs,
      title: "另存为",
      shortcut: "Mod+Shift+S",
      icon: <DownloadOutlined />,
      group: "文件",
      menuId: "file",
      keywords: ["save as", "另存为"],
      run: call((b) => b.saveDocumentAs()),
    },
    {
      id: PDF_COMMAND_IDS.viewZoomIn,
      title: "放大",
      shortcut: "Mod+=",
      icon: <ZoomInOutlined />,
      group: "视图",
      menuId: "view",
      keywords: ["zoom", "放大"],
      run: call((b) => b.zoomIn()),
    },
    {
      id: PDF_COMMAND_IDS.viewZoomOut,
      title: "缩小",
      shortcut: "Mod+-",
      icon: <ZoomOutOutlined />,
      group: "视图",
      menuId: "view",
      keywords: ["zoom", "缩小"],
      run: call((b) => b.zoomOut()),
    },
    {
      id: PDF_COMMAND_IDS.viewZoomReset,
      title: "重置缩放",
      shortcut: "Mod+0",
      icon: <RollbackOutlined />,
      group: "视图",
      menuId: "view",
      keywords: ["zoom", "重置", "100%"],
      run: call((b) => b.zoomReset()),
    },
    {
      id: PDF_COMMAND_IDS.viewNextPage,
      title: "下一页",
      shortcut: "Mod+ArrowRight",
      icon: <ArrowRightOutlined />,
      group: "视图",
      menuId: "view",
      keywords: ["next", "下一页"],
      run: call((b) => b.nextPage()),
    },
    {
      id: PDF_COMMAND_IDS.viewPrevPage,
      title: "上一页",
      shortcut: "Mod+ArrowLeft",
      icon: <ArrowLeftOutlined />,
      group: "视图",
      menuId: "view",
      keywords: ["prev", "上一页"],
      run: call((b) => b.prevPage()),
    },
    {
      id: PDF_COMMAND_IDS.viewFind,
      title: "查找",
      shortcut: "Mod+F",
      icon: <SearchOutlined />,
      group: "视图",
      menuId: "view",
      keywords: ["find", "search", "查找", "搜索"],
      run: call((b) => b.toggleFind()),
    },
    {
      id: PDF_COMMAND_IDS.viewSidebar,
      title: "侧栏",
      shortcut: "Mod+B",
      icon: <MenuFoldOutlined />,
      group: "视图",
      menuId: "view",
      keywords: ["sidebar", "侧栏"],
      run: call((b) => b.toggleSidebar()),
    },
    {
      id: PDF_COMMAND_IDS.toolSelect,
      title: "选择工具",
      shortcut: "Mod+1",
      icon: <SelectOutlined />,
      group: "批注",
      menuId: "annotate",
      keywords: ["select", "选择"],
      run: call((b) => b.setTool("select")),
    },
    {
      id: PDF_COMMAND_IDS.toolDraw,
      title: "绘图工具",
      shortcut: "Mod+2",
      icon: <HighlightOutlined />,
      group: "批注",
      menuId: "annotate",
      keywords: ["draw", "ink", "绘图"],
      run: call((b) => b.setTool("ink")),
    },
    {
      id: PDF_COMMAND_IDS.toolNote,
      title: "便签工具",
      shortcut: "Mod+3",
      icon: <EditOutlined />,
      group: "批注",
      menuId: "annotate",
      keywords: ["note", "便签", "批注"],
      run: call((b) => b.setTool("note")),
    },
  ];
}
