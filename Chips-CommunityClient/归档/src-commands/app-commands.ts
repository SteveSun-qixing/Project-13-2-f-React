import type {
  CommandDefinitionInput,
  CommandInvokedEvent,
  CommandSource,
} from "chips-sdk";
import {
  resolveCommandMenuGroups,
  resolveCommandPaletteItems,
  resolveCommandToolbarItems,
  type ChipsCommandProviderProps,
  type ChipsCommandView,
} from "@chips/component-library";

export const APP_PLUGIN_ID = "com.chips.community-client";

export const APP_COMMAND_IDS = {
  openWorkspace: "com.chips.community-client.open-workspace",
  openSettings: "com.chips.community-client.open-settings",
  refreshTheme: "com.chips.community-client.refresh-theme",
} as const;

export const APP_COMMAND_HANDLER_IDS = {
  openWorkspace: "open-workspace",
  openSettings: "open-settings",
  refreshTheme: "refresh-theme",
} as const;

const APP_COMMAND_ID_SET = new Set<string>(Object.values(APP_COMMAND_IDS));

export const appCommandDefinitions: CommandDefinitionInput[] = [
  {
    commandId: APP_COMMAND_IDS.openWorkspace,
    titleKey: "app.commands.openWorkspace.title",
    descriptionKey: "app.commands.openWorkspace.description",
    ariaLabelKey: "app.commands.openWorkspace.ariaLabel",
    icon: { name: "dashboard", style: "rounded" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.openWorkspace,
    menuPlacement: [{ menuId: "app", groupId: "primary", order: 10 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 10 }],
    paletteKeywords: ["workspace", "dashboard", "main"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.openSettings,
    titleKey: "app.commands.openSettings.title",
    descriptionKey: "app.commands.openSettings.description",
    ariaLabelKey: "app.commands.openSettings.ariaLabel",
    icon: { name: "settings", style: "rounded" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.openSettings,
    menuPlacement: [{ menuId: "app", groupId: "primary", order: 15 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 15 }],
    paletteKeywords: ["settings", "server", "preferences"],
    state: { enabled: true, visible: true },
  },
  {
    commandId: APP_COMMAND_IDS.refreshTheme,
    titleKey: "app.commands.refreshTheme.title",
    descriptionKey: "app.commands.refreshTheme.description",
    ariaLabelKey: "app.commands.refreshTheme.ariaLabel",
    icon: { name: "palette", style: "rounded" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    permission: "theme.read",
    handlerId: APP_COMMAND_HANDLER_IDS.refreshTheme,
    menuPlacement: [{ menuId: "app", groupId: "view", order: 20 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "secondary", order: 20 }],
    paletteKeywords: ["theme", "appearance", "refresh"],
    state: {
      enabled: true,
      visible: true,
      disabledReasonKey: "app.commands.refreshTheme.disabledReason",
    },
  },
];

export const appCommandViews = appCommandDefinitions as unknown as ChipsCommandView[];

export function resolveAppToolbarCommands(i18n?: ChipsCommandProviderProps["i18n"]) {
  return resolveCommandToolbarItems(appCommandViews, {
    toolbarId: "main",
    i18n,
    includeHidden: false,
  });
}

export function resolveAppMenuGroups(i18n?: ChipsCommandProviderProps["i18n"]) {
  return resolveCommandMenuGroups(appCommandViews, {
    menuId: "app",
    i18n,
    includeHidden: false,
  });
}

export function resolveAppPaletteItems(i18n?: ChipsCommandProviderProps["i18n"]) {
  return resolveCommandPaletteItems(appCommandViews, {
    i18n,
    includeHidden: false,
  });
}

export type AppCommandId = (typeof APP_COMMAND_IDS)[keyof typeof APP_COMMAND_IDS];
export type AppCommandHandlerId = (typeof APP_COMMAND_HANDLER_IDS)[keyof typeof APP_COMMAND_HANDLER_IDS];

export interface AppCommandStatus {
  commandId: string;
  handlerId: AppCommandHandlerId;
  source: CommandSource;
  invocationId?: string;
}

export function isAppCommandInvokedEvent(event: CommandInvokedEvent): boolean {
  if (!APP_COMMAND_ID_SET.has(event.commandId)) {
    return false;
  }
  return event.ownerPluginId === undefined || event.ownerPluginId === APP_PLUGIN_ID;
}

export function getAppCommandHandlerId(
  event: CommandInvokedEvent,
): AppCommandHandlerId | null {
  const handlerId = event.handlerId;
  if (handlerId === APP_COMMAND_HANDLER_IDS.openWorkspace) {
    return handlerId;
  }
  if (handlerId === APP_COMMAND_HANDLER_IDS.openSettings) {
    return handlerId;
  }
  if (handlerId === APP_COMMAND_HANDLER_IDS.refreshTheme) {
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
  };
}
