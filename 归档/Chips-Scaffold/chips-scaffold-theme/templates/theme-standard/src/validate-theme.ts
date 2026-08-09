import fs from "node:fs/promises";
import path from "node:path";

interface ThemeTokenLayers {
  ref: Record<string, unknown>;
  sys: Record<string, unknown>;
  comp: Record<string, unknown>;
  motion: Record<string, unknown>;
  layout: Record<string, unknown>;
}

interface ThemeContract {
  schemaVersion?: string;
  version?: string;
  contractVersion?: string;
  components: Array<{
    component?: string;
    name?: string;
    scope: string;
    parts?: string[];
    states?: string[];
    requiredTokens?: string[];
    tokens?: string[];
    optionalTokens?: string[];
    a11yConstraints?: Array<Record<string, unknown>>;
    motionConstraints?: Array<Record<string, unknown>>;
  }>;
}

interface ThemeDiagnosticSummary {
  total: number;
  blocking: number;
  bySeverity: Record<"info" | "warning" | "error", number>;
  byCode: Record<string, number>;
  status: "complete" | "warning" | "blocked";
  coverage?: {
    componentCount: number;
    coveredComponentCount: number;
    requiredTokenCount: number;
    coveredRequiredTokenCount: number;
    missingRequiredTokenCount: number;
    optionalTokenCount: number;
    coveredOptionalTokenCount: number;
    missingOptionalTokenCount: number;
    requiredCoverage: number;
    optionalCoverage: number;
  };
}

interface ThemeContractView {
  schemaVersion: string;
  themeId: string;
  themeVersion: string;
  contractVersion: string;
  components: Array<{
    component: string;
    diagnostics: Array<Record<string, unknown>>;
    coverage: {
      status: "complete" | "warning" | "blocked";
      missingRequiredTokenCount: number;
    };
  }>;
  summary: ThemeDiagnosticSummary;
}

interface ThemeValidationResult {
  contract: ThemeContract;
  view: ThemeContractView;
}

type ThemeContractValidator = {
  buildThemeContractView: (
    contract: ThemeContract,
    tokenTree: Record<string, unknown>,
    options: { themeId: string; themeVersion: string }
  ) => ThemeContractView;
  compareThemeInterfaceContract: (
    themeContract: ThemeContract,
    componentContracts: ThemeContract["components"]
  ) => Array<Record<string, unknown>>;
  compareThemeMinFunctionalSet: (
    minFunctionalSet: Record<string, unknown>,
    componentContracts: ThemeContract["components"]
  ) => Array<Record<string, unknown>>;
  loadComponentContracts: (contractDir?: string) => ThemeContract["components"];
};

interface ThemeMinFunctionalSet {
  schemaVersion?: string;
  contractVersion?: string;
  requiredComponents: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const flattenLayer = (layer: Record<string, unknown>, prefix?: string): Record<string, unknown> => {
  const flat: Record<string, unknown> = {};
  const walk = (node: unknown, pathParts: string[]): void => {
    if (!isRecord(node)) {
      const key = pathParts.join(".");
      flat[key] = node;
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      walk(v, [...pathParts, k]);
    }
  };
  walk(layer, prefix ? [prefix] : []);
  return flat;
};

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
};

const mergeLayer = (base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const current = result[key];
    if (isRecord(current) && isRecord(value)) {
      result[key] = mergeLayer(current, value);
      continue;
    }
    result[key] = value;
  }
  return result;
};

const assertThemeTokenLayers = (parsed: ThemeTokenLayers): void => {
  for (const layer of ["ref", "sys", "comp", "motion", "layout"] as const) {
    if (!isRecord(parsed[layer])) {
      throw new Error(`THEME_TOKENS_INVALID:${layer}`);
    }
  }
};

export const flattenThemeTokenLayers = (tokens: ThemeTokenLayers): Record<string, unknown> => {
  assertThemeTokenLayers(tokens);
  return {
    ...flattenLayer(tokens.ref),
    ...flattenLayer(tokens.sys),
    ...flattenLayer(tokens.comp),
    ...flattenLayer(tokens.motion),
    ...flattenLayer(tokens.layout)
  };
};

export const buildContractTokenTree = (tokens: ThemeTokenLayers): Record<string, unknown> => {
  assertThemeTokenLayers(tokens);
  return [tokens.ref, tokens.sys, tokens.motion, tokens.layout, tokens.comp].reduce<Record<string, unknown>>(
    (merged, layer) => mergeLayer(merged, layer),
    {}
  );
};

const readManifestField = async (projectRoot: string, field: "themeId" | "version"): Promise<string> => {
  const raw = await fs.readFile(path.join(projectRoot, "manifest.yaml"), "utf-8");
  const match = raw.match(new RegExp(`^${field}:\\\\s*\"?([^\"\\n]+)\"?`, "m"));
  return match?.[1]?.trim() ?? "unknown";
};

const loadThemeContractValidator = async (): Promise<ThemeContractValidator> => {
  return import("@chips/theme-contracts") as Promise<ThemeContractValidator>;
};

const assertGeneratedContractsMatchComponentLibrary = (
  validator: ThemeContractValidator,
  contract: ThemeContract,
  minFunctionalSet: ThemeMinFunctionalSet,
  componentContracts: ThemeContract["components"]
): void => {
  const interfaceFailures = validator.compareThemeInterfaceContract(contract, componentContracts);
  const minFunctionalSetFailures = validator.compareThemeMinFunctionalSet(minFunctionalSet, componentContracts);

  if (interfaceFailures.length > 0 || minFunctionalSetFailures.length > 0) {
    throw new Error(
      `THEME_CONTRACT_SOURCE_DRIFT:${JSON.stringify({ interfaceFailures, minFunctionalSetFailures }, null, 2)}`
    );
  }
};

export const validateTheme = async (projectRoot = process.cwd()): Promise<ThemeValidationResult> => {
  const [tokens, contract, minFunctionalSet, themeId, themeVersion, validator] = await Promise.all([
    readJson<ThemeTokenLayers>(path.join(projectRoot, "dist", "tokens.json")),
    readJson<ThemeContract>(path.join(projectRoot, "contracts", "theme-interface.contract.json")),
    readJson<ThemeMinFunctionalSet>(path.join(projectRoot, "contracts", "theme-min-functional-set.json")),
    readManifestField(projectRoot, "themeId"),
    readManifestField(projectRoot, "version"),
    loadThemeContractValidator()
  ]);
  const componentContracts = validator.loadComponentContracts();
  assertGeneratedContractsMatchComponentLibrary(validator, contract, minFunctionalSet, componentContracts);

  const view = validator.buildThemeContractView(contract, buildContractTokenTree(tokens), {
    themeId,
    themeVersion
  });

  return { contract, view };
};

const main = async (): Promise<void> => {
  try {
    const result = await validateTheme();
    const diagnostics = result.view.components.flatMap((component) => component.diagnostics);

    if (result.view.summary.blocking > 0) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            message: "Theme validation failed. Required component contract tokens are missing.",
            summary: result.view.summary,
            diagnostics
          },
          null,
          2
        )
      );
      process.exitCode = 1;
      return;
    }

    // eslint-disable-next-line no-console
    console.log(
      `Theme contract validation passed: ${result.view.summary.coverage?.componentCount ?? 0} components, ` +
        `${result.view.summary.coverage?.requiredTokenCount ?? 0} required tokens.`
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
};

if (require.main === module) {
  void main();
}
