import React from "react";
import { resolveHostSceneId, resolveSurfaceKind, resolveLaunchParams } from "@chips/ui";
import type { Client, PlatformLaunchContext, SurfaceContext } from "chips-sdk";
import { appConfig } from "../../config/app-config";
import { createLogger, createTraceId } from "../../config/logging";
import { chipsClient } from "../runtime/chips-client";
import { readLaunchContext } from "../runtime/launch-context";

export interface RichTextEditorRuntimeEnvironment {
  appId: string;
  pluginId: string;
  hostSceneId: string;
  activeSceneId: "document";
  surfaceId: string | null;
  sessionId: string | null;
  surfaceKind: string;
  launchParams: Record<string, unknown>;
}

export interface RichTextEditorRuntimeValue {
  client: Client;
  traceId: string;
  launchContext: PlatformLaunchContext;
  surface: SurfaceContext | null;
  environment: RichTextEditorRuntimeEnvironment;
}

const AppRuntimeContext = React.createContext<RichTextEditorRuntimeValue | null>(null);




export interface AppRuntimeProviderProps {
  children: React.ReactNode;
}

export function AppRuntimeProvider({ children }: AppRuntimeProviderProps): React.ReactElement {
  const client = chipsClient;
  const traceId = React.useMemo(() => createTraceId("rte"), []);
  const logger = React.useMemo(
    () =>
      createLogger({
        scope: "app-runtime",
        traceId,
      }),
    [traceId],
  );
  const [launchContext, setLaunchContext] = React.useState<PlatformLaunchContext>(() => readLaunchContext(client));

  React.useEffect(() => {
    logger.info("富文本编辑器运行时已初始化", {
      appId: appConfig.appId,
    });

    return () => {
      logger.info("富文本编辑器运行时已卸载");
    };
  }, [logger]);

  React.useEffect(() => {
    setLaunchContext(readLaunchContext(client));
  }, [client]);

  const environment = React.useMemo<RichTextEditorRuntimeEnvironment>(() => ({
    appId: appConfig.appId,
    pluginId: launchContext.surfaceContext?.pluginId ?? launchContext.pluginId ?? appConfig.appId,
    hostSceneId: resolveHostSceneId(launchContext, appConfig.defaultSceneId),
    activeSceneId: "document",
    surfaceId: launchContext.surfaceContext?.surfaceId ?? launchContext.surfaceId ?? null,
    sessionId: launchContext.surfaceContext?.sessionId ?? launchContext.sessionId ?? null,
    surfaceKind: resolveSurfaceKind(launchContext),
    launchParams: resolveLaunchParams(launchContext, { surfacePriority: false }),
  }), [launchContext]);

  const value = React.useMemo<RichTextEditorRuntimeValue>(() => ({
    client,
    traceId,
    launchContext,
    surface: launchContext.surfaceContext ?? null,
    environment,
  }), [client, environment, launchContext, traceId]);

  return <AppRuntimeContext.Provider value={value}>{children}</AppRuntimeContext.Provider>;
}

export function useAppRuntime(): RichTextEditorRuntimeValue {
  const context = React.useContext(AppRuntimeContext);
  if (!context) {
    throw new Error("AppRuntimeContext is not available.");
  }

  return context;
}
