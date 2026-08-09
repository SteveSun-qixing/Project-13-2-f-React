import path from "node:path";
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { buildContractTokenTree, validateTheme } from "../src/validate-theme";
import { buildContracts } from "../src/build-contracts";

interface ComponentContract {
  component: string;
  scope: string;
  parts: string[];
  states: string[];
  tokens?: string[];
  requiredTokens?: string[];
  optionalTokens?: string[];
  a11yConstraints?: Array<Record<string, unknown>>;
  motionConstraints?: Array<{ tokenKeys?: string[] } & Record<string, unknown>>;
  iframe?: Record<string, unknown>;
}

const sortedUnique = (values: string[] = []): string[] => [...new Set(values)].sort();

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;

const loadComponentLibraryContracts = async (): Promise<Map<string, ComponentContract>> => {
  const { loadComponentContracts } = await import("@chips/theme-contracts");
  return new Map(
    (loadComponentContracts() as ComponentContract[])
      .sort((left, right) => left.component.localeCompare(right.component))
      .map((contract) => [contract.component, contract])
  );
};

const motionConstraintTokens = (contract: ComponentContract): string[] =>
  (contract.motionConstraints ?? []).flatMap((constraint) => constraint.tokenKeys ?? []);

const normalizeRequiredTokens = (contract: ComponentContract): string[] =>
  sortedUnique([...(contract.requiredTokens ?? contract.tokens ?? []), ...motionConstraintTokens(contract)]);

const loadMinFunctionalSet = (projectRoot: string): { requiredComponents: string[] } => {
  return readJson<{ requiredComponents: string[] }>(
    path.join(projectRoot, "contracts", "theme-min-functional-set.json")
  );
};

describe("theme contract", () => {
  it("passes the full component-library contract baseline", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const result = await validateTheme(projectRoot);
    const expectedContracts = await loadComponentLibraryContracts();

    expect(result.contract.components).toHaveLength(expectedContracts.size);
    expect(result.view.summary.status).toBe("complete");
    expect(result.view.summary.blocking).toBe(0);
    expect(result.view.summary.coverage?.componentCount).toBe(expectedContracts.size);
    expect(result.view.summary.coverage?.requiredCoverage).toBe(1);
    expect(result.contract.components.some((component) => component.component === "image")).toBe(true);
    expect(result.contract.components.some((component) => component.component === "media")).toBe(true);
    expect(result.contract.components.some((component) => component.component === "error-state")).toBe(true);
    expect(result.contract.components.some((component) => component.component === "form")).toBe(true);
    expect(result.contract.components.some((component) => component.component === "navigation-split-view")).toBe(true);
    expect(result.contract.components.some((component) => component.component === "form-field")).toBe(false);
    expect(result.contract.components.some((component) => component.component === "form-group")).toBe(false);
    expect(result.view.components.every((component) => component.coverage.status === "complete")).toBe(true);
  });

  it("keeps generated theme contract equal to component-library contracts", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const result = await validateTheme(projectRoot);
    const expectedContracts = await loadComponentLibraryContracts();

    expect(result.contract.components.map((component) => component.component).sort()).toEqual(
      [...expectedContracts.keys()].sort()
    );

    for (const themeComponent of result.contract.components) {
      const expected = expectedContracts.get(themeComponent.component ?? themeComponent.scope);
      expect(expected, `missing component-library contract for ${themeComponent.component}`).toBeTruthy();
      expect(themeComponent.scope).toBe(expected?.scope);
      expect(sortedUnique(themeComponent.parts)).toEqual(sortedUnique(expected?.parts));
      expect(sortedUnique(themeComponent.states)).toEqual(sortedUnique(expected?.states));
      expect(normalizeRequiredTokens(themeComponent)).toEqual(normalizeRequiredTokens(expected as ComponentContract));
      expect(sortedUnique(themeComponent.optionalTokens)).toEqual(sortedUnique(expected?.optionalTokens));
      expect(themeComponent.a11yConstraints ?? []).toEqual(expected?.a11yConstraints ?? []);
      expect(themeComponent.motionConstraints ?? []).toEqual(expected?.motionConstraints ?? []);
      expect(themeComponent.iframe).toEqual(expected?.iframe);
    }
  });

  it("keeps min functional set generated from component-library contracts", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const expectedContracts = await loadComponentLibraryContracts();
    const minFunctionalSet = loadMinFunctionalSet(projectRoot);

    expect(sortedUnique(minFunctionalSet.requiredComponents)).toEqual([...expectedContracts.keys()].sort());
  });

  it("generates contract artifacts from component-library source of truth", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const expectedContracts = await loadComponentLibraryContracts();
    const { interfaceContract, minFunctionalSet } = await buildContracts(projectRoot);

    expect(interfaceContract.components).toHaveLength(expectedContracts.size);
    expect(interfaceContract.components.map((component) => component.component).sort()).toEqual(
      [...expectedContracts.keys()].sort()
    );
    expect(interfaceContract.components.find((component) => component.component === "card-cover-frame")?.iframe).toEqual(
      expectedContracts.get("card-cover-frame")?.iframe
    );
    expect(minFunctionalSet.requiredComponents).toEqual([...expectedContracts.keys()].sort());
  });

  it("emits the frozen diagnostic schema for missing required tokens", async () => {
    const projectRoot = path.resolve(__dirname, "..");
    const result = await validateTheme(projectRoot);
    const button = result.contract.components.find((component) => component.component === "button");
    expect(button).toBeTruthy();

    const tokenTree = buildContractTokenTree({
      ref: {},
      sys: {},
      comp: {},
      motion: {},
      layout: {}
    });
    const { buildThemeContractView } = await import("@chips/theme-contracts");
    const view = buildThemeContractView(
      { schemaVersion: "1.0.0", contractVersion: "1.0.0", components: [button] },
      tokenTree,
      { themeId: "{{themeId}}", themeVersion: "{{version}}" }
    );
    const diagnostic = view.components[0]?.diagnostics[0];

    expect(view.summary.status).toBe("blocked");
    expect(diagnostic).toMatchObject({
      severity: "error",
      code: "THEME_REQUIRED_TOKEN_MISSING",
      messageKey: "theme.diagnostics.requiredTokenMissing",
      component: "button",
      tokenKey: "chips.comp.button.root.radius",
      layer: "comp",
      scope: "component",
      blocking: true
    });
  });
});
