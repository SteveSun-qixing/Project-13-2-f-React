export interface AppFeatureFlags {
  enableDebugPanel: boolean;
}

export interface AppConfig {
  appId: string;
  featureFlags: AppFeatureFlags;
}

export const appConfig: AppConfig = {
  appId: "chips-official.editing-engine",
  featureFlags: {
    enableDebugPanel: false,
  },
};
