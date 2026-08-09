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
import { createRichTextEditorEnvironmentClient, toLaunchContext } from "../runtime/environment-client";
import { readLaunchContext } from "../runtime/launch-context";
import { defaultThemeState, readDocumentThemeState } from "../runtime/theme-runtime";
import { AppRuntimeProvider } from "./AppRuntimeProvider";

const RICH_TEXT_EDITOR_PERMISSIONS = [
  "card.read",
  "card.write",
  "file.read",
  "file.write",
  "platform.read",
  "platform.external",
  "theme.read",
  "i18n.read",
  "command.read",
  "command.write",
  "command.invoke",
] as const;

const runtimeLogger = createLogger({ scope: "rich-text-editor-environment" });

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
    () => createRichTextEditorEnvironmentClient(chipsClient),
    [],
  );
  const initialTheme = React.useMemo(() => readDocumentThemeState(), []);
  const initialLocale = React.useMemo(() => readDocumentLocale(), []);
  const environmentLaunchContext = React.useMemo(() => toLaunchContext(launchContext), [launchContext]);

  return (
    <ChipsEnvironmentProvider
      client={environmentClient}
      initialTheme={initialTheme ?? defaultThemeState}
      initialLocale={initialLocale}
      initialLaunchContext={environmentLaunchContext as ChipsLaunchContext}
      initialSurface={environmentLaunchContext.surfaceContext as ChipsSurfaceContext | undefined}
      initialPermissions={[...RICH_TEXT_EDITOR_PERMISSIONS]}
      initialDiagnostics={[]}
      onDiagnostic={reportRuntimeDiagnostic}
    >
      <RuntimeThemeProvider>{children}</RuntimeThemeProvider>
    </ChipsEnvironmentProvider>
  );
}

