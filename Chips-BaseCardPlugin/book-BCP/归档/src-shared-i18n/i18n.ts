import enUS from "../../i18n/en-US.json";
import zhCN from "../../i18n/zh-CN.json";

type Dictionary = Record<string, string>;
type Locale = "zh-CN" | "en-US";
export type ChipsTranslator = ((
  key: string,
  params?: Record<string, string | number>,
  fallback?: string,
) => string) & {
  translate(
    input: string | { key: string; params?: Record<string, string | number> },
    params?: Record<string, string | number>,
  ): string;
};

const dictionaries: Record<Locale, Dictionary> = {
  "zh-CN": zhCN as Record<string, string>,
  "en-US": enUS as Record<string, string>,
};

function normalizeLocale(locale: string | undefined): Locale {
  const normalized = (locale ?? "").toLowerCase();
  if (normalized === "en" || normalized === "en-us" || normalized.startsWith("en-")) {
    return "en-US";
  }

  if (normalized === "zh" || normalized === "zh-cn" || normalized.startsWith("zh-")) {
    return "zh-CN";
  }

  return "zh-CN";
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key: string) => (
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  ));
}

export function createTranslator(locale?: string): ChipsTranslator {
  const primaryLocale = normalizeLocale(locale);
  const fallbackLocales: Locale[] = primaryLocale === "zh-CN" ? ["en-US"] : ["zh-CN"];

  const translateKey = (
    key: string,
    params?: Record<string, string | number>,
    fallback?: string,
  ): string => {
    const localeChain = [primaryLocale, ...fallbackLocales];
    for (const lookupLocale of localeChain) {
      const template = dictionaries[lookupLocale][key];
      if (typeof template === "string") {
        return interpolate(template, params);
      }
    }

    return interpolate(fallback ?? key, params);
  };

  return Object.assign(translateKey, {
    translate(
      input: string | { key: string; params?: Record<string, string | number> },
      params?: Record<string, string | number>,
    ) {
      return typeof input === "string"
        ? translateKey(input, params)
        : translateKey(input.key, input.params);
    },
  });
}
