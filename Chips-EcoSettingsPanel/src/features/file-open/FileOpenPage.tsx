import React from "react";
import { Button, Select, Tag } from "antd";
import { useI18n } from "../../app/providers/I18nProvider";
import { PageFrame } from "../../shared/ui/PageFrame";
import { SettingsRow } from "../../shared/ui/SettingsRow";
import { SettingsSection } from "../../shared/ui/SettingsSection";
import { SectionStateBoundary } from "../../shared/ui/SectionStateBoundary";
import { NotificationStack } from "../../shared/ui/NotificationStack";
import { useFileOpenGovernance } from "./useFileOpenGovernance";
import type { FileOpenHandlerSlot } from "../../shared/runtime/settings-runtime-service";

function slotTitle(slot: FileOpenHandlerSlot): string {
  if (slot.kind === "file-handler" && slot.extension) {
    return slot.extension;
  }
  return slot.mimeType ?? slot.capability;
}

interface FileOpenSlotRowProps {
  slot: FileOpenHandlerSlot;
  active: boolean;
  onChange: (pluginId: string | null) => void;
}

function FileOpenSlotRow({ slot, active, onChange }: FileOpenSlotRowProps): React.ReactElement {
  const { t } = useI18n();

  const options = slot.plugins.map((plugin) => ({
    value: plugin.pluginId,
    label: plugin.tier === "fallback"
      ? `${plugin.name ?? plugin.pluginId}（兜底）`
      : (plugin.name ?? plugin.pluginId),
  }));

  const hasPreference = slot.preferencePluginId !== null;

  return (
    <SettingsRow
      label={slotTitle(slot)}
      control={
        <Select
          size="small"
          style={{ minWidth: 220 }}
          aria-label={slot.capability}
          value={slot.defaultPluginId}
          options={options}
          loading={active}
          onChange={(pluginId) => onChange(pluginId)}
        />
      }
    >
      {hasPreference ? (
        <div className="file-open-slot-meta">
          <Tag color="blue">{t("settingsPanel.fileOpen.preferredTag")}</Tag>
          <Button size="small" type="link" onClick={() => onChange(null)}>
            {t("settingsPanel.fileOpen.clearPreference")}
          </Button>
        </div>
      ) : null}
    </SettingsRow>
  );
}

export function FileOpenPage(): React.ReactElement {
  const { t } = useI18n();
  const governance = useFileOpenGovernance({
    listErrorKey: "settingsPanel.fileOpen.errors.list",
    updateErrorKey: "settingsPanel.fileOpen.errors.update",
    resetErrorKey: "settingsPanel.fileOpen.errors.reset",
    updateTitleKey: "settingsPanel.fileOpen.updateTitle",
    updateSuccessKey: "settingsPanel.fileOpen.updateSuccess",
    resetTitleKey: "settingsPanel.fileOpen.resetTitle",
    resetSuccessKey: "settingsPanel.fileOpen.resetSuccess",
  });

  const extensionSlots = governance.slots.filter((slot) => slot.kind === "file-handler");
  const mimeSlots = governance.slots.filter((slot) => slot.kind === "resource-handler");
  const hasAnyPreference = governance.slots.some((slot) => slot.preferencePluginId !== null);

  return (
    <PageFrame
      title={t("settingsPanel.fileOpen.title")}
      description={t("settingsPanel.fileOpen.description")}
      actions={
        hasAnyPreference ? (
          <Button
            size="small"
            onClick={() => void governance.resetAllDefaults()}
            loading={governance.activeKey === "*"}
          >
            {t("settingsPanel.fileOpen.resetAll")}
          </Button>
        ) : undefined
      }
    >
      <NotificationStack
        ariaLabel={t("settingsPanel.feedback.ariaLabel")}
        closeButtonLabel={t("settingsPanel.common.close")}
        items={governance.feedbackItems}
        onDismiss={(item) => governance.removeFeedback(item.id)}
      />

      <SectionStateBoundary
        loading={governance.loading}
        error={governance.error}
        loadingLabel={t("settingsPanel.fileOpen.loading")}
        onRetry={() => void governance.refresh()}
      >
        {governance.slots.length === 0 ? (
          <div className="file-open-empty">
            <span>{t("settingsPanel.fileOpen.emptyTitle")}</span>
            <span className="file-open-empty__description">{t("settingsPanel.fileOpen.emptyDescription")}</span>
          </div>
        ) : (
          <>
            <SettingsSection title={t("settingsPanel.fileOpen.extensionSection")}>
              {extensionSlots.map((slot) => (
                <FileOpenSlotRow
                  key={slot.capability}
                  slot={slot}
                  active={governance.activeKey === slot.preferenceKey}
                  onChange={(pluginId) => void governance.setDefaultHandler(slot, pluginId)}
                />
              ))}
            </SettingsSection>
            <SettingsSection title={t("settingsPanel.fileOpen.mimeSection")}>
              {mimeSlots.map((slot) => (
                <FileOpenSlotRow
                  key={slot.capability}
                  slot={slot}
                  active={governance.activeKey === slot.preferenceKey}
                  onChange={(pluginId) => void governance.setDefaultHandler(slot, pluginId)}
                />
              ))}
            </SettingsSection>
          </>
        )}
      </SectionStateBoundary>
    </PageFrame>
  );
}
