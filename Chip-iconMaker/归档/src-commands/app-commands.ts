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

export const APP_PLUGIN_ID = "com.chips.iconmaker";

export const APP_COMMAND_IDS = {
  focusImporter: "com.chips.iconmaker.focus-importer",
  generateIcons: "com.chips.iconmaker.generate-icons",
  refreshTheme: "com.chips.iconmaker.refresh-theme",
} as const;

export const APP_COMMAND_HANDLER_IDS = {
  focusImporter: "iconmaker:focus-importer",
  generateIcons: "iconmaker:generate-icons",
  refreshTheme: "iconmaker:refresh-theme",
} as const;

const APP_COMMAND_ID_SET = new Set<string>(Object.values(APP_COMMAND_IDS));

export const appCommandDefinitions: CommandDefinitionInput[] = [
  {
    commandId: APP_COMMAND_IDS.focusImporter,
    titleKey: "app.commands.focusImporter.title",
    descriptionKey: "app.commands.focusImporter.description",
    ariaLabelKey: "app.commands.focusImporter.ariaLabel",
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
    titleKey: "app.commands.generateIcons.title",
    descriptionKey: "app.commands.generateIcons.description",
    ariaLabelKey: "app.commands.generateIcons.ariaLabel",
    icon: { name: "auto_awesome", style: "rounded" },
    scope: { kind: "app", appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.generateIcons,
    menuPlacement: [{ menuId: "file", groupId: "primary", order: 20 }],
    toolbarPlacement: [{ toolbarId: "main", groupId: "primary", order: 20 }],
    paletteKeywords: ["generate", "icon", "ico", "icns", "png"],
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
    menuPlacement: [{ menuId: "view", groupId: "appearance", order: 10 }],
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
  return ["file", "view"].flatMap((menuId) =>
    resolveCommandMenuGroups(appCommandViews, {
      menuId,
      i18n,
      includeHidden: false,
    }),
  );
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
  payload?: Record<string, unknown>;
  context?: CommandInvokedEvent["context"];
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
  if (handlerId === APP_COMMAND_HANDLER_IDS.focusImporter) {
    return handlerId;
  }
  if (handlerId === APP_COMMAND_HANDLER_IDS.generateIcons) {
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
    payload: event.payload,
    context: event.context,
  };
}
