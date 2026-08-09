import type { CommandDefinitionInput, CommandInvokedEvent, CommandSource } from "chips-sdk";
import {
  resolveCommandMenuGroups,
  resolveCommandToolbarItems,
  type ChipsCommandProviderProps,
  type ChipsCommandView,
} from "@chips/component-library";
import { appConfig } from "../../config/app-config";

export const CARD_VIEWER_COMMAND_IDS = {
  openFile: `${appConfig.appId}.open-file`,
} as const;

export const CARD_VIEWER_COMMAND_HANDLER_IDS = {
  openFile: "open-file",
} as const;

const CARD_VIEWER_COMMAND_ID_SET = new Set<string>(Object.values(CARD_VIEWER_COMMAND_IDS));

export const cardViewerCommandDefinitions: CommandDefinitionInput[] = [
  {
    commandId: CARD_VIEWER_COMMAND_IDS.openFile,
    titleKey: "card-viewer.commands.openFile.title",
    descriptionKey: "card-viewer.commands.openFile.description",
    ariaLabelKey: "card-viewer.commands.openFile.ariaLabel",
    icon: { name: "folder_open", style: "rounded" },
    scope: { kind: "app", appId: appConfig.appId },
    permission: "platform.read",
    handlerId: CARD_VIEWER_COMMAND_HANDLER_IDS.openFile,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 10 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 10 }],
    state: { enabled: true, visible: true },
  },
];

export const cardViewerCommandViews = cardViewerCommandDefinitions as unknown as ChipsCommandView[];

export function resolveCardViewerToolbarCommands(i18n?: ChipsCommandProviderProps["i18n"]) {
  return resolveCommandToolbarItems(cardViewerCommandViews, {
    toolbarId: "main",
    i18n,
    includeHidden: false,
  });
}

export function resolveCardViewerMenuGroups(i18n?: ChipsCommandProviderProps["i18n"]) {
  return resolveCommandMenuGroups(cardViewerCommandViews, {
    menuId: "file",
    i18n,
    includeHidden: false,
  });
}

export type CardViewerCommandId = (typeof CARD_VIEWER_COMMAND_IDS)[keyof typeof CARD_VIEWER_COMMAND_IDS];
export type CardViewerCommandHandlerId =
  (typeof CARD_VIEWER_COMMAND_HANDLER_IDS)[keyof typeof CARD_VIEWER_COMMAND_HANDLER_IDS];

export interface CardViewerCommandStatus {
  commandId: string;
  handlerId: CardViewerCommandHandlerId;
  source: CommandSource;
  invocationId?: string;
}

export function isCardViewerCommandInvokedEvent(event: CommandInvokedEvent): boolean {
  if (!CARD_VIEWER_COMMAND_ID_SET.has(event.commandId)) {
    return false;
  }

  return event.ownerPluginId === undefined || event.ownerPluginId === appConfig.appId;
}

export function getCardViewerCommandHandlerId(event: CommandInvokedEvent): CardViewerCommandHandlerId | null {
  const handlerId = event.handlerId;
  if (handlerId === CARD_VIEWER_COMMAND_HANDLER_IDS.openFile) {
    return handlerId;
  }
  return null;
}

export function createCardViewerCommandStatus(
  event: CommandInvokedEvent,
  handlerId: CardViewerCommandHandlerId,
): CardViewerCommandStatus {
  return {
    commandId: event.commandId,
    handlerId,
    source: event.source ?? "api",
    invocationId: event.invocationId,
  };
}
