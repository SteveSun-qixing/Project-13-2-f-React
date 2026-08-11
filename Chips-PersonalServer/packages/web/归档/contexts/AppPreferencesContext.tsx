import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  LOCALE_STORAGE_KEY,
  detectPreferredLocale,
  isLocale,
  localeRegistry,
  type Locale,
} from '../runtime/i18n/registry';
import {
  THEME_STORAGE_KEY,
  detectPreferredTheme,
  isThemeId,
  themeRegistry,
  type ThemeId,
} from '../runtime/theme/registry';

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

interface AppPreferencesContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  themeId: ThemeId;
  setThemeId: (themeId: ThemeId) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (value: string | number | Date) => string;
  formatNumber: (value: number) => string;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === 'undefined') {
      return 'zh-CN';
    }

    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : detectPreferredLocale();
  });

  const [themeId, setThemeId] = useState<ThemeId>(() => {
    if (typeof window === 'undefined') {
      return 'ccps.web.nectar-dusk';
    }

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : detectPreferredTheme();
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }

    document.documentElement.lang = locale;
    document.documentElement.dir = localeRegistry[locale].direction;
  }, [locale]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    }

    document.documentElement.dataset.ccpsTheme = themeId;
    document.documentElement.style.colorScheme = themeRegistry[themeId].colorScheme;
  }, [themeId]);

  const value = useMemo<AppPreferencesContextValue>(() => {
    const dictionary = localeRegistry[locale].dictionary;

    return {
      locale,
      setLocale,
      themeId,
      setThemeId,
      t(key, params) {
        return interpolate(dictionary[key] ?? key, params);
      },
      formatDate(value) {
        return new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(new Date(value));
      },
      formatNumber(value) {
        return new Intl.NumberFormat(locale).format(value);
      },
    };
  }, [locale, themeId]);

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences(): AppPreferencesContextValue {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error('useAppPreferences must be used inside AppPreferencesProvider');
  }
  return context;
}
