import type { ChipsThemeState } from "@chips/component-library";

export const DEFAULT_THEME_ID = "chips-official.default-theme";
export const DEFAULT_THEME_VERSION = "1.0.0";
export const DEFAULT_THEME_DISPLAY_NAME = "薯片官方默认主题";

export const defaultThemeState: ChipsThemeState = {
  themeId: DEFAULT_THEME_ID,
  displayName: DEFAULT_THEME_DISPLAY_NAME,
  version: DEFAULT_THEME_VERSION,
};

export function readDocumentThemeState(): ChipsThemeState {
  if (typeof document === "undefined") {
    return defaultThemeState;
  }

  const root = document.documentElement;
  const themeId = root.getAttribute("data-chips-theme-id");
  const version = root.getAttribute("data-chips-theme-version");

  return {
    ...defaultThemeState,
    themeId: typeof themeId === "string" && themeId.trim().length > 0 ? themeId : defaultThemeState.themeId,
    version: typeof version === "string" && version.trim().length > 0 ? version : defaultThemeState.version,
  };
}

