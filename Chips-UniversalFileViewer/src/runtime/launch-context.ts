import type { Client, PlatformLaunchContext, SurfaceContext } from "chips-sdk";
import { appConfig } from "../../config/app-config";

export function createFallbackSurfaceContext(
  launchContext: PlatformLaunchContext | null = null,
): SurfaceContext {
  return {
    surfaceId: launchContext?.surfaceId,
    sceneId: launchContext?.sceneId ?? appConfig.defaultSceneId,
    pluginId: launchContext?.pluginId ?? appConfig.appId,
    sessionId: launchContext?.sessionId,
    kind: launchContext?.kind ?? "window",
    presentation: {
      ...appConfig.defaultPresentation,
      ...launchContext?.presentation,
    },
    launchParams: {
      ...launchContext?.launchParams,
    },
  };
}

export function readLaunchContext(client: Client): PlatformLaunchContext {
  const launchContext = client.platform.getLaunchContext();
  const surfaceContext = launchContext.surfaceContext ?? createFallbackSurfaceContext(launchContext);

  return {
    ...launchContext,
    pluginId: launchContext.pluginId ?? surfaceContext.pluginId ?? appConfig.appId,
    sessionId: launchContext.sessionId ?? surfaceContext.sessionId,
    sceneId: launchContext.sceneId ?? surfaceContext.sceneId ?? appConfig.defaultSceneId,
    surfaceId: launchContext.surfaceId ?? surfaceContext.surfaceId,
    kind: launchContext.kind ?? surfaceContext.kind,
    presentation: launchContext.presentation ?? surfaceContext.presentation,
    surfaceContext,
    launchParams: {
      ...surfaceContext.launchParams,
      ...launchContext.launchParams,
    },
  };
}
