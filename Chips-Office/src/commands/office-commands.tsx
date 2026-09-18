import { FileAddOutlined, FolderOpenOutlined, TableOutlined } from "@ant-design/icons";
import type { CommandItem } from "@chips/ui";
import type {
  CommandDefinitionInput,
  CommandInvokedEvent,
  CommandSource,
} from "chips-sdk";

export const OFFICE_PLUGIN_ID = "com.chips.office";

export const OFFICE_COMMAND_IDS = {
  openDocument: "com.chips.office.open-document",
  newWord: "com.chips.office.new-word",
  newSheet: "com.chips.office.new-sheet",
  newSlide: "com.chips.office.new-slide",
  newPdf: "com.chips.office.new-pdf",
} as const;

export const OFFICE_COMMAND_HANDLER_IDS = {
  openDocument: "open-document",
  newWord: "new-word",
  newSheet: "new-sheet",
  newSlide: "new-slide",
  newPdf: "new-pdf",
} as const;

const OFFICE_COMMAND_ID_SET = new Set<string>(Object.values(OFFICE_COMMAND_IDS));

export const officeCommandDefinitions: CommandDefinitionInput[] = [
  {
    commandId: OFFICE_COMMAND_IDS.openDocument,
    titleKey: "office.start.open",
    descriptionKey: "office.cli.open.description",
    ariaLabelKey: "office.start.open",
    icon: { name: "folder_open", style: "rounded" },
    scope: { kind: "app", appId: OFFICE_PLUGIN_ID },
    handlerId: OFFICE_COMMAND_HANDLER_IDS.openDocument,
    state: { enabled: true, visible: true },
  },
  {
    commandId: OFFICE_COMMAND_IDS.newWord,
    titleKey: "office.start.createWord",
    descriptionKey: "office.start.createWord",
    ariaLabelKey: "office.start.createWord",
    icon: { name: "description", style: "rounded" },
    scope: { kind: "app", appId: OFFICE_PLUGIN_ID },
    handlerId: OFFICE_COMMAND_HANDLER_IDS.newWord,
    state: { enabled: true, visible: true },
  },
  {
    commandId: OFFICE_COMMAND_IDS.newSheet,
    titleKey: "office.start.createSheet",
    descriptionKey: "office.start.createSheet",
    ariaLabelKey: "office.start.createSheet",
    icon: { name: "table_chart", style: "rounded" },
    scope: { kind: "app", appId: OFFICE_PLUGIN_ID },
    handlerId: OFFICE_COMMAND_HANDLER_IDS.newSheet,
    state: { enabled: true, visible: true },
  },
  {
    commandId: OFFICE_COMMAND_IDS.newSlide,
    titleKey: "office.start.createSlide",
    descriptionKey: "office.start.createSlide",
    ariaLabelKey: "office.start.createSlide",
    icon: { name: "slideshow", style: "rounded" },
    scope: { kind: "app", appId: OFFICE_PLUGIN_ID },
    handlerId: OFFICE_COMMAND_HANDLER_IDS.newSlide,
    state: { enabled: true, visible: true },
  },
  {
    commandId: OFFICE_COMMAND_IDS.newPdf,
    titleKey: "office.start.createPdf",
    descriptionKey: "office.start.createPdf",
    ariaLabelKey: "office.start.createPdf",
    icon: { name: "picture_as_pdf", style: "rounded" },
    scope: { kind: "app", appId: OFFICE_PLUGIN_ID },
    handlerId: OFFICE_COMMAND_HANDLER_IDS.newPdf,
    state: { enabled: true, visible: true },
  },
];

export type OfficeCommandId = (typeof OFFICE_COMMAND_IDS)[keyof typeof OFFICE_COMMAND_IDS];
export type OfficeCommandHandlerId =
  (typeof OFFICE_COMMAND_HANDLER_IDS)[keyof typeof OFFICE_COMMAND_HANDLER_IDS];

export interface OfficeCommandHandlers {
  openDocument: () => void;
  newWord: () => void;
  newSheet: () => void;
  newSlide: () => void;
  newPdf: () => void;
}

export function createOfficeCommands(handlers: OfficeCommandHandlers): CommandItem[] {
  return [
    {
      id: OFFICE_COMMAND_IDS.openDocument,
      title: "打开文档",
      icon: <FolderOpenOutlined />,
      group: "文档",
      keywords: ["open", "document", "打开文档"],
      run: handlers.openDocument,
    },
    {
      id: OFFICE_COMMAND_IDS.newWord,
      title: "新建 Word 文档",
      icon: <FileAddOutlined />,
      group: "新建",
      keywords: ["new", "word", "docx", "新建 Word 文档"],
      run: handlers.newWord,
    },
    {
      id: OFFICE_COMMAND_IDS.newSheet,
      title: "新建表格工作簿",
      icon: <TableOutlined />,
      group: "新建",
      keywords: ["new", "sheet", "xlsx", "新建表格工作簿"],
      run: handlers.newSheet,
    },
    {
      id: OFFICE_COMMAND_IDS.newSlide,
      title: "新建演示文稿",
      icon: <FileAddOutlined />,
      group: "新建",
      keywords: ["new", "slide", "pptx", "新建演示文稿"],
      run: handlers.newSlide,
    },
    {
      id: OFFICE_COMMAND_IDS.newPdf,
      title: "新建 PDF 文档",
      icon: <FileAddOutlined />,
      group: "新建",
      keywords: ["new", "pdf", "新建 PDF 文档"],
      run: handlers.newPdf,
    },
  ];
}

export function isOfficeCommandInvokedEvent(event: CommandInvokedEvent): boolean {
  if (!OFFICE_COMMAND_ID_SET.has(event.commandId)) {
    return false;
  }
  return event.ownerPluginId === undefined || event.ownerPluginId === OFFICE_PLUGIN_ID;
}

export function getOfficeCommandHandlerId(event: CommandInvokedEvent): OfficeCommandHandlerId | null {
  const handlerId = event.handlerId;
  if (
    handlerId === OFFICE_COMMAND_HANDLER_IDS.openDocument ||
    handlerId === OFFICE_COMMAND_HANDLER_IDS.newWord ||
    handlerId === OFFICE_COMMAND_HANDLER_IDS.newSheet ||
    handlerId === OFFICE_COMMAND_HANDLER_IDS.newSlide ||
    handlerId === OFFICE_COMMAND_HANDLER_IDS.newPdf
  ) {
    return handlerId;
  }
  return null;
}

export interface OfficeCommandStatus {
  commandId: string;
  handlerId: OfficeCommandHandlerId;
  source: CommandSource;
  invocationId?: string;
  payload?: Record<string, unknown>;
  context?: CommandInvokedEvent["context"];
}

export function createOfficeCommandStatus(
  event: CommandInvokedEvent,
  handlerId: OfficeCommandHandlerId,
): OfficeCommandStatus {
  return {
    commandId: event.commandId,
    handlerId,
    source: event.source ?? "api",
    invocationId: event.invocationId,
    payload: event.payload,
    context: event.context,
  };
}
