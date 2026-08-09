import enUS from "../../i18n/en-US.json";
import zhCN from "../../i18n/zh-CN.json";

const messages = {
  "en-US": enUS,
  "zh-CN": zhCN,
} as const;

export type LayoutLocale = keyof typeof messages;

export function getLayoutMessage(locale: string | undefined, key: keyof typeof enUS): string {
  const normalizedLocale = locale === "zh-CN" ? "zh-CN" : "en-US";
  return messages[normalizedLocale][key] ?? messages["en-US"][key] ?? String(key);
}
