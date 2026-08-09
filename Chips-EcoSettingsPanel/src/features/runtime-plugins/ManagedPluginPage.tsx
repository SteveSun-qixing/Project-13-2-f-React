import React from "react";
import { Button, Empty } from "antd";
import type { GovernedPluginType, PluginGovernanceRecord } from "../../shared/runtime/settings-runtime-service";
import { useI18n } from "../../app/providers/I18nProvider";
import { useWindowFileDrop } from "../../shared/hooks/useWindowFileDrop";
import { NotificationStack } from "../../shared/ui/NotificationStack";
import { PageFrame } from "../../shared/ui/PageFrame";
import { SettingsSection } from "../../shared/ui/SettingsSection";
import { SectionStateBoundary } from "../../shared/ui/SectionStateBoundary";
import { SettingsDetailPage } from "../../shared/ui/SettingsDetailPage";
import { SettingsRecordItem, SettingsRecordList } from "../../shared/ui/SettingsRecordList";
import { StatusBadge } from "../../shared/ui/StatusBadge";
import { WindowDropOverlay } from "../../shared/ui/WindowDropOverlay";
import { useManagedPluginGovernance } from "./useManagedPluginGovernance";

interface ManagedPluginPageProps {
  type: GovernedPluginType;
  translationBaseKey: "settingsPanel.cardPlugins" | "settingsPanel.layoutPlugins" | "settingsPanel.modulePlugins";
}

function ManagedPluginStatus({
  plugin,
  translationBaseKey,
}: {
  plugin: PluginGovernanceRecord;
  translationBaseKey: ManagedPluginPageProps["translationBaseKey"];
}): React.ReactElement {
  const { t } = useI18n();
  return plugin.enabled ? (
    <StatusBadge tone="positive" label={t(`${translationBaseKey}.badges.enabled`)} />
  ) : (
    <StatusBadge tone="neutral" label={t(`${translationBaseKey}.badges.disabled`)} />
  );
}

export function ManagedPluginPage({ type, translationBaseKey }: ManagedPluginPageProps): React.ReactElement {
  const { t } = useI18n();
  const {
    plugins,
    loading,
    error,
    activeActionId,
    installWithFilePicker,
    installFromDroppedFiles,
    togglePluginEnabled,
    uninstallPlugin,
    refresh,
    feedback,
    dismissFeedback,
  } = useManagedPluginGovernance(type, {
    listErrorKey: `settingsPanel.errors.${type}PluginList`,
    installErrorKey: `settingsPanel.errors.${type}PluginInstall`,
    toggleErrorKey: `settingsPanel.errors.${type}PluginToggle`,
    uninstallErrorKey: `settingsPanel.errors.${type}PluginUninstall`,
    pickerTitleKey: `${translationBaseKey}.dialogs.filePickerTitle`,
    pickerFilterKey: `${translationBaseKey}.dialogs.filePickerFilter`,
    installTitleKey: `${translationBaseKey}.feedback.installTitle`,
    installSuccessKey: `${translationBaseKey}.feedback.installSuccess`,
    enableTitleKey: `${translationBaseKey}.feedback.enableTitle`,
    enableSuccessKey: `${translationBaseKey}.feedback.enableSuccess`,
    disableTitleKey: `${translationBaseKey}.feedback.disableTitle`,
    disableSuccessKey: `${translationBaseKey}.feedback.disableSuccess`,
    uninstallTitleKey: `${translationBaseKey}.feedback.uninstallTitle`,
    uninstallSuccessKey: `${translationBaseKey}.feedback.uninstallSuccess`,
    confirmTitleKey: `${translationBaseKey}.dialogs.uninstallTitle`,
    confirmMessageKey: `${translationBaseKey}.dialogs.uninstallMessage`,
    confirmDetailKey: `${translationBaseKey}.dialogs.uninstallDetail`,
  });
  const [selectedPluginId, setSelectedPluginId] = React.useState<string | null>(null);
  const selectedPlugin = plugins.find((plugin) => plugin.pluginId === selectedPluginId) ?? null;
  const dropActive = useWindowFileDrop({ onDropFiles: installFromDroppedFiles });

  React.useEffect(() => {
    if (selectedPluginId && !selectedPlugin) {
      setSelectedPluginId(null);
    }
  }, [selectedPlugin, selectedPluginId]);

  const resolvePluginTypeLabel = React.useCallback((plugin: PluginGovernanceRecord) => {
    const capabilityLabel = plugin.capabilities.length > 0
      ? plugin.capabilities.join(", ")
      : t("settingsPanel.common.notAvailable");

    if (plugin.type === "card") {
      return plugin.cardTypes.length > 0
        ? plugin.cardTypes.join(", ")
        : t("settingsPanel.common.notAvailable");
    }

    if (plugin.type === "layout") {
      return plugin.layoutType ?? t("settingsPanel.common.notAvailable");
    }

    return capabilityLabel;
  }, [t]);

  if (selectedPlugin) {
    const busy = activeActionId === selectedPlugin.pluginId;
    const capabilityLabel = selectedPlugin.capabilities.length > 0
      ? selectedPlugin.capabilities.join(", ")
      : t("settingsPanel.common.notAvailable");
    const pluginTypeLabel = resolvePluginTypeLabel(selectedPlugin);

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
          title={t(`${translationBaseKey}.dropzone.title`)}
          description={t(`${translationBaseKey}.dropzone.description`)}
        />
        <SettingsDetailPage
          title={t(`${translationBaseKey}.detail.title`, { name: selectedPlugin.displayName ?? selectedPlugin.name })}
          description={selectedPlugin.description ?? t(`${translationBaseKey}.detail.description`)}
          backLabel={t("settingsPanel.common.back")}
          onBack={() => setSelectedPluginId(null)}
          status={
            <div className="governance-status">
              <ManagedPluginStatus plugin={selectedPlugin} translationBaseKey={translationBaseKey} />
            </div>
          }
          primaryActions={
            <div className="action-row">
              <Button disabled={busy} onClick={() => void togglePluginEnabled(selectedPlugin)}>
                {selectedPlugin.enabled
                  ? t(`${translationBaseKey}.actions.disable`)
                  : t(`${translationBaseKey}.actions.enable`)}
              </Button>
            </div>
          }
          secondaryActions={
            <div className="action-row">
              <Button disabled={busy} onClick={() => void uninstallPlugin(selectedPlugin)}>
                {t(`${translationBaseKey}.actions.uninstall`)}
              </Button>
            </div>
          }
          fieldGroups={[
            {
              title: t(`${translationBaseKey}.detail.groups.identity`),
              description: t(`${translationBaseKey}.detail.groups.identityDescription`),
              fields: [
                { label: t(`${translationBaseKey}.fields.pluginId`), value: selectedPlugin.pluginId },
                { label: t(`${translationBaseKey}.fields.version`), value: selectedPlugin.version },
                { label: t(`${translationBaseKey}.fields.identity`), value: pluginTypeLabel },
              ],
            },
            {
              title: t(`${translationBaseKey}.detail.groups.capabilities`),
              description: t(`${translationBaseKey}.detail.groups.capabilitiesDescription`),
              fields: [
                { label: t(`${translationBaseKey}.fields.capabilities`), value: capabilityLabel },
              ],
            },
            {
              title: t(`${translationBaseKey}.detail.groups.installation`),
              description: t(`${translationBaseKey}.detail.groups.installationDescription`),
              fields: [
                { label: t(`${translationBaseKey}.fields.installPath`), value: selectedPlugin.installPath },
              ],
            },
          ]}
        />
      </>
    );
  }

  return (
    <PageFrame
      title={t(`${translationBaseKey}.title`)}
      actions={<Button type="primary" onClick={installWithFilePicker}>{t(`${translationBaseKey}.actions.install`)}</Button>}
    >
      <NotificationStack
        ariaLabel={t("settingsPanel.feedback.ariaLabel")}
        closeButtonLabel={t("settingsPanel.common.close")}
        items={feedback}
        onDismiss={(item) => dismissFeedback(item.id)}
      />
      <WindowDropOverlay
        active={dropActive}
        title={t(`${translationBaseKey}.dropzone.title`)}
        description={t(`${translationBaseKey}.dropzone.description`)}
      />
      <SettingsSection title={t(`${translationBaseKey}.sectionTitle`)}>
      <SectionStateBoundary
        loading={loading}
        error={error}
        loadingLabel={t(`${translationBaseKey}.loading`)}
        onRetry={() => {
          void refresh();
        }}
      >
        {plugins.length === 0 ? (
          <Empty
            className="settings-empty-state"
            aria-label={t(`${translationBaseKey}.empty.ariaLabel`)}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div className="settings-empty-state__copy">
                <div className="settings-empty-state__title">{t(`${translationBaseKey}.empty.title`)}</div>
                <div className="settings-empty-state__description">{t(`${translationBaseKey}.empty.description`)}</div>
              </div>
            }
          >
            <Button type="primary" onClick={installWithFilePicker}>
              {t(`${translationBaseKey}.actions.install`)}
            </Button>
          </Empty>
        ) : (
          <SettingsRecordList
            ariaLabel={t(`${translationBaseKey}.listAriaLabel`)}
          >
            {plugins.map((plugin) => {
              const busy = activeActionId === plugin.pluginId;
              const pluginTypeLabel = resolvePluginTypeLabel(plugin);

              return (
                <SettingsRecordItem
                  key={plugin.pluginId}
                  id={plugin.pluginId}
                  title={plugin.displayName ?? plugin.name}
                  status={<ManagedPluginStatus plugin={plugin} translationBaseKey={translationBaseKey} />}
                  meta={
                    <>
                      <span>{t(`${translationBaseKey}.fields.version`)}: {plugin.version}</span>
                      <span>{t(`${translationBaseKey}.fields.identity`)}: {pluginTypeLabel}</span>
                    </>
                  }
                  actions={
                    <>
                      <Button disabled={busy} onClick={() => void togglePluginEnabled(plugin)}>
                        {plugin.enabled
                          ? t(`${translationBaseKey}.actions.disable`)
                          : t(`${translationBaseKey}.actions.enable`)}
                      </Button>
                    </>
                  }
                  detailLabel={t("settingsPanel.common.details")}
                  onOpenDetail={() => setSelectedPluginId(plugin.pluginId)}
                />
              );
            })}
          </SettingsRecordList>
        )}
      </SectionStateBoundary>
      </SettingsSection>
    </PageFrame>
  );
}
