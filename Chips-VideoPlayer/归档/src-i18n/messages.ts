import { localeBundles, resolveLocale } from "./locales";

export { DEFAULT_LOCALE, FALLBACK_LOCALE, localeBundles, resolveLocale, supportedLocales, type SupportedLocale } from "./locales";

function getByPath(record: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, record);
}

export function formatMessage(locale: string, key: string, params?: Record<string, string | number | boolean | null | undefined>): string {
  const template = getByPath(localeBundles[resolveLocale(locale)], key);
  if (typeof template !== "string") {
    return `[[${key}]]`;
  }

  return Object.entries(params ?? {}).reduce((text, [paramKey, value]) => {
    return text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
  }, template);
}
