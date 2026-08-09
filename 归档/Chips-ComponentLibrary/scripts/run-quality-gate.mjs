import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeStampedReport } from "./report-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportsDir = path.join(root, "reports", "quality-gate");
fs.mkdirSync(reportsDir, { recursive: true });

const steps = [
  { name: "lint", command: process.execPath, args: ["scripts/run-lint.mjs"] },
  { name: "typecheck", command: process.execPath, args: ["scripts/run-typecheck.mjs"] },
  { name: "test:types", command: "npm", args: ["run", "test:types"] },
  { name: "test", command: "npm", args: ["run", "test"] },
  { name: "test:contracts", command: "npm", args: ["run", "test:contracts"] },
  { name: "test:a11y", command: process.execPath, args: ["scripts/run-a11y-tests.mjs"] },
  { name: "test:perf", command: process.execPath, args: ["scripts/run-perf-tests.mjs"] },
  { name: "quality:coverage", command: process.execPath, args: ["scripts/run-quality-coverage.mjs"] },
  { name: "build", command: "npm", args: ["run", "build"] }
];

function runStep(step) {
  const startedAt = Date.now();
  const result = spawnSync(step.command, step.args, {
    cwd: root,
    encoding: "utf8"
  });

  return {
    name: step.name,
    command: [step.command, ...step.args].join(" "),
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    durationMs: Date.now() - startedAt,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

const startedAt = Date.now();
const results = [];
let failed = false;

for (const step of steps) {
  if (failed) {
    results.push({
      name: step.name,
      command: [step.command, ...step.args].join(" "),
      status: "skipped",
      exitCode: null,
      durationMs: 0,
      stdout: "",
      stderr: ""
    });
    continue;
  }

  const stepResult = runStep(step);
  results.push(stepResult);
  process.stdout.write(stepResult.stdout);
  process.stderr.write(stepResult.stderr);

  if (stepResult.status !== "passed") {
    failed = true;
  }
}

const report = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  totalDurationMs: Date.now() - startedAt,
  status: failed ? "failed" : "passed",
  summary: {
    stepCount: results.length,
    passedCount: results.filter((item) => item.status === "passed").length,
    failedCount: results.filter((item) => item.status === "failed").length,
    skippedCount: results.filter((item) => item.status === "skipped").length,
    blockingStep: results.find((item) => item.status === "failed")?.name || null
  },
  steps: results.map((item) => ({
    name: item.name,
    command: item.command,
    status: item.status,
    exitCode: item.exitCode,
    durationMs: item.durationMs
  }))
};

const { reportPath } = writeStampedReport(reportsDir, "quality-gate", report);

console.log(`[quality-gate] report written: ${path.relative(root, reportPath)}`);
console.log(`[quality-gate] final status: ${report.status}`);

if (failed) {
  process.exit(1);
}
