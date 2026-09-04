export interface AppFeatureFlags {
  enableDebugPanel: boolean;
}

export interface AppPresentationDefaults {
  title: string;
  width: number;
  height: number;
  resizable: boolean;
}

export interface AppConfig {
  appId: string;
  displayName: string;
  defaultSceneId: string;
  defaultPresentation: AppPresentationDefaults;
  supportedImageExtensions: string[];
  projectFileExtension: string;
  historyLimit: number;
  quickSaveStorageKey: string;
  featureFlags: AppFeatureFlags;
}

export const appConfig: AppConfig = {
  appId: "com.chips.photo",
  displayName: "薯片绘图",
  defaultSceneId: "main",
  defaultPresentation: {
    title: "薯片绘图",
    width: 1280,
    height: 800,
    resizable: true,
  },
  supportedImageExtensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif", "avif", "svg"],
  projectFileExtension: "json",
  historyLimit: 50,
  quickSaveStorageKey: "chips-photo.quicksave",
  featureFlags: {
    enableDebugPanel: false,
  },
};
