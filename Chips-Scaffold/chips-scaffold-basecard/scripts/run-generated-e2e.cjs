#!/usr/bin/env node

/**
 * 通过 chipsdev-r create card 生成标准基础卡片插件工程，并执行正式默认门禁。
 */

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const childProcess = require("node:child_process");

const TEXT_FILE_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

function run(command, args, options) {
  const result = childProcess.spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status}`);
  }
}

async function symlinkDir(sourceDir, targetDir) {
  const linkType = process.platform === "win32" ? "junction" : "dir";
  await fsp.symlink(sourceDir, targetDir, linkType);
}

async function createWorkspaceSandbox(sandboxRoot) {
  await fsp.writeFile(
    path.join(sandboxRoot, "package.json"),
    JSON.stringify(
      {
        name: "chips-ecosystem-workspace",
        private: true,
        packageManager: "npm@10.9.3",
        volta: {
          node: process.versions.node,
          npm: "10.9.3",
        },
        workspaces: [
          "Chips-*",
          "Chips-BaseCardPlugin/*",
          "Chips-ComponentLibrary/packages/*",
          "Chips-ComponentLibrary/packages/adapters/*",
          "Chips-Scaffold/*",
          "ThemePack/*",
        ],
        overrides: {
          tldts: "7.0.30",
          "tldts-core": "7.0.30",
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  for (const entry of [
    "Chips-SDK",
    "Chips-Scaffold",
    "Chips-ComponentLibrary",
    "Chips-Ui",
    "ThemePack",
  ]) {
    await symlinkDir(
      path.join(path.resolve(__dirname, "..", "..", ".."), entry),
      path.join(sandboxRoot, entry),
    );
  }
}

async function collectGeneratedTextFiles(dir) {
  const files = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["dist", "node_modules", "reports"].includes(entry.name)) {
        continue;
      }
      files.push(...await collectGeneratedTextFiles(entryPath));
      continue;
    }
    if (entry.isFile() && TEXT_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }
  return files;
}

async function assertGeneratedTextIsClean(projectDir) {
  const files = await collectGeneratedTextFiles(projectDir);
  for (const filePath of files) {
    const relativePath = path.relative(projectDir, filePath);
    const source = await fsp.readFile(filePath, "utf8");
    for (const [pattern, message] of [
      [/\{\{\s*[A-Z0-9_]+\s*\}\}/, "存在未渲染模板占位符"],
      [/\bchips dev\b/, "存在旧 chips dev 命令文本"],
      [/chips-scaffold-basecard/, "泄露脚手架包名"],
      [/\b(?:TODO|FIXME)\b/i, "存在未收口标记"],
    ]) {
      if (pattern.test(source)) {
        throw new Error(`E2E: ${relativePath} ${message}：${pattern}`);
      }
    }
  }
}

async function main() {
  const workspaceRoot = path.join(__dirname, "..");
  const tmpRoot = await fsp.mkdtemp(
    path.join(os.tmpdir(), "chips-basecard-scaffold-e2e-"),
  );
  const targetRelativePath = path.join("validation-projects", "card-e2e");
  const targetDir = path.join(tmpRoot, targetRelativePath);
  const sdkCliPath = path.join(tmpRoot, "Chips-SDK", "cli", "index.js");
  const npmCacheDir = path.join(tmpRoot, ".npm-cache");
  const commandEnv = {
    ...process.env,
    CHIPS_ECOSYSTEM_ROOT: tmpRoot,
    NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE || npmCacheDir,
    npm_config_cache: process.env.npm_config_cache || npmCacheDir,
  };

  try {
    await createWorkspaceSandbox(tmpRoot);

    run("node", [sdkCliPath, "create", "card", targetRelativePath], {
      cwd: tmpRoot,
      env: commandEnv,
    });
    run("npm", ["install", "--cache", npmCacheDir], {
      cwd: tmpRoot,
      env: commandEnv,
    });
    run("npm", ["run", "verify"], {
      cwd: targetDir,
      env: commandEnv,
    });

    const requiredFiles = [
      "manifest.yaml",
      "README.md",
      ".eslintrc.cjs",
      "vitest.config.mts",
      path.join("src", "lib", "messages.ts"),
      path.join("tests", "unit", "schema.test.ts"),
      path.join("tests", "unit", "render-view.test.tsx"),
      path.join("tests", "unit", "editor-panel.test.tsx"),
      path.join("tests", "integration", "card-flow.test.ts"),
    ];
    for (const relativePath of requiredFiles) {
      if (!fs.existsSync(path.join(targetDir, relativePath))) {
        throw new Error(`E2E: 生成工程缺少 ${relativePath}`);
      }
    }
    for (const legacyPath of [
      path.join("src", "shared", "i18n.ts"),
      path.join("i18n", "zh-CN.json"),
      path.join("i18n", "en-US.json"),
    ]) {
      if (fs.existsSync(path.join(targetDir, legacyPath))) {
        throw new Error(`E2E: 生成工程不应残留旧多语言文件 ${legacyPath}`);
      }
    }
    if (fs.existsSync(path.join(targetDir, "template.json"))) {
      throw new Error("E2E: 生成工程不应包含脚手架模板元数据 template.json。");
    }

    const rootPackage = JSON.parse(await fsp.readFile(path.join(tmpRoot, "package.json"), "utf8"));
    if (!rootPackage.workspaces.includes("validation-projects/card-e2e")) {
      throw new Error("E2E: chipsdev-r create card 未把生成工程登记到工作区。");
    }

    const generatedPackage = JSON.parse(
      await fsp.readFile(path.join(targetDir, "package.json"), "utf8"),
    );
    for (const scriptName of ["lint", "typecheck", "test", "build", "validate", "package", "verify"]) {
      if (typeof generatedPackage.scripts?.[scriptName] !== "string") {
        throw new Error(`E2E: 生成工程 package.json 缺少脚本 ${scriptName}`);
      }
    }
    if (!generatedPackage.scripts.verify.includes("npm run package")) {
      throw new Error("E2E: verify 必须串联 package 门禁。");
    }
    if (generatedPackage.volta?.extends !== "../../package.json") {
      throw new Error("E2E: chipsdev-r create 应为新工程写入根工作区 volta.extends。");
    }
    if (generatedPackage.dependencies?.["@chips/component-library"] !== undefined) {
      throw new Error("E2E: 基础卡片模板不得依赖已卸担的组件库。");
    }
    for (const [depName, expectedVersion] of [
      ["antd", "6.5.4"],
      ["@ant-design/icons", "6.3.2"],
      ["dayjs", "1.11.21"],
      ["@chips/ui", "0.1.0"],
    ]) {
      if (generatedPackage.dependencies?.[depName] !== expectedVersion) {
        throw new Error(`E2E: 基础卡片模板必须锁定 ${depName} ${expectedVersion}。`);
      }
    }
    if (generatedPackage.devDependencies?.["chips-sdk"] !== "^0.1.0") {
      throw new Error("E2E: 基础卡片模板必须保留正式 semver SDK 依赖。");
    }

    const vitestConfig = await fsp.readFile(path.join(targetDir, "vitest.config.mts"), "utf8");
    if (!vitestConfig.includes("dedupe: [\"react\", \"react-dom\"]")) {
      throw new Error("E2E: vitest.config.mts 必须为 React / React DOM 去重。");
    }

    const manifestText = await fsp.readFile(path.join(targetDir, "manifest.yaml"), "utf8");
    for (const requiredPattern of [
      /type:\s*card/,
      /entry:\s*dist\/index\.mjs/,
      /capabilities:\s*\n\s*cardTypes:\s*\n\s*-\s*base\.card\.e2e/,
      /desktop:\s*\n\s*supported:\s*true/,
      /web:\s*\n\s*supported:\s*false/,
      /mobile:\s*\n\s*supported:\s*false/,
      /headless:\s*\n\s*supported:\s*true/,
    ]) {
      if (!requiredPattern.test(manifestText)) {
        throw new Error(`E2E: manifest.yaml 缺少正式字段：${requiredPattern}`);
      }
    }
    if (/ui:\s*\n\s*surface:/.test(manifestText)) {
      throw new Error("E2E: card manifest 不应声明 ui.surface。");
    }

    const indexSource = await fsp.readFile(path.join(targetDir, "src", "index.ts"), "utf8");
    for (const requiredText of [
      "export function renderBasecardView",
      "export function renderBasecardEditor",
      "export const basecardDefinition",
      "openResource?:",
      "importArchiveBundle?:",
      "convertTiffToPng?:",
      "collectResourcePaths",
      'previewPointerEvents: "native"',
    ]) {
      if (!indexSource.includes(requiredText)) {
        throw new Error(`E2E: src/index.ts 缺少契约：${requiredText}`);
      }
    }

    const distEntryPath = path.join(targetDir, "dist", "index.mjs");
    if (!fs.existsSync(distEntryPath)) {
      throw new Error("E2E: verify 未生成 dist/index.mjs。");
    }
    const cpkFiles = (await fsp.readdir(path.join(targetDir, "dist"))).filter((name) =>
      name.endsWith(".cpk"),
    );
    if (cpkFiles.length !== 1) {
      throw new Error("E2E: verify 应生成唯一 .cpk 插件包。");
    }

    await assertGeneratedTextIsClean(targetDir);

    console.log("E2E: chipsdev-r create card 生成工程正式门禁通过。");
  } catch (error) {
    console.error("E2E: 生成工程失败", error);
    process.exitCode = 1;
  } finally {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  }
}

main();
