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
    title: "薯片社区",
    width: 1024,
    height: 720,
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
      "command.read",
      "command.write",
      "command.invoke",
    ],
  });
}
