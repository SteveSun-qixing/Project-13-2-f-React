import { useMemo } from "react";
import {
  resolveI18nText,
  useChipsI18n,
  useChipsI18nText,
} from "@chips/component-library";
import { localeBundles, supportedLocales, type SupportedLocale } from "./locales";

type TextParams = Record<string, string | number>;
export type AppTextResolver = (key: string, params?: TextParams) => string;

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale);
}

export function useAppText(): {
  locale: SupportedLocale;
  translate: AppTextResolver;
  text: AppTextResolver;
} {
  const i18n = useChipsI18n();
  const rawLocale = i18n.locale ?? "";
  const locale: SupportedLocale = isSupportedLocale(rawLocale) ? rawLocale : "zh-CN";
  const translate = useChipsI18nText({
    bundles: localeBundles,
    fallbackLocale: "en-US",
    defaultLocale: "zh-CN",
  });
  const i18nSource = useMemo(
    () => ({
      t: translate,
      translate,
    }),
    [translate],
  );

  const text = useMemo<AppTextResolver>(
    () => (key, params) => resolveI18nText({
      i18n: i18nSource,
      key,
      fallback: key,
      params,
    }),
    [i18nSource],
  );

  return { locale, translate: text, text };
}
