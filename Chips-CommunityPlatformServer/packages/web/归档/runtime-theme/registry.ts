export type ThemeId = 'ccps.web.nectar-dusk' | 'ccps.web.pear-mist';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  colorScheme: 'dark' | 'light';
}

export const THEME_STORAGE_KEY = 'ccps.web.theme';

export const themeRegistry: Record<ThemeId, ThemeDefinition> = {
  'ccps.web.nectar-dusk': {
    id: 'ccps.web.nectar-dusk',
    label: 'Nectar Dusk',
    colorScheme: 'light',
  },
  'ccps.web.pear-mist': {
    id: 'ccps.web.pear-mist',
    label: 'Pear Mist',
    colorScheme: 'light',
  },
};

export function detectPreferredTheme(): ThemeId {
  return 'ccps.web.pear-mist';
}

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return value === 'ccps.web.nectar-dusk' || value === 'ccps.web.pear-mist';
}
