import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateTheme } from "../src/validate-theme";

interface ThemeMatrix {
  schemaVersion: string;
  themeId: string;
  themeVersion: string;
  scenarios: Array<{
    id: string;
    surface: string;
    hostApis: string[];
    requiredCssAssets: string[];
    tokenScopes: string[];
    contractScopes: string[];
    assertions: string[];
  }>;
}

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;

describe("theme preview matrix", () => {
  it("documents default theme runtime surfaces against real contract scopes", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const matrix = readJson<ThemeMatrix>(path.join(projectRoot, "preview", "theme-matrix.json"));
    const validation = await validateTheme(projectRoot);
    const contractScopes = new Set(validation.contract.components.map((component) => component.scope));

    expect(matrix.schemaVersion).toBe("1.0.0");
    expect(matrix.themeId).toBe("chips-official.default-theme");
    expect(matrix.scenarios.map((scenario) => scenario.id).sort()).toEqual([
      "app-plugin-window",
      "base-card-iframe",
      "box-layout-iframe",
      "module-config-panel"
    ]);

    for (const scenario of matrix.scenarios) {
      expect(scenario.hostApis.length).toBeGreaterThan(0);
      expect(scenario.requiredCssAssets).toContain("dist/theme.css");
      expect(scenario.assertions.length).toBeGreaterThan(0);
      for (const scope of scenario.contractScopes) {
        expect(contractScopes.has(scope), `${scenario.id} references unknown scope ${scope}`).toBe(true);
      }
    }
  });
});
