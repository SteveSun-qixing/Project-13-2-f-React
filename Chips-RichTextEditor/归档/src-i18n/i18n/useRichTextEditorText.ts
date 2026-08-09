import { useMemo } from "react";
import {
  resolveI18nText,
  useChipsI18n,
  useChipsI18nText,
} from "@chips/component-library";
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  isSupportedLocale,
  localeBundles,
  type SupportedLocale,
} from "./messages";

type TextParams = Record<string, string | number>;
export type RichTextEditorTextResolver = (key: string, params?: TextParams, fallback?: string) => string;

export function useRichTextEditorText(): {
  locale: SupportedLocale;
  translate: RichTextEditorTextResolver;
  text: RichTextEditorTextResolver;
} {
  const i18n = useChipsI18n();
  const locale: SupportedLocale = isSupportedLocale(i18n.locale) ? i18n.locale : DEFAULT_LOCALE;
  const translate = useChipsI18nText({
    bundles: localeBundles,
    fallbackLocale: FALLBACK_LOCALE,
    defaultLocale: DEFAULT_LOCALE,
  });
  const i18nSource = useMemo(
    () => ({
      t: translate,
      translate,
    }),
    [translate],
  );
  const text = useMemo<RichTextEditorTextResolver>(
    () => (key, params, fallback) => resolveI18nText({
      i18n: i18nSource,
      key,
      fallback: fallback ?? key,
      params,
    }),
    [i18nSource],
  );

  return { locale, translate: text, text };
}

