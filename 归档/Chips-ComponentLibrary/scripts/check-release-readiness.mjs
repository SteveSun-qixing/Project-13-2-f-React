import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeStampedReport } from "./report-utils.mjs";

function parseArgs(argv) {
  const args = {
    bundle: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--bundle") {
      args.bundle = argv[index + 1] || null;
      index += 1;
    }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));

if (!args.bundle) {
  console.error("[release] missing required argument: --bundle <path>");
  process.exit(1);
}

const bundlePath = path.resolve(root, args.bundle);
if (!fs.existsSync(bundlePath)) {
  console.error(`[release] release bundle not found: ${bundlePath}`);
  process.exit(1);
}

const bundle = readJson(bundlePath);
const packageJson = readJson(path.join(root, "package.json"));
const qualityGatePath = path.join(root, "reports", "quality-gate", "quality-gate-latest.json");
const perfPath = path.join(root, "reports", "perf", "perf-stage9-latest.json");

const checks = [];
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

checks.push({
  name: "bundle.version",
  passed: typeof bundle.version === "string" && semverPattern.test(bundle.version),
  details: bundle.version || null
});

checks.push({
  name: "bundle.releaseType",
  passed: ["major", "minor", "patch"].includes(bundle.releaseType),
  details: bundle.releaseType || null
});

checks.push({
  name: "bundle.changeLog",
  passed: typeof bundle.changeLog === "string" && bundle.changeLog.trim().length > 0,
  details: bundle.changeLog || null
});

checks.push({
  name: "bundle.compatibility",
  passed: typeof bundle.compatibility === "string" && bundle.compatibility.trim().length > 0,
  details: bundle.compatibility || null
});

checks.push({
  name: "bundle.rollback",
  passed: typeof bundle.rollback === "string" && bundle.rollback.trim().length > 0,
  details: bundle.rollback || null
});

if (typeof bundle.changeLog === "string") {
  const changeLogPath = path.resolve(root, bundle.changeLog);
  checks.push({
    name: "bundle.changeLog.fileExists",
    passed: fs.existsSync(changeLogPath),
    details: bundle.changeLog
  });
}

if (typeof bundle.rollback === "string") {
  const rollbackPath = path.resolve(root, bundle.rollback);
  checks.push({
    name: "bundle.rollback.fileExists",
    passed: fs.existsSync(rollbackPath),
    details: bundle.rollback
  });
}

checks.push({
  name: "package.version.match",
  passed: typeof bundle.version === "string" && bundle.version === packageJson.version,
  details: `${bundle.version || "unknown"} vs ${packageJson.version || "unknown"}`
});

let qualityGate = null;
if (fs.existsSync(qualityGatePath)) {
  qualityGate = readJson(qualityGatePath);
  checks.push({
    name: "quality-gate.status",
    passed: qualityGate.status === "passed",
    details: qualityGate.status || null
  });
} else {
  checks.push({
    name: "quality-gate.report",
    passed: false,
    details: qualityGatePath
  });
}

let perf = null;
if (fs.existsSync(perfPath)) {
  perf = readJson(perfPath);
  checks.push({
    name: "perf.summary.passed",
    passed: perf.summary && perf.summary.passed === true,
    details: perf.summary || null
  });
} else {
  checks.push({
    name: "perf.report",
    passed: false,
    details: perfPath
  });
}

const failed = checks.filter((item) => item.passed !== true);
const report = {
  generatedAt: new Date().toISOString(),
  bundlePath,
  status: failed.length === 0 ? "passed" : "failed",
  checks,
  qualityGatePath: fs.existsSync(qualityGatePath) ? qualityGatePath : null,
  perfPath: fs.existsSync(perfPath) ? perfPath : null
};

const written = writeStampedReport(path.join(root, "reports", "release"), "release-readiness", report);

console.log(`[release] bundle=${path.relative(root, bundlePath)}`);
console.log(`[release] checks=${checks.length}, failed=${failed.length}`);
console.log(`[release] report=${path.relative(root, written.reportPath)}`);

if (failed.length > 0) {
  for (const item of failed) {
    console.error(`[release] failed: ${item.name}`);
  }
  process.exit(1);
}
