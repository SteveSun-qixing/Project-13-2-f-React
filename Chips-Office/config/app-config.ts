export interface AppFeatureFlags {
  enableDebugPanel: boolean;
}

export interface AppConfig {
  appId: string;
  defaultSceneId: string;
  defaultPresentation: {
    title: string;
    width: number;
    height: number;
    resizable: boolean;
  };
  featureFlags: AppFeatureFlags;
}

export const appConfig: AppConfig = {
  appId: "com.chips.office",
  defaultSceneId: "office.scene.start",
  defaultPresentation: {
    title: "薯片办公",
    width: 1280,
    height: 820,
    resizable: true,
  },
  featureFlags: {
    enableDebugPanel: false,
  },
};
