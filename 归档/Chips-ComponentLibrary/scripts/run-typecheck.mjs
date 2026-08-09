import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = [path.join(root, "packages"), path.join(root, "scripts")];
const allowedExtensions = new Set([".js", ".mjs"]);
const ignoredDirs = new Set(["node_modules", "dist", ".git", "coverage"]);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        walk(fullPath, files);
      }
      continue;
    }

    if (entry.isFile() && allowedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = targets.flatMap((target) => walk(target));
const failed = [];

for (const filePath of files) {
  const check = spawnSync(process.execPath, ["--check", filePath], {
    cwd: root,
    encoding: "utf8"
  });

  if (check.status !== 0) {
    failed.push({
      file: path.relative(root, filePath),
      stderr: check.stderr || ""
    });
  }
}

if (failed.length > 0) {
  for (const failure of failed) {
    console.error(`[typecheck] ${failure.file}`);
    if (failure.stderr.length > 0) {
      console.error(failure.stderr.trim());
    }
  }
  process.exit(1);
}

console.log(`[typecheck] syntax validated ${files.length} files`);
