import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/app/providers/I18nProvider", () => ({
  useI18n() {
    return {
      t(key: string, params?: Record<string, string | number>) {
        if (!params) {
          return key;
        }
        return `${key}:${JSON.stringify(params)}`;
      },
    };
  },
}));

vi.mock("../../src/features/theme-diagnostics/useThemeDiagnostics", () => ({
  useThemeDiagnostics() {
    return {
      loading: false,
      error: null,
      refresh: async () => undefined,
      diagnostics: {
        themeId: "chips.theme-demo",
        themeVersion: "1.0.0",
        contractVersion: "1.0.0",
        schemaVersion: "1.0.0",
        summary: {
          status: "warning",
          totalDiagnostics: 1,
          blockingDiagnostics: 0,
          errorDiagnostics: 0,
          warningDiagnostics: 1,
          infoDiagnostics: 0,
          componentCount: 1,
          coveredComponentCount: 1,
          requiredTokenCount: 2,
          missingRequiredTokenCount: 0,
          optionalTokenCount: 1,
          missingOptionalTokenCount: 1,
          requiredCoverage: 1,
          optionalCoverage: 0,
          tokenCount: 3,
        },
        chain: [{ id: "chips.theme-demo", displayName: "Theme Demo", version: "1.0.0", order: 0 }],
        components: [
          {
            id: "button:Button",
            component: "Button",
            scope: "button",
            partsCount: 2,
            statesCount: 3,
            requiredTokenCount: 2,
            missingRequiredTokenCount: 0,
            optionalTokenCount: 1,
            missingOptionalTokenCount: 1,
            requiredCoverage: 1,
            optionalCoverage: 0,
            status: "warning",
            diagnosticsCount: 1,
          },
        ],
        diagnostics: [
          {
            id: "warning",
            severity: "warning",
            code: "THEME_OPTIONAL_TOKEN_MISSING",
            messageKey: "chips.theme.optionalTokenMissing",
            blocking: false,
            component: "Button",
            tokenKey: "chips.comp.button.root.shadow.idle",
          },
        ],
        sources: {
          contract: "client.theme.contract.get",
          resolve: "client.theme.resolve",
        },
      },
    };
  },
}));

describe("ThemeDiagnosticsPage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders active theme contract and resolve diagnostics from the view model", async () => {
    const { ThemeDiagnosticsPage } = await import("../../src/features/theme-diagnostics/ThemeDiagnosticsPage");
    const markup = renderToStaticMarkup(<ThemeDiagnosticsPage />);

    expect(markup).toContain("settingsPanel.themeDiagnostics.title");
    expect(markup).not.toContain("settingsPanel.themeDiagnostics.subtitle");
    expect(markup).toContain("chips.theme-demo");
    expect(markup).toContain("client.theme.contract.get");
    expect(markup).toContain("client.theme.resolve");
    expect(markup).toContain("THEME_OPTIONAL_TOKEN_MISSING");
    expect(markup).toContain("settings-summary-panel");
    expect(markup).toContain("settings-metric-card__value");
    expect(markup).toContain("settings-chain-item");
    expect(markup).toContain("theme-diagnostics-components");
    expect(markup).toContain("data-scope=\"data-grid\"");
    expect(markup).toContain("settings-governance-list");
    expect(markup).not.toContain("diagnostics-page");
    expect(markup).not.toContain("diagnostics-hero");
    expect(markup).not.toContain("metric-grid");
  });
});
