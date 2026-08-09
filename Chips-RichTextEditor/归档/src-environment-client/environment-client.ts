import type { ChipsClientLike, ChipsLaunchContext, ChipsSurfaceContext, ChipsThemeState } from "@chips/component-library";
import type { Client, PlatformLaunchContext, ThemeChangedPayload, ThemeState } from "chips-sdk";
import { appConfig } from "../../config/app-config";
import { translateLocalKey } from "../i18n/messages";
import { readLaunchContext } from "./launch-context";

function toThemeState(theme: ThemeState): ChipsThemeState {
  return {
    ...theme,
    themeId: theme.themeId,
    displayName: theme.displayName,
    version: theme.version,
    parentTheme: theme.parentTheme,
  };
}

function toThemeChangedPayload(payload: ThemeChangedPayload): Record<string, unknown> {
  return {
    ...payload,
    previousThemeId: payload.previousThemeId,
    themeId: payload.themeId,
    themeVersion: payload.themeVersion,
    version: payload.themeVersion,
    timestamp: payload.timestamp,
    diagnosticsSummary: payload.diagnosticsSummary,
  };
}

function toSurfaceContext(launchContext: PlatformLaunchContext): ChipsSurfaceContext | undefined {
  const surface = launchContext.surfaceContext;
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
    surfaceContext: toSurfaceContext(launchContext),
    launchParams: launchContext.launchParams,
  };
}

export function createRichTextEditorEnvironmentClient(client: Client): ChipsClientLike {
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
      setCurrent: async (locale: string) => {
        await client.i18n.setCurrent(locale);
      },
      translate: async (key: string, params?: Record<string, unknown>) => {
        const locale = await client.i18n.getCurrent();
        return translateLocalKey(key, locale, params as Record<string, string | number> | undefined);
      },
      onChanged: (handler: (payload: { locale: string }) => void) => client.i18n.onChanged(handler),
    },
    platform: {
      getLaunchContext: () => toLaunchContext(readLaunchContext(client)),
    },
    command: client.command,
  };
}

