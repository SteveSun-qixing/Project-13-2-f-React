import type { ChipsThemeState } from "@chips/component-library";

export const defaultThemeState: ChipsThemeState = {
  themeId: "chips-official.default-theme",
  displayName: "Chips Default",
  version: "1.0.0",
};

export function readDocumentThemeState(): ChipsThemeState {
  if (typeof document === "undefined") {
    return defaultThemeState;
  }

  const root = document.documentElement;
  const themeId = root.getAttribute("data-chips-theme-id");
  const version = root.getAttribute("data-chips-theme-version");

  return {
    themeId: typeof themeId === "string" && themeId.trim().length > 0 ? themeId : defaultThemeState.themeId,
    displayName: defaultThemeState.displayName,
    version: typeof version === "string" && version.trim().length > 0 ? version : defaultThemeState.version,
  };
}

