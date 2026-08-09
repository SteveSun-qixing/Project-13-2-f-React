import React from "react";
import {
  ChipsCommandProvider,
  ChipsEnvironmentProvider,
  ChipsThemeProvider,
  createChipsI18nText,
  createCommandAdapter,
  useChipsI18n,
  useChipsTheme,
  type ChipsClientLike,
  type ChipsLaunchContext,
  type ChipsRuntimeDiagnostic,
  type ChipsSurfaceContext,
} from "@chips/component-library";
import { appConfig } from "../../config/app-config";
import { createLogger } from "../../config/logging";
import { localeBundles, resolveLocale } from "../i18n/messages";
import { chipsClient } from "../runtime/chips-client";
import { createMusicPlayerEnvironmentClient, toLaunchContext } from "../runtime/environment-client";
import { readLaunchContext } from "../runtime/launch-context";
import { defaultThemeState, readDocumentThemeState } from "../runtime/theme-runtime";
import { AppRuntimeProvider } from "./AppRuntimeProvider";

const MUSIC_PLAYER_PERMISSIONS = [
  "resource.read",
  "file.read",
  "file.write",
  "platform.read",
  "theme.read",
  "i18n.read",
  "command.read",
  "command.write",
  "command.invoke",
] as const;

const environmentLogger = createLogger({ scope: "music-player-environment" });

export interface AppProvidersProps {
  children: React.ReactNode;
}

function readDocumentLocale(): string {
  return resolveLocale(typeof document !== "undefined" ? document.documentElement.lang : undefined);
}

function reportRuntimeDiagnostic(diagnostic: ChipsRuntimeDiagnostic): void {
  environmentLogger.warn("Chips environment diagnostic received.", diagnostic);
}

function RuntimeThemeProvider({ children }: AppProvidersProps): React.ReactElement {
  const { theme } = useChipsTheme();
  const activeTheme = theme ?? readDocumentThemeState();

  return (
    <ChipsThemeProvider
      themeId={activeTheme.themeId}
      version={activeTheme.version}
      eventSource={chipsClient.events}
      eventName="theme.changed"
    >
      <AppRuntimeProvider>{children}</AppRuntimeProvider>
    </ChipsThemeProvider>
  );
}

function RuntimeCommandProvider({ children }: AppProvidersProps): React.ReactElement {
  const i18n = useChipsI18n();
  const locale = resolveLocale(i18n.locale ?? readDocumentLocale());
  const commandAdapter = React.useMemo(() => createCommandAdapter(chipsClient), []);
  const commandText = React.useMemo(
    () =>
      createChipsI18nText({
        bundles: localeBundles,
        locale,
        defaultLocale: "zh-CN",
        fallbackLocale: "en-US",
        missingText: (key) => key,
      }),
    [locale],
  );

  return (
    <ChipsCommandProvider
      adapter={commandAdapter}
      query={{
        scope: {
          kind: "app",
          appId: appConfig.appId,
        },
        includeDisabled: true,
      }}
      i18n={commandText}
    >
      {children}
    </ChipsCommandProvider>
  );
}

export function AppProviders({ children }: AppProvidersProps): React.ReactElement {
  const launchContext = React.useMemo(() => readLaunchContext(chipsClient), []);
  const environmentClient = React.useMemo<ChipsClientLike>(
    () => createMusicPlayerEnvironmentClient(chipsClient),
    [],
  );
  const initialTheme = React.useMemo(() => readDocumentThemeState(), []);
  const initialLocale = React.useMemo(() => readDocumentLocale(), []);
  const componentLaunchContext = React.useMemo(() => toLaunchContext(launchContext), [launchContext]);

  return (
    <ChipsEnvironmentProvider
      client={environmentClient}
      initialTheme={initialTheme ?? defaultThemeState}
      initialLocale={initialLocale}
      initialLaunchContext={componentLaunchContext as ChipsLaunchContext}
      initialSurface={componentLaunchContext.surfaceContext as ChipsSurfaceContext | undefined}
      initialPermissions={[...MUSIC_PLAYER_PERMISSIONS]}
      initialDiagnostics={[]}
      onDiagnostic={reportRuntimeDiagnostic}
    >
      <RuntimeThemeProvider>
        <RuntimeCommandProvider>
          {children}
        </RuntimeCommandProvider>
      </RuntimeThemeProvider>
    </ChipsEnvironmentProvider>
  );
}
