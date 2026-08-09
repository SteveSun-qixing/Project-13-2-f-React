import React from "react";
import { ChipsButton, ChipsEmptyState } from "@chips/component-library";
import type { LanguageGovernanceRecord } from "../../shared/runtime/settings-runtime-service";
import { useI18n } from "../../app/providers/I18nProvider";
import { NotificationStack } from "../../shared/ui/NotificationStack";
import { PageFrame } from "../../shared/ui/PageFrame";
import { SectionStateBoundary } from "../../shared/ui/SectionStateBoundary";
import { SettingsDetailPage } from "../../shared/ui/SettingsDetailPage";
import { SettingsRecordItem, SettingsRecordList } from "../../shared/ui/SettingsRecordList";
import { StatusBadge } from "../../shared/ui/StatusBadge";
import { useLanguageGovernance } from "./useLanguageGovernance";

function LanguageStatus({ language }: { language: LanguageGovernanceRecord }): React.ReactElement {
  const { t } = useI18n();
  return language.current ? (
    <StatusBadge tone="positive" label={t("settingsPanel.languages.badges.current")} />
  ) : (
    <StatusBadge tone="neutral" label={t("settingsPanel.languages.badges.available")} />
  );
}

export function LanguagePage(): React.ReactElement {
  const { t } = useI18n();
  const { languages, loading, error, activeLocale, switchLocale, refresh, feedback, dismissFeedback } = useLanguageGovernance();
  const [selectedLocale, setSelectedLocale] = React.useState<string | null>(null);
  const selectedLanguage = languages.find((language) => language.locale === selectedLocale) ?? null;

  React.useEffect(() => {
    if (selectedLocale && !selectedLanguage) {
      setSelectedLocale(null);
    }
  }, [selectedLanguage, selectedLocale]);

  if (selectedLanguage) {
    const busy = activeLocale === selectedLanguage.locale;

    return (
      <>
        <NotificationStack
          ariaLabel={t("settingsPanel.feedback.ariaLabel")}
          closeButtonLabel={t("settingsPanel.common.close")}
          items={feedback}
          onDismiss={(item) => dismissFeedback(item.id)}
        />
        <SettingsDetailPage
          title={t("settingsPanel.languages.detail.title", { name: selectedLanguage.displayName })}
          description={t("settingsPanel.languages.detail.description")}
          backLabel={t("settingsPanel.common.back")}
          onBack={() => setSelectedLocale(null)}
          status={<div className="governance-status"><LanguageStatus language={selectedLanguage} /></div>}
          primaryActions={
            <div className="action-row">
              <ChipsButton disabled={busy || selectedLanguage.current} onPress={() => void switchLocale(selectedLanguage.locale)}>
                {t("settingsPanel.languages.actions.apply")}
              </ChipsButton>
            </div>
          }
          fields={[
            { label: t("settingsPanel.languages.fields.locale"), value: selectedLanguage.locale },
            { label: t("settingsPanel.languages.fields.nativeName"), value: selectedLanguage.nativeName },
            {
              label: t("settingsPanel.languages.columns.status"),
              value: selectedLanguage.current
                ? t("settingsPanel.languages.badges.current")
                : t("settingsPanel.languages.badges.available"),
            },
          ]}
        />
      </>
    );
  }

  return (
    <PageFrame title={t("settingsPanel.languages.title")}>
      <NotificationStack
        ariaLabel={t("settingsPanel.feedback.ariaLabel")}
        closeButtonLabel={t("settingsPanel.common.close")}
        items={feedback}
        onDismiss={(item) => dismissFeedback(item.id)}
      />
      <SectionStateBoundary
        loading={loading}
        error={error}
        loadingLabel={t("settingsPanel.languages.loading")}
        onRetry={() => {
          void refresh();
        }}
      >
        {languages.length === 0 ? (
          <ChipsEmptyState
            ariaLabel={t("settingsPanel.languages.empty.ariaLabel")}
            title={t("settingsPanel.languages.empty.title")}
            description={t("settingsPanel.languages.empty.description")}
          />
        ) : (
          <SettingsRecordList
            ariaLabel={t("settingsPanel.languages.listAriaLabel")}
          >
            {languages.map((language) => {
              const busy = activeLocale === language.locale;

              return (
                <SettingsRecordItem
                  key={language.locale}
                  id={language.locale}
                  title={language.displayName}
                  summary={language.nativeName}
                  status={<LanguageStatus language={language} />}
                  meta={
                    <>
                      <span>{t("settingsPanel.languages.fields.locale")}: {language.locale}</span>
                      <span>{t("settingsPanel.languages.fields.nativeName")}: {language.nativeName}</span>
                    </>
                  }
                  actions={
                    <>
                      <ChipsButton disabled={busy || language.current} onPress={() => void switchLocale(language.locale)}>
                        {t("settingsPanel.languages.actions.apply")}
                      </ChipsButton>
                    </>
                  }
                  detailLabel={t("settingsPanel.common.details")}
                  onOpenDetail={() => setSelectedLocale(language.locale)}
                />
              );
            })}
          </SettingsRecordList>
        )}
      </SectionStateBoundary>
    </PageFrame>
  );
}
