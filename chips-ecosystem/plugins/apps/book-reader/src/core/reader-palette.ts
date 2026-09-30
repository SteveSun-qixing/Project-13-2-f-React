import type { EpubThemePalette } from '../domain/epub/types';
import type { ReaderBackgroundTone } from './book-model';

export type ReaderSystemColorScheme = 'light' | 'dark';
export type ReaderBackgroundToneOption = ReaderBackgroundTone | 'system';

export interface ReaderThemePreferences {
  backgroundTone?: ReaderBackgroundToneOption;
}

export const BASE_READER_PALETTE: EpubThemePalette = {
  surface: '#f5f2ea',
  text: '#1f1d19',
  mutedText: 'color-mix(in srgb, #1f1d19 72%, #f5f2ea)',
  primary: '#0a84ff',
  border: 'color-mix(in srgb, #1f1d19 12%, transparent)',
  accentSurface: 'color-mix(in srgb, #0a84ff 8%, #f5f2ea)',
};

export const READER_THEME_TRANSITION_DURATION_MS = 300;
export const READER_THEME_TRANSITION_CLASS = 'book-reader-theme-transition';
export const READER_THEME_TRANSITION_CSS_TEXT = `transition: background-color ${READER_THEME_TRANSITION_DURATION_MS}ms ease, color ${READER_THEME_TRANSITION_DURATION_MS}ms ease`;

export const BRIGHTNESS_MIN = 0.6;
export const BRIGHTNESS_MAX = 1;
export const BRIGHTNESS_DEFAULT = 1;
export const BRIGHTNESS_OVERLAY_OPACITY_CAP = 0.5;

export interface ReaderThemeTransition {
  durationMs: number;
  className: string;
  cssText: string;
}

export interface ReaderThemePaletteResolution extends EpubThemePalette {
  resolvedTone: ReaderBackgroundTone;
  isDark: boolean;
  transition: ReaderThemeTransition;
}

function buildNightPalette(baseTheme: EpubThemePalette): EpubThemePalette {
  return {
    surface: `color-mix(in srgb, ${baseTheme.text} 82%, #07070a 18%)`,
    text: 'color-mix(in srgb, white 92%, #d7d7de 8%)',
    mutedText: 'color-mix(in srgb, white 66%, #8b8b96 34%)',
    primary: `color-mix(in srgb, ${baseTheme.primary} 68%, white 32%)`,
    border: 'color-mix(in srgb, white 12%, transparent)',
    accentSurface: `color-mix(in srgb, ${baseTheme.text} 68%, ${baseTheme.primary} 32%)`,
  };
}

function resolvePaletteForTone(
  baseTheme: EpubThemePalette,
  tone: ReaderBackgroundToneOption,
  systemScheme: ReaderSystemColorScheme
): EpubThemePalette {
  switch (tone) {
    case 'system':
      return systemScheme === 'dark' ? buildNightPalette(baseTheme) : baseTheme;
    case 'warm':
      return {
        surface: `color-mix(in srgb, ${baseTheme.surface} 72%, #f1e1c7 28%)`,
        text: baseTheme.text,
        mutedText: `color-mix(in srgb, ${baseTheme.text} 68%, #f1e1c7)`,
        primary: baseTheme.primary,
        border: `color-mix(in srgb, ${baseTheme.text} 14%, #f1e1c7)`,
        accentSurface: `color-mix(in srgb, ${baseTheme.surface} 58%, #edd7b1 42%)`,
      };
    case 'mist':
      return {
        surface: `color-mix(in srgb, ${baseTheme.surface} 82%, ${baseTheme.primary} 18%)`,
        text: baseTheme.text,
        mutedText: `color-mix(in srgb, ${baseTheme.text} 72%, ${baseTheme.surface})`,
        primary: `color-mix(in srgb, ${baseTheme.primary} 84%, white 16%)`,
        border: `color-mix(in srgb, ${baseTheme.text} 12%, ${baseTheme.primary})`,
        accentSurface: `color-mix(in srgb, ${baseTheme.surface} 74%, ${baseTheme.primary} 26%)`,
      };
    case 'night':
      return buildNightPalette(baseTheme);
    default:
      return baseTheme;
  }
}

export function readSystemColorScheme(): ReaderSystemColorScheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveReaderThemePalette(
  baseTheme: EpubThemePalette,
  preferences: ReaderThemePreferences,
  systemScheme?: ReaderSystemColorScheme
): ReaderThemePaletteResolution {
  const requestedTone = preferences.backgroundTone ?? 'system';
  const scheme = systemScheme ?? readSystemColorScheme();
  const palette = resolvePaletteForTone(baseTheme, requestedTone, scheme);
  const resolvedTone: ReaderBackgroundTone =
    requestedTone === 'system' ? (scheme === 'dark' ? 'night' : 'theme') : requestedTone;

  return {
    ...palette,
    resolvedTone,
    isDark: resolvedTone === 'night',
    transition: {
      durationMs: READER_THEME_TRANSITION_DURATION_MS,
      className: READER_THEME_TRANSITION_CLASS,
      cssText: READER_THEME_TRANSITION_CSS_TEXT,
    },
  };
}

export function clampBrightness(value: number): number {
  if (!Number.isFinite(value)) {
    return BRIGHTNESS_DEFAULT;
  }

  return Math.min(BRIGHTNESS_MAX, Math.max(BRIGHTNESS_MIN, value));
}

export function resolveBrightnessOverlayOpacity(brightness: number): number {
  return Math.min(BRIGHTNESS_OVERLAY_OPACITY_CAP, (1 - clampBrightness(brightness)) * 0.5);
}
