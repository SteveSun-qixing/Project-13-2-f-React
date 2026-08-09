import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  useChipsDiagnostics,
  useChipsI18n,
  useChipsPermission,
  useChipsSurface,
  useChipsTheme,
  type ChipsLaunchContext,
  type ChipsRuntimeDiagnostic,
  type ChipsRuntimeStatus,
  type ChipsSurfaceContext,
  type ChipsThemeState,
} from "@chips/component-library";
import { appConfig } from "../../config/app-config";
import {
  defaultSceneDefinition,
  getSceneDefinition,
  type AppSceneDefinition,
  type AppSceneId,
} from "./scene-registry";

export type AppScenePhase = "launching" | "active" | "error";

export interface AppRuntimePermissions {
  values: string[];
  canReadTheme: boolean;
  canReadI18n: boolean;
  canWriteI18n: boolean;
  canReadCommand: boolean;
  canWriteCommand: boolean;
  canInvokeCommand: boolean;
}

export interface AppRuntimeStatus {
  phase: AppScenePhase;
  theme: ChipsRuntimeStatus;
  i18n: ChipsRuntimeStatus;
  surface: ChipsRuntimeStatus;
  diagnostics: ChipsRuntimeStatus;
  ready: boolean;
}

export interface AppRuntimeEnvironment {
  appId: string;
  pluginId: string;
  sceneId: AppSceneId;
  hostSceneId: string;
  surfaceId: string | null;
  sessionId: string | null;
  surfaceKind: string;
  launchParams: Record<string, unknown>;
}

export interface AppRuntimeValue {
  environment: AppRuntimeEnvironment;
  activeSceneId: AppSceneId;
  activeScene: AppSceneDefinition;
  setActiveSceneId(sceneId: AppSceneId): void;
  launchContext: ChipsLaunchContext | null;
  surface: ChipsSurfaceContext | null;
  theme: ChipsThemeState | null;
  locale: string;
  permissions: AppRuntimePermissions;
  diagnostics: ChipsRuntimeDiagnostic[];
  status: AppRuntimeStatus;
  hasPermission(permission: string): boolean;
  setLocale(locale: string): Promise<string | null>;
  refreshTheme(): Promise<ChipsThemeState | null>;
  refreshEnvironment(): Promise<PromiseSettledResult<unknown>[]>;
  pushDiagnostic(diagnostic: ChipsRuntimeDiagnostic): void;
  clearDiagnostics(): void;
}

const AppRuntimeContext = createContext<AppRuntimeValue | null>(null);

function resolveHostSceneId(
  surface: ChipsSurfaceContext | null,
  launchContext: ChipsLaunchContext | null,
): string {
  return surface?.sceneId ?? launchContext?.sceneId ?? appConfig.defaultSceneId;
}

export function resolveRuntimeSceneId(
  surface: ChipsSurfaceContext | null,
  launchContext: ChipsLaunchContext | null,
): AppSceneId {
  return getSceneDefinition(resolveHostSceneId(surface, launchContext)).id;
}

export function createRuntimeDiagnostic(
  code: string,
  message: string,
  source = "app-runtime",
  details?: Record<string, unknown>,
): ChipsRuntimeDiagnostic {
  return {
    code,
    message,
    source,
    details,
  };
}

function resolvePhase(
  themeStatus: ChipsRuntimeStatus,
  i18nStatus: ChipsRuntimeStatus,
  surfaceStatus: ChipsRuntimeStatus,
): AppScenePhase {
  if (themeStatus === "error" || i18nStatus === "error" || surfaceStatus === "error") {
    return "error";
  }
  if (themeStatus === "loading" || i18nStatus === "loading" || surfaceStatus === "loading") {
    return "launching";
  }
  return "active";
}

export interface AppRuntimeProviderProps {
  children: ReactNode;
}

export function AppRuntimeProvider({ children }: AppRuntimeProviderProps) {
  const theme = useChipsTheme();
  const i18n = useChipsI18n();
  const surface = useChipsSurface();
  const permission = useChipsPermission();
  const diagnostics = useChipsDiagnostics();
  const runtimeSceneId = resolveRuntimeSceneId(surface.surface, surface.launchContext);
  const [activeSceneId, setActiveSceneId] = useState<AppSceneId>(runtimeSceneId);

  useEffect(() => {
    setActiveSceneId(runtimeSceneId);
  }, [runtimeSceneId]);

  const permissions = useMemo<AppRuntimePermissions>(() => ({
    values: permission.permissions,
    canReadTheme: permission.hasPermission("theme.read"),
    canReadI18n: permission.hasPermission("i18n.read"),
    canWriteI18n: permission.hasPermission("i18n.write"),
    canReadCommand: permission.hasPermission("command.read"),
    canWriteCommand: permission.hasPermission("command.write"),
    canInvokeCommand: permission.hasPermission("command.invoke"),
  }), [permission]);

  const refreshEnvironment = useCallback(async () => {
    return Promise.allSettled([
      theme.refresh(),
      i18n.refresh(),
      surface.refresh(),
      diagnostics.refresh(),
    ]);
  }, [diagnostics, i18n, surface, theme]);

  const hostSceneId = resolveHostSceneId(surface.surface, surface.launchContext);
  const activeScene = getSceneDefinition(activeSceneId);
  const phase = resolvePhase(theme.status, i18n.status, surface.status);
  const status = useMemo<AppRuntimeStatus>(() => ({
    phase,
    theme: theme.status,
    i18n: i18n.status,
    surface: surface.status,
    diagnostics: diagnostics.status,
    ready: phase === "active",
  }), [diagnostics.status, i18n.status, phase, surface.status, theme.status]);

  const environment = useMemo<AppRuntimeEnvironment>(() => ({
    appId: appConfig.appId,
    pluginId: surface.surface?.pluginId ?? surface.launchContext?.pluginId ?? appConfig.appId,
    sceneId: activeSceneId,
    hostSceneId,
    surfaceId: surface.surface?.surfaceId ?? surface.launchContext?.surfaceId ?? null,
    sessionId: surface.surface?.sessionId ?? surface.launchContext?.sessionId ?? null,
    surfaceKind: surface.surface?.kind ?? surface.launchContext?.kind ?? "window",
    launchParams: {
      ...surface.launchContext?.launchParams,
      ...surface.surface?.launchParams,
    },
  }), [activeSceneId, hostSceneId, surface.launchContext, surface.surface]);

  const value = useMemo<AppRuntimeValue>(() => ({
    environment,
    activeSceneId,
    activeScene: activeScene ?? defaultSceneDefinition,
    setActiveSceneId,
    launchContext: surface.launchContext,
    surface: surface.surface,
    theme: theme.theme,
    locale: i18n.locale ?? "zh-CN",
    permissions,
    diagnostics: diagnostics.diagnostics,
    status,
    hasPermission: permission.hasPermission,
    setLocale: i18n.setLocale,
    refreshTheme: theme.refresh,
    refreshEnvironment,
    pushDiagnostic: diagnostics.push,
    clearDiagnostics: diagnostics.clear,
  }), [
    activeScene,
    activeSceneId,
    diagnostics.clear,
    diagnostics.diagnostics,
    diagnostics.push,
    environment,
    i18n.locale,
    i18n.setLocale,
    permission.hasPermission,
    permissions,
    refreshEnvironment,
    status,
    surface.launchContext,
    surface.surface,
    theme.refresh,
    theme.theme,
  ]);

  return (
    <AppRuntimeContext.Provider value={value}>
      {children}
    </AppRuntimeContext.Provider>
  );
}

export function useAppRuntime(): AppRuntimeValue {
  const context = useContext(AppRuntimeContext);
  if (!context) {
    throw new Error("useAppRuntime must be used inside AppRuntimeProvider.");
  }
  return context;
}
