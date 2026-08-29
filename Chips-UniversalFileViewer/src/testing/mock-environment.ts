import {
  createMockChipsClient,
  createMockLaunchContext,
  createMockSurfaceContext,
  type MockChipsClient,
} from "chips-sdk/testing";
import { appConfig } from "../../config/app-config";

export const appMockSurfaceContext = createMockSurfaceContext({
  pluginId: appConfig.appId,
  sceneId: appConfig.defaultSceneId,
  kind: "window",
  presentation: {
    title: "万能文件查看器",
    width: 1100,
    height: 760,
  },
});

export const appMockLaunchContext = createMockLaunchContext({
  pluginId: appConfig.appId,
  sceneId: appConfig.defaultSceneId,
  surfaceContext: appMockSurfaceContext,
});

export function createAppMockClient(): MockChipsClient {
  return createMockChipsClient({
    locale: "zh-CN",
    launchContext: appMockLaunchContext,
    surfaceContext: appMockSurfaceContext,
    permissions: [
      "resource.read",
      "file.read",
      "file.write",
      "platform.read",
      "command.read",
      "command.write",
      "command.invoke",
    ],
  });
}
