import fs from 'node:fs';
import path from 'node:path';

export function listDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

export function toPosix(value) {
  return value.split(path.sep).join('/');
}

export function walkFiles(root, { skipDirs = [], filter = () => true } = {}) {
  const results = [];
  const skip = new Set(skipDirs);
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of listDir(current)) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (skip.has(entry.name)) {
          continue;
        }
        stack.push(full);
        continue;
      }
      if (entry.isFile() && filter(full)) {
        results.push(full);
      }
    }
  }
  results.sort();
  return results;
}

export function hasSkippedDir(relPath, skipDirs) {
  const parts = toPosix(relPath).split('/');
  return parts.some((part) => skipDirs.includes(part));
}

export function matchSegment(pattern, value) {
  if (pattern === '*') {
    return true;
  }
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`).test(value);
}

export function matchGlob(pattern, value) {
  const patternParts = toPosix(pattern).split('/');
  const valueParts = toPosix(value).split('/');
  if (patternParts.length !== valueParts.length) {
    return false;
  }
  return patternParts.every((part, index) => matchSegment(part, valueParts[index]));
}

export function classify(relPath, rules) {
  const posix = toPosix(relPath);
  for (const rule of rules) {
    if (matchGlob(rule.match, posix)) {
      return rule;
    }
  }
  return null;
}

export function workspacePackages(workspaceRoot, { skipDirs = [] } = {}) {
  const results = [];
  const skip = new Set([
    ...skipDirs,
    'node_modules',
    '.git',
    'dist',
    'coverage',
    'reports',
    'target',
    'fixtures',
  ]);
  const stack = [workspaceRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of listDir(current)) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (skip.has(entry.name)) {
        continue;
      }
      const full = path.join(current, entry.name);
      stack.push(full);
    }
    const manifest = path.join(current, 'package.json');
    if (fs.existsSync(manifest)) {
      const rel = toPosix(path.relative(workspaceRoot, current));
      results.push({ dir: current, relPath: rel === '' ? '.' : rel, manifest });
    }
  }
  results.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
  return results;
}

export function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

export function readJson(filePath) {
  return JSON.parse(readText(filePath));
}
