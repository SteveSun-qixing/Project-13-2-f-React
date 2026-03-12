import enUS from "../../../i18n/en-US.json";
import zhCN from "../../../i18n/zh-CN.json";

export type EditorLocale = "zh-CN" | "en-US";

type MessageTree = Record<string, unknown>;
type TranslatorParams = Record<string, string | number>;

const dictionaries: Record<EditorLocale, MessageTree> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

function readByPath(source: MessageTree, pathExpression: string): string | null {
  const segments = pathExpression.split(".");
  let current: unknown = source;

  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : null;
}

function interpolate(template: string, params?: TranslatorParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (token, key: string) => {
    const value = params[key];
    return value === undefined ? token : String(value);
  });
}

export function normalizeLocale(locale: string | null | undefined): EditorLocale {
  if (typeof locale !== "string") {
    return "zh-CN";
  }

  const normalized = locale.toLowerCase();
  if (normalized.startsWith("en")) {
    return "en-US";
  }
  return "zh-CN";
}

export function createTranslator(locale: string) {
  const normalizedLocale = normalizeLocale(locale);

  return (key: string, params?: TranslatorParams): string => {
    const localized = readByPath(dictionaries[normalizedLocale], key);
    if (localized !== null) {
      return interpolate(localized, params);
    }

    const fallback = readByPath(dictionaries["zh-CN"], key);
    return interpolate(fallback ?? key, params);
  };
}
