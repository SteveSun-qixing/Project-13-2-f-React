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
      title: "Chips Sheet",
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
      // Host 在 surface 语义下可能只把资源参数放在 surfaceContext 中。
      // SDK 会保留两层原始结构，因此应用侧必须按正式优先级合并。
      ...surfaceContext.launchParams,
      ...launchContext.launchParams,
    },
  };
}

export function readSurfaceContext(client: Client): SurfaceContext {
  return readLaunchContext(client).surfaceContext ?? createFallbackSurfaceContext();
}
