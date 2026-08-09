import React from "react";
import { useI18n } from "../../app/providers/I18nProvider";
import { useHostRefresh } from "../../shared/hooks/useHostRefresh";
import { normalizeSettingsError, type SettingsPanelError } from "../../shared/runtime/errors";
import { getSettingsRuntimeService } from "../../shared/runtime/settings-runtime-service";
import { createThemeDiagnosticsViewModel, type ThemeDiagnosticsViewModel } from "./view-model";

export function useThemeDiagnostics() {
  const { t } = useI18n();
  const service = React.useMemo(() => getSettingsRuntimeService(), []);
  const [diagnostics, setDiagnostics] = React.useState<ThemeDiagnosticsViewModel | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<SettingsPanelError | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [contractView, resolvedTheme] = await Promise.all([
        service.getThemeContract(),
        service.resolveThemeDiagnostics([]),
      ]);
      const nextDiagnostics = createThemeDiagnosticsViewModel(contractView, resolvedTheme);
      setDiagnostics(nextDiagnostics);
      setError(null);
    } catch (nextError) {
      setError(normalizeSettingsError(nextError, t("settingsPanel.errors.themeDiagnostics")));
    } finally {
      setLoading(false);
    }
  }, [service, t]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  useHostRefresh(["theme.changed"], refresh);

  return {
    diagnostics,
    loading,
    error,
    refresh,
  };
}
