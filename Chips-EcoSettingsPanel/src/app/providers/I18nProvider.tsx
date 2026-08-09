import React from "react";
import { formatMessage } from "../../lib/messages";

interface I18nContextValue {
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: React.PropsWithChildren): React.ReactElement {
  const value = React.useMemo<I18nContextValue>(() => {
    return {
      locale: "zh-CN",
      t: formatMessage,
    };
  }, []);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = React.useContext(I18nContext);
  if (!context) {
    throw new Error("I18nContext is not available.");
  }
  return context;
}
