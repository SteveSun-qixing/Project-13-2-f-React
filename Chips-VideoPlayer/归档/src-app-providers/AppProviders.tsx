import React, { useMemo } from "react";
import {
  ChipsEnvironmentProvider,
  ChipsThemeProvider,
  useChipsTheme,
  type ChipsClientLike,
  type ChipsLaunchContext,
  type ChipsRuntimeDiagnostic,
  type ChipsSurfaceContext,
} from "@chips/component-library";
import { appConfig } from "../../config/app-config";
import { createLogger } from "../../config/logging";
import { resolveLocale } from "../i18n/locales";
import { chipsClient } from "../runtime/chips-client";
import { readLaunchContext } from "../runtime/launch-context";
import { DEFAULT_THEME_STATE, readDocumentThemeState } from "../runtime/theme-runtime";
import { AppRuntimeProvider } from "./AppRuntimeProvider";

const VIDEO_PLAYER_PERMISSIONS = [
  "resource.read",
  "file.write",
  "platform.read",
  "theme.read",
  "i18n.read",
  "command.read",
  "command.write",
  "command.invoke",
] as const;

const runtimeLogger = createLogger({ scope: "video-player-environment" });

export interface AppProvidersProps {
  children: React.ReactNode;
}

function RuntimeThemeProvider({ children }: AppProvidersProps): React.ReactElement {
  const { theme } = useChipsTheme();
  const activeTheme = theme ?? readDocumentThemeState();

  return (
    <ChipsThemeProvider
      themeId={activeTheme.themeId}
      version={activeTheme.version ?? DEFAULT_THEME_STATE.version}
      eventSource={chipsClient.events}
      eventName="theme.changed"
    >
      <AppRuntimeProvider>{children}</AppRuntimeProvider>
    </ChipsThemeProvider>
  );
}

function reportRuntimeDiagnostic(diagnostic: ChipsRuntimeDiagnostic): void {
  runtimeLogger.warn("Chips environment diagnostic received.", diagnostic);
}

function readDocumentLocale(): string {
  return resolveLocale(typeof document !== "undefined" ? document.documentElement.lang : undefined);
}

export function AppProviders({ children }: AppProvidersProps): React.ReactElement {
  const launchContext = useMemo(() => readLaunchContext(chipsClient), []);
  const initialTheme = useMemo(() => readDocumentThemeState(), []);
  const initialLocale = useMemo(() => readDocumentLocale(), []);

  return (
    <ChipsEnvironmentProvider
      client={chipsClient as unknown as ChipsClientLike}
      initialTheme={initialTheme}
      initialLocale={initialLocale}
      initialLaunchContext={launchContext as unknown as ChipsLaunchContext}
      initialSurface={launchContext.surfaceContext as ChipsSurfaceContext | undefined}
      initialPermissions={[...VIDEO_PLAYER_PERMISSIONS]}
      initialDiagnostics={[]}
      onDiagnostic={reportRuntimeDiagnostic}
    >
      <RuntimeThemeProvider>{children}</RuntimeThemeProvider>
    </ChipsEnvironmentProvider>
  );
}

