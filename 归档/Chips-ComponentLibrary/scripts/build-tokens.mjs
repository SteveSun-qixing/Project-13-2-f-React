import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildResolvedTokenTree,
  flattenTokens,
  loadTokenSources,
  resolveTokenReferences,
  toCssVariables,
  toTokenKeyDeclaration,
  writeTokenArtifacts
} from "../packages/tokens/src/token-utils.js";

function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildDiffReport(previousTree, nextTree) {
  if (!previousTree) {
    return "# Token Diff Report\n\n- previous snapshot missing\n- all keys treated as additions\n";
  }

  const prev = flattenTokens(previousTree);
  const next = flattenTokens(nextTree);
  const prevKeys = new Set(Object.keys(prev));
  const nextKeys = new Set(Object.keys(next));

  const added = [...nextKeys].filter((key) => !prevKeys.has(key)).sort();
  const removed = [...prevKeys].filter((key) => !nextKeys.has(key)).sort();
  const changed = [...nextKeys]
    .filter((key) => prevKeys.has(key) && String(prev[key]) !== String(next[key]))
    .sort();

  const lines = ["# Token Diff Report", "", `- added: ${added.length}`, `- removed: ${removed.length}`, `- changed: ${changed.length}`, ""];

  if (added.length > 0) {
    lines.push("## Added", "");
    for (const key of added) {
      lines.push(`- ${key}`);
    }
    lines.push("");
  }

  if (removed.length > 0) {
    lines.push("## Removed", "");
    for (const key of removed) {
      lines.push(`- ${key}`);
    }
    lines.push("");
  }

  if (changed.length > 0) {
    lines.push("## Changed", "");
    for (const key of changed) {
      lines.push(`- ${key}: ${prev[key]} -> ${next[key]}`);
    }
    lines.push("");
  }

  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    lines.push("- no differences\n");
  }

  return `${lines.join("\n")}\n`;
}

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../packages/tokens");
const sourceDir = path.join(packageDir, "tokens");
const distDir = path.join(packageDir, "dist");

const sourceTree = loadTokenSources(sourceDir);
const flatSource = flattenTokens(sourceTree);
const flatResolved = resolveTokenReferences(flatSource);
const resolvedTree = buildResolvedTokenTree(flatResolved);

const previousSnapshot = readJsonSafe(path.join(distDir, "json/tokens.json"));
const diffReport = buildDiffReport(previousSnapshot, resolvedTree);

writeTokenArtifacts(distDir, {
  "json/tokens.json": `${JSON.stringify(resolvedTree, null, 2)}\n`,
  "css/variables.css": toCssVariables(flatResolved),
  "ts/token-keys.d.ts": toTokenKeyDeclaration(flatResolved),
  "report/token-diff.md": diffReport
});

console.log(`[tokens] built ${Object.keys(flatResolved).length} keys`);
