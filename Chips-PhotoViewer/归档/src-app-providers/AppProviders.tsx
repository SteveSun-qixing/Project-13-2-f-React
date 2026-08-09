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
import { createScopedLogger } from "../../config/logging";
import { resolveLocale } from "../i18n/messages";
import { chipsClient } from "../runtime/chips-client";
import { createPhotoViewerEnvironmentClient, toLaunchContext } from "../runtime/environment-client";
import { readLaunchContext } from "../runtime/launch-context";
import { defaultThemeState, readDocumentThemeState } from "../runtime/theme-runtime";
import { AppRuntimeProvider } from "./AppRuntimeProvider";

const PHOTO_VIEWER_PERMISSIONS = [
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

const runtimeLogger = createScopedLogger({ scope: "photo-viewer-environment" });

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
    () => createPhotoViewerEnvironmentClient(chipsClient),
    [],
  );
  const initialTheme = React.useMemo(() => readDocumentThemeState(), []);
  const initialLocale = React.useMemo(() => readDocumentLocale(), []);
  const normalizedLaunchContext = React.useMemo(() => toLaunchContext(launchContext), [launchContext]);

  return (
    <ChipsEnvironmentProvider
      client={environmentClient}
      initialTheme={initialTheme ?? defaultThemeState}
      initialLocale={initialLocale}
      initialLaunchContext={normalizedLaunchContext as ChipsLaunchContext}
      initialSurface={normalizedLaunchContext.surfaceContext as ChipsSurfaceContext | undefined}
      initialPermissions={[...PHOTO_VIEWER_PERMISSIONS]}
      initialDiagnostics={[]}
      onDiagnostic={reportRuntimeDiagnostic}
    >
      <RuntimeThemeProvider>{children}</RuntimeThemeProvider>
    </ChipsEnvironmentProvider>
  );
}
