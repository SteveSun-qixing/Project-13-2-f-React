import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = path.join(root, "packages");

function collectTests(dir) {
  const found = [];

  if (!fs.existsSync(dir)) {
    return found;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectTests(target));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
      found.push(target);
    }
  }

  return found;
}

const tests = collectTests(packagesDir).sort();

if (tests.length === 0) {
  console.log("[tests] no test files found");
  process.exit(0);
}

const result = spawnSync(process.execPath, ["--test", ...tests], {
  stdio: "inherit"
});

process.exit(result.status ?? 1);
