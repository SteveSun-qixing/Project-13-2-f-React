import { performance } from "node:perf_hooks";
import {
  applyDataGridSort,
  clampSplitRatio,
  computeVirtualWindow,
  filterCommandPaletteItems,
  flattenTreeNodes,
  resolveDockPanelStateMap,
  toggleInspectorSection
} from "../packages/components/src/index.js";

function runBenchmark(name, fn, options = {}) {
  const warmup = Number.isInteger(options.warmup) ? options.warmup : 50;
  const iterations = Number.isInteger(options.iterations) ? options.iterations : 500;
  const samples = [];

  for (let index = 0; index < warmup; index += 1) {
    fn();
  }

  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    fn();
    const end = performance.now();
    samples.push(end - start);
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = sorted[p95Index];
  const max = sorted[sorted.length - 1];

  return {
    name,
    warmup,
    iterations,
    averageMs: Number(average.toFixed(4)),
    p95Ms: Number(p95.toFixed(4)),
    maxMs: Number(max.toFixed(4))
  };
}

function createRows(size) {
  return Array.from({ length: size }, (_, index) => ({
    id: `row-${index}`,
    order: size - index,
    name: `Card ${index}`
  }));
}

function createTree() {
  return Array.from({ length: 120 }, (_, rootIndex) => ({
    id: `root-${rootIndex}`,
    label: `Root ${rootIndex}`,
    children: Array.from({ length: 12 }, (_, childIndex) => ({
      id: `root-${rootIndex}-child-${childIndex}`,
      label: `Child ${childIndex}`,
      children: Array.from({ length: 3 }, (_, leafIndex) => ({
        id: `root-${rootIndex}-child-${childIndex}-leaf-${leafIndex}`,
        label: `Leaf ${leafIndex}`
      }))
    }))
  }));
}

function createCommandItems(size) {
  return Array.from({ length: size }, (_, index) => ({
    id: `cmd-${index}`,
    label: `Action ${index}`,
    shortcut: index % 2 === 0 ? "Cmd+Shift+P" : "Cmd+P",
    keywords: ["card", "render", `tag-${index % 10}`]
  }));
}

function createDockPanels(size) {
  return Array.from({ length: size }, (_, index) => ({
    id: `panel-${index}`,
    title: `Panel ${index}`
  }));
}

function createDockStateMap(size) {
  const states = ["active", "minimized", "hidden", "invalid"];
  return Array.from({ length: size }).reduce((result, _, index) => {
    result[`panel-${index}`] = states[index % states.length];
    return result;
  }, {});
}

const rows = createRows(5000);
const treeNodes = createTree();
const expandedIds = treeNodes.slice(0, 60).map((node) => node.id);
const commandItems = createCommandItems(6000);
const dockPanels = createDockPanels(320);
const dockStateMap = createDockStateMap(320);

const suites = [
  runBenchmark("computeVirtualWindow(10k)", () =>
    computeVirtualWindow({
      itemCount: 10000,
      itemSize: 32,
      viewportHeight: 640,
      scrollTop: 3200,
      overscan: 8
    })
  ),
  runBenchmark("applyDataGridSort(5k)", () =>
    applyDataGridSort(rows, {
      key: "order",
      direction: "asc"
    })
  ),
  runBenchmark("flattenTreeNodes(120x12x3)", () => flattenTreeNodes(treeNodes, expandedIds)),
  runBenchmark("filterCommandPaletteItems(6k)", () =>
    filterCommandPaletteItems(commandItems, "shift")
  ),
  runBenchmark("resolveDockPanelStateMap(320)", () =>
    resolveDockPanelStateMap(dockPanels, dockStateMap)
  ),
  runBenchmark("toggleInspectorSection(120)", () => {
    const openIds = Array.from({ length: 120 }, (_, index) => `section-${index}`);
    return toggleInspectorSection(openIds, "section-24");
  }),
  runBenchmark("clampSplitRatio(50k calls)", () => {
    let total = 0;
    for (let index = 0; index < 50000; index += 1) {
      total += clampSplitRatio(index / 100000);
    }
    return total;
  })
];

console.log("Stage7 Benchmark Results");
console.log("name,averageMs,p95Ms,maxMs,iterations");
for (const result of suites) {
  console.log(
    `${result.name},${result.averageMs},${result.p95Ms},${result.maxMs},${result.iterations}`
  );
}
