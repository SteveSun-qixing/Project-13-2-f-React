import type { ChipsThemeState } from "@chips/component-library";

export const DEFAULT_THEME_ID = "chips-official.default-theme";
export const DEFAULT_THEME_VERSION = "1.0.0";
export const DEFAULT_THEME_DISPLAY_NAME = "薯片官方默认主题";

export const defaultThemeState: ChipsThemeState = {
  themeId: DEFAULT_THEME_ID,
  displayName: DEFAULT_THEME_DISPLAY_NAME,
  version: DEFAULT_THEME_VERSION,
};

export function resolveThemeLabel(theme: ChipsThemeState | null): string {
  return theme?.displayName ?? theme?.themeId ?? DEFAULT_THEME_DISPLAY_NAME;
}
