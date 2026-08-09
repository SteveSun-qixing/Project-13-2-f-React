import enUS from "../../i18n/en-US.json";
import zhCN from "../../i18n/zh-CN.json";

type Dictionary = Record<string, string>;
type Locale = "zh-CN" | "en-US";

const dictionaries: Record<Locale, Dictionary> = {
  "zh-CN": zhCN as Dictionary,
  "en-US": enUS as Dictionary,
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

  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ""));
}

export function createTranslator(locale?: string) {
  const dictionary = dictionaries[normalizeLocale(locale)];

  return (key: string, params?: Record<string, string | number>): string => {
    const template = dictionary[key] ?? key;
    return interpolate(template, params);
  };
}
