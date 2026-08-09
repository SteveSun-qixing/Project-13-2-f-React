import React from "react";
import { useI18n } from "../../app/providers/I18nProvider";
import { PageFrame } from "../../shared/ui/PageFrame";
import { SettingsRow } from "../../shared/ui/SettingsRow";
import { SettingsSection } from "../../shared/ui/SettingsSection";
import { SettingsStatusDot, type SettingsStatusTone } from "../../shared/ui/SettingsStatusDot";
import { PREVIEW_QUALITY_ENTRIES, type PreviewQualityEntryKind } from "./view-model";

function kindLabelKey(kind: PreviewQualityEntryKind): string {
  return `settingsPanel.previewQuality.kind.${kind}`;
}

function kindTone(kind: PreviewQualityEntryKind): SettingsStatusTone {
  if (kind === "preview") {
    return "positive";
  }
  if (kind === "contract") {
    return "attention";
  }
  return "neutral";
}

export function PreviewQualityPage(): React.ReactElement {
  const { t } = useI18n();

  return (
    <PageFrame
      title={t("settingsPanel.previewQuality.title")}
      description={t("settingsPanel.previewQuality.sectionDescription")}
    >
      <SettingsSection title={t("settingsPanel.previewQuality.sectionTitle")}>
        {PREVIEW_QUALITY_ENTRIES.map((entry) => (
          <SettingsRow
            key={entry.id}
            label={t(entry.titleKey)}
            control={<SettingsStatusDot tone={kindTone(entry.kind)} label={t(kindLabelKey(entry.kind))} />}
          >
            <code className="preview-quality-command">{entry.command}</code>
          </SettingsRow>
        ))}
      </SettingsSection>
    </PageFrame>
  );
}
