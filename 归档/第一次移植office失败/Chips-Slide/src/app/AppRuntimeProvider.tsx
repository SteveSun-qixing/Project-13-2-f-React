import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Client, PlatformLaunchContext, SurfaceContext } from "chips-sdk";
import { useChips } from "@chips/ui";
import { appConfig } from "../../config/app-config";
import { readLaunchContext } from "../runtime/launch-context";
import {
  defaultSceneDefinition,
  getSceneDefinition,
  type AppSceneDefinition,
  type AppSceneId,
} from "./scene-registry";

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

export interface AppRuntimeDiagnostic {
  code: string;
  message: string;
  source: string;
  details?: Record<string, unknown>;
}

export interface AppRuntimeValue {
  client: Client | null;
  ready: boolean;
  launchContext: PlatformLaunchContext | null;
  surface: SurfaceContext | null;
  environment: AppRuntimeEnvironment;
  activeSceneId: AppSceneId;
  activeScene: AppSceneDefinition;
  setActiveSceneId(sceneId: AppSceneId): void;
  diagnostics: AppRuntimeDiagnostic[];
  pushDiagnostic(diagnostic: AppRuntimeDiagnostic): void;
  clearDiagnostics(): void;
  refreshEnvironment(): Promise<void>;
}

const AppRuntimeContext = createContext<AppRuntimeValue | null>(null);

function resolveHostSceneId(launchContext: PlatformLaunchContext | null): string {
  return (
    launchContext?.surfaceContext?.sceneId ??
    launchContext?.sceneId ??
    appConfig.defaultSceneId
  );
}

export function resolveRuntimeSceneId(launchContext: PlatformLaunchContext | null): AppSceneId {
  return getSceneDefinition(resolveHostSceneId(launchContext)).id;
}

export function createRuntimeDiagnostic(
  code: string,
  message: string,
  source = "app-runtime",
  details?: Record<string, unknown>,
): AppRuntimeDiagnostic {
  return {
    code,
    message,
    source,
    details,
  };
}

export interface AppRuntimeProviderProps {
  children: ReactNode;
}

export function AppRuntimeProvider({ children }: AppRuntimeProviderProps) {
  const { client, launchContext, ready } = useChips();
  const [activeSceneId, setActiveSceneId] = useState<AppSceneId>(() =>
    resolveRuntimeSceneId(launchContext),
  );
  const [diagnostics, setDiagnostics] = useState<AppRuntimeDiagnostic[]>([]);

  useEffect(() => {
    setActiveSceneId(resolveRuntimeSceneId(launchContext));
  }, [launchContext]);

  const refreshEnvironment = useCallback(async (): Promise<void> => {
    if (!client) {
      return;
    }
    const nextLaunchContext = readLaunchContext(client);
    setActiveSceneId(resolveRuntimeSceneId(nextLaunchContext));
  }, [client]);

  const pushDiagnostic = useCallback((diagnostic: AppRuntimeDiagnostic): void => {
    setDiagnostics((current) => [...current, diagnostic]);
  }, []);

  const clearDiagnostics = useCallback((): void => {
    setDiagnostics([]);
  }, []);

  const surface = launchContext?.surfaceContext ?? null;

  const environment = useMemo<AppRuntimeEnvironment>(() => ({
    appId: appConfig.appId,
    pluginId: launchContext?.pluginId ?? surface?.pluginId ?? appConfig.appId,
    sceneId: activeSceneId,
    hostSceneId: resolveHostSceneId(launchContext),
    surfaceId: launchContext?.surfaceId ?? surface?.surfaceId ?? null,
    sessionId: launchContext?.sessionId ?? surface?.sessionId ?? null,
    surfaceKind: launchContext?.kind ?? surface?.kind ?? "window",
    launchParams: {
      ...launchContext?.launchParams,
      ...surface?.launchParams,
    },
  }), [activeSceneId, launchContext, surface]);

  const activeScene = getSceneDefinition(activeSceneId);

  const value = useMemo<AppRuntimeValue>(() => ({
    client,
    ready,
    launchContext,
    surface,
    environment,
    activeSceneId,
    activeScene: activeScene ?? defaultSceneDefinition,
    setActiveSceneId,
    diagnostics,
    pushDiagnostic,
    clearDiagnostics,
    refreshEnvironment,
  }), [
    activeScene,
    activeSceneId,
    clearDiagnostics,
    client,
    diagnostics,
    environment,
    launchContext,
    pushDiagnostic,
    ready,
    refreshEnvironment,
    surface,
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
