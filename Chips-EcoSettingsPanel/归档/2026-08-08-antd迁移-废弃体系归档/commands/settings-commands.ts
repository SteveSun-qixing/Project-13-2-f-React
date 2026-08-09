import type { CommandDefinitionInput, CommandInvokedEvent, CommandSource } from "chips-sdk";
import type { ChipsCommandView } from "@chips/component-library";
import { appConfig } from "../../config/app-config";
import { sceneDefinitions, type SettingsSceneId } from "../app/scene-registry";
import { getSettingsSceneIconName } from "../app/settings-scene-icons";

export const SETTINGS_COMMAND_IDS = Object.fromEntries(
  sceneDefinitions.map((scene) => [scene.id, `${appConfig.appId}.scene.${scene.id}`]),
) as Record<SettingsSceneId, string>;

export const SETTINGS_COMMAND_HANDLER_IDS = Object.fromEntries(
  sceneDefinitions.map((scene) => [scene.id, `open-scene:${scene.id}`]),
) as Record<SettingsSceneId, string>;

const SETTINGS_COMMAND_ID_SET = new Set<string>(Object.values(SETTINGS_COMMAND_IDS));

export const settingsCommandDefinitions: CommandDefinitionInput[] = sceneDefinitions.map((scene, index) => ({
  commandId: SETTINGS_COMMAND_IDS[scene.id],
  titleKey: scene.titleKey,
  descriptionKey: scene.summaryKey,
  ariaLabelKey: scene.titleKey,
  icon: { name: getSettingsSceneIconName(scene.id), style: "rounded" },
  scope: { kind: "app", appId: appConfig.appId },
  handlerId: SETTINGS_COMMAND_HANDLER_IDS[scene.id],
  menuPlacement: [{ menuId: "settings", groupId: "sections", order: (index + 1) * 10 }],
  toolbarPlacement: [{ toolbarId: "settings", groupId: "sections", order: (index + 1) * 10 }],
  paletteKeywords: [scene.id, scene.titleKey, scene.summaryKey],
  state: { enabled: true, visible: true },
}));

export const settingsCommandViews = settingsCommandDefinitions as unknown as ChipsCommandView[];

export type SettingsCommandPhase = "idle" | "registering" | "ready" | "error";

export interface SettingsCommandStatus {
  commandId: string;
  sceneId: SettingsSceneId;
  source: CommandSource;
  invocationId?: string;
}

export function getSceneIdFromHandlerId(handlerId: string | undefined): SettingsSceneId | null {
  const match = Object.entries(SETTINGS_COMMAND_HANDLER_IDS).find(([, value]) => value === handlerId);
  return match ? (match[0] as SettingsSceneId) : null;
}

export function isSettingsCommandInvokedEvent(event: CommandInvokedEvent): boolean {
  if (!SETTINGS_COMMAND_ID_SET.has(event.commandId)) {
    return false;
  }
  return event.ownerPluginId === undefined || event.ownerPluginId === appConfig.appId;
}

export function createSettingsCommandStatus(event: CommandInvokedEvent, sceneId: SettingsSceneId): SettingsCommandStatus {
  return {
    commandId: event.commandId,
    sceneId,
    source: event.source ?? "api",
    invocationId: event.invocationId,
  };
}
