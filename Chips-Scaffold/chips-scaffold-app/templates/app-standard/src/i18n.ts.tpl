import enUS from "../i18n/en-US.json";
import zhCN from "../i18n/zh-CN.json";

export type AppLocale = "zh-CN" | "en-US";

type MessageTree = Record<string, unknown>;

const catalogs: Record<AppLocale, MessageTree> = {
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

export function normalizeLocale(locale: string | null | undefined): AppLocale {
  if (typeof locale !== "string") {
    return "zh-CN";
  }

  const normalized = locale.toLowerCase();
  if (normalized.startsWith("en")) {
    return "en-US";
  }
  return "zh-CN";
}

export function createTranslator(locale: AppLocale) {
  return (key: string): string => {
    const primary = readByPath(catalogs[locale], key);
    if (primary !== null) {
      return primary;
    }

    const fallback = readByPath(catalogs["zh-CN"], key);
    return fallback ?? key;
  };
}
