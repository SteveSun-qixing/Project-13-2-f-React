import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyTokenMap } from "../packages/testing/src/index.js";
import {
  backupFileWithRelativePath,
  collectTargetFiles,
  parseFlagArguments,
  resolveRequiredTarget,
  toRelativePath,
  writeStampedReport
} from "./migration-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseFlagArguments(process.argv.slice(2));
const targetDir = resolveRequiredTarget(root, args.target);
const mapPath = path.join(root, "migrations", "legacy-token-map.json");
const mapDocument = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const files = collectTargetFiles(targetDir, args.extensions, args.includeArchive);
const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
const backupRoot = path.join(targetDir, "归档", "迁移备份", stamp, "tokens");

const fileReports = [];
const ruleSummary = new Map();
let touchedFileCount = 0;
let totalReplacementCount = 0;
let backupCount = 0;

for (const filePath of files) {
  const original = fs.readFileSync(filePath, "utf8");
  const result = applyTokenMap(original, mapDocument);
  if (result.total === 0) {
    continue;
  }

  touchedFileCount += 1;
  totalReplacementCount += result.total;

  for (const item of result.exactReplacements) {
    const key = `exact:${item.from}=>${item.to}`;
    ruleSummary.set(key, (ruleSummary.get(key) || 0) + item.count);
  }

  for (const item of result.prefixReplacements) {
    const key = `prefix:${item.from}=>${item.to}`;
    ruleSummary.set(key, (ruleSummary.get(key) || 0) + item.count);
  }

  if (args.apply) {
    backupFileWithRelativePath(filePath, targetDir, backupRoot);
    backupCount += 1;
    fs.writeFileSync(filePath, result.content);
  }

  fileReports.push({
    file: toRelativePath(targetDir, filePath),
    replacementCount: result.total,
    exactReplacements: result.exactReplacements,
    prefixReplacements: result.prefixReplacements
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: args.apply ? "apply" : "dry-run",
  target: targetDir,
  scannedFileCount: files.length,
  touchedFileCount,
  totalReplacementCount,
  backupRoot: args.apply ? backupRoot : null,
  backupCount,
  mappingVersion: mapDocument.version || "unknown",
  mappingSource: mapPath,
  ruleSummary: [...ruleSummary.entries()].map(([rule, count]) => ({
    rule,
    count
  })),
  files: fileReports
};

const written = writeStampedReport(path.join(root, "reports", "migration"), "token-migration", report);

console.log(`[migration:tokens] mode=${report.mode}`);
console.log(`[migration:tokens] target=${targetDir}`);
console.log(`[migration:tokens] scanned=${files.length}, touched=${touchedFileCount}, replacements=${totalReplacementCount}`);
if (args.apply) {
  console.log(`[migration:tokens] backups=${backupCount}, backupRoot=${backupRoot}`);
}
console.log(`[migration:tokens] report=${toRelativePath(root, written.reportPath)}`);
