#!/usr/bin/env node

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const childProcess = require("node:child_process");

function run(command, args, options) {
  childProcess.execFileSync(command, args, { stdio: "inherit", ...options });
}

function shouldCopyWorkspacePath(sourceRoot, entryPath) {
  const relativePath = path.relative(sourceRoot, entryPath);
  if (relativePath.length === 0) {
    return true;
  }
  const segments = relativePath.split(path.sep);
  return !segments.includes("node_modules") && !segments.includes(".git");
}

async function copyWorkspaceDir(source, target) {
  await fsp.cp(source, target, {
    recursive: true,
    dereference: true,
    filter: (entryPath) => shouldCopyWorkspacePath(source, entryPath),
  });
}

async function symlinkWorkspaceDir(source, target) {
  const type = process.platform === "win32" ? "junction" : "dir";
  await fsp.symlink(source, target, type);
}

async function readText(filePath) {
  return fsp.readFile(filePath, "utf8");
}

async function assertPathExists(filePath, message) {
  if (!fs.existsSync(filePath)) {
    throw new Error(message);
  }
}

async function assertPathMissing(filePath, message) {
  if (fs.existsSync(filePath)) {
    throw new Error(message);
  }
}

function extractManifestLayoutType(manifestText) {
  const layoutBlock = manifestText.match(/(?:^|\n)layout:\n(?<body>(?:\s{2}.+\n?)+)/u)?.groups?.body ?? "";
  return layoutBlock.match(/layoutType:\s*(?<layoutType>[^\s#]+)/u)?.groups?.layoutType;
}

function extractSourceLayoutType(sourceText) {
  return sourceText.match(/layoutType:\s*"(?<layoutType>[^"]+)"/u)?.groups?.layoutType;
}

async function collectTextFiles(rootDir) {
  const textExtensions = new Set([
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
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") {
          continue;
        }
        stack.push(entryPath);
        continue;
      }
      if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

async function assertNoLegacyBoxRuntimeFields(targetDir) {
  const forbiddenPattern = /\b(?:cardId|cardInfo|cardFile|card-window)\b/u;
  const files = await collectTextFiles(targetDir);

  for (const filePath of files) {
    const source = await readText(filePath);
    if (forbiddenPattern.test(source)) {
      throw new Error(`E2E: 生成工程包含旧 Box Runtime 字段：${path.relative(targetDir, filePath)}`);
    }
  }
}

async function main() {
  const ecosystemRoot = path.resolve(__dirname, "../../..");
  const tmpRoot = await fsp.mkdtemp(
    path.join(os.tmpdir(), "chips-boxlayout-scaffold-e2e-")
  );
  const targetRelativePath = path.join("validation-projects", "layout-smoke");
  const targetDir = path.join(tmpRoot, targetRelativePath);
  const cliPath = path.join(tmpRoot, "Chips-SDK", "cli", "index.js");
  const commandEnv = {
    ...process.env,
    CHIPS_ECOSYSTEM_ROOT: tmpRoot,
    NPM_CONFIG_CACHE:
      process.env.NPM_CONFIG_CACHE || path.join(tmpRoot, ".npm-cache"),
    npm_config_cache:
      process.env.npm_config_cache || path.join(tmpRoot, ".npm-cache"),
  };

  try {
    await symlinkWorkspaceDir(
      path.join(ecosystemRoot, "Chips-SDK"),
      path.join(tmpRoot, "Chips-SDK")
    );
    await symlinkWorkspaceDir(
      path.join(ecosystemRoot, "Chips-Scaffold"),
      path.join(tmpRoot, "Chips-Scaffold")
    );
    await symlinkWorkspaceDir(
      path.join(ecosystemRoot, "Chips-Ui"),
      path.join(tmpRoot, "Chips-Ui")
    );
    await copyWorkspaceDir(
      path.join(ecosystemRoot, "Chips-ComponentLibrary"),
      path.join(tmpRoot, "Chips-ComponentLibrary")
    );

    await fsp.writeFile(
      path.join(tmpRoot, "package.json"),
      `${JSON.stringify(
        {
          name: "chips-boxlayout-scaffold-e2e-workspace",
          private: true,
          volta: {
            node: process.versions.node,
            npm: "10.9.3",
          },
          workspaces: [
            "Chips-SDK",
            "Chips-Ui",
            "Chips-ComponentLibrary/packages/*",
            "Chips-ComponentLibrary/packages/adapters/*",
            "Chips-Scaffold/*",
          ],
        },
        null,
        2
      )}\n`,
      "utf-8"
    );

    run(process.execPath, [cliPath, "create", "layout", targetRelativePath], {
      cwd: tmpRoot,
      env: commandEnv,
    });

    const requiredFiles = [
      "manifest.yaml",
      "README.md",
      ".eslintrc.cjs",
      path.join("src", "index.ts"),
      path.join("src", "view", "page.tsx"),
      path.join("src", "editor", "panel.tsx"),
      path.join("src", "editor", "frame-region-editor.tsx"),
      path.join("tests", "unit", "schema.test.ts"),
    ];

    for (const relativePath of requiredFiles) {
      await assertPathExists(
        path.join(targetDir, relativePath),
        `E2E: 生成工程缺少 ${relativePath}`
      );
    }
    await assertPathMissing(
      path.join(targetDir, "template.json"),
      "E2E: 生成工程不应包含 template.json"
    );
    await assertNoLegacyBoxRuntimeFields(targetDir);

    const rootPackage = JSON.parse(await readText(path.join(tmpRoot, "package.json")));
    if (!rootPackage.workspaces.includes("validation-projects/layout-smoke")) {
      throw new Error("E2E: chipsdev-r create layout 未把生成工程登记到临时生态工作区。");
    }

    const createdPackage = JSON.parse(await readText(path.join(targetDir, "package.json")));
    if (createdPackage.volta?.extends !== "../../package.json") {
      throw new Error("E2E: 生成工程 package.json 未继承生态根 Volta 配置。");
    }

    run("npm", ["install"], {
      cwd: tmpRoot,
      env: commandEnv,
    });

    run("npm", ["run", "verify"], {
      cwd: targetDir,
      env: commandEnv,
    });

    const manifestText = await readText(path.join(targetDir, "manifest.yaml"));
    if (!/entry:\s*dist\/index\.mjs/u.test(manifestText)) {
      throw new Error("E2E: manifest.entry 必须指向 dist/index.mjs。");
    }
    const manifestLayoutType = extractManifestLayoutType(manifestText);
    const sourceLayoutType = extractSourceLayoutType(
      await readText(path.join(targetDir, "src", "index.ts"))
    );
    if (!manifestLayoutType || manifestLayoutType !== sourceLayoutType) {
      throw new Error(
        `E2E: manifest.layout.layoutType 与 layoutDefinition.layoutType 不一致：${manifestLayoutType} / ${sourceLayoutType}`
      );
    }

    await assertPathExists(
      path.join(targetDir, "dist", "index.mjs"),
      "E2E: 生成工程 verify 后缺少 dist/index.mjs"
    );
    const distFiles = await fsp.readdir(path.join(targetDir, "dist"));
    const cpkFiles = distFiles.filter((name) => name.endsWith(".cpk"));
    if (cpkFiles.length !== 1) {
      throw new Error(`E2E: 生成工程 dist/ 下应有唯一 .cpk 输出，实际为 ${cpkFiles.length} 个。`);
    }

    console.log("E2E: 真实 chipsdev-r create layout 与生成工程 verify 通过。");
  } catch (error) {
    console.error("E2E: 生成工程失败", error);
    process.exitCode = 1;
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

void main();
