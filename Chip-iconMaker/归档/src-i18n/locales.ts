import zhCN from "../../i18n/zh-CN.json";
import enUS from "../../i18n/en-US.json";

type LocaleTree = Record<string, unknown>;

export const localeBundles: Record<string, LocaleTree> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

export const supportedLocales = ["zh-CN", "en-US"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

function readPath(source: LocaleTree, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, source);
}

export function translateLocalKey(
  key: string,
  locale = "zh-CN",
  params?: Record<string, string | number>,
): string {
  const activeBundle = localeBundles[locale] ?? localeBundles["zh-CN"];
  const fallbackBundle = localeBundles["en-US"];
  const value = readPath(activeBundle, key) ?? readPath(fallbackBundle, key);
  if (typeof value !== "string") {
    return key;
  }
  if (!params) {
    return value;
  }
  return value.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => {
    const replacement = params[name];
    return typeof replacement === "undefined" ? match : String(replacement);
  });
}
