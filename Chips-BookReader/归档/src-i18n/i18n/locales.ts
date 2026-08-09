import zhCN from "../../i18n/zh-CN.json";
import enUS from "../../i18n/en-US.json";

export const localeBundles = {
  "zh-CN": zhCN,
  "en-US": enUS,
} satisfies Record<string, Record<string, unknown>>;

export type SupportedLocale = keyof typeof localeBundles;

export const supportedLocales = Object.keys(localeBundles) as SupportedLocale[];
export const DEFAULT_LOCALE: SupportedLocale = "zh-CN";
export const FALLBACK_LOCALE: SupportedLocale = "en-US";

export function isSupportedLocale(input: string | null | undefined): input is SupportedLocale {
  return typeof input === "string" && input in localeBundles;
}

export function resolveLocale(input: string | null | undefined): SupportedLocale {
  return isSupportedLocale(input) ? input : DEFAULT_LOCALE;
}

export function resolveLocaleDirection(locale: string | null | undefined): "ltr" | "rtl" {
  const normalized = locale?.toLowerCase() ?? "";
  return normalized.startsWith("ar") || normalized.startsWith("he") || normalized.startsWith("fa") ? "rtl" : "ltr";
}

function getByPath(record: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, record);
}

export function translateLocalKey(
  key: string,
  locale: string | null | undefined = DEFAULT_LOCALE,
  params?: Record<string, string | number | boolean | null | undefined>,
  fallback = `[[${key}]]`,
): string {
  const activeLocale = resolveLocale(locale);
  const template = getByPath(localeBundles[activeLocale], key) ?? getByPath(localeBundles[FALLBACK_LOCALE], key);

  if (typeof template !== "string") {
    return fallback;
  }

  return Object.entries(params ?? {}).reduce((text, [paramKey, value]) => {
    return text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value ?? ""));
  }, template);
}
