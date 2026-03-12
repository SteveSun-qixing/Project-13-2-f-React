export type EditorLayoutMode = "infinite-canvas" | "workbench";

export interface AppFeatureFlags {
  enableRuntimePanel: boolean;
  enableLaunchContextRecovery: boolean;
}

export interface AppConfig {
  appId: string;
  defaultLayoutMode: EditorLayoutMode;
  configKeys: {
    layoutMode: string;
    recentTargets: string;
    editorPanelState: string;
  };
  featureFlags: AppFeatureFlags;
}

export const appConfig: AppConfig = {
  appId: "com.chips.editing-engine",
  defaultLayoutMode: "workbench",
  configKeys: {
    layoutMode: "editing-engine.shell.layout-mode",
    recentTargets: "editing-engine.workspace.recent-targets",
    editorPanelState: "editing-engine.editor.panel-state",
  },
  featureFlags: {
    enableRuntimePanel: true,
    enableLaunchContextRecovery: true,
  },
};
