import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  applyDataGridSort,
  computeVirtualWindow,
  filterCommandPaletteItems
} from "../packages/components/src/index.js";
import { applyThemeVariablesInBatches } from "../packages/hooks/src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportsDir = path.join(root, "reports", "perf");
fs.mkdirSync(reportsDir, { recursive: true });

function percentile(samples, ratio) {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return sorted[index];
}

function buildRows(size) {
  return Array.from({ length: size }, (_, index) => ({
    id: `row-${index}`,
    order: size - index,
    title: `Title ${index}`
  }));
}

function buildCommands(size) {
  return Array.from({ length: size }, (_, index) => ({
    id: `cmd-${index}`,
    label: `Action ${index}`,
    shortcut: index % 2 === 0 ? "Cmd+Shift+P" : "Cmd+P",
    keywords: ["open", "card", `tag-${index % 12}`]
  }));
}

function measureSync(name, fn, iterations = 200, warmup = 20) {
  for (let index = 0; index < warmup; index += 1) {
    fn();
  }

  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }

  return {
    name,
    iterations,
    averageMs: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(4)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(4)),
    maxMs: Number(Math.max(...samples).toFixed(4)),
    longTaskRatio: Number((samples.filter((value) => value > 50).length / samples.length).toFixed(4))
  };
}

async function measureThemeSwitch(iterations = 20) {
  const sourceVariables = {};
  for (let index = 0; index < 1800; index += 1) {
    sourceVariables[`chips.comp.test.key-${index}`] = `#${String(index % 999999).padStart(6, "0")}`;
  }

  const target = {
    style: {
      setProperty() {}
    }
  };

  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    await applyThemeVariablesInBatches(target, sourceVariables, { chunkSize: 240 });
    samples.push(performance.now() - startedAt);
  }

  return {
    name: "theme-switch-visible",
    iterations,
    averageMs: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(4)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(4)),
    maxMs: Number(Math.max(...samples).toFixed(4)),
    longTaskRatio: Number((samples.filter((value) => value > 50).length / samples.length).toFixed(4))
  };
}

const rows = buildRows(5000);
const commands = buildCommands(4000);

const results = [
  measureSync("render-submit:data-grid-sort", () =>
    applyDataGridSort(rows, { key: "order", direction: "asc" })
  ),
  measureSync("render-submit:command-filter", () =>
    filterCommandPaletteItems(commands, "shift")
  ),
  measureSync("render-submit:virtual-window", () =>
    computeVirtualWindow({
      itemCount: 12000,
      itemHeight: 32,
      viewportHeight: 640,
      scrollTop: 4480,
      overscan: 8
    })
  ),
  await measureThemeSwitch()
];

const renderP95Max = Math.max(
  results[0].p95Ms,
  results[1].p95Ms,
  results[2].p95Ms
);
const themeP95 = results[3].p95Ms;
const longTaskRatio = Number(
  (
    results.reduce((sum, item) => sum + item.longTaskRatio, 0) /
    results.length
  ).toFixed(4)
);

const thresholds = {
  renderSubmitP95MaxMs: 32,
  themeSwitchVisibleP95Ms: 150,
  longTaskRatioMax: 0.05
};

const summary = {
  renderSubmitP95MaxMs: renderP95Max,
  themeSwitchVisibleP95Ms: themeP95,
  longTaskRatio,
  passed:
    renderP95Max <= thresholds.renderSubmitP95MaxMs &&
    themeP95 <= thresholds.themeSwitchVisibleP95Ms &&
    longTaskRatio <= thresholds.longTaskRatioMax
};

const report = {
  generatedAt: new Date().toISOString(),
  thresholds,
  summary,
  results
};

const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
const reportPath = path.join(reportsDir, `perf-stage9-${stamp}.json`);
const latestPath = path.join(reportsDir, "perf-stage9-latest.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));

console.log(`[perf] report written: ${path.relative(root, reportPath)}`);
console.log(
  `[perf] render p95 max=${renderP95Max}ms, theme p95=${themeP95}ms, longTaskRatio=${longTaskRatio}`
);

if (!summary.passed) {
  console.error("[perf] threshold check failed");
  process.exit(1);
}
