import React from "react";
import {
  ChipsEnvironmentProvider,
  ChipsThemeProvider,
  type ChipsClientLike,
  type ChipsLaunchContext,
  type ChipsSurfaceContext,
  type ChipsThemeState,
} from "@chips/component-library";
import type { PlatformLaunchContext, ThemeChangedPayload, ThemeState } from "chips-sdk";
import { getChipsClient } from "../shared/runtime/client";
import { createRuntimeEventSource } from "../shared/runtime/event-source";
import { normalizeSettingsError } from "../shared/runtime/errors";
import { formatMessage } from "../shared/i18n/messages";
import { appConfig } from "../../config/app-config";
import { createScopedLogger } from "../../config/logging";
import { AppRuntimeProvider } from "./AppRuntimeProvider";
import { I18nProvider } from "./providers/I18nProvider";
import { RuntimeProvider, useRuntimeContext } from "./providers/RuntimeProvider";
import { SETTINGS_PANEL_PERMISSIONS } from "./settings-permissions";

const runtimeLogger = createScopedLogger({ scope: "settings-runtime" });

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

function toLaunchContext(launchContext: PlatformLaunchContext): ChipsLaunchContext {
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

function createEnvironmentClient(): ChipsClientLike {
  const client = getChipsClient();
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
        return formatMessage(await client.i18n.getCurrent(), key, params as Record<string, string | number> | undefined);
      },
      onChanged: (handler: (payload: { locale: string }) => void) => client.events.on("language.changed", handler),
    },
    platform: {
      getLaunchContext: () => toLaunchContext(client.platform.getLaunchContext()),
    },
    command: client.command,
  };
}

function SettingsRuntimeBridge({ children }: React.PropsWithChildren): React.ReactElement {
  const runtime = useRuntimeContext();

  return (
    <ChipsThemeProvider
      themeId={runtime.currentTheme?.themeId ?? "chips-official.default-theme"}
      version={runtime.currentTheme?.version ?? "0.1.0"}
      eventSource={runtime.eventSource}
      eventName="theme.changed"
    >
      <AppRuntimeProvider
        client={runtime.client}
        eventSource={runtime.eventSource}
        currentTheme={runtime.currentTheme}
        currentLocale={runtime.currentLocale}
        ready={runtime.ready}
        runtimeError={runtime.runtimeError}
        refreshRuntimeState={runtime.refreshRuntimeState}
      >
        <I18nProvider>{children}</I18nProvider>
      </AppRuntimeProvider>
    </ChipsThemeProvider>
  );
}

function reportEnvironmentDiagnostic(error: unknown): void {
  runtimeLogger.warn(
    "Chips environment diagnostic received.",
    normalizeSettingsError(error, "Chips environment diagnostic received."),
  );
}

export function AppProviders({ children }: React.PropsWithChildren): React.ReactElement {
  const environmentClient = React.useMemo(() => createEnvironmentClient(), []);

  return (
    <ChipsEnvironmentProvider
      client={environmentClient}
      initialLocale="zh-CN"
      initialPermissions={[...SETTINGS_PANEL_PERMISSIONS]}
      initialDiagnostics={[]}
      onDiagnostic={reportEnvironmentDiagnostic}
    >
      <RuntimeProvider>
        <SettingsRuntimeBridge>{children}</SettingsRuntimeBridge>
      </RuntimeProvider>
    </ChipsEnvironmentProvider>
  );
}
