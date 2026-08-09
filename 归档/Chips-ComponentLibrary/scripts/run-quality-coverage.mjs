import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHIPS_COMPONENT_QUALITY_MATRIX,
  assertA11yFixtureCoverage,
  assertComponentContractCoverage,
  assertComponentStatePriorityCoverage,
  assertContractAttrMatrixCoverage,
  assertThemeFallbackChain,
  createComponentMatrixReport,
  createThemeFallbackFixture
} from "../packages/testing/src/index.js";
import { validateComponentA11y } from "../packages/components/src/index.js";
import { writeStampedReport } from "./report-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractDir = path.join(root, "packages", "theme-contracts", "contracts", "components");
const reportsDir = path.join(root, "reports", "quality-gate");
const perfLatestPath = path.join(root, "reports", "perf", "perf-stage9-latest.json");
const CARD_RUNTIME_COMPONENTS = new Set(["card-cover-frame", "composite-card-window"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadContracts() {
  return fs.readdirSync(contractDir)
    .filter((fileName) => fileName.endsWith(".contract.json"))
    .sort()
    .map((fileName) => readJson(path.join(contractDir, fileName)));
}

function runGate(name, fn) {
  const startedAt = Date.now();
  try {
    const details = fn();
    return {
      name,
      status: "passed",
      durationMs: Date.now() - startedAt,
      details: details || {}
    };
  } catch (error) {
    return {
      name,
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: {
        message: error.message,
        code: error.code
      }
    };
  }
}

function validateCardRuntimeA11y(entry) {
  const failures = [];
  for (const fixture of entry.a11yFixtures || []) {
    const attrs = fixture.attrs || {};
    if (!attrs.title) {
      failures.push("iframe.title");
    }
    if (!attrs.sandbox) {
      failures.push("iframe.sandbox");
    }
  }
  if (failures.length > 0) {
    throw new Error(`CARD_RUNTIME_A11Y_FIXTURE_INVALID:${entry.component}:${failures.join(",")}`);
  }
  return true;
}

function validateRuntimeA11yFixtures(matrix) {
  const failures = [];
  for (const entry of matrix) {
    for (const fixture of entry.a11yFixtures || []) {
      try {
        if (CARD_RUNTIME_COMPONENTS.has(entry.component)) {
          validateCardRuntimeA11y(entry);
        } else {
          validateComponentA11y(entry.component, fixture.attrs || {});
        }
      } catch (error) {
        failures.push(`${entry.component}:${error.message}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`COMPONENT_RUNTIME_A11Y_COVERAGE_FAILED:${failures.join("|")}`);
  }

  return true;
}

function validateThemeFallbackFixture() {
  const fixture = createThemeFallbackFixture({
    global: {
      "chips.sys.color.surface": "global-surface",
      "chips.sys.color.text": "global-text"
    },
    app: {
      "chips.sys.color.surface": "app-surface"
    },
    component: {
      "chips.comp.button.root.surface.idle": "component-button"
    }
  });

  assertThemeFallbackChain(fixture, {
    "chips.comp.button.root.surface.idle": {
      scope: "component",
      value: "component-button"
    },
    "chips.sys.color.surface": {
      scope: "app",
      value: "app-surface"
    },
    "chips.sys.color.text": {
      scope: "global",
      value: "global-text"
    }
  });

  return {
    chain: ["component", "base-card", "composite-card", "box", "app", "global"],
    fixtureScopes: Object.keys(fixture)
  };
}

function loadPerfReport() {
  if (!fs.existsSync(perfLatestPath)) {
    throw new Error("QUALITY_COVERAGE_PERF_REPORT_MISSING");
  }
  return readJson(perfLatestPath);
}

function validatePerfSmokeCoverage(matrix) {
  const report = loadPerfReport();
  const expectedScenarios = [...new Set(matrix.flatMap((entry) => entry.perfSmokeScenarios || []))].sort();
  const actualScenarios = [...new Set((report.results || []).map((item) => item.name).filter(Boolean))].sort();
  const missing = expectedScenarios.filter((scenario) => !actualScenarios.includes(scenario));

  if (missing.length > 0) {
    throw new Error(`QUALITY_COVERAGE_PERF_SCENARIO_MISSING:${missing.join(",")}`);
  }
  if (report.summary?.passed !== true) {
    throw new Error("QUALITY_COVERAGE_PERF_SUMMARY_FAILED");
  }

  return {
    expectedScenarios,
    actualScenarios,
    thresholds: report.thresholds,
    summary: report.summary
  };
}

const startedAt = Date.now();
const generatedAt = new Date().toISOString();
const contracts = loadContracts();
const matrix = CHIPS_COMPONENT_QUALITY_MATRIX;
const gates = [
  runGate("component-contract-coverage", () => {
    assertComponentContractCoverage(contracts, matrix);
    return { contractCount: contracts.length, matrixCount: matrix.length };
  }),
  runGate("contract-attr-fixtures", () => {
    assertContractAttrMatrixCoverage(contracts, matrix);
    return { fixtureCount: matrix.length };
  }),
  runGate("a11y-fixtures", () => {
    assertA11yFixtureCoverage(contracts, matrix);
    validateRuntimeA11yFixtures(matrix);
    return { fixtureCount: matrix.reduce((sum, entry) => sum + entry.a11yFixtures.length, 0) };
  }),
  runGate("state-priority", () => {
    assertComponentStatePriorityCoverage(contracts, matrix);
    return { coveredComponentCount: contracts.length };
  }),
  runGate("theme-fallback-fixture", validateThemeFallbackFixture),
  runGate("perf-smoke-coverage", () => validatePerfSmokeCoverage(matrix))
];
const failed = gates.some((gate) => gate.status !== "passed");
const componentMatrix = createComponentMatrixReport(contracts, matrix, { generatedAt });
const report = {
  schemaVersion: "1.0.0",
  generatedAt,
  totalDurationMs: Date.now() - startedAt,
  status: failed ? "failed" : "passed",
  gates,
  componentMatrix
};

const { reportPath, latestPath } = writeStampedReport(reportsDir, "component-quality-coverage", report);
console.log(`[quality-coverage] report written: ${path.relative(root, reportPath)}`);
console.log(`[quality-coverage] latest report: ${path.relative(root, latestPath)}`);
console.log(`[quality-coverage] final status: ${report.status}`);

if (failed) {
  for (const gate of gates.filter((item) => item.status !== "passed")) {
    console.error(`[quality-coverage] ${gate.name} failed: ${gate.error?.message}`);
  }
  process.exit(1);
}
