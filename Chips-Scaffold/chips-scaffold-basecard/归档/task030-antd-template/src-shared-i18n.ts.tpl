import {
  createChipsI18nText,
  type ChipsI18nText,
} from "@chips/component-library";
import enUS from "../../i18n/en-US.json";
import zhCN from "../../i18n/zh-CN.json";

export type BasecardLocale = "zh-CN" | "en-US";

export const localeBundles: Record<BasecardLocale, Record<string, unknown>> = {
  "zh-CN": zhCN as Record<string, unknown>,
  "en-US": enUS as Record<string, unknown>,
};

export function normalizeBasecardLocale(locale: string | undefined): BasecardLocale {
  const normalized = (locale ?? "").toLowerCase();
  if (normalized === "en" || normalized === "en-us" || normalized.startsWith("en-")) {
    return "en-US";
  }

  if (normalized === "zh" || normalized === "zh-cn" || normalized.startsWith("zh-")) {
    return "zh-CN";
  }

  return "zh-CN";
}

export function createBasecardText(locale?: string): ChipsI18nText {
  return createChipsI18nText({
    bundles: localeBundles,
    locale: normalizeBasecardLocale(locale),
    defaultLocale: "zh-CN",
    fallbackLocale: "en-US",
    fallbackLocales: ["zh-CN"],
  });
}
