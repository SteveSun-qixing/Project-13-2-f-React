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
    title: "薯片办公",
    width: 1280,
    height: 820,
  },
});

export const appMockLaunchContext = createMockLaunchContext({
  pluginId: appConfig.appId,
  sceneId: appConfig.defaultSceneId,
  surfaceContext: appMockSurfaceContext,
});

export const OFFICE_MOCK_PERMISSIONS = [
  "resource.read",
  "file.read",
  "file.write",
  "platform.read",
  "office.read",
  "office.write",
  "command.read",
  "command.write",
  "command.invoke",
];

export function createAppMockClient(): MockChipsClient {
  return createMockChipsClient({
    locale: "zh-CN",
    launchContext: appMockLaunchContext,
    surfaceContext: appMockSurfaceContext,
    permissions: OFFICE_MOCK_PERMISSIONS,
  });
}
