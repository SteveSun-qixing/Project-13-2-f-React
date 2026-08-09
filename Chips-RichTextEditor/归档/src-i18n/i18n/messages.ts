import zhCN from "../../i18n/zh-CN.json";
import enUS from "../../i18n/en-US.json";

const MESSAGE_BUNDLES = {
  "zh-CN": zhCN,
  "en-US": enUS,
} satisfies Record<string, Record<string, unknown>>;

export type SupportedLocale = keyof typeof MESSAGE_BUNDLES;

export const DEFAULT_LOCALE: SupportedLocale = "zh-CN";
export const FALLBACK_LOCALE: SupportedLocale = "en-US";
export const supportedLocales = Object.keys(MESSAGE_BUNDLES) as SupportedLocale[];
export const localeBundles: Record<string, Record<string, unknown>> = MESSAGE_BUNDLES;
export type TextDirection = "ltr" | "rtl";

const RTL_LANGUAGE_CODES = new Set(["ar", "fa", "he", "ur"]);

function getByPath(record: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, record);
}

export function resolveLocale(input: string | null | undefined): SupportedLocale {
  return isSupportedLocale(input) ? input : DEFAULT_LOCALE;
}

export function isSupportedLocale(input: string | null | undefined): input is SupportedLocale {
  return typeof input === "string" && input in MESSAGE_BUNDLES;
}

export function resolveLocaleDirection(locale: string | null | undefined): TextDirection {
  const languageCode = (locale ?? DEFAULT_LOCALE).toLowerCase().split("-")[0];
  return RTL_LANGUAGE_CODES.has(languageCode) ? "rtl" : "ltr";
}

export function translateLocalKey(
  key: string,
  locale: string = DEFAULT_LOCALE,
  params?: Record<string, string | number>,
  fallback?: string,
): string {
  const activeBundle = MESSAGE_BUNDLES[resolveLocale(locale)];
  const fallbackBundle = MESSAGE_BUNDLES[FALLBACK_LOCALE];
  const defaultBundle = MESSAGE_BUNDLES[DEFAULT_LOCALE];
  const template = getByPath(activeBundle, key) ?? getByPath(fallbackBundle, key) ?? getByPath(defaultBundle, key);

  if (typeof template !== "string") {
    return fallback ?? key;
  }

  return Object.entries(params ?? {}).reduce((text, [paramKey, value]) => {
    return text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
  }, template);
}

export function formatMessage(locale: string, key: string, params?: Record<string, string | number>): string {
  return translateLocalKey(key, resolveLocale(locale), params, `[[${key}]]`);
}
