export interface AppFeatureFlags {
  enableDebugPanel: boolean;
}

export interface AppConfig {
  appId: string;
  defaultSceneId: string;
  featureFlags: AppFeatureFlags;
}

export const appConfig: AppConfig = {
  appId: "com.example.chips-office",
  defaultSceneId: "main",
  featureFlags: {
    enableDebugPanel: false,
  },
};
