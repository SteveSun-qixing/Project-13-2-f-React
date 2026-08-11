export interface AppFeatureFlags {
  enableDebugPanel: boolean;
  enableDiagnosticsLogging: boolean;
}

export interface AppConfig {
  appId: string;
  defaultSceneId: string;
  communityServerUrl: string;
  featureFlags: AppFeatureFlags;
}

export const appConfig: AppConfig = {
  appId: "com.chips.community-client",
  defaultSceneId: "main",
  communityServerUrl: "http://127.0.0.1:3000",
  featureFlags: {
    enableDebugPanel: false,
    enableDiagnosticsLogging: true,
  },
};
