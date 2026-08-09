import React from "react";
import type { LanguageGovernanceRecord } from "../../shared/runtime/settings-runtime-service";
import { getSettingsRuntimeService } from "../../shared/runtime/settings-runtime-service";
import { normalizeSettingsError, type SettingsPanelError } from "../../shared/runtime/errors";
import { useHostRefresh } from "../../shared/hooks/useHostRefresh";
import { useFeedbackQueue } from "../../shared/hooks/useFeedbackQueue";
import { useI18n } from "../../app/providers/I18nProvider";

export function useLanguageGovernance() {
  const service = React.useMemo(() => getSettingsRuntimeService(), []);
  const { locale, t } = useI18n();
  const feedback = useFeedbackQueue();
  const [languages, setLanguages] = React.useState<LanguageGovernanceRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<SettingsPanelError | null>(null);
  const [activeLocale, setActiveLocale] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const nextLanguages = await service.listLanguages(locale);
      setLanguages(nextLanguages);
      setError(null);
    } catch (nextError) {
      setError(normalizeSettingsError(nextError, t("settingsPanel.errors.languageList")));
    } finally {
      setLoading(false);
    }
  }, [locale, service, t]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  useHostRefresh(["language.changed"], refresh);

  const switchLocale = React.useCallback(async (targetLocale: string) => {
    setActiveLocale(targetLocale);
    try {
      await service.setCurrentLocale(targetLocale);
      feedback.push({
        tone: "success",
        title: t("settingsPanel.languages.feedback.switchTitle"),
        message: t("settingsPanel.languages.feedback.switchSuccess", { locale: targetLocale }),
      });
      await refresh();
    } catch (nextError) {
      const normalized = normalizeSettingsError(nextError, t("settingsPanel.errors.languageSwitch"));
      setError(normalized);
    } finally {
      setActiveLocale(null);
    }
  }, [feedback, refresh, service, t]);

  return {
    languages,
    loading,
    error,
    activeLocale,
    switchLocale,
    refresh,
    feedback: feedback.items,
    dismissFeedback: feedback.remove,
  };
}
