import zhCN from "../../i18n/zh-CN.json";
import enUS from "../../i18n/en-US.json";

type LocaleTree = Record<string, unknown>;
type TextParams = Record<string, string | number>;

export const localeBundles: Record<string, LocaleTree> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

export const supportedLocales = ["zh-CN", "en-US"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export const DEFAULT_LOCALE: SupportedLocale = "zh-CN";
export const FALLBACK_LOCALE: SupportedLocale = "en-US";
export type TextDirection = "ltr" | "rtl";

const RTL_LANGUAGE_CODES = new Set(["ar", "fa", "he", "ur"]);

export function isSupportedLocale(locale: string | null | undefined): locale is SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale);
}

function readPath(source: LocaleTree | undefined, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, source);
}

export function resolveLocale(input: string | null | undefined): SupportedLocale {
  return isSupportedLocale(input) ? input : DEFAULT_LOCALE;
}

export function resolveLocaleDirection(locale: string | null | undefined): TextDirection {
  const languageCode = (locale ?? DEFAULT_LOCALE).toLowerCase().split("-")[0];
  return RTL_LANGUAGE_CODES.has(languageCode) ? "rtl" : "ltr";
}

export function translateLocalKey(
  key: string,
  locale: string = DEFAULT_LOCALE,
  params?: TextParams,
  fallback?: string,
): string {
  const activeBundle = localeBundles[resolveLocale(locale)];
  const fallbackBundle = localeBundles[FALLBACK_LOCALE];
  const defaultBundle = localeBundles[DEFAULT_LOCALE];
  const value = readPath(activeBundle, key) ?? readPath(fallbackBundle, key) ?? readPath(defaultBundle, key);
  if (typeof value !== "string") {
    return fallback ?? key;
  }
  if (!params) {
    return value;
  }
  return value.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => {
    const replacement = params[name];
    return typeof replacement === "undefined" ? match : String(replacement);
  });
}
