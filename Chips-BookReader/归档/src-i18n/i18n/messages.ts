import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  isSupportedLocale,
  localeBundles,
  resolveLocale,
  resolveLocaleDirection,
  supportedLocales,
  translateLocalKey,
  type SupportedLocale,
} from "./locales";

export {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  isSupportedLocale,
  localeBundles,
  resolveLocale,
  resolveLocaleDirection,
  supportedLocales,
  translateLocalKey,
  type SupportedLocale,
};

export function formatMessage(locale: string, key: string, params?: Record<string, string | number>): string {
  return translateLocalKey(key, resolveLocale(locale), params);
}
