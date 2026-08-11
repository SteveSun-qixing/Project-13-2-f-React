import React from "react";
import { resolveHostSceneId, resolveSurfaceKind, resolveLaunchParams } from "@chips/ui";
import type { Client, PlatformLaunchContext } from "chips-sdk";
import { appConfig } from "../../config/app-config";
import type { RuntimeEventSource } from "../shared/runtime/event-source";
import type { SettingsPanelError } from "../shared/runtime/errors";
import {
  defaultSceneDefinition,
  getSceneDefinition,
  type SettingsSceneDefinition,
  type SettingsSceneId,
} from "./scene-registry";

export type SettingsRuntimePhase = "loading" | "active" | "error";

export interface SettingsRuntimeEnvironment {
  appId: string;
  pluginId: string;
  hostSceneId: string;
  activeSceneId: SettingsSceneId;
  surfaceId: string | null;
  sessionId: string | null;
  surfaceKind: string;
  launchParams: Record<string, unknown>;
}

export interface AppRuntimeValue {
  client: Client;
  eventSource: RuntimeEventSource;
  environment: SettingsRuntimeEnvironment;
  activeSceneId: SettingsSceneId;
  activeScene: SettingsSceneDefinition;
  setActiveSceneId(sceneId: SettingsSceneId): void;
  launchContext: PlatformLaunchContext;
  ready: boolean;
  phase: SettingsRuntimePhase;
  runtimeError: SettingsPanelError | null;
  refreshRuntimeState: () => Promise<void>;
}

export interface AppRuntimeProviderProps extends React.PropsWithChildren {
  client: Client;
  eventSource: RuntimeEventSource;
  ready: boolean;
  runtimeError: SettingsPanelError | null;
  refreshRuntimeState: () => Promise<void>;
}

const AppRuntimeContext = React.createContext<AppRuntimeValue | null>(null);

function getLaunchContext(client: Client): PlatformLaunchContext {
  try {
    return client.platform.getLaunchContext();
  } catch {
    return { launchParams: {} };
  }
}




export function AppRuntimeProvider({
  children,
  client,
  eventSource,
  ready,
  runtimeError,
  refreshRuntimeState,
}: AppRuntimeProviderProps): React.ReactElement {
  const launchContext = React.useMemo(() => getLaunchContext(client), [client]);
  const initialSceneId = getSceneDefinition(resolveHostSceneId(launchContext, defaultSceneDefinition.id)).id;
  const [activeSceneId, setActiveSceneId] = React.useState<SettingsSceneId>(initialSceneId);
  const activeScene = getSceneDefinition(activeSceneId);
  const phase = runtimeError ? "error" : ready ? "active" : "loading";

  const environment = React.useMemo<SettingsRuntimeEnvironment>(() => ({
    appId: appConfig.appId,
    pluginId: launchContext.surfaceContext?.pluginId ?? launchContext.pluginId ?? appConfig.appId,
    hostSceneId: resolveHostSceneId(launchContext, defaultSceneDefinition.id),
    activeSceneId,
    surfaceId: launchContext.surfaceContext?.surfaceId ?? launchContext.surfaceId ?? null,
    sessionId: launchContext.surfaceContext?.sessionId ?? launchContext.sessionId ?? null,
    surfaceKind: resolveSurfaceKind(launchContext),
    launchParams: resolveLaunchParams(launchContext),
  }), [activeSceneId, launchContext]);

  const value = React.useMemo<AppRuntimeValue>(() => ({
    client,
    eventSource,
    environment,
    activeSceneId,
    activeScene,
    setActiveSceneId,
    launchContext,
    ready,
    phase,
    runtimeError,
    refreshRuntimeState,
  }), [
    activeScene,
    activeSceneId,
    client,
    environment,
    eventSource,
    launchContext,
    phase,
    ready,
    refreshRuntimeState,
    runtimeError,
  ]);

  return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>;
}

export function useAppRuntime(): AppRuntimeValue {
  const context = React.useContext(AppRuntimeContext);
  if (!context) {
    throw new Error("AppRuntimeContext is not available.");
  }
  return context;
}
