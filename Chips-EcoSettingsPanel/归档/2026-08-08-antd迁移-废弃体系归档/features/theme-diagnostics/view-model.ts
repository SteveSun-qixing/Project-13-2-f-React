import type {
  ResolvedTheme,
  ThemeContractComponentView,
  ThemeContractView,
  ThemeDiagnostic,
  ThemeDiagnosticSeverity,
  ThemeDiagnosticStatus,
} from "chips-sdk";

export interface ThemeDiagnosticsSummaryViewModel {
  status: ThemeDiagnosticStatus;
  totalDiagnostics: number;
  blockingDiagnostics: number;
  errorDiagnostics: number;
  warningDiagnostics: number;
  infoDiagnostics: number;
  componentCount: number;
  coveredComponentCount: number;
  requiredTokenCount: number;
  missingRequiredTokenCount: number;
  optionalTokenCount: number;
  missingOptionalTokenCount: number;
  requiredCoverage: number;
  optionalCoverage: number;
  tokenCount: number;
}

export interface ThemeChainEntryViewModel {
  id: string;
  displayName: string;
  version: string;
  order: number;
}

export interface ThemeComponentContractRowViewModel {
  id: string;
  component: string;
  scope: string;
  partsCount: number;
  statesCount: number;
  requiredTokenCount: number;
  missingRequiredTokenCount: number;
  optionalTokenCount: number;
  missingOptionalTokenCount: number;
  requiredCoverage: number;
  optionalCoverage: number;
  status: ThemeDiagnosticStatus;
  diagnosticsCount: number;
}

export interface ThemeDiagnosticRowViewModel {
  id: string;
  severity: ThemeDiagnosticSeverity;
  code: string;
  messageKey: string;
  blocking: boolean;
  themeId?: string;
  component?: string;
  tokenKey?: string;
  layer?: string;
  scope?: string;
  part?: string;
  state?: string;
  suggestionKey?: string;
}

export interface ThemeDiagnosticsViewModel {
  themeId: string;
  themeVersion: string;
  contractVersion: string;
  schemaVersion: string;
  summary: ThemeDiagnosticsSummaryViewModel;
  chain: ThemeChainEntryViewModel[];
  components: ThemeComponentContractRowViewModel[];
  diagnostics: ThemeDiagnosticRowViewModel[];
  sources: {
    contract: "client.theme.contract.get";
    resolve: "client.theme.resolve";
  };
}

function clampRatio(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function countTokenLeaves(value: unknown): number {
  if (!value || typeof value !== "object") {
    return value === undefined ? 0 : 1;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  return Object.values(value).reduce((total, child) => total + countTokenLeaves(child), 0);
}

function getStatusRank(status: ThemeDiagnosticStatus): number {
  if (status === "blocked") {
    return 0;
  }
  if (status === "warning") {
    return 1;
  }
  return 2;
}

function resolveOverallStatus(
  contractStatus: ThemeDiagnosticStatus,
  resolveStatus: ThemeDiagnosticStatus,
): ThemeDiagnosticStatus {
  return getStatusRank(contractStatus) < getStatusRank(resolveStatus) ? contractStatus : resolveStatus;
}

function toComponentRow(component: ThemeContractComponentView): ThemeComponentContractRowViewModel {
  return {
    id: `${component.scope}:${component.component}`,
    component: component.component,
    scope: component.scope,
    partsCount: component.parts.length,
    statesCount: component.states.length,
    requiredTokenCount: component.coverage.requiredTokenCount,
    missingRequiredTokenCount: component.coverage.missingRequiredTokenCount,
    optionalTokenCount: component.coverage.optionalTokenCount,
    missingOptionalTokenCount: component.coverage.missingOptionalTokenCount,
    requiredCoverage: clampRatio(component.coverage.requiredCoverage),
    optionalCoverage: clampRatio(component.coverage.optionalCoverage),
    status: component.coverage.status,
    diagnosticsCount: component.diagnostics.length,
  };
}

function toDiagnosticRow(diagnostic: ThemeDiagnostic, index: number): ThemeDiagnosticRowViewModel {
  return {
    id: [
      diagnostic.code,
      diagnostic.themeId ?? "theme",
      diagnostic.component ?? "runtime",
      diagnostic.tokenKey ?? index,
    ].join(":"),
    severity: diagnostic.severity,
    code: diagnostic.code,
    messageKey: diagnostic.messageKey,
    blocking: diagnostic.blocking,
    themeId: diagnostic.themeId,
    component: diagnostic.component,
    tokenKey: diagnostic.tokenKey,
    layer: diagnostic.layer,
    scope: diagnostic.scope,
    part: diagnostic.part,
    state: diagnostic.state,
    suggestionKey: diagnostic.suggestionKey,
  };
}

function uniqueDiagnostics(diagnostics: ThemeDiagnostic[]): ThemeDiagnostic[] {
  const seen = new Set<string>();
  const result: ThemeDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const key = JSON.stringify({
      code: diagnostic.code,
      severity: diagnostic.severity,
      blocking: diagnostic.blocking,
      themeId: diagnostic.themeId,
      component: diagnostic.component,
      tokenKey: diagnostic.tokenKey,
      messageKey: diagnostic.messageKey,
    });
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(diagnostic);
  }

  return result;
}

function countSeverity(diagnostics: ThemeDiagnostic[], severity: ThemeDiagnosticSeverity): number {
  return diagnostics.filter((diagnostic) => diagnostic.severity === severity).length;
}

export function createThemeDiagnosticsViewModel(
  contractView: ThemeContractView,
  resolvedTheme: ResolvedTheme,
): ThemeDiagnosticsViewModel {
  const coverage = contractView.summary.coverage ?? resolvedTheme.summary.coverage;
  const diagnostics = uniqueDiagnostics([
    ...resolvedTheme.diagnostics,
    ...contractView.components.flatMap((component) => component.diagnostics),
  ]);
  const componentRows = contractView.components
    .map((component) => toComponentRow(component))
    .sort((left, right) => {
      const statusDiff = getStatusRank(left.status) - getStatusRank(right.status);
      if (statusDiff !== 0) {
        return statusDiff;
      }
      const missingDiff = right.missingRequiredTokenCount - left.missingRequiredTokenCount;
      if (missingDiff !== 0) {
        return missingDiff;
      }
      return left.component.localeCompare(right.component, "zh-Hans-CN");
    });

  const status = resolveOverallStatus(contractView.summary.status, resolvedTheme.summary.status);
  const blockingDiagnostics = diagnostics.filter((diagnostic) => diagnostic.blocking).length;

  return {
    themeId: contractView.themeId,
    themeVersion: contractView.themeVersion,
    contractVersion: contractView.contractVersion,
    schemaVersion: contractView.schemaVersion,
    summary: {
      status,
      totalDiagnostics: diagnostics.length,
      blockingDiagnostics,
      errorDiagnostics: countSeverity(diagnostics, "error"),
      warningDiagnostics: countSeverity(diagnostics, "warning"),
      infoDiagnostics: countSeverity(diagnostics, "info"),
      componentCount: coverage?.componentCount ?? componentRows.length,
      coveredComponentCount: coverage?.coveredComponentCount ?? componentRows.filter((component) => component.status === "complete").length,
      requiredTokenCount: coverage?.requiredTokenCount ?? componentRows.reduce((total, component) => total + component.requiredTokenCount, 0),
      missingRequiredTokenCount: coverage?.missingRequiredTokenCount ?? componentRows.reduce(
        (total, component) => total + component.missingRequiredTokenCount,
        0,
      ),
      optionalTokenCount: coverage?.optionalTokenCount ?? componentRows.reduce((total, component) => total + component.optionalTokenCount, 0),
      missingOptionalTokenCount: coverage?.missingOptionalTokenCount ?? componentRows.reduce(
        (total, component) => total + component.missingOptionalTokenCount,
        0,
      ),
      requiredCoverage: clampRatio(coverage?.requiredCoverage),
      optionalCoverage: clampRatio(coverage?.optionalCoverage),
      tokenCount: countTokenLeaves(resolvedTheme.tokens),
    },
    chain: resolvedTheme.resolved.map((entry) => ({
      id: entry.id,
      displayName: entry.displayName,
      version: entry.version,
      order: entry.order,
    })),
    components: componentRows,
    diagnostics: diagnostics.map((diagnostic, index) => toDiagnosticRow(diagnostic, index)),
    sources: {
      contract: "client.theme.contract.get",
      resolve: "client.theme.resolve",
    },
  };
}
