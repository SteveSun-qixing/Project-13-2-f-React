import { describe, expect, it } from "vitest";
import { createThemeDiagnosticsViewModel } from "../../src/features/theme-diagnostics/view-model";

describe("theme diagnostics view model", () => {
  it("merges contract and resolve diagnostics without scanning theme files", () => {
    const viewModel = createThemeDiagnosticsViewModel(
      {
        schemaVersion: "1.0.0",
        themeId: "chips.theme-demo",
        themeVersion: "1.0.0",
        contractVersion: "1.0.0",
        components: [
          {
            component: "Button",
            scope: "button",
            parts: ["root", "label"],
            states: ["idle"],
            requiredTokens: ["chips.comp.button.root.surface.idle"],
            optionalTokens: [],
            a11yConstraints: [],
            motionConstraints: [],
            coverage: {
              requiredTokenCount: 1,
              coveredRequiredTokenCount: 0,
              missingRequiredTokenCount: 1,
              optionalTokenCount: 0,
              coveredOptionalTokenCount: 0,
              missingOptionalTokenCount: 0,
              requiredCoverage: 0,
              optionalCoverage: 1,
              status: "blocked",
            },
            diagnostics: [
              {
                severity: "error",
                code: "THEME_REQUIRED_TOKEN_MISSING",
                messageKey: "chips.theme.requiredTokenMissing",
                component: "Button",
                tokenKey: "chips.comp.button.root.surface.idle",
                blocking: true,
              },
            ],
          },
        ],
        summary: {
          total: 1,
          blocking: 1,
          bySeverity: { info: 0, warning: 0, error: 1 },
          byCode: { THEME_REQUIRED_TOKEN_MISSING: 1 },
          status: "blocked",
          coverage: {
            componentCount: 1,
            coveredComponentCount: 0,
            requiredTokenCount: 1,
            coveredRequiredTokenCount: 0,
            missingRequiredTokenCount: 1,
            optionalTokenCount: 0,
            coveredOptionalTokenCount: 0,
            missingOptionalTokenCount: 0,
            requiredCoverage: 0,
            optionalCoverage: 1,
          },
        },
      },
      {
        resolved: [{ id: "chips.theme-demo", displayName: "Theme Demo", version: "1.0.0", order: 0 }],
        tokens: { chips: { sys: { color: { surface: "#fff" } } } },
        diagnostics: [],
        summary: {
          total: 0,
          blocking: 0,
          bySeverity: { info: 0, warning: 0, error: 0 },
          byCode: {},
          status: "complete",
        },
      },
    );

    expect(viewModel.themeId).toBe("chips.theme-demo");
    expect(viewModel.summary.status).toBe("blocked");
    expect(viewModel.summary.missingRequiredTokenCount).toBe(1);
    expect(viewModel.components[0]).toMatchObject({
      component: "Button",
      status: "blocked",
      missingRequiredTokenCount: 1,
    });
    expect(viewModel.chain).toEqual([
      { id: "chips.theme-demo", displayName: "Theme Demo", version: "1.0.0", order: 0 },
    ]);
    expect(viewModel.sources).toEqual({
      contract: "client.theme.contract.get",
      resolve: "client.theme.resolve",
    });
  });
});
