import zhCN from "../../../i18n/zh-CN.json";
import enUS from "../../../i18n/en-US.json";

const MESSAGE_BUNDLES = {
  "zh-CN": zhCN,
  "en-US": enUS,
} satisfies Record<string, Record<string, unknown>>;

export const DEFAULT_LOCALE = "zh-CN";

export type SupportedLocale = keyof typeof MESSAGE_BUNDLES;

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

export function formatMessage(locale: string, key: string, params?: Record<string, string | number>): string {
  const bundle = MESSAGE_BUNDLES[resolveLocale(locale)];
  const template = getByPath(bundle, key);
  if (typeof template !== "string") {
    return `[[${key}]]`;
  }

  return Object.entries(params ?? {}).reduce((text, [paramKey, value]) => {
    return text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(value));
  }, template);
}

export function getSupportedLocales(): SupportedLocale[] {
  return Object.keys(MESSAGE_BUNDLES) as SupportedLocale[];
}
