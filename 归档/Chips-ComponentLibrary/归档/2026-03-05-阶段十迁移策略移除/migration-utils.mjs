import fs from "node:fs";
import path from "node:path";

export const DEFAULT_EXTENSIONS = [
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".scss",
  ".json",
  ".md",
  ".mdx"
];

const DEFAULT_IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  "build",
  "归档"
]);

export function parseFlagArguments(argv) {
  const args = {
    target: null,
    apply: false,
    extensions: DEFAULT_EXTENSIONS,
    includeArchive: false,
    reportOnly: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--target") {
      args.target = argv[index + 1] || null;
      index += 1;
      continue;
    }

    if (current === "--apply") {
      args.apply = true;
      continue;
    }

    if (current === "--extensions") {
      const next = argv[index + 1] || "";
      args.extensions = next
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .map((item) => (item.startsWith(".") ? item : `.${item}`));
      index += 1;
      continue;
    }

    if (current === "--include-archive") {
      args.includeArchive = true;
      continue;
    }

    if (current === "--report-only") {
      args.reportOnly = true;
      continue;
    }
  }

  return args;
}

export function collectTargetFiles(targetDir, extensions, includeArchive = false) {
  const extensionSet = new Set(Array.isArray(extensions) && extensions.length > 0 ? extensions : DEFAULT_EXTENSIONS);
  const ignoredDirs = new Set(DEFAULT_IGNORED_DIRS);

  if (includeArchive) {
    ignoredDirs.delete("归档");
  }

  const files = [];

  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          walk(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (extensionSet.has(path.extname(entry.name))) {
        files.push(absolutePath);
      }
    }
  };

  walk(targetDir);
  return files.sort();
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function backupFileWithRelativePath(sourceFile, sourceRoot, backupRoot) {
  const relative = path.relative(sourceRoot, sourceFile);
  const destination = path.join(backupRoot, relative);
  ensureParentDir(destination);
  fs.copyFileSync(sourceFile, destination);
  return destination;
}

export function writeStampedReport(reportDir, prefix, report) {
  fs.mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
  const reportPath = path.join(reportDir, `${prefix}-${stamp}.json`);
  const latestPath = path.join(reportDir, `${prefix}-latest.json`);

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));

  return {
    reportPath,
    latestPath
  };
}

export function resolveRequiredTarget(rootDir, targetArg) {
  if (typeof targetArg !== "string" || targetArg.trim().length === 0) {
    throw new Error("MIGRATION_TARGET_REQUIRED");
  }

  const candidate = path.resolve(rootDir, targetArg);
  if (!fs.existsSync(candidate)) {
    throw new Error(`MIGRATION_TARGET_NOT_FOUND:${candidate}`);
  }

  const stat = fs.statSync(candidate);
  if (!stat.isDirectory()) {
    throw new Error(`MIGRATION_TARGET_NOT_DIRECTORY:${candidate}`);
  }

  return candidate;
}

export function toRelativePath(baseDir, targetPath) {
  return path.relative(baseDir, targetPath) || ".";
}
