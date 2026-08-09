import React, { createContext, useContext, useMemo } from "react";
import { formatMessage } from "../../lib/messages";

type TextParams = Record<string, string | number>;
export type AppTextResolver = (key: string, params?: TextParams) => string;

const APP_LOCALE = "zh-CN";

interface CommunityPreferencesValue {
  locale: string;
  t: AppTextResolver;
  formatDate: (value: string | number | Date) => string;
  formatNumber: (value: number) => string;
}

const CommunityPreferencesContext = createContext<CommunityPreferencesValue | null>(null);

export function CommunityPreferencesProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<CommunityPreferencesValue>(() => ({
    locale: APP_LOCALE,
    t(key, params) {
      return formatMessage(key, params);
    },
    formatDate(input) {
      return new Intl.DateTimeFormat(APP_LOCALE, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(input));
    },
    formatNumber(input) {
      return new Intl.NumberFormat(APP_LOCALE).format(input);
    },
  }), []);

  return (
    <CommunityPreferencesContext.Provider value={value}>
      {children}
    </CommunityPreferencesContext.Provider>
  );
}

export function useAppPreferences(): CommunityPreferencesValue {
  const context = useContext(CommunityPreferencesContext);
  if (!context) {
    throw new Error("useAppPreferences must be used inside CommunityPreferencesProvider");
  }
  return context;
}
