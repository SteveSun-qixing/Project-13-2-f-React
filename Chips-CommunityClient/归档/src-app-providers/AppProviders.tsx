import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  ChipsEnvironmentProvider,
  ChipsThemeProvider,
  useChipsTheme,
  type ChipsClientLike,
  type ChipsLaunchContext,
  type ChipsRuntimeDiagnostic,
  type ChipsSurfaceContext,
} from "@chips/component-library";
import { chipsClient } from "../runtime/chips-client";
import { readLaunchContext } from "../runtime/launch-context";
import { defaultThemeState, resolveThemeLabel } from "../theme/theme-runtime";
import { createScopedLogger } from "../../config/logging";
import { resolveLocale } from "../i18n/locales";
import { AppRuntimeProvider } from "./AppRuntimeProvider";

const COMMUNITY_CLIENT_PERMISSIONS = [
  "theme.read",
  "i18n.read",
  "i18n.write",
  "command.read",
  "command.write",
  "command.invoke",
  "config.read",
  "config.write",
  "credential.manage",
  "module.invoke",
  "card.read",
  "box.read",
  "plugin.read",
  "resource.read",
  "platform.read",
  "platform.external",
  "network.request",
  "file.read",
] as const;

const runtimeLogger = createScopedLogger({ scope: "app-runtime" });

export interface AppProvidersProps {
  children: ReactNode;
}

function RuntimeThemeProvider({ children }: AppProvidersProps) {
  const { theme } = useChipsTheme();
  const activeTheme = theme ?? defaultThemeState;

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

function reportRuntimeDiagnostic(diagnostic: ChipsRuntimeDiagnostic) {
  runtimeLogger.warn("Runtime diagnostic received.", diagnostic);
}

function readDocumentLocale(): string {
  if (typeof document === "undefined") {
    return resolveLocale(undefined);
  }
  return resolveLocale(document.documentElement.lang);
}

export function AppProviders({ children }: AppProvidersProps) {
  const launchContext = useMemo(() => readLaunchContext(chipsClient), []);
  const surfaceContext = launchContext.surfaceContext ?? null;
  const environmentClient = chipsClient as unknown as ChipsClientLike;
  const initialLocale = useMemo(() => readDocumentLocale(), []);
  const initialTheme = useMemo(
    () => ({ ...defaultThemeState, displayName: resolveThemeLabel(null) }),
    [],
  );

  return (
    <ChipsEnvironmentProvider
      client={environmentClient}
      initialTheme={initialTheme}
      initialLocale={initialLocale}
      initialLaunchContext={launchContext as unknown as ChipsLaunchContext}
      initialSurface={surfaceContext as unknown as ChipsSurfaceContext | null}
      initialPermissions={[...COMMUNITY_CLIENT_PERMISSIONS]}
      initialDiagnostics={[]}
      onDiagnostic={reportRuntimeDiagnostic}
    >
      <RuntimeThemeProvider>{children}</RuntimeThemeProvider>
    </ChipsEnvironmentProvider>
  );
}
