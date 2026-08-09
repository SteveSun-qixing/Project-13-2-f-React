#!/usr/bin/env node

import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
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

async function readJsonReport(projectDir, relativePath, expectedKind) {
  const reportPath = path.join(projectDir, relativePath);
  let report;
  try {
    report = JSON.parse(await readFile(reportPath, "utf8"));
  } catch (error) {
    throw new Error(
      `E2E: 无法读取报告 ${relativePath}：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (report.kind !== expectedKind) {
    throw new Error(`E2E: 报告 ${relativePath} kind 应为 ${expectedKind}`);
  }
  return report;
}

function requireReportCheck(report, reportName, checkName, allowedStatuses = ["passed"]) {
  const checks = Array.isArray(report.checks) ? report.checks : [];
  const check = checks.find((entry) => entry.name === checkName);
  if (!check) {
    throw new Error(`E2E: ${reportName} 缺少检查项 ${checkName}`);
  }
  if (!allowedStatuses.includes(check.status)) {
    throw new Error(
      `E2E: ${reportName} 检查项 ${checkName} 状态应为 ${allowedStatuses.join("/")}，实际为 ${check.status}`,
    );
  }
  return check;
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
        overrides: {
          "tldts": "7.0.30",
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
    "Chips-Ui",
    "Chips-ComponentLibrary",
    "ThemePack",
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
  const npmCacheDir = path.join(sandboxRoot, ".npm-cache");
  const env = {
    ...process.env,
    CHIPS_ECOSYSTEM_ROOT: sandboxRoot,
    NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE ?? npmCacheDir,
    npm_config_cache: process.env.npm_config_cache ?? npmCacheDir,
  };

  try {
    await createWorkspaceSandbox(sandboxRoot);

    const commands = [
      ["node", [sdkCliPath, "create", "app", projectRelativePath], { cwd: sandboxRoot, env }],
      ["npm", ["install", "--cache", npmCacheDir], { cwd: sandboxRoot, env }],
      ["npm", ["run", "verify"], { cwd: projectDir, env }],
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
    if (generatedPackage.dependencies?.["antd"] !== "6.5.4") {
      throw new Error("E2E: 应用模板必须锁定 antd 6.5.4");
    }
    if (generatedPackage.dependencies?.["@ant-design/icons"] !== "6.3.2") {
      throw new Error("E2E: 应用模板必须锁定 @ant-design/icons 6.3.2");
    }
    if (generatedPackage.dependencies?.["dayjs"] !== "1.11.21") {
      throw new Error("E2E: 应用模板必须锁定 dayjs 1.11.21");
    }
    if (generatedPackage.dependencies?.["@chips/ui"] !== "0.1.0") {
      throw new Error("E2E: 应用模板必须保留正式 semver @chips/ui 依赖");
    }
    if (generatedPackage.dependencies?.["@chips/component-library"] !== undefined) {
      throw new Error("E2E: 应用模板不得依赖已卸担的 @chips/component-library");
    }
    if (generatedPackage.devDependencies?.["chips-sdk"] !== "^0.1.0") {
      throw new Error("E2E: 应用模板必须保留正式 semver SDK 依赖");
    }
    if (generatedPackage.volta?.extends !== "../../package.json") {
      throw new Error("E2E: chipsdev-r create 应为新工程写入根工作区 volta.extends");
    }
    for (const scriptName of ["typecheck", "preview:smoke", "quality:gate", "verify"]) {
      if (typeof generatedPackage.scripts?.[scriptName] !== "string") {
        throw new Error(`E2E: 应用模板 package.json 缺少脚本 ${scriptName}`);
      }
    }
    if (!generatedPackage.scripts.verify.includes("npm run preview:smoke")) {
      throw new Error("E2E: verify 必须串联 preview:smoke");
    }
    if (!generatedPackage.scripts.verify.includes("npm run quality:gate")) {
      throw new Error("E2E: verify 必须串联 quality:gate");
    }

    const manifestText = await readFile(path.join(projectDir, "manifest.yaml"), "utf8");
    for (const permission of ["command.read", "command.write", "command.invoke"]) {
      if (!manifestText.includes(`  - ${permission}`)) {
        throw new Error(`E2E: 应用模板 manifest 缺少 ${permission}`);
      }
    }
    for (const removedPermission of ["theme.read", "i18n.read", "i18n.write"]) {
      if (manifestText.includes(removedPermission)) {
        throw new Error(`E2E: 应用模板 manifest 不应声明 ${removedPermission}`);
      }
    }
    if (/^commands\s*:/m.test(manifestText)) {
      throw new Error("E2E: 应用模板不应生成未冻结的 manifest.commands 字段");
    }
    if (!manifestText.includes("cli:\n  commands:")) {
      throw new Error("E2E: 应用模板应生成 manifest.cli.commands");
    }
    if (!manifestText.includes("commandPath: app-e2e open")) {
      throw new Error("E2E: 应用模板 CLI 命令路径应来自项目名安全命令根");
    }
    for (const requiredText of [
      "target:\n        type: app",
      "pluginId: com.example.app-e2e",
      "surface:\n          open: true",
      "reuse: preferred",
      "titleKey: app.cli.open.title",
      "descriptionKey: app.cli.open.description",
      "mapsTo: subject",
      "placeholderKey: app.cli.open.subjectPlaceholder",
    ]) {
      if (!manifestText.includes(requiredText)) {
        throw new Error(`E2E: 应用模板 CLI 声明缺少 ${requiredText}`);
      }
    }
    for (const forbiddenPattern of [
      /^plugin\s*:/m,
      /^theme\s*:/m,
      /^themeId\s*:/m,
      /^displayName\s*:/m,
      /^module\s*:/m,
      /^layout\s*:/m,
    ]) {
      if (forbiddenPattern.test(manifestText)) {
        throw new Error(`E2E: 应用模板 manifest 不应声明越界字段 ${forbiddenPattern}`);
      }
    }

    let templateMetaPresent = true;
    try {
      await stat(path.join(projectDir, "template.json"));
    } catch {
      templateMetaPresent = false;
    }
    if (templateMetaPresent) {
      throw new Error("E2E: 生成工程不得包含模板元数据文件 template.json");
    }

    const commandSource = await readFile(
      path.join(projectDir, "src", "commands", "app-commands.tsx"),
      "utf8",
    );
    const appSource = await readFile(
      path.join(projectDir, "src", "App.tsx"),
      "utf8",
    );
    const sourceBundle = (
      await Promise.all(
        [
          "src/App.tsx",
          "src/app/AppRoot.tsx",
          "src/app/AppRuntimeProvider.tsx",
          "src/app/AppShell.tsx",
          "src/app/scene-registry.ts",
          "src/commands/useAppCommands.ts",
          "src/scenes/MainScene.tsx",
          "src/scenes/SettingsScene.tsx",
          "src/views/WorkspaceOverviewView.tsx",
          "src/views/StateBindingView.tsx",
          "src/views/SceneListView.tsx",
          "src/views/EnvironmentStatusView.tsx",
          "src/views/RuntimeDiagnosticsView.tsx",
          "src/lib/messages.ts",
          "src/runtime/launch-context.ts",
          "src/testing/mock-environment.ts",
          "src/testing/render-with-antd.tsx",
        ].map((relativePath) => readFile(path.join(projectDir, relativePath), "utf8")),
      )
    ).join("\n");
    const commandRuntimeSource = await readFile(
      path.join(projectDir, "src", "commands", "useAppCommands.ts"),
      "utf8",
    );
    const appTestSource = await readFile(
      path.join(projectDir, "tests", "unit", "app.test.tsx"),
      "utf8",
    );
    const commandTestSource = await readFile(
      path.join(projectDir, "tests", "unit", "commands.test.ts"),
      "utf8",
    );
    for (const requiredText of [
      "CommandItem",
      "createAppCommands",
      "appCommandDefinitions",
      "titleKey",
      "descriptionKey",
      "ariaLabelKey",
      "handlerId",
      "menuPlacement",
      "toolbarPlacement",
      "paletteKeywords",
      "menuId",
      "toolbarId",
      "@ant-design/icons",
    ]) {
      if (!commandSource.includes(requiredText)) {
        throw new Error(`E2E: command 定义缺少 ${requiredText}`);
      }
    }
    for (const requiredText of [
      "client.command.register",
      "client.command.invoke",
      "client.command.onInvoked",
      "useCommandRegistry",
      "register(commands)",
    ]) {
      if (!commandRuntimeSource.includes(requiredText)) {
        throw new Error(`E2E: command runtime 缺少 ${requiredText}`);
      }
    }
    for (const requiredText of [
      "ConfigProvider",
      "appleTheme",
      "ChipsProvider",
      "CommandProvider",
      "AppChrome",
      "useCommandRegistry",
      "useAppCommands",
      "useAppRuntime",
      "AppRuntimeProvider",
      "useChips",
      "formatMessage",
      "renderWithAntd",
    ]) {
      if (!sourceBundle.includes(requiredText)) {
        throw new Error(`E2E: App 环境入口缺少 ${requiredText}`);
      }
    }
    if (!appSource.includes("export { AppRoot as App } from \"./app/AppRoot\";")) {
      throw new Error("E2E: src/App.tsx 应保持轻量根组件 re-export");
    }
    for (const requiredText of ["formatMessage", "sceneDefinitions", "renderWithAntd", "resolveRuntimeSceneId"]) {
      if (!appTestSource.includes(requiredText)) {
        throw new Error(`E2E: app 单元测试缺少新体系覆盖 ${requiredText}`);
      }
    }
    for (const requiredText of [
      "chips-sdk/testing",
      "createMockChipsClient",
      "createAppCommands",
      "command.onInvoked",
      "isAppCommandInvokedEvent",
      "APP_COMMAND_IDS",
    ]) {
      if (!commandTestSource.includes(requiredText)) {
        throw new Error(`E2E: command 单元测试缺少 SDK testing mock 覆盖 ${requiredText}`);
      }
    }
    if (/@chips\/component-library/.test(`${sourceBundle}\n${commandSource}\n${commandRuntimeSource}`)) {
      throw new Error("E2E: 应用模板不得引用已卸担的 @chips/component-library");
    }
    if (/\bChipsEnvironmentProvider\b|\bChipsThemeProvider\b|\buseChipsI18n\b|\buseChipsTheme\b/.test(sourceBundle)) {
      throw new Error("E2E: 应用模板不得残留已卸担的 Environment hooks");
    }
    if (/window\.chips\.invoke\(["']command\./.test(commandRuntimeSource)) {
      throw new Error("E2E: command runtime 不得绕过 SDK 直连 Bridge action");
    }
    if (/\buseChipsBridge\b/.test(`${sourceBundle}\n${commandRuntimeSource}`)) {
      throw new Error("E2E: 应用模板不得生成旧的 useChipsBridge 私有入口");
    }
    if (/style=\{\{/.test(sourceBundle)) {
      throw new Error("E2E: 应用模板源码不得使用 inline style");
    }
    if (/--chips-sys-|--chips-base-|data-scope=/.test(sourceBundle)) {
      throw new Error("E2E: 应用模板源码不得残留旧主题变量或 data-scope 结构");
    }
    if (/\bapp-standard\b|\bchips-scaffold-app\b|\bExamplePanel\b/.test(sourceBundle)) {
      throw new Error("E2E: 应用模板源码不得泄漏模板身份或旧示例面板");
    }

    const previewReport = await readJsonReport(
      projectDir,
      path.join("reports", "preview", "app-preview-smoke.json"),
      "chipsdev.preview",
    );
    if (previewReport.previewPlan?.mode !== "mock" || previewReport.previewPlan?.target !== "app") {
      throw new Error("E2E: preview smoke 报告必须记录 mock/app 预览计划");
    }
    if (previewReport.previewPlan?.reportOnly !== true) {
      throw new Error("E2E: preview smoke 当前必须保持 reportOnly 报告边界");
    }
    if (previewReport.summary?.blockingCheckCount !== 0) {
      throw new Error("E2E: preview smoke 报告不得存在阻断检查");
    }
    for (const checkName of [
      "project.config",
      "manifest",
      "manifest.runtimeTargets",
      "manifest.surface",
      "manifest.entryAsset",
      "host.mock",
    ]) {
      requireReportCheck(previewReport, "preview smoke 报告", checkName);
    }
    requireReportCheck(previewReport, "preview smoke 报告", "host.realWorkspace", ["passed", "warning"]);

    const qualityReport = await readJsonReport(
      projectDir,
      path.join("reports", "quality", "quality-gate.json"),
      "chipsdev.quality.gate",
    );
    if (qualityReport.project?.manifestType !== "app") {
      throw new Error("E2E: quality gate 报告必须识别生成工程为 app 插件");
    }
    if (qualityReport.summary?.failedCheckCount !== 0) {
      throw new Error("E2E: quality gate 报告不得存在 failed 检查");
    }
    for (const check of Array.isArray(qualityReport.checks) ? qualityReport.checks : []) {
      if (check.status === "failed") {
        throw new Error(`E2E: quality gate 检查项 ${check.name} 不得失败`);
      }
    }
    for (const checkName of [
      "project.package",
      "project.chipsConfig",
      "project.manifest",
      "sdk.routeManifest",
      "componentLibrary.qualityGateLatest",
      "componentLibrary.perfLatest",
      "theme.inspect",
    ]) {
      requireReportCheck(qualityReport, "quality gate 报告", checkName, ["passed", "warning"]);
    }
  } finally {
    await rm(sandboxRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("[run-generated-e2e] 执行失败", error);
  process.exitCode = 1;
});
