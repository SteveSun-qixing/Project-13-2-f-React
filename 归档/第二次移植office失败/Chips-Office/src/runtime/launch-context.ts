import type { Client, PlatformLaunchContext, SurfaceContext } from "chips-sdk";
import { appConfig } from "../../config/app-config";

export function createFallbackSurfaceContext(
  launchContext: PlatformLaunchContext | null = null,
): SurfaceContext {
  return {
    sceneId: launchContext?.sceneId ?? appConfig.defaultSceneId,
    surfaceId: launchContext?.surfaceId,
    pluginId: launchContext?.pluginId ?? appConfig.appId,
    sessionId: launchContext?.sessionId,
    kind: launchContext?.kind ?? "window",
    presentation: {
      title: "Chips Office",
      width: 1024,
      height: 720,
      resizable: true,
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
    sceneId: launchContext.sceneId ?? surfaceContext.sceneId ?? appConfig.defaultSceneId,
    surfaceId: launchContext.surfaceId ?? surfaceContext.surfaceId,
    kind: launchContext.kind ?? surfaceContext.kind,
    presentation: launchContext.presentation ?? surfaceContext.presentation,
    surfaceContext,
    launchParams: {
      ...launchContext.launchParams,
    },
  };
}

export function readSurfaceContext(client: Client): SurfaceContext {
  return readLaunchContext(client).surfaceContext ?? createFallbackSurfaceContext();
}
