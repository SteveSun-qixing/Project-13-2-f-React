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
  appId: "com.chips.universal-file-viewer",
  defaultSceneId: "universal-viewer.scene.main",
  defaultPresentation: {
    title: "万能文件查看器",
    width: 1100,
    height: 760,
    resizable: true,
  },
  featureFlags: {
    enableDebugPanel: false,
  },
};
