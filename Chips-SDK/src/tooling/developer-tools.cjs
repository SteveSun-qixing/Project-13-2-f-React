const fs = require("node:fs");
const path = require("node:path");
const yaml = require("yaml");

const REPORT_SCHEMA_VERSION = "1.0.0";
const ASSIMILATION_MAX_FILES = 2500;
const ASSIMILATION_MAX_EVIDENCE = 40;
const DEFAULT_SKIP_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".vite",
  "coverage",
  "dist",
  "build",
  "out",
  "node_modules"
]);

const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".mjs",
  ".scss",
  ".ts",
  ".tsx",
  ".vue",
  ".svelte"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeSlashes(value) {
  return value.split(path.sep).join("/");
}

function stripDotSlash(value) {
  return String(value ?? "").replace(/^[.][\\/]/, "");
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function readTextFile(filePath, fallback = undefined) {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return fallback;
  }
}

function readJsonFile(filePath, fallback = undefined) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function readYamlFile(filePath, fallback = undefined) {
  try {
    return yaml.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function fileInfo(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return {
      path: filePath,
      exists: true,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString()
    };
  } catch {
    return {
      path: filePath,
      exists: false,
      sizeBytes: 0,
      updatedAt: null
    };
  }
}

function walkFiles(rootDir, options = {}) {
  const extensions = options.extensions ? new Set(options.extensions) : undefined;
  const skipDirs = options.skipDirs ?? DEFAULT_SKIP_DIRS;
  const maxFiles = options.maxFiles ?? 10000;
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0 && files.length < maxFiles) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) {
      continue;
    }

    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          stack.push(target);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (extensions && !extensions.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }
      files.push(target);
      if (files.length >= maxFiles) {
        break;
      }
    }
  }

  return files.sort();
}

function flattenJsonLeaves(value, prefix = [], out = {}) {
  if (isPlainObject(value)) {
    for (const [key, next] of Object.entries(value)) {
      flattenJsonLeaves(next, prefix.concat(key), out);
    }
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((next, index) => {
      flattenJsonLeaves(next, prefix.concat(String(index)), out);
    });
    return out;
  }

  out[prefix.join(".")] = value;
  return out;
}

function mergeObjects(base, overlay) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay ?? {})) {
    const current = result[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = mergeObjects(current, value);
      continue;
    }
    result[key] = value;
  }
  return result;
}

function buildContractTokenTree(tokenTree) {
  if (!isPlainObject(tokenTree)) {
    return {};
  }

  const themeLayerNames = ["ref", "sys", "motion", "layout", "comp"];
  const hasThemeLayers = themeLayerNames.some((layer) => isPlainObject(tokenTree[layer]));
  if (!hasThemeLayers) {
    return tokenTree;
  }

  return themeLayerNames.reduce((merged, layer) => {
    const layerValue = isPlainObject(tokenTree[layer]) ? tokenTree[layer] : {};
    return mergeObjects(merged, layerValue);
  }, {});
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).filter((item) => typeof item === "string" && item.length > 0))];
}

function safePackageNameFromPath(targetRoot) {
  const base = path.basename(path.resolve(targetRoot));
  return base
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "assimilated-app";
}

function toDisplayName(value) {
  return String(value ?? "Chips App")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (match) => match.toUpperCase()) || "Chips App";
}

function createReportBase(kind) {
  return {
    kind,
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString()
  };
}

function summarizeStatus(items) {
  const statuses = items.map((item) => item.status).filter(Boolean);
  if (statuses.includes("failed") || statuses.includes("blocked")) {
    return "failed";
  }
  if (statuses.includes("warning")) {
    return "warning";
  }
  if (statuses.length === 0) {
    return "unknown";
  }
  return "passed";
}

function makeCheck(name, status, details = {}) {
  return { name, status, ...details };
}

function findThemePackageDirs(ecosystemRoot) {
  const themeRoot = path.join(ecosystemRoot, "ThemePack");
  if (!fs.existsSync(themeRoot)) {
    return [];
  }

  return fs.readdirSync(themeRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(themeRoot, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, "manifest.yaml")))
    .sort();
}

function resolveThemeDirs({ ecosystemRoot, themeRef, baseDir = process.cwd() }) {
  const allThemeDirs = findThemePackageDirs(ecosystemRoot);
  if (!themeRef) {
    return allThemeDirs;
  }

  const explicitPath = path.resolve(baseDir, themeRef);
  if (fs.existsSync(explicitPath)) {
    const stat = fs.statSync(explicitPath);
    return [stat.isDirectory() ? explicitPath : path.dirname(explicitPath)];
  }

  return allThemeDirs.filter((themeDir) => {
    const manifest = readYamlFile(path.join(themeDir, "manifest.yaml"), {});
    const candidates = [
      manifest.id,
      manifest.themeId,
      manifest.name,
      manifest.displayName,
      path.basename(themeDir)
    ].filter(Boolean);
    return candidates.includes(themeRef);
  });
}

function inspectThemeDirectory(themeDir) {
  const manifestPath = path.join(themeDir, "manifest.yaml");
  const manifest = readYamlFile(manifestPath, null);
  const checks = [];

  checks.push(makeCheck("manifest", manifest ? "passed" : "failed", { path: manifestPath }));

  const entry = isPlainObject(manifest?.entry) ? manifest.entry : {};
  const layout = isPlainObject(manifest?.ui?.layout) ? manifest.ui.layout : {};
  const tokenEntry = typeof entry.tokens === "string" ? entry.tokens : "dist/tokens.json";
  const cssEntry = typeof entry.themeCss === "string" ? entry.themeCss : "dist/theme.css";
  const contractEntry = typeof layout.contract === "string" ? layout.contract : "contracts/theme-interface.contract.json";
  const minSetEntry = typeof layout.minFunctionalSet === "string"
    ? layout.minFunctionalSet
    : "contracts/theme-min-functional-set.json";

  const tokenPath = path.join(themeDir, stripDotSlash(tokenEntry));
  const cssPath = path.join(themeDir, stripDotSlash(cssEntry));
  const contractPath = path.join(themeDir, stripDotSlash(contractEntry));
  const minSetPath = path.join(themeDir, stripDotSlash(minSetEntry));
  const tokensDir = path.join(themeDir, "tokens");

  const tokenTree = readJsonFile(tokenPath, null);
  const contract = readJsonFile(contractPath, null);
  const minSet = readJsonFile(minSetPath, null);
  const contractTokenTree = buildContractTokenTree(tokenTree);
  const flatTokens = tokenTree ? flattenJsonLeaves(contractTokenTree) : {};
  const tokenKeys = Object.keys(flatTokens);
  const tokenFiles = walkFiles(tokensDir, {
    extensions: new Set([".json"]),
    skipDirs: new Set(),
    maxFiles: 5000
  });

  const assets = {
    tokens: fileInfo(tokenPath),
    themeCss: fileInfo(cssPath),
    contract: fileInfo(contractPath),
    minFunctionalSet: fileInfo(minSetPath)
  };

  for (const [name, info] of Object.entries(assets)) {
    checks.push(makeCheck(`asset.${name}`, info.exists ? "passed" : "failed", { path: info.path }));
  }

  const components = Array.isArray(contract?.components) ? contract.components : [];
  const requiredComponents = Array.isArray(minSet?.requiredComponents) ? minSet.requiredComponents : [];
  const componentNames = uniqueStrings(components.map((component) => component.component ?? component.name));
  const missingComponents = requiredComponents.filter((name) => !componentNames.includes(name));
  const missingRequiredTokens = [];

  for (const component of components) {
    const componentName = component.component ?? component.name ?? "unknown";
    const requiredTokens = uniqueStrings(component.requiredTokens ?? component.tokens);
    for (const tokenKey of requiredTokens) {
      if (!Object.hasOwn(flatTokens, tokenKey)) {
        missingRequiredTokens.push({ component: componentName, tokenKey });
      }
    }
  }

  checks.push(makeCheck(
    "contract.components",
    missingComponents.length === 0 ? "passed" : "failed",
    {
      componentCount: componentNames.length,
      requiredComponentCount: requiredComponents.length,
      missingComponents
    }
  ));
  checks.push(makeCheck(
    "contract.requiredTokens",
    missingRequiredTokens.length === 0 ? "passed" : "failed",
    {
      tokenCount: tokenKeys.length,
      missingRequiredTokenCount: missingRequiredTokens.length,
      missingRequiredTokens: missingRequiredTokens.slice(0, 50)
    }
  ));

  const layerCounts = {};
  for (const tokenKey of tokenKeys) {
    const layer = tokenKey.split(".").slice(0, 2).join(".") || "unknown";
    layerCounts[layer] = (layerCounts[layer] ?? 0) + 1;
  }

  return {
    themeDir,
    manifest: manifest
      ? {
          id: manifest.id,
          themeId: manifest.themeId,
          name: manifest.name,
          version: manifest.version,
          type: manifest.type,
          isDefault: manifest.isDefault === true
        }
      : null,
    assets,
    tokenSources: {
      directory: tokensDir,
      fileCount: tokenFiles.length,
      componentTokenFileCount: tokenFiles.filter((file) => normalizeSlashes(file).includes("/tokens/comp/")).length
    },
    tokenSummary: {
      tokenCount: tokenKeys.length,
      layerCounts
    },
    contractSummary: {
      componentCount: componentNames.length,
      requiredComponentCount: requiredComponents.length,
      missingComponentCount: missingComponents.length,
      missingRequiredTokenCount: missingRequiredTokens.length,
      contractVersion: contract?.contractVersion ?? contract?.version ?? null,
      minFunctionalSetVersion: minSet?.contractVersion ?? minSet?.version ?? null
    },
    checks,
    status: summarizeStatus(checks)
  };
}

function createThemeInspectReport(options) {
  const themeDirs = resolveThemeDirs(options);
  const themes = themeDirs.map((themeDir) => inspectThemeDirectory(themeDir));
  const checks = [
    makeCheck("theme.match", themes.length > 0 ? "passed" : "failed", {
      themeRef: options.themeRef ?? null
    }),
    ...themes.map((theme) => makeCheck(`theme.${theme.manifest?.themeId ?? path.basename(theme.themeDir)}`, theme.status, {
      themeDir: theme.themeDir
    }))
  ];

  return {
    ...createReportBase("chipsdev.theme.inspect"),
    input: {
      themeRef: options.themeRef ?? null,
      ecosystemRoot: options.ecosystemRoot
    },
    themes,
    summary: {
      themeCount: themes.length,
      status: summarizeStatus(checks),
      failedThemes: themes
        .filter((theme) => theme.status === "failed")
        .map((theme) => theme.manifest?.themeId ?? path.basename(theme.themeDir))
    },
    checks
  };
}

function loadComponentContracts(componentLibraryRoot) {
  const contractDir = path.join(componentLibraryRoot, "packages", "theme-contracts", "contracts", "components");
  const files = walkFiles(contractDir, {
    extensions: new Set([".json"]),
    skipDirs: new Set([...DEFAULT_SKIP_DIRS, "归档", "archive"]),
    maxFiles: 10000
  });
  return files.map((filePath) => ({
    filePath,
    contract: readJsonFile(filePath, {})
  }));
}

function createComponentGalleryReport({ ecosystemRoot }) {
  const componentLibraryRoot = path.join(ecosystemRoot, "Chips-ComponentLibrary");
  if (!fs.existsSync(componentLibraryRoot)) {
    const archivedChecks = [
      makeCheck("componentLibrary.exists", "skipped", {
        path: componentLibraryRoot,
        note: "自研组件库已于 task030 卸担计划废弃（antd v6 + @chips/ui 替代），本报告不再生成。"
      })
    ];
    return {
      ...createReportBase("chipsdev.component.gallery"),
      input: { ecosystemRoot, componentLibraryRoot },
      components: [],
      reports: { qualityGateLatest: null, perfLatest: null },
      summary: {
        componentCount: 0,
        stateCellCount: 0,
        partCount: 0,
        requiredTokenCount: 0,
        missingRequiredTokenCount: 0,
        requiredTokenCoverage: 1,
        status: "skipped"
      },
      checks: archivedChecks
    };
  }
  const tokenPath = path.join(componentLibraryRoot, "packages", "tokens", "dist", "json", "tokens.json");
  const tokenTree = readJsonFile(tokenPath, null);
  const flatTokens = tokenTree ? flattenJsonLeaves(tokenTree) : {};
  const contracts = loadComponentContracts(componentLibraryRoot);

  const components = contracts.map(({ filePath, contract }) => {
    const name = contract.component ?? contract.name ?? path.basename(filePath, ".contract.json");
    const parts = uniqueStrings(contract.parts);
    const states = uniqueStrings(contract.states);
    const requiredTokens = uniqueStrings(contract.requiredTokens ?? contract.tokens);
    const optionalTokens = uniqueStrings(contract.optionalTokens);
    const missingRequiredTokens = requiredTokens.filter((tokenKey) => !Object.hasOwn(flatTokens, tokenKey));
    const missingOptionalTokens = optionalTokens.filter((tokenKey) => !Object.hasOwn(flatTokens, tokenKey));

    return {
      component: name,
      scope: contract.scope ?? name,
      contractPath: filePath,
      parts,
      states,
      matrix: {
        partCount: parts.length,
        stateCount: states.length,
        stateCellCount: parts.length * states.length
      },
      tokens: {
        requiredCount: requiredTokens.length,
        optionalCount: optionalTokens.length,
        missingRequiredCount: missingRequiredTokens.length,
        missingOptionalCount: missingOptionalTokens.length,
        requiredCoverage: requiredTokens.length === 0
          ? 1
          : Number(((requiredTokens.length - missingRequiredTokens.length) / requiredTokens.length).toFixed(4))
      },
      diagnostics: {
        missingRequiredTokens,
        missingOptionalTokens
      },
      a11yConstraints: Array.isArray(contract.a11yConstraints) ? contract.a11yConstraints : [],
      motionConstraints: Array.isArray(contract.motionConstraints) ? contract.motionConstraints : [],
      status: missingRequiredTokens.length > 0 ? "failed" : missingOptionalTokens.length > 0 ? "warning" : "passed"
    };
  });

  const latestQuality = readJsonFile(
    path.join(componentLibraryRoot, "reports", "quality-gate", "quality-gate-latest.json"),
    null
  );
  const latestPerf = readJsonFile(
    path.join(componentLibraryRoot, "reports", "perf", "perf-stage9-latest.json"),
    null
  );

  const requiredTokenCount = components.reduce((sum, component) => sum + component.tokens.requiredCount, 0);
  const missingRequiredTokenCount = components.reduce((sum, component) => sum + component.tokens.missingRequiredCount, 0);
  const checks = [
    makeCheck("componentLibrary.exists", fs.existsSync(componentLibraryRoot) ? "passed" : "failed", {
      path: componentLibraryRoot
    }),
    makeCheck("componentContracts.exists", components.length > 0 ? "passed" : "failed", {
      contractCount: components.length
    }),
    makeCheck("componentTokens.built", tokenTree ? "passed" : "warning", {
      path: tokenPath
    }),
    makeCheck(
      "componentContracts.requiredTokens",
      missingRequiredTokenCount === 0 ? "passed" : "failed",
      { missingRequiredTokenCount }
    )
  ];

  return {
    ...createReportBase("chipsdev.component.gallery"),
    input: {
      ecosystemRoot,
      componentLibraryRoot
    },
    components,
    reports: {
      qualityGateLatest: latestQuality
        ? {
            path: path.join(componentLibraryRoot, "reports", "quality-gate", "quality-gate-latest.json"),
            generatedAt: latestQuality.generatedAt ?? null,
            status: latestQuality.status ?? "unknown",
            steps: Array.isArray(latestQuality.steps) ? latestQuality.steps.map((step) => step.name) : []
          }
        : null,
      perfLatest: latestPerf
        ? {
            path: path.join(componentLibraryRoot, "reports", "perf", "perf-stage9-latest.json"),
            generatedAt: latestPerf.generatedAt ?? null,
            summary: latestPerf.summary ?? null
          }
        : null
    },
    summary: {
      componentCount: components.length,
      stateCellCount: components.reduce((sum, component) => sum + component.matrix.stateCellCount, 0),
      partCount: components.reduce((sum, component) => sum + component.matrix.partCount, 0),
      requiredTokenCount,
      missingRequiredTokenCount,
      requiredTokenCoverage: requiredTokenCount === 0
        ? 1
        : Number(((requiredTokenCount - missingRequiredTokenCount) / requiredTokenCount).toFixed(4)),
      status: summarizeStatus(checks.concat(components.map((component) => ({ status: component.status }))))
    },
    checks
  };
}

function loadManifestFromProject(projectRoot) {
  const manifestPath = path.join(projectRoot, "manifest.yaml");
  const manifest = readYamlFile(manifestPath, null);
  return { manifest, manifestPath };
}

function validateRuntimeTargets(manifest) {
  const targetIds = ["desktop", "web", "mobile", "headless"];
  const targets = manifest?.runtime?.targets;
  if (!isPlainObject(targets)) {
    return ["manifest.runtime.targets must be an object"];
  }
  const errors = [];
  for (const targetId of targetIds) {
    if (!isPlainObject(targets[targetId]) || typeof targets[targetId].supported !== "boolean") {
      errors.push(`manifest.runtime.targets.${targetId}.supported must be boolean`);
    }
  }
  return errors;
}

function validateSurface(manifest) {
  if (manifest?.type !== "app") {
    return [];
  }
  const kinds = ["window", "tab", "route", "modal", "sheet", "fullscreen"];
  const surface = manifest?.ui?.surface;
  if (!isPlainObject(surface)) {
    return ["app manifest must declare ui.surface"];
  }
  const errors = [];
  if (!kinds.includes(surface.defaultKind)) {
    errors.push("manifest.ui.surface.defaultKind is invalid");
  }
  const preferredKinds = surface.preferredKinds;
  for (const targetId of ["desktop", "web", "mobile", "headless"]) {
    if (!isPlainObject(preferredKinds) || !kinds.includes(preferredKinds[targetId])) {
      errors.push(`manifest.ui.surface.preferredKinds.${targetId} is invalid`);
    }
  }
  return errors;
}

function createPreviewReport({ projectRoot, ecosystemRoot, mode = "mock", target = "app", projectConfig = null }) {
  const configPath = path.join(projectRoot, "chips.config.mjs");
  const { manifest, manifestPath } = loadManifestFromProject(projectRoot);
  const runtimeErrors = manifest ? validateRuntimeTargets(manifest) : [];
  const surfaceErrors = manifest ? validateSurface(manifest) : [];
  const entryValue = typeof manifest?.entry === "string"
    ? manifest.entry
    : isPlainObject(manifest?.entry)
      ? manifest.entry.themeCss ?? manifest.entry.tokens
      : projectConfig?.entry;
  const entryPath = entryValue ? path.join(projectRoot, stripDotSlash(entryValue)) : null;

  const checks = [
    makeCheck("project.config", fs.existsSync(configPath) ? "passed" : "failed", { path: configPath }),
    makeCheck("manifest", manifest ? "passed" : "failed", { path: manifestPath }),
    makeCheck("manifest.runtimeTargets", runtimeErrors.length === 0 ? "passed" : "failed", { errors: runtimeErrors }),
    makeCheck("manifest.surface", surfaceErrors.length === 0 ? "passed" : "failed", { errors: surfaceErrors }),
    makeCheck("manifest.entryAsset", entryPath && fs.existsSync(entryPath) ? "passed" : "warning", {
      path: entryPath,
      note: "Build outputs may be absent before chipsdev-r build."
    }),
    makeCheck("host.mock", fs.existsSync(path.join(ecosystemRoot, "Chips-SDK", "src", "testing", "index.ts")) ? "passed" : "failed", {
      entry: "chips-sdk/testing"
    }),
    makeCheck("host.realWorkspace", fs.existsSync(path.join(ecosystemRoot, "Chips-Host")) ? "passed" : "warning", {
      path: path.join(ecosystemRoot, "Chips-Host")
    })
  ];

  return {
    ...createReportBase("chipsdev.preview"),
    input: { mode, target, projectRoot, ecosystemRoot },
    project: {
      configPath,
      config: projectConfig
        ? {
            type: projectConfig.type,
            srcDir: projectConfig.srcDir,
            outDir: projectConfig.outDir,
            entry: projectConfig.entry,
            testsDir: projectConfig.testsDir
          }
        : null,
      manifestPath,
      manifest: manifest
        ? {
            id: manifest.id ?? manifest.pluginId ?? null,
            name: manifest.name ?? null,
            version: manifest.version ?? null,
            type: manifest.type ?? null,
            entry: manifest.entry ?? null,
            permissions: Array.isArray(manifest.permissions) ? manifest.permissions : []
          }
        : null
    },
    previewPlan: {
      target,
      mode,
      hostMock: {
        supported: true,
        entry: "chips-sdk/testing",
        purpose: "Bridge, launch context, surface context, permission and event simulation"
      },
      realHost: {
        supported: true,
        commands: manifest?.type === "app"
          ? ["chipsdev-r run"]
          : ["chipsdev-r plugin install <package>", "chipsdev-r plugin enable <pluginId>"],
        workspaceKind: "dev"
      },
      reportOnly: true
    },
    checks,
    summary: {
      status: summarizeStatus(checks),
      blockingCheckCount: checks.filter((check) => check.status === "failed").length,
      warningCheckCount: checks.filter((check) => check.status === "warning").length
    }
  };
}

function createQualityGateReport({ projectRoot, ecosystemRoot }) {
  const componentLibraryRoot = path.join(ecosystemRoot, "Chips-ComponentLibrary");
  const sdkRoot = path.join(ecosystemRoot, "Chips-SDK");
  const routeManifestPath = path.join(sdkRoot, "src", "contracts", "route-manifest.json");
  const latestQualityPath = path.join(componentLibraryRoot, "reports", "quality-gate", "quality-gate-latest.json");
  const latestPerfPath = path.join(componentLibraryRoot, "reports", "perf", "perf-stage9-latest.json");
  const latestQuality = readJsonFile(latestQualityPath, null);
  const latestPerf = readJsonFile(latestPerfPath, null);
  const themeReport = createThemeInspectReport({ ecosystemRoot });

  const projectPackagePath = path.join(projectRoot, "package.json");
  const projectPackage = readJsonFile(projectPackagePath, null);
  const { manifest } = loadManifestFromProject(projectRoot);
  const projectChecks = [
    makeCheck("project.package", projectPackage ? "passed" : "warning", { path: projectPackagePath }),
    makeCheck("project.chipsConfig", fs.existsSync(path.join(projectRoot, "chips.config.mjs")) ? "passed" : "warning", {
      path: path.join(projectRoot, "chips.config.mjs")
    }),
    makeCheck("project.manifest", manifest ? "passed" : "warning", {
      path: path.join(projectRoot, "manifest.yaml")
    })
  ];

  const componentLibraryExists = fs.existsSync(componentLibraryRoot);
  const ecosystemChecks = [
    makeCheck("sdk.routeManifest", fs.existsSync(routeManifestPath) ? "passed" : "failed", {
      path: routeManifestPath
    }),
    makeCheck("componentLibrary.qualityGateLatest", componentLibraryExists ? (latestQuality ? latestQuality.status ?? "warning" : "warning") : "skipped", {
      path: latestQualityPath,
      generatedAt: latestQuality?.generatedAt ?? null,
      note: componentLibraryExists ? undefined : "自研组件库已于 task030 卸担计划废弃（antd v6 + @chips/ui 替代）。"
    }),
    makeCheck("componentLibrary.perfLatest", componentLibraryExists ? (latestPerf?.summary?.passed === false ? "failed" : latestPerf ? "passed" : "warning") : "skipped", {
      path: latestPerfPath,
      generatedAt: latestPerf?.generatedAt ?? null,
      summary: latestPerf?.summary ?? null,
      note: componentLibraryExists ? undefined : "自研组件库已于 task030 卸担计划废弃（antd v6 + @chips/ui 替代）。"
    }),
    makeCheck("theme.inspect", themeReport.summary.status === "failed" && themeReport.summary.themeCount === 0 ? "skipped" : themeReport.summary.status, {
      themeCount: themeReport.summary.themeCount,
      failedThemes: themeReport.summary.failedThemes,
      note: themeReport.summary.themeCount === 0 ? "主题系统已于 task030 卸担计划废弃（单一苹果主题，antd ConfigProvider）。" : undefined
    })
  ];
  const checks = projectChecks.concat(ecosystemChecks);

  return {
    ...createReportBase("chipsdev.quality.gate"),
    input: { projectRoot, ecosystemRoot },
    project: {
      packageName: projectPackage?.name ?? null,
      manifestId: manifest?.id ?? manifest?.pluginId ?? null,
      manifestType: manifest?.type ?? null
    },
    reports: {
      componentLibraryQuality: latestQuality
        ? {
            path: latestQualityPath,
            generatedAt: latestQuality.generatedAt ?? null,
            status: latestQuality.status ?? "unknown",
            steps: latestQuality.steps ?? []
          }
        : null,
      componentLibraryPerf: latestPerf
        ? {
            path: latestPerfPath,
            generatedAt: latestPerf.generatedAt ?? null,
            thresholds: latestPerf.thresholds ?? null,
            summary: latestPerf.summary ?? null
          }
        : null,
      themes: themeReport.summary
    },
    checks,
    summary: {
      status: summarizeStatus(checks),
      failedCheckCount: checks.filter((check) => check.status === "failed").length,
      warningCheckCount: checks.filter((check) => check.status === "warning").length
    }
  };
}

function lineForIndex(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function collectPatternEvidence(files, definitions, rootDir) {
  const groups = {};
  for (const definition of definitions) {
    groups[definition.id] = {
      id: definition.id,
      title: definition.title,
      severity: definition.severity,
      count: 0,
      evidence: []
    };
  }

  for (const filePath of files) {
    let source = readTextFile(filePath, "");
    if (!source) {
      continue;
    }
    if (source.length > 500000) {
      source = source.slice(0, 500000);
    }

    for (const definition of definitions) {
      const pattern = new RegExp(definition.pattern.source, definition.pattern.flags.includes("g")
        ? definition.pattern.flags
        : `${definition.pattern.flags}g`);
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const group = groups[definition.id];
        group.count += 1;
        if (group.evidence.length < ASSIMILATION_MAX_EVIDENCE) {
          const excerpt = match[0].replace(/\s+/g, " ").trim().slice(0, 160);
          group.evidence.push({
            file: normalizeSlashes(path.relative(rootDir, filePath)),
            line: lineForIndex(source, match.index),
            excerpt
          });
        }
        if (match.index === pattern.lastIndex) {
          pattern.lastIndex += 1;
        }
      }
    }
  }

  return groups;
}

function detectProjectKind(targetRoot, sourceFiles) {
  const packageJson = readJsonFile(path.join(targetRoot, "package.json"), null);
  const deps = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
    ...(packageJson?.peerDependencies ?? {})
  };
  const fileNames = new Set(sourceFiles.map((file) => path.basename(file)));

  const frameworks = [];
  if (deps.react || sourceFiles.some((file) => [".jsx", ".tsx"].includes(path.extname(file)))) frameworks.push("react");
  if (deps.vue || sourceFiles.some((file) => path.extname(file) === ".vue")) frameworks.push("vue");
  if (deps.svelte || sourceFiles.some((file) => path.extname(file) === ".svelte")) frameworks.push("svelte");
  if (deps["@angular/core"]) frameworks.push("angular");
  if (deps.vite || [...fileNames].some((name) => /^vite\.config\./.test(name))) frameworks.push("vite");
  if (deps.electron) frameworks.push("electron");
  if (fs.existsSync(path.join(targetRoot, "index.html")) && frameworks.length === 0) frameworks.push("static-html");

  return {
    packageName: packageJson?.name ?? null,
    packageVersion: packageJson?.version ?? null,
    scripts: packageJson?.scripts ?? {},
    frameworks: uniqueStrings(frameworks),
    hasPackageJson: Boolean(packageJson),
    hasIndexHtml: fs.existsSync(path.join(targetRoot, "index.html")),
    hasViteConfig: [...fileNames].some((name) => /^vite\.config\./.test(name))
  };
}

const ASSIMILATION_PATTERNS = [
  {
    id: "nodeElectronApis",
    title: "Direct Node/Electron API usage",
    severity: "required",
    pattern: /\b(?:require\(["'](?:electron|fs|path|os|child_process|node:[^"']+)["']\)|from\s+["'](?:electron|node:[^"']+|fs|path|os|child_process)["']|ipcRenderer|BrowserWindow|process\.)/g
  },
  {
    id: "webStorage",
    title: "Browser storage usage",
    severity: "recommended",
    pattern: /\b(?:localStorage|sessionStorage)\s*\./g
  },
  {
    id: "network",
    title: "Network access",
    severity: "review",
    pattern: /\b(?:fetch\s*\(|XMLHttpRequest|WebSocket|axios\s*\.)/g
  },
  {
    id: "fileInputDownload",
    title: "File input or download",
    severity: "required",
    pattern: /(<input[^>]+type=["']?file|FileReader\b|URL\.createObjectURL|download\s*=)/gi
  },
  {
    id: "windowOpen",
    title: "External window open",
    severity: "required",
    pattern: /\bwindow\.open\s*\(/g
  },
  {
    id: "clipboard",
    title: "Clipboard access",
    severity: "required",
    pattern: /\b(?:navigator\.clipboard|document\.execCommand\s*\(\s*["']copy["'])/g
  },
  {
    id: "keyboardShortcuts",
    title: "Keyboard shortcut handling",
    severity: "recommended",
    pattern: /\b(?:addEventListener\s*\(\s*["']keydown["']|onKeyDown|KeyboardEvent|ctrlKey|metaKey|altKey)\b/g
  },
  {
    id: "hardcodedStyles",
    title: "Hardcoded visual styles",
    severity: "required",
    pattern: /(?:#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\(|font-family\s*:|box-shadow\s*:|border-radius\s*:|style\s*=\s*\{\{)/g
  },
  {
    id: "visibleText",
    title: "Hardcoded visible text",
    severity: "required",
    pattern: /(?:[\u4e00-\u9fff]{2,}|>\s*[A-Za-z][A-Za-z0-9 ,.!?'"-]{3,}\s*<)/g
  }
];

const COMPONENT_PATTERNS = [
  { id: "button", component: "Button", chipsComponent: "ChipsButton", pattern: /<button\b/gi },
  { id: "input", component: "Input", chipsComponent: "ChipsInput", pattern: /<input\b/gi },
  { id: "select", component: "Select", chipsComponent: "ChipsSelect", pattern: /<select\b/gi },
  { id: "textarea", component: "Textarea", chipsComponent: "ChipsInput", pattern: /<textarea\b/gi },
  { id: "dialog", component: "Dialog", chipsComponent: "ChipsDialog", pattern: /<(?:dialog|Modal|Dialog)\b/g },
  { id: "tabs", component: "Tabs", chipsComponent: "ChipsTabs", pattern: /<(?:Tabs|TabList|TabPanel)\b/g },
  { id: "table", component: "Table", chipsComponent: "ChipsDataGrid", pattern: /<table\b/gi },
  { id: "list", component: "List", chipsComponent: "ChipsVirtualList", pattern: /<(?:ul|ol)\b/gi },
  { id: "menu", component: "Menu", chipsComponent: "ChipsMenu", pattern: /<(?:menu|Menu|Dropdown)\b/g }
];

function createManifestSuggestion(targetRoot, projectKind, evidenceGroups) {
  const slug = safePackageNameFromPath(targetRoot);
  const permissions = new Set();

  if (evidenceGroups.fileInputDownload.count > 0) {
    permissions.add("file.read");
    permissions.add("file.write");
  }
  if (evidenceGroups.webStorage.count > 0) {
    permissions.add("config.read");
    permissions.add("config.write");
  }
  if (evidenceGroups.clipboard.count > 0) {
    permissions.add("platform.read");
  }
  if (evidenceGroups.windowOpen.count > 0 || evidenceGroups.network.count > 0) {
    permissions.add("platform.external");
  }
  if (evidenceGroups.keyboardShortcuts.count > 0) {
    permissions.add("command.read");
    permissions.add("command.write");
  }

  return {
    id: `com.assimilated.${slug}`,
    name: toDisplayName(projectKind.packageName ?? slug),
    version: "0.1.0",
    type: "app",
    entry: "dist/index.html",
    permissions: [...permissions].sort(),
    runtime: {
      targets: {
        desktop: { supported: true },
        web: { supported: false },
        mobile: { supported: false },
        headless: { supported: false }
      }
    },
    capabilityFallbacks: evidenceGroups.windowOpen.count > 0
      ? {
          openExternal: {
            whenUnsupported: "openExternal"
          }
        }
      : {},
    ui: {
      surface: {
        defaultKind: "window",
        preferredKinds: {
          desktop: "window",
          web: "route",
          mobile: "fullscreen",
          headless: "window"
        }
      },
      launcher: {
        displayName: toDisplayName(projectKind.packageName ?? slug)
      }
    }
  };
}

function createAssimilationScanReport({ targetRoot, reportLevel = "scan" }) {
  const resolvedRoot = path.resolve(targetRoot);
  const sourceFiles = walkFiles(resolvedRoot, {
    extensions: SOURCE_EXTENSIONS,
    maxFiles: ASSIMILATION_MAX_FILES
  });
  const projectKind = detectProjectKind(resolvedRoot, sourceFiles);
  const evidenceGroups = collectPatternEvidence(sourceFiles, ASSIMILATION_PATTERNS, resolvedRoot);
  const componentGroups = collectPatternEvidence(sourceFiles, COMPONENT_PATTERNS.map((item) => ({
    id: item.id,
    title: item.component,
    severity: "recommended",
    pattern: item.pattern
  })), resolvedRoot);

  const requiredFixes = Object.values(evidenceGroups)
    .filter((group) => group.severity === "required" && group.count > 0)
    .map((group) => ({
      id: group.id,
      title: group.title,
      count: group.count,
      firstEvidence: group.evidence[0] ?? null
    }));
  const recommendedFixes = Object.values(evidenceGroups)
    .filter((group) => group.severity === "recommended" && group.count > 0)
    .map((group) => ({
      id: group.id,
      title: group.title,
      count: group.count,
      firstEvidence: group.evidence[0] ?? null
    }));
  const componentSuggestions = COMPONENT_PATTERNS
    .map((definition) => ({
      source: definition.component,
      target: definition.chipsComponent,
      count: componentGroups[definition.id]?.count ?? 0,
      evidence: componentGroups[definition.id]?.evidence ?? []
    }))
    .filter((item) => item.count > 0);

  const riskPenalty = requiredFixes.reduce((sum, item) => sum + Math.min(18, item.count * 3), 0)
    + recommendedFixes.reduce((sum, item) => sum + Math.min(8, item.count), 0)
    + (projectKind.frameworks.includes("electron") ? 15 : 0);
  const score = Math.max(0, 100 - riskPenalty);

  const manifestSuggestion = createManifestSuggestion(resolvedRoot, projectKind, evidenceGroups);
  const migrationPlan = reportLevel === "report"
    ? [
        {
          order: 1,
          title: "Freeze app manifest and surface contract",
          actions: ["Create manifest.yaml from manifestSuggestion", "Confirm permissions against SDK calls"]
        },
        {
          order: 2,
          title: "Replace direct host capability usage",
          actions: ["Move Node/Electron calls behind chips-sdk APIs", "Route external opens through platform/association APIs"]
        },
        {
          order: 3,
          title: "Assimilate UI system",
          actions: ["Replace hardcoded styles with theme tokens", "Move visible text into i18n resources"]
        },
        {
          order: 4,
          title: "Adopt component and quality gates",
          actions: ["Replace native controls with Chips components", "Run chipsdev-r quality gate before packaging"]
        }
      ]
    : [];

  return {
    ...createReportBase(reportLevel === "report" ? "chipsdev.assimilate.report" : "chipsdev.assimilate.scan"),
    input: {
      targetRoot: resolvedRoot,
      reportLevel
    },
    project: {
      ...projectKind,
      scannedFileCount: sourceFiles.length,
      scanTruncated: sourceFiles.length >= ASSIMILATION_MAX_FILES
    },
    findings: evidenceGroups,
    componentSuggestions,
    manifestSuggestion,
    migrationPlan,
    summary: {
      score,
      status: requiredFixes.length > 0 ? "blocked" : recommendedFixes.length > 0 ? "warning" : "ready",
      requiredFixCount: requiredFixes.length,
      recommendedFixCount: recommendedFixes.length,
      componentSuggestionCount: componentSuggestions.length,
      requiredFixes,
      recommendedFixes
    }
  };
}

function createDiagnosticsReport({ projectRoot, ecosystemRoot }) {
  const routeManifestPath = path.join(ecosystemRoot, "Chips-SDK", "src", "contracts", "route-manifest.json");
  const routeManifest = readJsonFile(routeManifestPath, { routes: {} });
  const routes = isPlainObject(routeManifest.routes) ? routeManifest.routes : {};
  const namespaceCounts = {};
  const permissions = new Set();

  for (const [routeKey, descriptor] of Object.entries(routes)) {
    const namespace = routeKey.split(".")[0] ?? "unknown";
    namespaceCounts[namespace] = (namespaceCounts[namespace] ?? 0) + 1;
    for (const permission of descriptor.permission ?? []) {
      permissions.add(permission);
    }
  }

  const componentGallery = createComponentGalleryReport({ ecosystemRoot });
  const themeInspect = createThemeInspectReport({ ecosystemRoot });
  const qualityGate = createQualityGateReport({ projectRoot, ecosystemRoot });

  const checks = [
    makeCheck("routeManifest", Object.keys(routes).length > 0 ? "passed" : "failed", {
      path: routeManifestPath,
      routeCount: Object.keys(routes).length
    }),
    makeCheck("componentGallery", componentGallery.summary.status, componentGallery.summary),
    makeCheck("themeInspect", themeInspect.summary.status, themeInspect.summary),
    makeCheck("qualityGate", qualityGate.summary.status, qualityGate.summary)
  ];

  return {
    ...createReportBase("chipsdev.diagnostics"),
    input: { projectRoot, ecosystemRoot },
    routes: {
      path: routeManifestPath,
      routeCount: Object.keys(routes).length,
      namespaceCounts,
      permissions: [...permissions].sort()
    },
    summaries: {
      componentGallery: componentGallery.summary,
      themeInspect: themeInspect.summary,
      qualityGate: qualityGate.summary
    },
    checks,
    summary: {
      status: summarizeStatus(checks),
      failedCheckCount: checks.filter((check) => check.status === "failed").length,
      warningCheckCount: checks.filter((check) => check.status === "warning").length
    }
  };
}

module.exports = {
  createAssimilationScanReport,
  createComponentGalleryReport,
  createDiagnosticsReport,
  createPreviewReport,
  createQualityGateReport,
  createThemeInspectReport,
  inspectThemeDirectory
};
