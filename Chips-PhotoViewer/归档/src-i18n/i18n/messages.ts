import zhCN from "../../i18n/zh-CN.json";
import enUS from "../../i18n/en-US.json";

const MESSAGE_BUNDLES = {
  "zh-CN": zhCN,
  "en-US": enUS,
} satisfies Record<string, Record<string, unknown>>;

export type SupportedLocale = keyof typeof MESSAGE_BUNDLES;

export const DEFAULT_LOCALE: SupportedLocale = "zh-CN";

function getByPath(record: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, record);
}

export function resolveLocale(input: string | null | undefined): SupportedLocale {
  if (input && input in MESSAGE_BUNDLES) {
    return input as SupportedLocale;
  }
  return DEFAULT_LOCALE;
}

export function resolveLocaleDirection(locale: string | null | undefined): "ltr" | "rtl" {
  const normalized = resolveLocale(locale);
  return normalized === "zh-CN" || normalized === "en-US" ? "ltr" : "ltr";
}

export function translateLocalKey(
  key: string,
  locale: string | null | undefined,
  params?: Record<string, string | number>,
): string {
  return formatMessage(resolveLocale(locale), key, params);
}

export function formatMessage(locale: string, key: string, params?: Record<string, string | number>): string {
  const template = getByPath(MESSAGE_BUNDLES[resolveLocale(locale)], key);
  if (typeof template !== "string") {
    return `[[${key}]]`;
  }

  return Object.entries(params ?? {}).reduce((text, [paramKey, value]) => {
    return text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
  }, template);
}
