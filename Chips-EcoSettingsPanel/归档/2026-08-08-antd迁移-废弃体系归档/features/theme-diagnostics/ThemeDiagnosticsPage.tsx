import React from "react";
import { ChipsBox, ChipsButton, ChipsCardShell, ChipsEmptyState, ChipsText } from "@chips/component-library";
import type { ThemeDiagnosticStatus } from "chips-sdk";
import { useI18n } from "../../app/providers/I18nProvider";
import { GovernanceList, GovernanceListCell, GovernanceListRow } from "../../shared/ui/GovernanceList";
import { PageFrame } from "../../shared/ui/PageFrame";
import { CardGrid, CardGridItem, MetricCard, PageSection, PageStack, SummaryPanel } from "../../shared/ui/PageLayout";
import { SectionStateBoundary } from "../../shared/ui/SectionStateBoundary";
import { StatusBadge } from "../../shared/ui/StatusBadge";
import { useThemeDiagnostics } from "./useThemeDiagnostics";
import type { ThemeDiagnosticRowViewModel, ThemeDiagnosticsViewModel } from "./view-model";

function formatPercent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function statusTone(status: ThemeDiagnosticStatus): "neutral" | "positive" | "attention" | "danger" {
  if (status === "complete") {
    return "positive";
  }
  if (status === "warning") {
    return "attention";
  }
  return "danger";
}

function diagnosticTone(diagnostic: ThemeDiagnosticRowViewModel): "neutral" | "positive" | "attention" | "danger" {
  if (diagnostic.blocking || diagnostic.severity === "error") {
    return "danger";
  }
  if (diagnostic.severity === "warning") {
    return "attention";
  }
  return "neutral";
}

function ThemeChain({ diagnostics }: { diagnostics: ThemeDiagnosticsViewModel }): React.ReactElement {
  return (
    <CardGrid minItemSize="220px">
      {diagnostics.chain.map((entry) => (
        <CardGridItem key={`${entry.order}:${entry.id}`}>
          <div className="settings-chain-item">
            <span className="settings-chain-item__order">{entry.order + 1}</span>
            <span className="settings-chain-item__body">
              <strong>{entry.displayName}</strong>
              <ChipsText as="span" text={entry.id} tone="muted" />
            </span>
            <ChipsText as="span" text={entry.version} tone="muted" />
          </div>
        </CardGridItem>
      ))}
    </CardGrid>
  );
}

function DiagnosticList({ diagnostics }: { diagnostics: ThemeDiagnosticRowViewModel[] }): React.ReactElement {
  const { t } = useI18n();
  const visibleDiagnostics = diagnostics.slice(0, 8);

  if (visibleDiagnostics.length === 0) {
    return (
      <ChipsEmptyState
        ariaLabel={t("settingsPanel.themeDiagnostics.diagnostics.empty.ariaLabel")}
        title={t("settingsPanel.themeDiagnostics.diagnostics.empty.title")}
        description={t("settingsPanel.themeDiagnostics.diagnostics.empty.description")}
      />
    );
  }

  return (
    <CardGrid minItemSize="260px">
      {visibleDiagnostics.map((diagnostic) => (
        <CardGridItem key={diagnostic.id}>
          <ChipsCardShell
            title={<StatusBadge tone={diagnosticTone(diagnostic)} label={diagnostic.code} />}
            toolbar={<span className="settings-diagnostic-severity">{diagnostic.severity}</span>}
            ariaLabel={t("settingsPanel.themeDiagnostics.diagnostics.ariaLabel")}
          >
            <ChipsBox
              as="dl"
              className="settings-detail-field-list"
            >
              <div className="settings-detail-field-list__item">
                <dt>{t("settingsPanel.themeDiagnostics.diagnostics.fields.messageKey")}</dt>
                <dd>{diagnostic.messageKey}</dd>
              </div>
              <div className="settings-detail-field-list__item">
                <dt>{t("settingsPanel.themeDiagnostics.diagnostics.fields.target")}</dt>
                <dd>{diagnostic.component ?? diagnostic.tokenKey ?? diagnostic.themeId ?? t("settingsPanel.common.notAvailable")}</dd>
              </div>
              <div className="settings-detail-field-list__item">
                <dt>{t("settingsPanel.themeDiagnostics.diagnostics.fields.suggestion")}</dt>
                <dd>{diagnostic.suggestionKey ?? t("settingsPanel.common.notAvailable")}</dd>
              </div>
            </ChipsBox>
          </ChipsCardShell>
        </CardGridItem>
      ))}
    </CardGrid>
  );
}

function ThemeDiagnosticsSummary({ diagnostics }: { diagnostics: ThemeDiagnosticsViewModel }): React.ReactElement {
  const { t } = useI18n();
  return (
    <SummaryPanel
      ariaLabel={t("settingsPanel.themeDiagnostics.summary.ariaLabel")}
      main={
        <>
          <StatusBadge
            tone={statusTone(diagnostics.summary.status)}
            label={t(`settingsPanel.themeDiagnostics.status.${diagnostics.summary.status}`)}
          />
          <ChipsText as="strong" text={diagnostics.themeId} emphasis="strong" />
          <ChipsText as="p" text={t("settingsPanel.themeDiagnostics.summary.source", diagnostics.sources)} tone="muted" />
        </>
      }
      meta={
        <>
          <ChipsText
            as="span"
            text={`${t("settingsPanel.themeDiagnostics.fields.themeVersion")}: ${diagnostics.themeVersion}`}
            tone="muted"
          />
          <ChipsText
            as="span"
            text={`${t("settingsPanel.themeDiagnostics.fields.contractVersion")}: ${diagnostics.contractVersion}`}
            tone="muted"
          />
          <ChipsText
            as="span"
            text={`${t("settingsPanel.themeDiagnostics.fields.schemaVersion")}: ${diagnostics.schemaVersion}`}
            tone="muted"
          />
        </>
      }
    />
  );
}

function ThemeDiagnosticsMetrics({ diagnostics }: { diagnostics: ThemeDiagnosticsViewModel }): React.ReactElement {
  const { t } = useI18n();
  return (
    <CardGrid minItemSize="180px">
      <CardGridItem>
        <MetricCard
          label={t("settingsPanel.themeDiagnostics.metrics.requiredCoverage")}
          value={formatPercent(diagnostics.summary.requiredCoverage)}
          detail={t("settingsPanel.themeDiagnostics.metrics.requiredDetail", {
            missing: diagnostics.summary.missingRequiredTokenCount,
            total: diagnostics.summary.requiredTokenCount,
          })}
        />
      </CardGridItem>
      <CardGridItem>
        <MetricCard
          label={t("settingsPanel.themeDiagnostics.metrics.optionalCoverage")}
          value={formatPercent(diagnostics.summary.optionalCoverage)}
          detail={t("settingsPanel.themeDiagnostics.metrics.optionalDetail", {
            missing: diagnostics.summary.missingOptionalTokenCount,
            total: diagnostics.summary.optionalTokenCount,
          })}
        />
      </CardGridItem>
      <CardGridItem>
        <MetricCard
          label={t("settingsPanel.themeDiagnostics.metrics.components")}
          value={`${diagnostics.summary.coveredComponentCount}/${diagnostics.summary.componentCount}`}
          detail={t("settingsPanel.themeDiagnostics.metrics.componentsDetail")}
        />
      </CardGridItem>
      <CardGridItem>
        <MetricCard
          label={t("settingsPanel.themeDiagnostics.metrics.diagnostics")}
          value={diagnostics.summary.totalDiagnostics}
          detail={t("settingsPanel.themeDiagnostics.metrics.diagnosticsDetail", {
            blocking: diagnostics.summary.blockingDiagnostics,
          })}
        />
      </CardGridItem>
    </CardGrid>
  );
}

function ThemeDiagnosticsContent({ diagnostics }: { diagnostics: ThemeDiagnosticsViewModel }): React.ReactElement {
  const { t } = useI18n();

  return (
    <PageStack>
      <PageSection title={t("settingsPanel.themeDiagnostics.summary.ariaLabel")} titleId="theme-diagnostics-summary">
        <div className="settings-theme-diagnostics-summary-group">
          <ThemeDiagnosticsSummary diagnostics={diagnostics} />
          <ThemeDiagnosticsMetrics diagnostics={diagnostics} />
        </div>
      </PageSection>

      <PageSection title={t("settingsPanel.themeDiagnostics.chain.title")} titleId="theme-diagnostics-chain">
        <ThemeChain diagnostics={diagnostics} />
      </PageSection>

      <PageSection title={t("settingsPanel.themeDiagnostics.components.ariaLabel")} titleId="theme-diagnostics-components">
        <GovernanceList
          ariaLabel={t("settingsPanel.themeDiagnostics.components.ariaLabel")}
          columns={[
            { id: "component", label: t("settingsPanel.themeDiagnostics.components.columns.component"), width: "minmax(0, 2fr)" },
            { id: "coverage", label: t("settingsPanel.themeDiagnostics.components.columns.coverage"), width: "minmax(0, 1.2fr)" },
            { id: "tokens", label: t("settingsPanel.themeDiagnostics.components.columns.tokens"), width: "minmax(0, 1.4fr)" },
            { id: "status", label: t("settingsPanel.themeDiagnostics.components.columns.status"), width: "auto", align: "end" },
          ]}
        >
          {diagnostics.components.slice(0, 12).map((component) => (
            <GovernanceListRow key={component.id}>
              <GovernanceListCell label={t("settingsPanel.themeDiagnostics.components.columns.component")}>
                <div className="governance-item">
                  <div className="governance-item__title">{component.component}</div>
                  <div className="governance-item__summary">
                    {t("settingsPanel.themeDiagnostics.components.scope", { scope: component.scope })}
                  </div>
                </div>
              </GovernanceListCell>
              <GovernanceListCell label={t("settingsPanel.themeDiagnostics.components.columns.coverage")}>
                <span>{formatPercent(component.requiredCoverage)}</span>
              </GovernanceListCell>
              <GovernanceListCell label={t("settingsPanel.themeDiagnostics.components.columns.tokens")}>
                <div className="governance-meta">
                  <span>{t("settingsPanel.themeDiagnostics.components.requiredTokens", {
                    missing: component.missingRequiredTokenCount,
                    total: component.requiredTokenCount,
                  })}</span>
                  <span>{t("settingsPanel.themeDiagnostics.components.partsStates", {
                    parts: component.partsCount,
                    states: component.statesCount,
                  })}</span>
                </div>
              </GovernanceListCell>
              <GovernanceListCell label={t("settingsPanel.themeDiagnostics.components.columns.status")} align="end">
                <StatusBadge
                  tone={statusTone(component.status)}
                  label={t(`settingsPanel.themeDiagnostics.status.${component.status}`)}
                />
              </GovernanceListCell>
            </GovernanceListRow>
          ))}
        </GovernanceList>
      </PageSection>

      <PageSection title={t("settingsPanel.themeDiagnostics.diagnostics.title")} titleId="theme-diagnostics-diagnostics">
        <DiagnosticList diagnostics={diagnostics.diagnostics} />
      </PageSection>
    </PageStack>
  );
}

export function ThemeDiagnosticsPage(): React.ReactElement {
  const { t } = useI18n();
  const { diagnostics, loading, error, refresh } = useThemeDiagnostics();

  return (
    <PageFrame
      title={t("settingsPanel.themeDiagnostics.title")}
      actions={<ChipsButton onPress={() => void refresh()}>{t("settingsPanel.themeDiagnostics.actions.refresh")}</ChipsButton>}
    >
      <SectionStateBoundary
        loading={loading}
        error={error}
        loadingLabel={t("settingsPanel.themeDiagnostics.loading")}
        onRetry={() => {
          void refresh();
        }}
      >
        {diagnostics ? (
          <ThemeDiagnosticsContent diagnostics={diagnostics} />
        ) : (
          <ChipsEmptyState
            ariaLabel={t("settingsPanel.themeDiagnostics.empty.ariaLabel")}
            title={t("settingsPanel.themeDiagnostics.empty.title")}
            description={t("settingsPanel.themeDiagnostics.empty.description")}
          />
        )}
      </SectionStateBoundary>
    </PageFrame>
  );
}
