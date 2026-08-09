import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeStampedReport } from "./report-utils.mjs";

function parseArgs(argv) {
  const args = { report: null };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--report") {
      args.report = argv[index + 1] || null;
      index += 1;
    }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isValidStatus(value) {
  return ["pending", "passed", "failed", "blocked"].includes(value);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));

if (!args.report) {
  console.error("[ecosystem-acceptance] missing required argument: --report <path>");
  process.exit(1);
}

const reportPath = path.resolve(root, args.report);
if (!fs.existsSync(reportPath)) {
  console.error(`[ecosystem-acceptance] report not found: ${reportPath}`);
  process.exit(1);
}

const data = readJson(reportPath);
const checks = [];

checks.push({
  name: "stage",
  passed: data.stage === "stage10",
  details: data.stage || null
});

checks.push({
  name: "status",
  passed: isValidStatus(data.status),
  details: data.status || null
});

const scenarioNames = ["settings-panel-plugin", "card-editor-plugin", "card-viewer-plugin"];
const scenarios = Array.isArray(data.scenarios) ? data.scenarios : [];

for (const requiredName of scenarioNames) {
  const scenario = scenarios.find((item) => item && item.name === requiredName);
  checks.push({
    name: `scenario:${requiredName}`,
    passed: Boolean(scenario),
    details: scenario ? scenario.status : null
  });

  if (scenario) {
    checks.push({
      name: `scenario:${requiredName}:status`,
      passed: isValidStatus(scenario.status),
      details: scenario.status
    });
  }
}

checks.push({
  name: "blockingTickets",
  passed: Array.isArray(data.blockingTickets),
  details: Array.isArray(data.blockingTickets) ? data.blockingTickets.length : null
});

const failed = checks.filter((item) => item.passed !== true);
const result = {
  generatedAt: new Date().toISOString(),
  sourceReport: reportPath,
  status: failed.length === 0 ? "passed" : "failed",
  checks
};

const written = writeStampedReport(path.join(root, "reports", "ecosystem"), "ecosystem-acceptance-verify", result);

console.log(`[ecosystem-acceptance] source=${path.relative(root, reportPath)}`);
console.log(`[ecosystem-acceptance] checks=${checks.length}, failed=${failed.length}`);
console.log(`[ecosystem-acceptance] report=${path.relative(root, written.reportPath)}`);

if (failed.length > 0) {
  process.exit(1);
}
