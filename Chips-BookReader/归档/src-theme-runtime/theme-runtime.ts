import type { EpubThemePalette } from "../domain/epub/types";
import type { ReaderPreferences } from "../utils/book-reader";

export interface ThemeSnapshot {
  themeId: string;
  version: string;
}

export const DEFAULT_THEME_STATE: ThemeSnapshot = {
  themeId: "chips-official.default-theme",
  version: "1.0.0",
};

export function readDocumentThemeState(): ThemeSnapshot {
  if (typeof document === "undefined") {
    return DEFAULT_THEME_STATE;
  }

  const root = document.documentElement;
  const themeId = root.getAttribute("data-chips-theme-id");
  const version = root.getAttribute("data-chips-theme-version");

  return {
    themeId: typeof themeId === "string" && themeId.trim().length > 0 ? themeId : DEFAULT_THEME_STATE.themeId,
    version: typeof version === "string" && version.trim().length > 0 ? version : DEFAULT_THEME_STATE.version,
  };
}

export function readRendererThemePalette(): EpubThemePalette {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return {
      surface: "#f5f2ea",
      text: "#1f1d19",
      mutedText: "color-mix(in srgb, #1f1d19 72%, #f5f2ea)",
      primary: "#2158d2",
      border: "color-mix(in srgb, #1f1d19 12%, transparent)",
      accentSurface: "color-mix(in srgb, #2158d2 8%, #f5f2ea)",
    };
  }

  const styles = window.getComputedStyle(document.documentElement);
  const surface = styles.getPropertyValue("--chips-sys-color-surface").trim() || "#f5f2ea";
  const text = styles.getPropertyValue("--chips-sys-color-on-surface").trim() || "#1f1d19";
  const primary = styles.getPropertyValue("--chips-sys-color-primary").trim() || "#2158d2";

  return {
    surface,
    text,
    mutedText: `color-mix(in srgb, ${text} 72%, ${surface})`,
    primary,
    border: `color-mix(in srgb, ${text} 12%, transparent)`,
    accentSurface: `color-mix(in srgb, ${primary} 8%, ${surface})`,
  };
}

export function resolveReaderThemePalette(
  baseTheme: EpubThemePalette,
  preferences: ReaderPreferences,
): EpubThemePalette {
  switch (preferences.backgroundTone) {
    case "warm":
      return {
        surface: `color-mix(in srgb, ${baseTheme.surface} 72%, #f1e1c7 28%)`,
        text: baseTheme.text,
        mutedText: `color-mix(in srgb, ${baseTheme.text} 68%, #f1e1c7)`,
        primary: baseTheme.primary,
        border: `color-mix(in srgb, ${baseTheme.text} 14%, #f1e1c7)`,
        accentSurface: `color-mix(in srgb, ${baseTheme.surface} 58%, #edd7b1 42%)`,
      };
    case "mist":
      return {
        surface: `color-mix(in srgb, ${baseTheme.surface} 82%, ${baseTheme.primary} 18%)`,
        text: baseTheme.text,
        mutedText: `color-mix(in srgb, ${baseTheme.text} 72%, ${baseTheme.surface})`,
        primary: `color-mix(in srgb, ${baseTheme.primary} 84%, white 16%)`,
        border: `color-mix(in srgb, ${baseTheme.text} 12%, ${baseTheme.primary})`,
        accentSurface: `color-mix(in srgb, ${baseTheme.surface} 74%, ${baseTheme.primary} 26%)`,
      };
    case "night":
      return {
        surface: `color-mix(in srgb, ${baseTheme.text} 82%, #07070a 18%)`,
        text: "color-mix(in srgb, white 92%, #d7d7de 8%)",
        mutedText: "color-mix(in srgb, white 66%, #8b8b96 34%)",
        primary: `color-mix(in srgb, ${baseTheme.primary} 68%, white 32%)`,
        border: "color-mix(in srgb, white 12%, transparent)",
        accentSurface: `color-mix(in srgb, ${baseTheme.text} 68%, ${baseTheme.primary} 32%)`,
      };
    default:
      return baseTheme;
  }
}
