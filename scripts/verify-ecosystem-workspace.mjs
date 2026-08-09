import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rootPackagePath = path.join(root, "package.json");
const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, "utf8"));

const expectedWorkspacePatterns = [
  "Chips-*",
  "Chips-BaseCardPlugin/*",
  "Chips-ModulePlugin/*",
  "Chips-Scaffold/*"
];

const requiredWorkspaceSpecs = new Map([
  ["Chips-CardViewer/package.json", new Map([
    ["dependencies.antd", "6.5.4"],
    ["dependencies.@chips/ui", "0.1.0"],
    ["devDependencies.chips-sdk", "^0.1.0"]
  ])],
  ["Chips-PhotoViewer/package.json", new Map([
    ["dependencies.antd", "6.5.4"],
    ["dependencies.@chips/ui", "0.1.0"],
    ["devDependencies.chips-sdk", "^0.1.0"]
  ])],
  ["Chips-BaseCardPlugin/richtext-BCP/package.json", new Map([
    ["devDependencies.chips-sdk", "^0.1.0"]
  ])]
]);

const requiredTemplateSpecs = new Map([
  ["Chips-Scaffold/chips-scaffold-app/templates/app-standard/package.json.tpl", [
    "\"@chips/ui\": \"0.1.0\"",
    "\"antd\": \"6.5.4\"",
    "\"chips-sdk\": \"^0.1.0\""
  ]],
  ["Chips-Scaffold/chips-scaffold-basecard/templates/card-standard/package.json.tpl", [
    "\"jsdom\": \"^28.1.0\"",
    "\"chips-sdk\": \"^0.1.0\""
  ]]
]);

const requiredRootVolta = {
  node: "22.18.0",
  npm: "10.9.3"
};

const requiredRootToolDependencies = {
  "devDependencies.chips-host": "0.1.0",
  "devDependencies.chips-sdk": "0.1.0"
};

const requiredTemplateFiles = new Map([
  ["Chips-Scaffold/chips-scaffold-basecard/templates/card-standard", [
    "vitest.config.mts.tpl",
    "chips.config.mjs.tpl",
    "manifest.yaml.tpl"
  ]]
]);

const requiredTemplateContent = new Map([
  ["Chips-Scaffold/chips-scaffold-basecard/templates/card-standard/chips.config.mjs.tpl", [
    'type: "card"',
    'testsDir: "./tests"'
  ]],
  ["Chips-Scaffold/chips-scaffold-basecard/templates/card-standard/manifest.yaml.tpl", [
    "entry: dist/index.mjs"
  ]],
  ["Chips-Scaffold/chips-scaffold-basecard/templates/card-standard/vitest.config.mts.tpl", [
    'environment: "jsdom"'
  ]]
]);

const getByPath = (value, dottedPath) => {
  return dottedPath.split(".").reduce((current, key) => {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    return current[key];
  }, value);
};

const escapeRegex = (value) => value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");

const workspacePatternToRegex = (pattern) => {
  const normalized = pattern.split(path.sep).join("/");
  let source = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === "*") {
      if (normalized[index + 1] === "*") {
        source += ".*";
        index += 1;
      } else {
        source += "[^/]+";
      }
      continue;
    }
    source += escapeRegex(char);
  }
  source += "$";
  return new RegExp(source);
};

const workspacePatternMatches = (pattern, relativePath) => {
  return workspacePatternToRegex(pattern).test(relativePath.split(path.sep).join("/"));
};

const collectWorkspacePackagePaths = (workspacePatterns) => {
  const matches = [];
  const ignoredDirectories = new Set([".git", "node_modules", "dist", "release-artifacts", "归档"]);

  const visit = (currentDir, relativeDir = "") => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }
      const nextDir = path.join(currentDir, entry.name);
      const nextRelativeDir = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
      const packageJsonPath = path.join(nextDir, "package.json");
      if (
        fs.existsSync(packageJsonPath) &&
        workspacePatterns.some((pattern) => workspacePatternMatches(pattern, nextRelativeDir))
      ) {
        matches.push(path.join(nextRelativeDir, "package.json").split(path.sep).join("/"));
      }
      visit(nextDir, nextRelativeDir);
    }
  };

  visit(root);
  return matches.sort((left, right) => left.localeCompare(right));
};

const errors = [];

for (const pattern of expectedWorkspacePatterns) {
  if (!rootPackage.workspaces || !rootPackage.workspaces.includes(pattern)) {
    errors.push(`缺少根 workspace 模式：${pattern}`);
  }
}

for (const [field, expectedValue] of Object.entries(requiredRootVolta)) {
  if (rootPackage.volta?.[field] !== expectedValue) {
    errors.push(`根 package.json 的 volta.${field} 应为 ${expectedValue}，当前为 ${String(rootPackage.volta?.[field])}`);
  }
}

for (const [fieldPath, expectedValue] of Object.entries(requiredRootToolDependencies)) {
  const actualValue = getByPath(rootPackage, fieldPath);
  if (actualValue !== expectedValue) {
    errors.push(`根 package.json 的 ${fieldPath} 应为 ${expectedValue}，当前为 ${String(actualValue)}`);
  }
}

for (const [relativePath, expectations] of requiredWorkspaceSpecs) {
  const absolutePath = path.join(root, relativePath);
  const manifest = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  for (const [fieldPath, expectedValue] of expectations) {
    const actualValue = getByPath(manifest, fieldPath);
    if (actualValue !== expectedValue) {
      errors.push(`${relativePath} 的 ${fieldPath} 应为 ${expectedValue}，当前为 ${String(actualValue)}`);
    }
  }
}

for (const [relativePath, snippets] of requiredTemplateSpecs) {
  const absolutePath = path.join(root, relativePath);
  const content = fs.readFileSync(absolutePath, "utf8");
  if (content.includes("file:")) {
    errors.push(`${relativePath} 不允许再出现 file: 依赖。`);
  }
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      errors.push(`${relativePath} 缺少依赖声明：${snippet}`);
    }
  }
}

for (const [relativeDir, fileNames] of requiredTemplateFiles) {
  const absoluteDir = path.join(root, relativeDir);
  for (const fileName of fileNames) {
    const absolutePath = path.join(absoluteDir, fileName);
    if (!fs.existsSync(absolutePath)) {
      errors.push(`${relativeDir} 缺少模板文件：${fileName}`);
    }
  }
}

for (const [relativePath, snippets] of requiredTemplateContent) {
  const absolutePath = path.join(root, relativePath);
  const content = fs.readFileSync(absolutePath, "utf8");
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      errors.push(`${relativePath} 缺少必要内容：${snippet}`);
    }
  }
}

const workspacePackagePaths = collectWorkspacePackagePaths(expectedWorkspacePatterns);
for (const relativePackagePath of workspacePackagePaths) {
  const absolutePath = path.join(root, relativePackagePath);
  const pkg = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const packageDir = path.dirname(absolutePath);
  const expectedExtends = path
    .relative(packageDir, rootPackagePath)
    .split(path.sep)
    .join("/");
  if (pkg.volta?.extends !== expectedExtends) {
    errors.push(`${relativePackagePath} 的 volta.extends 应为 ${expectedExtends}，当前为 ${String(pkg.volta?.extends)}`);
  }
}

if (errors.length > 0) {
  console.error("生态工作区校验失败：");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("生态工作区校验通过。");
