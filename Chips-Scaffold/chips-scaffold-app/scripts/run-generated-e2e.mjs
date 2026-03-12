#!/usr/bin/env node

import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const ECOSYSTEM_ROOT = path.resolve(ROOT, "..", "..");

async function symlinkDir(sourceDir, targetDir) {
  const linkType = process.platform === "win32" ? "junction" : "dir";
  await symlink(sourceDir, targetDir, linkType);
}

async function createWorkspaceSandbox(sandboxRoot) {
  await writeFile(
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
  ]) {
    await symlinkDir(
      path.join(ECOSYSTEM_ROOT, entry),
      path.join(sandboxRoot, entry),
    );
  }
}

/** 在 CI 中从模板生成示例工程并执行基础命令，用作端到端质量门禁。 */

async function main() {
  const sandboxRoot = await mkdtemp(
    path.join(os.tmpdir(), "chips-app-scaffold-e2e-"),
  );
  const projectRelativePath = path.join("validation-projects", "app-e2e");
  const projectDir = path.join(sandboxRoot, projectRelativePath);
  const sdkCliPath = path.join(sandboxRoot, "Chips-SDK", "cli", "index.js");
  const env = {
    ...process.env,
    CHIPS_ECOSYSTEM_ROOT: sandboxRoot,
  };

  try {
    await createWorkspaceSandbox(sandboxRoot);

    const commands = [
      ["node", [sdkCliPath, "create", "app", projectRelativePath], { cwd: sandboxRoot, env }],
      ["npm", ["install"], { cwd: sandboxRoot, env }],
      ["npm", ["run", "lint"], { cwd: projectDir }],
      ["npm", ["test"], { cwd: projectDir }],
      ["npm", ["run", "build"], { cwd: projectDir }],
      ["npm", ["run", "validate"], { cwd: projectDir }],
    ];

    for (const [cmd, args, opts] of commands) {
      const result = spawnSync(cmd, args, {
        stdio: "inherit",
        ...opts,
      });
      if (result.status !== 0) {
        process.exitCode = result.status ?? 1;
        return;
      }
    }

    const generatedPackage = JSON.parse(
      await readFile(path.join(projectDir, "package.json"), "utf8"),
    );
    if (
      generatedPackage.dependencies?.["@chips/component-library"] !== "^0.1.0"
    ) {
      throw new Error("E2E: 应用模板必须保留正式 semver 组件库依赖");
    }
    if (generatedPackage.devDependencies?.["chips-sdk"] !== "^0.1.0") {
      throw new Error("E2E: 应用模板必须保留正式 semver SDK 依赖");
    }
    if (generatedPackage.volta?.extends !== "../../package.json") {
      throw new Error("E2E: chipsdev create 应为新工程写入根工作区 volta.extends");
    }
    try {
      await readFile(path.join(projectDir, "template.json"), "utf8");
      throw new Error("E2E: 生成工程不应包含模板内部元数据文件 template.json");
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
  } finally {
    await rm(sandboxRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("[run-generated-e2e] 执行失败", error);
  process.exitCode = 1;
});
