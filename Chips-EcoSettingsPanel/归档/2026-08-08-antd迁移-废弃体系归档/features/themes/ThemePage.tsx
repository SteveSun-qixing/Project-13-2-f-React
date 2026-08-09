import React from "react";
import { ChipsButton, ChipsEmptyState } from "@chips/component-library";
import type { ThemeGovernanceRecord } from "../../shared/runtime/settings-runtime-service";
import { useI18n } from "../../app/providers/I18nProvider";
import { useWindowFileDrop } from "../../shared/hooks/useWindowFileDrop";
import { NotificationStack } from "../../shared/ui/NotificationStack";
import { PageFrame } from "../../shared/ui/PageFrame";
import { SectionStateBoundary } from "../../shared/ui/SectionStateBoundary";
import { SettingsDetailPage } from "../../shared/ui/SettingsDetailPage";
import { SettingsRecordItem, SettingsRecordList } from "../../shared/ui/SettingsRecordList";
import { StatusBadge } from "../../shared/ui/StatusBadge";
import { WindowDropOverlay } from "../../shared/ui/WindowDropOverlay";
import { useThemeGovernance } from "./useThemeGovernance";

function ThemeStatus({ theme }: { theme: ThemeGovernanceRecord }): React.ReactElement {
  const { t } = useI18n();
  return (
    <>
      {theme.current ? <StatusBadge tone="positive" label={t("settingsPanel.themes.badges.current")} /> : null}
      {theme.enabled && !theme.current ? <StatusBadge tone="attention" label={t("settingsPanel.themes.badges.enabled")} /> : null}
    </>
  );
}

function ThemeTitle({ theme }: { theme: ThemeGovernanceRecord }): React.ReactElement {
  const { t } = useI18n();
  return (
    <span className="settings-record-title-with-badge">
      <span>{theme.displayName}</span>
      {theme.isDefault ? <StatusBadge tone="neutral" label={t("settingsPanel.themes.badges.default")} /> : null}
    </span>
  );
}

export function ThemePage(): React.ReactElement {
  const { t } = useI18n();
  const {
    themes,
    loading,
    error,
    activeActionId,
    installWithFilePicker,
    installFromDroppedFiles,
    applyTheme,
    uninstallTheme,
    refresh,
    feedback,
    dismissFeedback,
  } = useThemeGovernance();
  const [selectedThemeId, setSelectedThemeId] = React.useState<string | null>(null);
  const selectedTheme = themes.find((theme) => theme.pluginId === selectedThemeId) ?? null;
  const dropActive = useWindowFileDrop({ onDropFiles: installFromDroppedFiles });

  React.useEffect(() => {
    if (selectedThemeId && !selectedTheme) {
      setSelectedThemeId(null);
    }
  }, [selectedTheme, selectedThemeId]);

  if (selectedTheme) {
    const busy = activeActionId === selectedTheme.pluginId;

    return (
      <>
        <NotificationStack
          ariaLabel={t("settingsPanel.feedback.ariaLabel")}
          closeButtonLabel={t("settingsPanel.common.close")}
          items={feedback}
          onDismiss={(item) => dismissFeedback(item.id)}
        />
        <WindowDropOverlay
          active={dropActive}
          title={t("settingsPanel.themes.dropzone.title")}
          description={t("settingsPanel.themes.dropzone.description")}
        />
        <SettingsDetailPage
          title={t("settingsPanel.themes.detail.title", { name: selectedTheme.displayName })}
          description={t("settingsPanel.themes.detail.description")}
          titleBadge={selectedTheme.isDefault ? <StatusBadge tone="neutral" label={t("settingsPanel.themes.badges.default")} /> : null}
          backLabel={t("settingsPanel.common.back")}
          onBack={() => setSelectedThemeId(null)}
          status={<div className="governance-status"><ThemeStatus theme={selectedTheme} /></div>}
          primaryActions={
            <div className="action-row">
              <ChipsButton disabled={busy || selectedTheme.current} onPress={() => void applyTheme(selectedTheme)}>
                {t("settingsPanel.themes.actions.apply")}
              </ChipsButton>
              <ChipsButton disabled={busy} onPress={() => void uninstallTheme(selectedTheme)}>
                {t("settingsPanel.themes.actions.uninstall")}
              </ChipsButton>
            </div>
          }
          fieldGroups={[
            {
              title: t("settingsPanel.themes.detail.groups.identity"),
              description: t("settingsPanel.themes.detail.groups.identityDescription"),
              fields: [
                { label: t("settingsPanel.themes.fields.themeId"), value: selectedTheme.themeId },
                { label: t("settingsPanel.themes.fields.version"), value: selectedTheme.version },
                {
                  label: t("settingsPanel.themes.fields.publisher"),
                  value: selectedTheme.publisher ?? t("settingsPanel.common.notAvailable"),
                },
              ],
            },
            {
              title: t("settingsPanel.themes.detail.groups.installation"),
              description: t("settingsPanel.themes.detail.groups.installationDescription"),
              fields: [
                { label: t("settingsPanel.themes.fields.installPath"), value: selectedTheme.installPath },
              ],
            },
          ]}
        />
      </>
    );
  }

  return (
    <PageFrame
      title={t("settingsPanel.themes.title")}
      actions={<ChipsButton onPress={installWithFilePicker}>{t("settingsPanel.themes.actions.install")}</ChipsButton>}
    >
      <NotificationStack
        ariaLabel={t("settingsPanel.feedback.ariaLabel")}
        closeButtonLabel={t("settingsPanel.common.close")}
        items={feedback}
        onDismiss={(item) => dismissFeedback(item.id)}
      />
      <WindowDropOverlay
        active={dropActive}
        title={t("settingsPanel.themes.dropzone.title")}
        description={t("settingsPanel.themes.dropzone.description")}
      />
      <SectionStateBoundary
        loading={loading}
        error={error}
        loadingLabel={t("settingsPanel.themes.loading")}
        onRetry={() => {
          void refresh();
        }}
      >
        {themes.length === 0 ? (
          <ChipsEmptyState
            ariaLabel={t("settingsPanel.themes.empty.ariaLabel")}
            title={t("settingsPanel.themes.empty.title")}
            description={t("settingsPanel.themes.empty.description")}
            actionLabel={t("settingsPanel.themes.actions.install")}
            onAction={installWithFilePicker}
          />
        ) : (
          <SettingsRecordList
            ariaLabel={t("settingsPanel.themes.listAriaLabel")}
          >
            {themes.map((theme) => {
              const busy = activeActionId === theme.pluginId;

              return (
                <SettingsRecordItem
                  key={theme.pluginId}
                  id={theme.pluginId}
                  title={<ThemeTitle theme={theme} />}
                  summary={theme.themeId}
                  status={<ThemeStatus theme={theme} />}
                  meta={
                    <>
                      <span>{t("settingsPanel.themes.fields.version")}: {theme.version}</span>
                      <span>{t("settingsPanel.themes.fields.publisher")}: {theme.publisher ?? t("settingsPanel.common.notAvailable")}</span>
                    </>
                  }
                  actions={
                    <>
                      <ChipsButton disabled={busy || theme.current} onPress={() => void applyTheme(theme)}>
                        {t("settingsPanel.themes.actions.apply")}
                      </ChipsButton>
                    </>
                  }
                  detailLabel={t("settingsPanel.common.details")}
                  onOpenDetail={() => setSelectedThemeId(theme.pluginId)}
                />
              );
            })}
          </SettingsRecordList>
        )}
      </SectionStateBoundary>
    </PageFrame>
  );
}
