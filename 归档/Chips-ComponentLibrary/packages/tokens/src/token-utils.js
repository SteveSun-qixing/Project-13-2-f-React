import fs from "node:fs";
import path from "node:path";

const REF_PATTERN = /^\{([^}]+)\}$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function walkEntries(value, keyPath = [], out = {}) {
  if (isObject(value)) {
    for (const [key, next] of Object.entries(value)) {
      walkEntries(next, keyPath.concat(key), out);
    }
    return out;
  }

  const key = keyPath.join(".");
  out[key] = value;
  return out;
}

function mergeDeep(target, source) {
  if (!isObject(source)) {
    return target;
  }

  for (const [key, value] of Object.entries(source)) {
    if (isObject(value)) {
      if (!isObject(target[key])) {
        target[key] = {};
      }
      mergeDeep(target[key], value);
    } else {
      target[key] = value;
    }
  }

  return target;
}

function setByPath(target, keyPath, value) {
  const keys = keyPath.split(".");
  let cursor = target;

  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (!isObject(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }

  cursor[keys.at(-1)] = value;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(dirPath, name));
}

export function loadTokenSources(tokensRootDir) {
  const all = {};
  const topLevelFiles = ["ref.json", "sys.json", "motion.json", "layout.json"];

  for (const name of topLevelFiles) {
    const filePath = path.join(tokensRootDir, name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`TOKEN_SOURCE_MISSING:${name}`);
    }
    mergeDeep(all, readJson(filePath));
  }

  for (const filePath of listJsonFiles(path.join(tokensRootDir, "comp"))) {
    mergeDeep(all, readJson(filePath));
  }

  return all;
}

export function flattenTokens(tokenTree) {
  return walkEntries(tokenTree);
}

export function resolveTokenReferences(flatTokens) {
  const resolved = {};
  const resolving = new Set();

  const resolveKey = (key) => {
    if (Object.hasOwn(resolved, key)) {
      return resolved[key];
    }

    if (!Object.hasOwn(flatTokens, key)) {
      throw new Error(`TOKEN_REFERENCE_MISSING:${key}`);
    }

    if (resolving.has(key)) {
      throw new Error(`TOKEN_REFERENCE_CYCLE:${key}`);
    }

    resolving.add(key);
    const rawValue = flatTokens[key];

    if (typeof rawValue === "string") {
      const match = rawValue.match(REF_PATTERN);
      if (match) {
        const refKey = match[1];
        const refValue = resolveKey(refKey);
        resolving.delete(key);
        resolved[key] = refValue;
        return refValue;
      }
    }

    resolving.delete(key);
    resolved[key] = rawValue;
    return rawValue;
  };

  for (const key of Object.keys(flatTokens)) {
    resolveKey(key);
  }

  return resolved;
}

export function buildResolvedTokenTree(flatResolvedTokens) {
  const tree = {};

  for (const [key, value] of Object.entries(flatResolvedTokens)) {
    setByPath(tree, key, value);
  }

  return tree;
}

export function toCssVariables(flatResolvedTokens) {
  const entries = Object.entries(flatResolvedTokens)
    .filter(([, value]) => ["string", "number"].includes(typeof value))
    .sort(([a], [b]) => a.localeCompare(b));

  const lines = [":root {"];
  for (const [key, value] of entries) {
    const cssKey = `--${key.replaceAll(".", "-")}`;
    lines.push(`  ${cssKey}: ${String(value)};`);
  }
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

export function toTokenKeyDeclaration(flatResolvedTokens) {
  const keys = Object.keys(flatResolvedTokens).sort();
  if (keys.length === 0) {
    return "export type ChipsTokenKey = never;\n";
  }

  const lines = ["export type ChipsTokenKey ="];
  for (const key of keys) {
    lines.push(`  | "${key}"`);
  }
  lines[lines.length - 1] = `${lines.at(-1)};`;
  return `${lines.join("\n")}\n`;
}

export function ensureRequiredTokenPrefixes(flatResolvedTokens, requiredPrefixes) {
  for (const prefix of requiredPrefixes) {
    const found = Object.keys(flatResolvedTokens).some((key) => key.startsWith(prefix));
    if (!found) {
      throw new Error(`TOKEN_REQUIRED_PREFIX_MISSING:${prefix}`);
    }
  }
}

export function writeTokenArtifacts(outputDir, artifacts) {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [relativePath, content] of Object.entries(artifacts)) {
    const target = path.join(outputDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  }
}
