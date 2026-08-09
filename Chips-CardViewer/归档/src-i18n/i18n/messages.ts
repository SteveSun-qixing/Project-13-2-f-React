import {
  DEFAULT_LOCALE,
  localeBundles,
  resolveLocaleDirection,
  resolveLocale,
  supportedLocales,
  translateLocalKey,
  type SupportedLocale,
} from "./locales";

export {
  DEFAULT_LOCALE,
  localeBundles,
  resolveLocaleDirection,
  resolveLocale,
  supportedLocales,
  translateLocalKey,
  type SupportedLocale,
};

export function formatMessage(locale: string, key: string, params?: Record<string, string | number>): string {
  return translateLocalKey(key, resolveLocale(locale), params, `[[${key}]]`);
}
