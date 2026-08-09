import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = [path.join(root, "packages"), path.join(root, "scripts")];
const allowedExtensions = new Set([".js", ".mjs", ".json"]);
const ignoredDirs = new Set(["node_modules", "dist", ".git", "coverage"]);
const deniedPatternSources = ["TO" + "DO\\b", "FIX" + "ME\\b"];
const deniedPatterns = deniedPatternSources.map((source) => new RegExp(source));

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

function lintFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const issues = [];
  const lines = source.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const pattern of deniedPatterns) {
      if (pattern.test(line)) {
        issues.push({
          file: filePath,
          line: index + 1,
          code: "LINT_DENIED_PATTERN",
          message: `Denied pattern matched: ${pattern.source}`
        });
      }
    }

    if (/\s+$/.test(line) && line.trim().length > 0) {
      issues.push({
        file: filePath,
        line: index + 1,
        code: "LINT_TRAILING_WHITESPACE",
        message: "Trailing whitespace is not allowed"
      });
    }
  }

  if (source.length > 0 && !source.endsWith("\n")) {
    issues.push({
      file: filePath,
      line: lines.length,
      code: "LINT_FINAL_NEWLINE_MISSING",
      message: "File must end with newline"
    });
  }

  return issues;
}

const files = targets.flatMap((target) => walk(target));
const allIssues = [];
for (const filePath of files) {
  allIssues.push(...lintFile(filePath));
}

if (allIssues.length > 0) {
  for (const issue of allIssues) {
    const short = path.relative(root, issue.file);
    console.error(`[lint] ${issue.code} ${short}:${issue.line} ${issue.message}`);
  }
  process.exit(1);
}

console.log(`[lint] checked ${files.length} files`);
