import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Client, PlatformLaunchContext, SurfaceContext } from "chips-sdk";
import { useChips } from "@chips/ui";
import { appConfig } from "../../config/app-config";
import { formatMessage } from "../lib/messages";
import { resolveLaunchDocumentTarget, resolveSceneForDocument, type LaunchDocumentTarget } from "../bridge/launch-target";
import { readLaunchContext } from "../runtime/launch-context";
import {
  getSceneDefinition,
  OFFICE_SCENE_IDS,
  type OfficeSceneDefinition,
  type OfficeSceneId,
} from "./scene-registry";

export interface AppRuntimeEnvironment {
  appId: string;
  pluginId: string;
  sceneId: OfficeSceneId;
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
  activeSceneId: OfficeSceneId;
  activeScene: OfficeSceneDefinition;
  documentTarget: LaunchDocumentTarget | null;
  setActiveSceneId(sceneId: OfficeSceneId): void;
  /** 打开文档路径：检测类型并路由到对应场景；返回是否路由成功。 */
  openDocumentPath(path: string): Promise<boolean>;
  diagnostics: AppRuntimeDiagnostic[];
  pushDiagnostic(diagnostic: AppRuntimeDiagnostic): void;
  clearDiagnostics(): void;
}

const AppRuntimeContext = createContext<AppRuntimeValue | null>(null);

function resolveHostSceneId(launchContext: PlatformLaunchContext | null): string {
  return (
    launchContext?.surfaceContext?.sceneId ??
    launchContext?.sceneId ??
    appConfig.defaultSceneId
  );
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
  const { client, launchContext: chipsLaunchContext, ready } = useChips();
  const launchContext = useMemo<PlatformLaunchContext | null>(() => {
    if (!ready || !client) {
      return chipsLaunchContext;
    }
    return readLaunchContext(client);
  }, [chipsLaunchContext, client, ready]);

  const [activeSceneId, setActiveSceneId] = useState<OfficeSceneId>(OFFICE_SCENE_IDS.start);
  const [documentTarget, setDocumentTarget] = useState<LaunchDocumentTarget | null>(null);
  const [diagnostics, setDiagnostics] = useState<AppRuntimeDiagnostic[]>([]);
  const launchHandledRef = useRef(false);

  const pushDiagnostic = useCallback((diagnostic: AppRuntimeDiagnostic): void => {
    setDiagnostics((current) => [...current, diagnostic]);
  }, []);

  const clearDiagnostics = useCallback((): void => {
    setDiagnostics([]);
  }, []);

  const routeDocumentTarget = useCallback(
    async (target: LaunchDocumentTarget): Promise<boolean> => {
      if (!client) {
        return false;
      }
      try {
        const sceneId = await resolveSceneForDocument(client, target);
        if (!sceneId) {
          pushDiagnostic(
            createRuntimeDiagnostic(
              "OFFICE_TYPE_UNSUPPORTED",
              formatMessage("office.start.invalidType"),
              "app-runtime",
              { path: target.path },
            ),
          );
          return false;
        }
        setDocumentTarget(target);
        setActiveSceneId(sceneId);
        return true;
      } catch (error) {
        pushDiagnostic(
          createRuntimeDiagnostic(
            "OFFICE_OPEN_FAILED",
            error instanceof Error ? error.message : formatMessage("office.start.error"),
            "app-runtime",
            { path: target.path },
          ),
        );
        return false;
      }
    },
    [client, pushDiagnostic],
  );

  const openDocumentPath = useCallback(
    async (path: string): Promise<boolean> => routeDocumentTarget({ path }),
    [routeDocumentTarget],
  );

  useEffect(() => {
    if (!ready || !client || launchHandledRef.current) {
      return;
    }
    launchHandledRef.current = true;
    const target = resolveLaunchDocumentTarget(launchContext?.launchParams);
    if (target) {
      void routeDocumentTarget(target);
    }
  }, [client, launchContext, ready, routeDocumentTarget]);

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
      ...surface?.launchParams,
      ...launchContext?.launchParams,
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
    activeScene,
    documentTarget,
    setActiveSceneId,
    openDocumentPath,
    diagnostics,
    pushDiagnostic,
    clearDiagnostics,
  }), [
    activeScene,
    activeSceneId,
    clearDiagnostics,
    client,
    diagnostics,
    documentTarget,
    environment,
    launchContext,
    openDocumentPath,
    pushDiagnostic,
    ready,
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
