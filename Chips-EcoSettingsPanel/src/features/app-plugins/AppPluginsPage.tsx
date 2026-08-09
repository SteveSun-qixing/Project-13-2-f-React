import React from "react";
import { Button, Empty } from "antd";
import { AppstoreOutlined } from "@ant-design/icons";
import type { AppPluginGovernanceRecord } from "../../shared/runtime/settings-runtime-service";
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
import { useAppPluginGovernance } from "./useAppPluginGovernance";

function toFileUrl(filePath?: string): string | null {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    return null;
  }

  const normalized = filePath.replace(/\\/g, "/");
  if (/^file:\/\//i.test(normalized)) {
    return normalized;
  }
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`);
  }
  return encodeURI(`file://${normalized.startsWith("/") ? normalized : `/${normalized}`}`);
}

function formatInstalledAt(locale: string, installedAt: number): string {
  if (!Number.isFinite(installedAt) || installedAt <= 0) {
    return String(installedAt);
  }

  if (installedAt < 100000000000) {
    return String(installedAt);
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(installedAt));
}

function AppPluginIcon({ plugin }: { plugin: AppPluginGovernanceRecord }): React.ReactElement {
  const shortcutIconUrl = toFileUrl(plugin.shortcut.iconPath);

  return (
    <>
      {shortcutIconUrl ? (
        <img
          className="settings-record-main__icon-image"
          src={shortcutIconUrl}
          alt=""
        />
      ) : (
        <AppstoreOutlined />
      )}
    </>
  );
}

function AppPluginStatus({ plugin }: { plugin: AppPluginGovernanceRecord }): React.ReactElement {
  const { t } = useI18n();
  return (
    <>
      {plugin.enabled ? (
        <StatusBadge tone="positive" label={t("settingsPanel.appPlugins.badges.enabled")} />
      ) : (
        <StatusBadge tone="neutral" label={t("settingsPanel.appPlugins.badges.disabled")} />
      )}
      {plugin.selfManaged ? (
        <StatusBadge tone="attention" label={t("settingsPanel.appPlugins.badges.currentApp")} />
      ) : null}
    </>
  );
}

function AppShortcutStatus({ plugin }: { plugin: AppPluginGovernanceRecord }): React.ReactElement {
  const { t } = useI18n();
  const shortcut = plugin.shortcut;
  return (
    <>
      {shortcut.exists ? (
        <StatusBadge tone="positive" label={t("settingsPanel.appPlugins.badges.shortcutReady")} />
      ) : (
        <StatusBadge tone="neutral" label={t("settingsPanel.appPlugins.badges.shortcutMissing")} />
      )}
      <span>
        {shortcut.exists
          ? t(`settingsPanel.appPlugins.shortcut.location.${shortcut.location}`)
          : t("settingsPanel.appPlugins.shortcut.empty")}
      </span>
    </>
  );
}

function EmptyState({
  ariaLabel,
  title,
  description,
  actionLabel,
  onAction,
}: {
  ariaLabel: string;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}): React.ReactElement {
  return (
    <Empty
      className="settings-empty-state"
      aria-label={ariaLabel}
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <div className="settings-empty-state__copy">
          <div className="settings-empty-state__title">{title}</div>
          <div className="settings-empty-state__description">{description}</div>
        </div>
      }
    >
      <Button type="primary" onClick={onAction}>
        {actionLabel}
      </Button>
    </Empty>
  );
}

export function AppPluginsPage(): React.ReactElement {
  const { locale, t } = useI18n();
  const {
    plugins,
    loading,
    error,
    activeActionId,
    installWithFilePicker,
    installFromDroppedFiles,
    togglePluginEnabled,
    uninstallPlugin,
    launchPlugin,
    createPluginShortcut,
    removePluginShortcut,
    revealPluginShortcut,
    refresh,
    feedback,
    dismissFeedback,
  } = useAppPluginGovernance();
  const [selectedPluginId, setSelectedPluginId] = React.useState<string | null>(null);
  const selectedPlugin = plugins.find((plugin) => plugin.pluginId === selectedPluginId) ?? null;
  const dropActive = useWindowFileDrop({ onDropFiles: installFromDroppedFiles });

  React.useEffect(() => {
    if (selectedPluginId && !selectedPlugin) {
      setSelectedPluginId(null);
    }
  }, [selectedPlugin, selectedPluginId]);

  if (selectedPlugin) {
    const busy = activeActionId === selectedPlugin.pluginId;
    const installedAtLabel = formatInstalledAt(locale, selectedPlugin.installedAt);
    const shortcut = selectedPlugin.shortcut;

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
          title={t("settingsPanel.appPlugins.dropzone.title")}
          description={t("settingsPanel.appPlugins.dropzone.description")}
        />
        <SettingsDetailPage
          title={t("settingsPanel.appPlugins.detail.title", { name: selectedPlugin.name })}
          description={selectedPlugin.description ?? t("settingsPanel.appPlugins.detail.description")}
          backLabel={t("settingsPanel.common.back")}
          onBack={() => setSelectedPluginId(null)}
          hero={<AppPluginIcon plugin={selectedPlugin} />}
          status={<div className="governance-status"><AppPluginStatus plugin={selectedPlugin} /></div>}
          primaryActions={
            <div className="action-row">
              <Button disabled={busy || !selectedPlugin.enabled} onClick={() => void launchPlugin(selectedPlugin)}>
                {t("settingsPanel.appPlugins.actions.launch")}
              </Button>
              <Button disabled={busy || selectedPlugin.selfManaged} onClick={() => void togglePluginEnabled(selectedPlugin)}>
                {selectedPlugin.enabled
                  ? t("settingsPanel.appPlugins.actions.disable")
                  : t("settingsPanel.appPlugins.actions.enable")}
              </Button>
            </div>
          }
          secondaryActions={
            <div className="action-row">
              <Button disabled={busy} onClick={() => void createPluginShortcut(selectedPlugin)}>
                {shortcut.exists
                  ? t("settingsPanel.appPlugins.actions.rebuildShortcut")
                  : t("settingsPanel.appPlugins.actions.createShortcut")}
              </Button>
              <Button disabled={busy || !shortcut.exists} onClick={() => void revealPluginShortcut(selectedPlugin)}>
                {t("settingsPanel.appPlugins.actions.revealShortcut")}
              </Button>
              <Button disabled={busy || !shortcut.exists} onClick={() => void removePluginShortcut(selectedPlugin)}>
                {t("settingsPanel.appPlugins.actions.removeShortcut")}
              </Button>
              <Button disabled={busy || selectedPlugin.selfManaged} onClick={() => void uninstallPlugin(selectedPlugin)}>
                {t("settingsPanel.appPlugins.actions.uninstall")}
              </Button>
            </div>
          }
          fieldGroups={[
            {
              title: t("settingsPanel.appPlugins.detail.groups.identity"),
              description: t("settingsPanel.appPlugins.detail.groups.identityDescription"),
              fields: [
                { label: t("settingsPanel.appPlugins.fields.pluginId"), value: selectedPlugin.pluginId },
                { label: t("settingsPanel.appPlugins.fields.version"), value: selectedPlugin.version },
                {
                  label: t("settingsPanel.appPlugins.fields.capabilities"),
                  value: selectedPlugin.capabilities.length > 0
                    ? selectedPlugin.capabilities.join(", ")
                    : t("settingsPanel.common.notAvailable"),
                },
              ],
            },
            {
              title: t("settingsPanel.appPlugins.detail.groups.installation"),
              description: t("settingsPanel.appPlugins.detail.groups.installationDescription"),
              fields: [
                { label: t("settingsPanel.appPlugins.fields.installPath"), value: selectedPlugin.installPath },
                { label: t("settingsPanel.appPlugins.fields.installedAt"), value: installedAtLabel },
              ],
            },
            {
              title: t("settingsPanel.appPlugins.detail.groups.shortcut"),
              description: t("settingsPanel.appPlugins.detail.groups.shortcutDescription"),
              fields: [
                {
                  label: t("settingsPanel.appPlugins.fields.shortcut"),
                  value: shortcut.exists ? shortcut.launcherPath : t("settingsPanel.common.notAvailable"),
                },
              ],
            },
          ]}
        />
      </>
    );
  }

  return (
    <PageFrame
      title={t("settingsPanel.appPlugins.title")}
      actions={<Button type="primary" onClick={installWithFilePicker}>{t("settingsPanel.appPlugins.actions.install")}</Button>}
    >
      <NotificationStack
        ariaLabel={t("settingsPanel.feedback.ariaLabel")}
        closeButtonLabel={t("settingsPanel.common.close")}
        items={feedback}
        onDismiss={(item) => dismissFeedback(item.id)}
      />
      <WindowDropOverlay
        active={dropActive}
        title={t("settingsPanel.appPlugins.dropzone.title")}
        description={t("settingsPanel.appPlugins.dropzone.description")}
      />
      <SettingsSection title={t("settingsPanel.appPlugins.sectionTitle")}>
      <SectionStateBoundary
        loading={loading}
        error={error}
        loadingLabel={t("settingsPanel.appPlugins.loading")}
        onRetry={() => {
          void refresh();
        }}
      >
        {plugins.length === 0 ? (
          <EmptyState
            ariaLabel={t("settingsPanel.appPlugins.empty.ariaLabel")}
            title={t("settingsPanel.appPlugins.empty.title")}
            description={t("settingsPanel.appPlugins.empty.description")}
            actionLabel={t("settingsPanel.appPlugins.actions.install")}
            onAction={installWithFilePicker}
          />
        ) : (
          <SettingsRecordList
            ariaLabel={t("settingsPanel.appPlugins.listAriaLabel")}
          >
            {plugins.map((plugin) => {
              const busy = activeActionId === plugin.pluginId;
              const installedAtLabel = formatInstalledAt(locale, plugin.installedAt);

              return (
                <SettingsRecordItem
                  key={plugin.pluginId}
                  id={plugin.pluginId}
                  icon={<AppPluginIcon plugin={plugin} />}
                  title={plugin.name}
                  status={<AppPluginStatus plugin={plugin} />}
                  meta={
                    <>
                      <span>{t("settingsPanel.appPlugins.fields.version")}: {plugin.version}</span>
                      <span>{t("settingsPanel.appPlugins.fields.installedAt")}: {installedAtLabel}</span>
                      <span className="settings-record-meta__shortcut"><AppShortcutStatus plugin={plugin} /></span>
                    </>
                  }
                  actions={
                    <>
                      <Button disabled={busy || !plugin.enabled} onClick={() => void launchPlugin(plugin)}>
                        {t("settingsPanel.appPlugins.actions.launch")}
                      </Button>
                      <Button disabled={busy || plugin.selfManaged} onClick={() => void togglePluginEnabled(plugin)}>
                        {plugin.enabled
                          ? t("settingsPanel.appPlugins.actions.disable")
                          : t("settingsPanel.appPlugins.actions.enable")}
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
