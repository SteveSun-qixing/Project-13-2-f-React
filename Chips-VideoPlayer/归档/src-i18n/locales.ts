import zhCN from "../../i18n/zh-CN.json";
import enUS from "../../i18n/en-US.json";

export const localeBundles = {
  "zh-CN": zhCN,
  "en-US": enUS,
} satisfies Record<string, Record<string, unknown>>;

export type SupportedLocale = keyof typeof localeBundles;

export const DEFAULT_LOCALE: SupportedLocale = "zh-CN";
export const FALLBACK_LOCALE: SupportedLocale = "en-US";
export const supportedLocales = Object.keys(localeBundles) as SupportedLocale[];

export function resolveLocale(input: string | null | undefined): SupportedLocale {
  if (input && input in localeBundles) {
    return input as SupportedLocale;
  }

  return DEFAULT_LOCALE;
}

