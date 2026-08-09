import type {
  CommandDefinitionInput,
  CommandInvokedEvent,
  CommandInvocationContext,
  CommandSetStateOptions,
  CommandSource,
  CommandState,
} from "chips-sdk";
import type { ChipsCommandView } from "@chips/component-library";
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

export const RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS = {
  newDocument: "rich-text-editor:file.new",
  openFile: "rich-text-editor:file.open",
  save: "rich-text-editor:file.save",
  saveAs: "rich-text-editor:file.save-as",
  exportCard: "rich-text-editor:file.export-card",
  preview: "rich-text-editor:document.preview",
  info: "rich-text-editor:document.info",
  undo: "rich-text-editor:edit.undo",
  redo: "rich-text-editor:edit.redo",
  find: "rich-text-editor:edit.find",
  format: "rich-text-editor:format.open",
} as const;

export type RichTextEditorCommandId =
  (typeof RICH_TEXT_EDITOR_COMMAND_IDS)[keyof typeof RICH_TEXT_EDITOR_COMMAND_IDS];
export type RichTextEditorCommandHandlerId =
  (typeof RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS)[keyof typeof RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS];
export type RichTextEditorCommandPhase = "idle" | "registering" | "ready" | "error";

export interface RichTextEditorCommandRuntimeState {
  isBusy: boolean;
  hasFilePath: boolean;
  canPreview: boolean;
}

export interface RichTextEditorCommandStatus {
  commandId: RichTextEditorCommandId;
  handlerId: RichTextEditorCommandHandlerId;
  source: CommandSource;
  invocationId?: string;
  payload?: Record<string, unknown>;
  context?: CommandInvocationContext;
}

const APP_SCOPE = { kind: "app", appId: appConfig.appId } as const;
const COMMAND_ID_SET = new Set<string>(Object.values(RICH_TEXT_EDITOR_COMMAND_IDS));
const HANDLER_ID_SET = new Set<string>(Object.values(RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS));

function shortcut(accelerator: string) {
  return {
    accelerator,
    platform: "desktop" as const,
    preventDefault: true,
  };
}

function unavailableState(reasonKey: string): CommandState {
  return {
    enabled: false,
    visible: true,
    disabledReasonKey: reasonKey,
  };
}

export const richTextEditorCommandDefinitions: CommandDefinitionInput[] = [
  {
    commandId: RICH_TEXT_EDITOR_COMMAND_IDS.newDocument,
    titleKey: "app.commands.new.title",
    descriptionKey: "app.commands.new.description",
    ariaLabelKey: "app.commands.new.ariaLabel",
    icon: { name: "note_add", style: "rounded" },
    scope: APP_SCOPE,
    handlerId: RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS.newDocument,
    shortcut: shortcut("Mod+N"),
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 10 }],
    toolbarPlacement: [{ toolbarId: "document", groupId: "file", order: 10 }],
    paletteKeywords: ["new", "document", "app.commands.new.title"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: RICH_TEXT_EDITOR_COMMAND_IDS.openFile,
    titleKey: "app.commands.open.title",
    descriptionKey: "app.commands.open.description",
    ariaLabelKey: "app.commands.open.ariaLabel",
    icon: { name: "folder_open", style: "rounded" },
    scope: APP_SCOPE,
    permission: "platform.read",
    handlerId: RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS.openFile,
    shortcut: shortcut("Mod+O"),
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 20 }],
    toolbarPlacement: [{ toolbarId: "document", groupId: "file", order: 20 }],
    paletteKeywords: ["open", "card", "app.commands.open.title"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: RICH_TEXT_EDITOR_COMMAND_IDS.save,
    titleKey: "app.commands.save.title",
    descriptionKey: "app.commands.save.description",
    ariaLabelKey: "app.commands.save.ariaLabel",
    icon: { name: "save", style: "rounded" },
    scope: APP_SCOPE,
    permission: "card.write",
    handlerId: RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS.save,
    shortcut: shortcut("Mod+S"),
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 30 }],
    toolbarPlacement: [{ toolbarId: "document", groupId: "file", order: 30 }],
    paletteKeywords: ["save", "card", "app.commands.save.title"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: RICH_TEXT_EDITOR_COMMAND_IDS.saveAs,
    titleKey: "app.commands.saveAs.title",
    descriptionKey: "app.commands.saveAs.description",
    ariaLabelKey: "app.commands.saveAs.ariaLabel",
    icon: { name: "save_as", style: "rounded" },
    scope: APP_SCOPE,
    permission: "card.write",
    handlerId: RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS.saveAs,
    shortcut: shortcut("Mod+Shift+S"),
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 40 }],
    toolbarPlacement: [{ toolbarId: "document", groupId: "file", order: 40 }],
    paletteKeywords: ["save as", "export", "app.commands.saveAs.title"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: RICH_TEXT_EDITOR_COMMAND_IDS.exportCard,
    titleKey: "app.commands.export.title",
    descriptionKey: "app.commands.export.description",
    ariaLabelKey: "app.commands.export.ariaLabel",
    icon: { name: "ios_share", style: "rounded" },
    scope: APP_SCOPE,
    permission: "card.write",
    handlerId: RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS.exportCard,
    menuPlacement: [{ menuId: "file", groupId: "secondary", order: 50 }],
    paletteKeywords: ["export", "card", "app.commands.export.title"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: RICH_TEXT_EDITOR_COMMAND_IDS.preview,
    titleKey: "app.commands.preview.title",
    descriptionKey: "app.commands.preview.description",
    ariaLabelKey: "app.commands.preview.ariaLabel",
    icon: { name: "visibility", style: "rounded" },
    scope: APP_SCOPE,
    permission: "platform.external",
    handlerId: RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS.preview,
    shortcut: shortcut("Mod+P"),
    menuPlacement: [{ menuId: "view", groupId: "document", order: 10 }],
    toolbarPlacement: [{ toolbarId: "document", groupId: "view", order: 10 }],
    paletteKeywords: ["preview", "view", "app.commands.preview.title"],
    state: { enabled: false, visible: true, disabledReasonKey: "app.commands.disabled.needsSavedFile" },
  },
  {
    commandId: RICH_TEXT_EDITOR_COMMAND_IDS.info,
    titleKey: "app.commands.info.title",
    descriptionKey: "app.commands.info.description",
    ariaLabelKey: "app.commands.info.ariaLabel",
    icon: { name: "info", style: "rounded" },
    scope: APP_SCOPE,
    handlerId: RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS.info,
    menuPlacement: [{ menuId: "view", groupId: "document", order: 20 }],
    toolbarPlacement: [{ toolbarId: "document", groupId: "view", order: 20 }],
    paletteKeywords: ["info", "metadata", "app.commands.info.title"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: RICH_TEXT_EDITOR_COMMAND_IDS.undo,
    titleKey: "app.commands.undo.title",
    descriptionKey: "app.commands.undo.description",
    ariaLabelKey: "app.commands.undo.ariaLabel",
    icon: { name: "undo", style: "rounded" },
    scope: APP_SCOPE,
    handlerId: RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS.undo,
    shortcut: shortcut("Mod+Z"),
    menuPlacement: [{ menuId: "edit", groupId: "history", order: 10 }],
    paletteKeywords: ["undo", "app.commands.undo.title"],
    state: unavailableState("app.commands.disabled.editorOwned"),
  },
  {
    commandId: RICH_TEXT_EDITOR_COMMAND_IDS.redo,
    titleKey: "app.commands.redo.title",
    descriptionKey: "app.commands.redo.description",
    ariaLabelKey: "app.commands.redo.ariaLabel",
    icon: { name: "redo", style: "rounded" },
    scope: APP_SCOPE,
    handlerId: RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS.redo,
    shortcut: shortcut("Mod+Shift+Z"),
    menuPlacement: [{ menuId: "edit", groupId: "history", order: 20 }],
    paletteKeywords: ["redo", "app.commands.redo.title"],
    state: unavailableState("app.commands.disabled.editorOwned"),
  },
  {
    commandId: RICH_TEXT_EDITOR_COMMAND_IDS.find,
    titleKey: "app.commands.find.title",
    descriptionKey: "app.commands.find.description",
    ariaLabelKey: "app.commands.find.ariaLabel",
    icon: { name: "search", style: "rounded" },
    scope: APP_SCOPE,
    handlerId: RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS.find,
    shortcut: shortcut("Mod+F"),
    menuPlacement: [{ menuId: "edit", groupId: "search", order: 30 }],
    paletteKeywords: ["find", "search", "app.commands.find.title"],
    state: unavailableState("app.commands.disabled.editorOwned"),
  },
  {
    commandId: RICH_TEXT_EDITOR_COMMAND_IDS.format,
    titleKey: "app.commands.format.title",
    descriptionKey: "app.commands.format.description",
    ariaLabelKey: "app.commands.format.ariaLabel",
    icon: { name: "format_bold", style: "rounded" },
    scope: APP_SCOPE,
    handlerId: RICH_TEXT_EDITOR_COMMAND_HANDLER_IDS.format,
    menuPlacement: [{ menuId: "format", groupId: "richtext", order: 10 }],
    paletteKeywords: ["format", "markdown", "app.commands.format.title"],
    state: unavailableState("app.commands.disabled.editorOwned"),
  },
];

export function createRichTextEditorCommandViews(
  runtimeState: RichTextEditorCommandRuntimeState,
): ChipsCommandView[] {
  return richTextEditorCommandDefinitions.map((definition) => {
    const isFileAction =
      definition.commandId === RICH_TEXT_EDITOR_COMMAND_IDS.newDocument
      || definition.commandId === RICH_TEXT_EDITOR_COMMAND_IDS.openFile
      || definition.commandId === RICH_TEXT_EDITOR_COMMAND_IDS.save
      || definition.commandId === RICH_TEXT_EDITOR_COMMAND_IDS.saveAs
      || definition.commandId === RICH_TEXT_EDITOR_COMMAND_IDS.exportCard;
    const isPreview = definition.commandId === RICH_TEXT_EDITOR_COMMAND_IDS.preview;

    const state: CommandState = {
      ...(definition.state ?? {}),
      enabled: isPreview
        ? runtimeState.canPreview && !runtimeState.isBusy
        : isFileAction
          ? !runtimeState.isBusy
          : definition.state?.enabled,
    };

    if (isPreview && !runtimeState.hasFilePath) {
      state.disabledReasonKey = "app.commands.disabled.needsSavedFile";
    }

    return {
      ...definition,
      state,
      diagnostic: {
        visible: state.visible !== false,
        enabled: state.enabled !== false,
        checked: state.checked === true,
        disabledReasonKey: state.disabledReasonKey,
        hiddenReasonKey: state.hiddenReasonKey,
      },
    } as ChipsCommandView;
  });
}

export function createRichTextEditorCommandSetStateOptions(
  context?: CommandInvocationContext,
): CommandSetStateOptions {
  return context ? { context } : {};
}

export function createRichTextEditorCommandStatus(event: CommandInvokedEvent): RichTextEditorCommandStatus | null {
  if (!COMMAND_ID_SET.has(event.commandId) || !event.handlerId || !HANDLER_ID_SET.has(event.handlerId)) {
    return null;
  }

  return {
    commandId: event.commandId as RichTextEditorCommandId,
    handlerId: event.handlerId as RichTextEditorCommandHandlerId,
    source: event.source ?? "api",
    invocationId: event.invocationId,
    payload: event.payload,
    context: event.context,
  };
}

export function createRichTextEditorCommandStatusFromCommandId(
  commandId: RichTextEditorCommandId,
  source: CommandSource,
  payload: Record<string, unknown> = {},
  context?: CommandInvocationContext,
): RichTextEditorCommandStatus {
  const definition = richTextEditorCommandDefinitions.find((item) => item.commandId === commandId);
  if (!definition || !HANDLER_ID_SET.has(definition.handlerId)) {
    throw new Error(`Unknown rich text editor command: ${commandId}`);
  }

  return {
    commandId,
    handlerId: definition.handlerId as RichTextEditorCommandHandlerId,
    source,
    payload,
    context,
  };
}

export function toRichTextEditorCommandErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) {
      return code;
    }
  }
  return "RICH_TEXT_EDITOR_COMMAND_RUNTIME_ERROR";
}

