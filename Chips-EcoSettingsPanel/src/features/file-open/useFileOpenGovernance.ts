import React from "react";
import type { FileOpenHandlerSlot } from "../../shared/runtime/settings-runtime-service";
import { getSettingsRuntimeService } from "../../shared/runtime/settings-runtime-service";
import { normalizeSettingsError, type SettingsPanelError } from "../../shared/runtime/errors";
import { useHostRefresh } from "../../shared/hooks/useHostRefresh";
import { useFeedbackQueue } from "../../shared/hooks/useFeedbackQueue";
import { useI18n } from "../../app/providers/I18nProvider";

interface FileOpenMessages {
  listErrorKey: string;
  updateErrorKey: string;
  resetErrorKey: string;
  updateTitleKey: string;
  updateSuccessKey: string;
  resetTitleKey: string;
  resetSuccessKey: string;
}

export function useFileOpenGovernance(messages: FileOpenMessages) {
  const service = React.useMemo(() => getSettingsRuntimeService(), []);
  const { t } = useI18n();
  const feedback = useFeedbackQueue();
  const [slots, setSlots] = React.useState<FileOpenHandlerSlot[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<SettingsPanelError | null>(null);
  const [activeKey, setActiveKey] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const nextSlots = await service.listFileOpenHandlers();
      setSlots(nextSlots);
      setError(null);
    } catch (nextError) {
      setError(normalizeSettingsError(nextError, t(messages.listErrorKey)));
    } finally {
      setLoading(false);
    }
  }, [messages.listErrorKey, service, t]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  useHostRefresh(["plugin.installed", "plugin.enabled", "plugin.disabled", "plugin.uninstalled"], refresh);

  const setDefaultHandler = React.useCallback(async (slot: FileOpenHandlerSlot, pluginId: string | null) => {
    setActiveKey(slot.preferenceKey);
    try {
      await service.setFileOpenDefaultPreference(slot.preferenceKey, pluginId);
      feedback.push({
        tone: "success",
        title: t(messages.updateTitleKey),
        message: t(messages.updateSuccessKey, { capability: slot.capability }),
      });
      await refresh();
    } catch (nextError) {
      setError(normalizeSettingsError(nextError, t(messages.updateErrorKey)));
    } finally {
      setActiveKey(null);
    }
  }, [feedback, messages.updateErrorKey, messages.updateSuccessKey, messages.updateTitleKey, refresh, service, t]);

  const resetAllDefaults = React.useCallback(async () => {
    setActiveKey("*");
    try {
      await service.resetFileOpenDefaults();
      feedback.push({
        tone: "success",
        title: t(messages.resetTitleKey),
        message: t(messages.resetSuccessKey),
      });
      await refresh();
    } catch (nextError) {
      setError(normalizeSettingsError(nextError, t(messages.resetErrorKey)));
    } finally {
      setActiveKey(null);
    }
  }, [feedback, messages.resetErrorKey, messages.resetSuccessKey, messages.resetTitleKey, refresh, service, t]);

  return {
    slots,
    loading,
    error,
    activeKey,
    feedbackItems: feedback.items,
    removeFeedback: feedback.remove,
    clearError: React.useCallback(() => setError(null), []),
    refresh,
    setDefaultHandler,
    resetAllDefaults,
  };
}
