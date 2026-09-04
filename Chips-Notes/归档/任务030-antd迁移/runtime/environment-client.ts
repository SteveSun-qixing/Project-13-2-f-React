import type {
  ChipsClientLike,
  ChipsLaunchContext,
  ChipsSurfaceContext,
  ChipsThemeState,
  ThemeChangedPayload as ChipsThemeChangedPayload,
} from '@chips/component-library';
import type { Client, PlatformLaunchContext, SurfaceContext, ThemeChangedPayload, ThemeState } from 'chips-sdk';
import { appConfig } from '../../config/app-config';
import { getLocale, translate } from '../i18n';
import { readLaunchContext } from './launch-context';

function toThemeState(theme: ThemeState): ChipsThemeState {
  return {
    ...theme,
    themeId: theme.themeId,
    displayName: theme.displayName,
    version: theme.version,
    parentTheme: theme.parentTheme,
  };
}

function toThemeChangedPayload(payload: ThemeChangedPayload): ChipsThemeChangedPayload {
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

function toSurfaceContext(surfaceContext: SurfaceContext | null): ChipsSurfaceContext | undefined {
  if (!surfaceContext) {
    return undefined;
  }

  return {
    ...surfaceContext,
    sceneId: surfaceContext.sceneId,
    surfaceId: surfaceContext.surfaceId,
    pluginId: surfaceContext.pluginId,
    sessionId: surfaceContext.sessionId,
    kind: surfaceContext.kind,
    presentation: surfaceContext.presentation ? { ...surfaceContext.presentation } : undefined,
    launchParams: surfaceContext.launchParams,
  };
}

export function toEnvironmentLaunchContext(launchContext: PlatformLaunchContext | null): ChipsLaunchContext | null {
  if (!launchContext) {
    return null;
  }

  const launchParams = {
    ...launchContext.surfaceContext?.launchParams,
    ...launchContext.launchParams,
  };

  return {
    ...launchContext,
    pluginId: launchContext.pluginId,
    sessionId: launchContext.sessionId,
    sceneId: launchContext.sceneId,
    surfaceId: launchContext.surfaceId,
    kind: launchContext.kind,
    presentation: launchContext.presentation ? { ...launchContext.presentation } : undefined,
    surfaceContext: toSurfaceContext(launchContext.surfaceContext ?? null),
    launchParams,
  };
}

export function createEditingEngineEnvironmentClient(client: Client): ChipsClientLike {
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
      translate: async (key: string, params?: Record<string, unknown>) => (
        translate(key, params as Record<string, string | number> | undefined, getLocale())
      ),
      onChanged: client.i18n.onChanged,
    },
    platform: {
      getLaunchContext: () => toEnvironmentLaunchContext(readLaunchContext(client).launchContext),
    },
    command: client.command,
  };
}
