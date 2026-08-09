import React from "react";
import {
  ChipsEnvironmentProvider,
  ChipsThemeProvider,
  useChipsTheme,
  type ChipsClientLike,
  type ChipsLaunchContext,
  type ChipsRuntimeDiagnostic,
  type ChipsSurfaceContext,
} from "@chips/component-library";
import { createLogger } from "../../config/logging";
import { resolveLocale } from "../i18n/messages";
import { chipsClient } from "../runtime/chips-client";
import { createBookReaderEnvironmentClient, toLaunchContext } from "../runtime/environment-client";
import { readLaunchContext } from "../runtime/launch-context";
import { DEFAULT_THEME_STATE, readDocumentThemeState } from "../runtime/theme-runtime";
import { AppRuntimeProvider } from "./AppRuntimeProvider";

const BOOK_READER_PERMISSIONS = [
  "command.read",
  "command.write",
  "command.invoke",
  "resource.read",
  "file.read",
  "platform.read",
  "platform.external",
  "config.read",
  "config.write",
  "theme.read",
  "i18n.read",
  "network.request",
] as const;

const runtimeLogger = createLogger({ scope: "book-reader-environment" });

export interface AppProvidersProps {
  children: React.ReactNode;
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

function reportRuntimeDiagnostic(diagnostic: ChipsRuntimeDiagnostic): void {
  runtimeLogger.warn("Chips environment diagnostic received.", diagnostic);
}

function readDocumentLocale(): string {
  return resolveLocale(typeof document !== "undefined" ? document.documentElement.lang : undefined);
}

export function AppProviders({ children }: AppProvidersProps): React.ReactElement {
  const launchContext = React.useMemo(() => readLaunchContext(chipsClient), []);
  const environmentClient = React.useMemo<ChipsClientLike>(
    () => createBookReaderEnvironmentClient(chipsClient),
    [],
  );
  const initialTheme = React.useMemo(() => readDocumentThemeState(), []);
  const initialLocale = React.useMemo(() => readDocumentLocale(), []);
  const environmentLaunchContext = React.useMemo(() => toLaunchContext(launchContext), [launchContext]);

  return (
    <ChipsEnvironmentProvider
      client={environmentClient}
      initialTheme={initialTheme ?? DEFAULT_THEME_STATE}
      initialLocale={initialLocale}
      initialLaunchContext={environmentLaunchContext as ChipsLaunchContext}
      initialSurface={environmentLaunchContext.surfaceContext as ChipsSurfaceContext | undefined}
      initialPermissions={[...BOOK_READER_PERMISSIONS]}
      initialDiagnostics={[]}
      onDiagnostic={reportRuntimeDiagnostic}
    >
      <RuntimeThemeProvider>{children}</RuntimeThemeProvider>
    </ChipsEnvironmentProvider>
  );
}
