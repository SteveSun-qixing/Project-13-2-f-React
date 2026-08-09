#!/usr/bin/env node

import { readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const TEMPLATES_ROOT = path.join(ROOT, "templates");

/** 简单的模板完整性检查脚本，用于在 CI 中作为质量门禁的一部分。 */

async function collectTemplateSourceFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTemplateSourceFiles(entryPath));
      continue;
    }
    if (entry.isFile() && /\.(?:ts|tsx|js|jsx|mjs|cjs)\.tpl$/.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

async function collectTextTemplateFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTextTemplateFiles(entryPath));
      continue;
    }
    if (entry.isFile() && (entry.name.endsWith(".tpl") || entry.name === "template.json")) {
      files.push(entryPath);
    }
  }
  return files;
}

function readPath(source, key) {
  return key.split(".").reduce((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    return current[segment];
  }, source);
}

function collectRegexGroupValues(text, pattern) {
  const values = new Set();
  for (const match of text.matchAll(pattern)) {
    if (match[1]) {
      values.add(match[1]);
    }
  }
  return values;
}

async function main() {
  const entries = await readdir(TEMPLATES_ROOT, { withFileTypes: true });
  const templateDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (templateDirs.length === 0) {
    console.error("[check-templates] 未找到任何模板目录");
    process.exitCode = 1;
    return;
  }

  const requiredFiles = [
    "template.json",
    "manifest.yaml.tpl",
    "package.json.tpl",
    ".eslintrc.cjs.tpl",
    "tsconfig.json.tpl",
    "chips.config.mjs.tpl",
    "README.md.tpl",
    "index.html.tpl",
    "src/main.tsx.tpl",
    "src/App.tsx.tpl",
    "src/app/AppRoot.tsx.tpl",
    "src/app/AppRuntimeProvider.tsx.tpl",
    "src/app/AppShell.tsx.tpl",
    "src/app/app-shell.css.tpl",
    "src/app/scene-registry.ts.tpl",
    "config/app-config.ts.tpl",
    "config/logging.ts.tpl",
    "src/lib/messages.ts.tpl",
    "src/runtime/chips-client.ts.tpl",
    "src/runtime/launch-context.ts.tpl",
    "src/scenes/MainScene.tsx.tpl",
    "src/scenes/SettingsScene.tsx.tpl",
    "src/views/WorkspaceOverviewView.tsx.tpl",
    "src/views/StateBindingView.tsx.tpl",
    "src/views/SceneListView.tsx.tpl",
    "src/views/EnvironmentStatusView.tsx.tpl",
    "src/views/RuntimeDiagnosticsView.tsx.tpl",
    "src/commands/app-commands.tsx.tpl",
    "src/commands/useAppCommands.ts.tpl",
    "src/testing/mock-environment.ts.tpl",
    "src/testing/render-with-antd.tsx.tpl",
    "src/preview/preview-smoke.js.tpl",
    "tests/unit/app.test.tsx.tpl",
    "tests/unit/commands.test.ts.tpl",
    "tests/e2e/basic-flow.test.ts.tpl"
  ];

  let hasError = false;

  for (const dir of templateDirs) {
    const base = path.join(TEMPLATES_ROOT, dir);
    try {
      const metaPath = path.join(base, "template.json");
      const raw = await readFile(metaPath, "utf8");
      const meta = JSON.parse(raw);
      if (!meta.id || meta.id !== dir) {
        console.error(
          `[check-templates] 模板 ${dir} 的 template.json.id 不匹配目录名`,
        );
        hasError = true;
      }
    } catch (error) {
      console.error(
        `[check-templates] 模板 ${dir} 的 template.json 无法读取或解析`,
        error,
      );
      hasError = true;
    }

    for (const rel of requiredFiles) {
      const p = path.join(base, rel);
      try {
        const s = await stat(p);
        if (!s.isFile()) {
          console.error(
            `[check-templates] 模板 ${dir} 缺少关键文件（非文件）：${rel}`,
          );
          hasError = true;
        }
      } catch {
        console.error(
          `[check-templates] 模板 ${dir} 缺少关键文件：${rel}`,
        );
        hasError = true;
      }
    }

    try {
      const packageText = await readFile(path.join(base, "package.json.tpl"), "utf8");
      const packageJson = JSON.parse(packageText);
      for (const scriptName of ["typecheck", "preview:smoke", "quality:gate", "verify"]) {
        if (typeof packageJson.scripts?.[scriptName] !== "string") {
          console.error(
            `[check-templates] 模板 ${dir} package.json.tpl 缺少脚本：${scriptName}`,
          );
          hasError = true;
        }
      }
      if (!packageJson.scripts?.verify?.includes("npm run preview:smoke")) {
        console.error(
          `[check-templates] 模板 ${dir} verify 脚本必须串联 preview:smoke`,
        );
        hasError = true;
      }
      if (!packageJson.scripts?.verify?.includes("npm run quality:gate")) {
        console.error(
          `[check-templates] 模板 ${dir} verify 脚本必须串联 quality:gate`,
        );
        hasError = true;
      }
      if (!packageJson.scripts?.["preview:smoke"]?.includes("reports/preview/app-preview-smoke.json")) {
        console.error(
          `[check-templates] 模板 ${dir} preview:smoke 必须归档报告到 reports/preview/app-preview-smoke.json`,
        );
        hasError = true;
      }
      if (!packageJson.scripts?.["quality:gate"]?.includes("reports/quality/quality-gate.json")) {
        console.error(
          `[check-templates] 模板 ${dir} quality:gate 必须归档报告到 reports/quality/quality-gate.json`,
        );
        hasError = true;
      }
      for (const [depName, expectedVersion] of [
        ["antd", "6.5.4"],
        ["@ant-design/icons", "6.3.2"],
        ["dayjs", "1.11.21"],
        ["@chips/ui", "0.1.0"],
      ]) {
        if (packageJson.dependencies?.[depName] !== expectedVersion) {
          console.error(
            `[check-templates] 模板 ${dir} 依赖 ${depName} 必须锁定 ${expectedVersion}`,
          );
          hasError = true;
        }
      }
      if (packageJson.dependencies?.["@chips/component-library"] !== undefined) {
        console.error(
          `[check-templates] 模板 ${dir} 不得依赖已卸担的 @chips/component-library`,
        );
        hasError = true;
      }

      const manifestText = await readFile(path.join(base, "manifest.yaml.tpl"), "utf8");
      for (const permission of ["command.read", "command.write", "command.invoke"]) {
        if (!manifestText.includes(`  - ${permission}`)) {
          console.error(
            `[check-templates] 模板 ${dir} manifest.yaml.tpl 缺少权限：${permission}`,
          );
          hasError = true;
        }
      }
      for (const removedPermission of ["theme.read", "i18n.read", "i18n.write"]) {
        if (manifestText.includes(removedPermission)) {
          console.error(
            `[check-templates] 模板 ${dir} manifest.yaml.tpl 不应声明已移除的权限：${removedPermission}`,
          );
          hasError = true;
        }
      }
      if (/^commands\s*:/m.test(manifestText)) {
        console.error(
          `[check-templates] 模板 ${dir} 不应声明未冻结的 manifest.commands 字段`,
        );
        hasError = true;
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
          console.error(
            `[check-templates] 模板 ${dir} manifest.yaml.tpl 不应声明类型越界或 Host 治理保留字段：${forbiddenPattern}`,
          );
          hasError = true;
        }
      }
      for (const requiredText of [
        "cli:",
        "commands:",
        "commandPath: {{ CLI_COMMAND_ROOT }} open",
        "target:",
        "type: app",
        "pluginId: {{ PLUGIN_ID }}",
        "surface:",
        "open: true",
        "focus: true",
        "reuse: preferred",
        "titleKey: app.cli.open.title",
        "descriptionKey: app.cli.open.description",
        "mapsTo: subject",
        "placeholderKey: app.cli.open.subjectPlaceholder",
      ]) {
        if (!manifestText.includes(requiredText)) {
          console.error(
            `[check-templates] 模板 ${dir} manifest.yaml.tpl 缺少应用 CLI 声明片段：${requiredText}`,
          );
          hasError = true;
        }
      }

      const commandText = await readFile(
        path.join(base, "src/commands/app-commands.tsx.tpl"),
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
        if (!commandText.includes(requiredText)) {
          console.error(
            `[check-templates] 模板 ${dir} command 定义缺少：${requiredText}`,
          );
          hasError = true;
        }
      }

      const sourceFiles = await collectTemplateSourceFiles(path.join(base, "src"));
      const runtimeSourceFiles = sourceFiles.filter(
        (sourcePath) => !sourcePath.includes(`${path.sep}src${path.sep}preview${path.sep}`),
      );
      const sourceText = (
        await Promise.all(
          runtimeSourceFiles.map((sourcePath) => readFile(sourcePath, "utf8")),
        )
      ).join("\n");
      for (const requiredText of [
        "ConfigProvider",
        "appleTheme",
        "ChipsProvider",
        "CommandProvider",
        "useCommandRegistry",
        "useAppCommands",
        "useAppRuntime",
        "AppRuntimeProvider",
        "AppChrome",
        "useChips",
        "formatMessage",
        "renderWithAntd",
      ]) {
        if (!sourceText.includes(requiredText)) {
          console.error(
            `[check-templates] 模板 ${dir} React 环境入口缺少：${requiredText}`,
          );
          hasError = true;
        }
      }
      for (const forbiddenPattern of [
        /@chips\/component-library/,
        /\bChipsEnvironmentProvider\b/,
        /\bChipsThemeProvider\b/,
        /\buseChipsI18n\b/,
        /\buseChipsI18nText\b/,
        /\buseChipsTheme\b/,
        /\buseChipsSurface\b/,
        /\buseChipsPermission\b/,
        /\buseChipsDiagnostics\b/,
        /\bChipsView\b/,
        /\bChipsGrid\b/,
        /\bChipsDialog\b/,
        /\bChipsErrorState\b/,
        /\bChipsIcon\b/,
        /\buseChipsBridge\b/,
        /window\.chips\.invoke\(["']command\./,
        /\bBrowserWindow\b/,
        /\bipcRenderer\b/,
        /\bfrom\s+["'](?:node:)?fs["']/,
        /\brequire\(["'](?:node:)?fs["']\)/,
        /style=\{\{/,
        /\bExamplePanel\b/,
        /--chips-sys-/,
        /data-scope=/,
      ]) {
        if (forbiddenPattern.test(sourceText)) {
          console.error(
            `[check-templates] 模板 ${dir} 源码包含禁止的旧体系模式：${forbiddenPattern}`,
          );
          hasError = true;
        }
      }

      const appShellCss = await readFile(path.join(base, "src/app/app-shell.css.tpl"), "utf8");
      for (const forbiddenPattern of [/--chips-sys-/, /--chips-base-/, /--chips-comp-/, /data-scope/]) {
        if (forbiddenPattern.test(appShellCss)) {
          console.error(
            `[check-templates] 模板 ${dir} 应用私有样式包含旧主题变量：${forbiddenPattern}`,
          );
          hasError = true;
        }
      }

      const generatedFacingFiles = await collectTextTemplateFiles(base);
      const generatedFacingText = (
        await Promise.all(
          generatedFacingFiles
            .filter((filePath) => path.basename(filePath) !== "template.json")
            .map((filePath) => readFile(filePath, "utf8")),
        )
      ).join("\n");
      for (const forbiddenPattern of [/\bapp-standard\b/, /\bchips-scaffold-app\b/, /\bExamplePanel\b/]) {
        if (forbiddenPattern.test(generatedFacingText)) {
          console.error(
            `[check-templates] 模板 ${dir} 生成面文本包含模板身份泄漏：${forbiddenPattern}`,
          );
          hasError = true;
        }
      }

      const messagesText = await readFile(path.join(base, "src/lib/messages.ts.tpl"), "utf8");
      if (!messagesText.includes("export function formatMessage")) {
        console.error(
          `[check-templates] 模板 ${dir} 本地文案表缺少 formatMessage 导出`,
        );
        hasError = true;
      }

      const appTestText = await readFile(path.join(base, "tests/unit/app.test.tsx.tpl"), "utf8");
      for (const requiredText of ["formatMessage", "sceneDefinitions", "renderWithAntd", "resolveRuntimeSceneId"]) {
        if (!appTestText.includes(requiredText)) {
          console.error(
            `[check-templates] 模板 ${dir} app 单元测试缺少新体系覆盖：${requiredText}`,
          );
          hasError = true;
        }
      }

      const previewSmokeText = await readFile(path.join(base, "src/preview/preview-smoke.js.tpl"), "utf8");
      for (const requiredText of [
        "reports/preview/app-preview-smoke.json",
        "chipsdev.preview",
        "reportOnly",
        "blockingCheckCount",
      ]) {
        if (!previewSmokeText.includes(requiredText)) {
          console.error(
            `[check-templates] 模板 ${dir} preview smoke 校验缺少：${requiredText}`,
          );
          hasError = true;
        }
      }

      const commandTestText = await readFile(path.join(base, "tests/unit/commands.test.ts.tpl"), "utf8");
      for (const requiredText of [
        "chips-sdk/testing",
        "createMockChipsClient",
        "createAppCommands",
        "command.onInvoked",
        "isAppCommandInvokedEvent",
        "APP_COMMAND_IDS",
      ]) {
        if (!commandTestText.includes(requiredText)) {
          console.error(
            `[check-templates] 模板 ${dir} command 单元测试缺少 SDK testing mock 覆盖：${requiredText}`,
          );
          hasError = true;
        }
      }
    } catch (error) {
      console.error(
        `[check-templates] 模板 ${dir} 契约扫描失败`,
        error,
      );
      hasError = true;
    }
  }

  if (hasError) {
    process.exitCode = 1;
  } else {
    // eslint-disable-next-line no-console
    console.log("[check-templates] 模板结构检查通过");
  }
}

main().catch((error) => {
  console.error("[check-templates] 执行失败", error);
  process.exitCode = 1;
});
