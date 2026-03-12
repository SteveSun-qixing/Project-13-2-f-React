import { useMemo } from "react";
import { createTranslator } from "./editor-i18n";

export function useEditorTranslation(locale: string | null | undefined) {
  return useMemo(() => createTranslator(locale ?? "zh-CN"), [locale]);
}
