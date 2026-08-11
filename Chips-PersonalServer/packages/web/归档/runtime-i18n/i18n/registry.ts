import enUS from './dictionaries/en-US';
import zhCN from './dictionaries/zh-CN';

export type Locale = 'zh-CN' | 'en-US';

export interface LocaleDefinition {
  id: Locale;
  label: string;
  direction: 'ltr' | 'rtl';
  dictionary: Record<string, string>;
}

export const LOCALE_STORAGE_KEY = 'ccps.web.locale';

export const localeRegistry: Record<Locale, LocaleDefinition> = {
  'zh-CN': {
    id: 'zh-CN',
    label: '简体中文',
    direction: 'ltr',
    dictionary: zhCN,
  },
  'en-US': {
    id: 'en-US',
    label: 'English',
    direction: 'ltr',
    dictionary: enUS,
  },
};

export function detectPreferredLocale(): Locale {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')) {
    return 'en-US';
  }

  return 'zh-CN';
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'zh-CN' || value === 'en-US';
}
