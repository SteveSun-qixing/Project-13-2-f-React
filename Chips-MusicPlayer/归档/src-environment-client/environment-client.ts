import type {
  ChipsClientLike,
  ChipsLaunchContext,
  ChipsSurfaceContext,
  ChipsThemeState,
  ThemeChangedPayload as ComponentThemeChangedPayload,
} from "@chips/component-library";
import type { Client, PlatformLaunchContext, SurfaceContext, ThemeChangedPayload, ThemeState } from "chips-sdk";
import { appConfig } from "../../config/app-config";
import { formatMessage } from "../i18n/messages";

function toThemeState(theme: ThemeState): ChipsThemeState {
  return {
    ...theme,
    themeId: theme.themeId,
    displayName: theme.displayName,
    version: theme.version,
    parentTheme: theme.parentTheme,
  };
}

function toThemeChangedPayload(payload: ThemeChangedPayload): ComponentThemeChangedPayload {
  return {
    ...payload,
    previousThemeId: payload.previousThemeId,
    themeId: payload.themeId,
    themeVersion: payload.themeVersion,
    timestamp: payload.timestamp,
    diagnosticsSummary: payload.diagnosticsSummary,
  };
}

function toSurfaceContext(surface: SurfaceContext | undefined): ChipsSurfaceContext | undefined {
  if (!surface) {
    return undefined;
  }

  return {
    ...surface,
    sceneId: surface.sceneId,
    surfaceId: surface.surfaceId,
    pluginId: surface.pluginId,
    sessionId: surface.sessionId,
    kind: surface.kind,
    presentation: surface.presentation ? { ...surface.presentation } : undefined,
    launchParams: surface.launchParams,
    documentContext: surface.documentContext,
    commandContext: surface.commandContext,
  };
}

export function toLaunchContext(launchContext: PlatformLaunchContext): ChipsLaunchContext {
  return {
    ...launchContext,
    pluginId: launchContext.pluginId,
    sessionId: launchContext.sessionId,
    sceneId: launchContext.sceneId,
    surfaceId: launchContext.surfaceId,
    kind: launchContext.kind,
    presentation: launchContext.presentation ? { ...launchContext.presentation } : undefined,
    surfaceContext: toSurfaceContext(launchContext.surfaceContext),
    launchParams: launchContext.launchParams,
  };
}

export function createMusicPlayerEnvironmentClient(client: Client): ChipsClientLike {
  return {
    ...client,
    theme: {
      ...client.theme,
      getCurrent: async () => toThemeState(await client.theme.getCurrent({ appId: appConfig.appId })),
      apply: client.theme.apply,
      onChanged: (handler) => client.theme.onChanged((payload) => handler(toThemeChangedPayload(payload))),
    },
    i18n: {
      ...client.i18n,
      getCurrent: client.i18n.getCurrent,
      setCurrent: client.i18n.setCurrent,
      translate: async (key: string, params?: Record<string, unknown>) => {
        return formatMessage(await client.i18n.getCurrent(), key, params as Record<string, string | number> | undefined);
      },
      onChanged: (handler) => client.i18n.onChanged(handler),
    },
    platform: {
      getLaunchContext: () => toLaunchContext(client.platform.getLaunchContext()),
    },
    command: client.command,
  };
}

