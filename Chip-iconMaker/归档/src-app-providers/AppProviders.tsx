import type { ReactNode } from "react";
import { useMemo } from "react";
import type { Client } from "chips-sdk";
import {
  ChipsEnvironmentProvider,
  ChipsThemeProvider,
  useChipsTheme,
  type ChipsClientLike,
  type ChipsLaunchContext,
  type ChipsSurfaceContext,
} from "@chips/component-library";
import { chipsClient } from "../runtime/chips-client";
import { readLaunchContext } from "../runtime/launch-context";
import { createAppPreviewMockClient } from "../testing/mock-environment";
import { defaultThemeState } from "../theme/theme-runtime";
import { createScopedLogger } from "../../config/logging";
import { AppRuntimeProvider } from "./AppRuntimeProvider";

const DEFAULT_PERMISSIONS = [
  "theme.read",
  "i18n.read",
  "i18n.write",
  "command.read",
  "command.write",
  "command.invoke",
];

const runtimeLogger = createScopedLogger({ scope: "app-runtime" });
const isHostBridgeAvailable = typeof window !== "undefined" && typeof window.chips !== "undefined";

export interface AppProvidersProps {
  children: ReactNode;
}

function RuntimeThemeProvider({ children }: AppProvidersProps) {
  const { theme } = useChipsTheme();
  const activeTheme = theme ?? defaultThemeState;

  return (
    <ChipsThemeProvider themeId={activeTheme.themeId} version={activeTheme.version}>
      <AppRuntimeProvider>{children}</AppRuntimeProvider>
    </ChipsThemeProvider>
  );
}

function reportRuntimeDiagnostic(diagnostic: unknown) {
  runtimeLogger.warn("Runtime diagnostic received.", diagnostic);
}

export function AppProviders({ children }: AppProvidersProps) {
  const environmentClient = useMemo(
    () => (isHostBridgeAvailable ? chipsClient : createAppPreviewMockClient()) as Client,
    [],
  );
  const launchContext = useMemo(() => readLaunchContext(environmentClient), [environmentClient]);
  const surfaceContext = launchContext.surfaceContext ?? null;

  return (
    <ChipsEnvironmentProvider
      client={environmentClient as unknown as ChipsClientLike}
      initialTheme={defaultThemeState}
      initialLocale="zh-CN"
      initialLaunchContext={launchContext as unknown as ChipsLaunchContext}
      initialSurface={surfaceContext as unknown as ChipsSurfaceContext | null}
      initialPermissions={DEFAULT_PERMISSIONS}
      initialDiagnostics={[]}
      onDiagnostic={reportRuntimeDiagnostic}
    >
      <RuntimeThemeProvider>{children}</RuntimeThemeProvider>
    </ChipsEnvironmentProvider>
  );
}
