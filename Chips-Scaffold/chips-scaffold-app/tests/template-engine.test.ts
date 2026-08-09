import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import {
  listTemplateMetas,
  createAppProjectInternal,
} from "../src/core/template-engine.js";
import type { CreateAppProjectOptions } from "../src/core/types.js";

const FORBIDDEN_PROJECT_DIRS = [
  "需求文档",
  "技术文档",
  "技术手册",
  "开发计划",
];

test("listTemplateMetas 应返回至少一个模板（app-standard）", async () => {
  const metas = await listTemplateMetas();
  assert.ok(Array.isArray(metas));
  const standard = metas.find((m) => m.id === "app-standard");
  assert.ok(standard, "应包含 id 为 app-standard 的模板");
});

test("createAppProjectInternal 可在临时目录生成完整工程骨架", async () => {
  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "chips-app-scaffold-"));
  const targetDir = path.join(tmpRoot, "my-app");

  const options: CreateAppProjectOptions = {
    projectName: "my-app",
    targetDir,
    templateId: "app-standard",
    pluginId: "com.example.my-app",
    displayName: "示例应用插件",
    version: "0.1.0",
    authorName: "Scaffold Tester",
    authorEmail: "tester@example.com",
  };

  try {
    const result = await createAppProjectInternal(options);
    assert.equal(result.projectDir, targetDir);
    assert.equal(result.templateId, "app-standard");
    assert.ok(result.filesCreated > 0);

    const manifestPath = path.join(targetDir, "manifest.yaml");
    const pkgPath = path.join(targetDir, "package.json");
    const indexHtmlPath = path.join(targetDir, "index.html");
    const eslintConfigPath = path.join(targetDir, ".eslintrc.cjs");
    const appCommandsPath = path.join(targetDir, "src/commands/app-commands.tsx");
    const useAppCommandsPath = path.join(targetDir, "src/commands/useAppCommands.ts");
    const appSourcePath = path.join(targetDir, "src/App.tsx");
    const appRootPath = path.join(targetDir, "src/app/AppRoot.tsx");
    const appRuntimeProviderPath = path.join(targetDir, "src/app/AppRuntimeProvider.tsx");
    const appShellPath = path.join(targetDir, "src/app/AppShell.tsx");
    const appShellCssPath = path.join(targetDir, "src/app/app-shell.css");
    const sceneRegistryPath = path.join(targetDir, "src/app/scene-registry.ts");
    const messagesPath = path.join(targetDir, "src/lib/messages.ts");
    const runtimeClientPath = path.join(targetDir, "src/runtime/chips-client.ts");
    const launchContextPath = path.join(targetDir, "src/runtime/launch-context.ts");
    const previewSmokePath = path.join(targetDir, "src/preview/preview-smoke.js");
    const mockEnvironmentPath = path.join(targetDir, "src/testing/mock-environment.ts");
    const renderWithAntdPath = path.join(targetDir, "src/testing/render-with-antd.tsx");
    const runtimeDiagnosticsPath = path.join(targetDir, "src/views/RuntimeDiagnosticsView.tsx");
    const commandTestPath = path.join(targetDir, "tests/unit/commands.test.ts");
    const appTestPath = path.join(targetDir, "tests/unit/app.test.tsx");

    await stat(manifestPath);
    await stat(pkgPath);
    await stat(indexHtmlPath);
    await stat(eslintConfigPath);
    await stat(appSourcePath);
    await stat(appRootPath);
    await stat(appRuntimeProviderPath);
    await stat(appShellPath);
    await stat(appShellCssPath);
    await stat(sceneRegistryPath);
    await stat(appCommandsPath);
    await stat(useAppCommandsPath);
    await stat(messagesPath);
    await stat(runtimeClientPath);
    await stat(launchContextPath);
    await stat(previewSmokePath);
    await stat(mockEnvironmentPath);
    await stat(renderWithAntdPath);
    await stat(runtimeDiagnosticsPath);
    await stat(commandTestPath);
    await stat(appTestPath);

    const manifestContent = await readFile(manifestPath, "utf8");
    const packageContent = JSON.parse(await readFile(pkgPath, "utf8"));
    const appSourceContent = await readFile(appSourcePath, "utf8");
    const appRuntimeContent = (
      await Promise.all(
        [
          appSourcePath,
          appRootPath,
          appRuntimeProviderPath,
          appShellPath,
          sceneRegistryPath,
          useAppCommandsPath,
          path.join(targetDir, "src/scenes/MainScene.tsx"),
          path.join(targetDir, "src/scenes/SettingsScene.tsx"),
          path.join(targetDir, "src/views/WorkspaceOverviewView.tsx"),
          path.join(targetDir, "src/views/StateBindingView.tsx"),
          path.join(targetDir, "src/views/SceneListView.tsx"),
          path.join(targetDir, "src/views/EnvironmentStatusView.tsx"),
          runtimeDiagnosticsPath,
          messagesPath,
          launchContextPath,
          mockEnvironmentPath,
          renderWithAntdPath,
        ].map((filePath) => readFile(filePath, "utf8")),
      )
    ).join("\n");
    const appCommandsContent = await readFile(appCommandsPath, "utf8");
    const useAppCommandsContent = await readFile(useAppCommandsPath, "utf8");
    const appTestContent = await readFile(appTestPath, "utf8");
    const commandTestContent = await readFile(commandTestPath, "utf8");
    assert.ok(
      manifestContent.includes("type: app"),
      "manifest.yaml 应声明 type: app",
    );
    assert.ok(
      manifestContent.includes("frame: true"),
      "manifest.yaml 应显式保留标准应用的原生窗口标题栏",
    );
    assert.ok(
      !manifestContent.includes("titleBarStyle: hidden"),
      "manifest.yaml 不应再默认生成隐藏式标题栏配置",
    );
    assert.ok(
      manifestContent.includes("runtime:\n  targets:"),
      "manifest.yaml 应包含 runtime.targets",
    );
    assert.ok(
      manifestContent.includes("surface:\n    defaultKind: window"),
      "manifest.yaml 应包含 ui.surface 默认容器配置",
    );
    assert.ok(
      manifestContent.includes("cli:\n  commands:"),
      "manifest.yaml 应声明 cli.commands 命令行入口",
    );
    assert.ok(
      manifestContent.includes("commandPath: my-app open"),
      "manifest.yaml 应使用项目名派生安全 CLI 命令路径",
    );
    assert.ok(
      manifestContent.includes("target:\n        type: app") &&
        manifestContent.includes("pluginId: com.example.my-app") &&
        manifestContent.includes("surface:\n          open: true") &&
        manifestContent.includes("reuse: preferred"),
      "应用 CLI 命令应通过 Host surface.open 打开当前插件",
    );
    assert.ok(
      manifestContent.includes("titleKey: app.cli.open.title") &&
        manifestContent.includes("descriptionKey: app.cli.open.description") &&
        manifestContent.includes("mapsTo: subject") &&
        manifestContent.includes("placeholderKey: app.cli.open.subjectPlaceholder"),
      "应用 CLI 命令应声明 titleKey、参数映射与 TUI 输入提示",
    );
    for (const permission of ["command.read", "command.write", "command.invoke"]) {
      assert.ok(
        manifestContent.includes(`  - ${permission}`),
        `manifest.yaml 应声明 ${permission}`,
      );
    }
    assert.ok(
      !manifestContent.includes("theme.read") &&
        !manifestContent.includes("i18n.read") &&
        !manifestContent.includes("i18n.write"),
      "manifest.yaml 不应声明已移除的 theme.read / i18n.* 权限",
    );
    assert.ok(
      !/^commands\s*:/m.test(manifestContent),
      "manifest.yaml 不应声明未冻结的 commands 字段",
    );
    for (const forbiddenPattern of [
      /^plugin\s*:/m,
      /^theme\s*:/m,
      /^themeId\s*:/m,
      /^displayName\s*:/m,
      /^module\s*:/m,
      /^layout\s*:/m,
    ]) {
      assert.ok(
        !forbiddenPattern.test(manifestContent),
        `应用 manifest 不应声明类型越界或 Host 治理保留字段：${forbiddenPattern}`,
      );
    }
    assert.equal(
      packageContent.dependencies.antd,
      "6.5.4",
      "模板必须锁定 antd 正式版本",
    );
    assert.equal(
      packageContent.dependencies["@ant-design/icons"],
      "6.3.2",
      "模板必须锁定 @ant-design/icons 正式版本",
    );
    assert.equal(
      packageContent.dependencies.dayjs,
      "1.11.21",
      "模板必须锁定 dayjs 正式版本",
    );
    assert.equal(
      packageContent.dependencies["@chips/ui"],
      "0.1.0",
      "模板必须保持 @chips/ui 正式 semver 依赖，由生态根工作区解析本地包",
    );
    assert.equal(
      packageContent.dependencies["@chips/component-library"],
      undefined,
      "模板不得再依赖已卸担的 @chips/component-library",
    );
    assert.equal(
      packageContent.devDependencies.eslint,
      "^8.57.1",
      "模板必须预置 ESLint，保证 chipsdev-r lint 可直接运行",
    );
    assert.equal(
      packageContent.devDependencies["@typescript-eslint/parser"],
      "^7.18.0",
      "模板必须预置 TypeScript ESLint parser，保证 TS/TSX 文件可被解析",
    );
    assert.equal(
      packageContent.devDependencies["chips-sdk"],
      "^0.1.0",
      "模板必须保持 SDK 正式 semver 依赖，由生态根工作区解析本地包",
    );
    for (const scriptName of ["typecheck", "preview:smoke", "quality:gate", "verify"]) {
      assert.equal(
        typeof packageContent.scripts[scriptName],
        "string",
        `模板 package.json 应包含 ${scriptName} 脚本`,
      );
    }
    assert.ok(
      packageContent.scripts["preview:smoke"].includes("reports/preview/app-preview-smoke.json"),
      "preview:smoke 应把报告归档到 reports/preview/app-preview-smoke.json",
    );
    assert.ok(
      packageContent.scripts["quality:gate"].includes("reports/quality/quality-gate.json"),
      "quality:gate 应把报告归档到 reports/quality/quality-gate.json",
    );
    assert.ok(
      packageContent.scripts.verify.includes("npm run preview:smoke") &&
        packageContent.scripts.verify.includes("npm run quality:gate"),
      "verify 脚本应串联预览 smoke 与质量门禁",
    );
    assert.ok(
      appCommandsContent.includes("createAppCommands") &&
        appCommandsContent.includes("CommandItem") &&
        appCommandsContent.includes("menuId") &&
        appCommandsContent.includes("toolbarId") &&
        appCommandsContent.includes("@ant-design/icons"),
      "命令模板应以 CommandItem 模型 + antd 图标声明本地命令",
    );
    assert.ok(
      appCommandsContent.includes("titleKey") &&
        appCommandsContent.includes("descriptionKey") &&
        appCommandsContent.includes("ariaLabelKey") &&
        appCommandsContent.includes("handlerId"),
      "命令模板应集中声明 Host 注册元数据 key 与 handlerId",
    );
    assert.ok(
      !/@chips\/component-library/.test(appCommandsContent),
      "命令模板不得引用已卸担的组件库",
    );
    assert.ok(
      useAppCommandsContent.includes("client.command.register") &&
        useAppCommandsContent.includes("client.command.invoke") &&
        useAppCommandsContent.includes("client.command.onInvoked"),
      "命令运行时应通过 SDK command API 注册、调用并监听 handlerId",
    );
    assert.ok(
      useAppCommandsContent.includes("useCommandRegistry") &&
        useAppCommandsContent.includes("register(commands)"),
      "命令运行时应用 useCommandRegistry 注册本地 CommandItem",
    );
    for (const requiredText of [
      "ConfigProvider",
      "appleTheme",
      "ChipsProvider",
      "CommandProvider",
      "AppRuntimeProvider",
      "useAppRuntime",
      "AppChrome",
      "useChips",
      "setActiveSceneId",
      "formatMessage",
      "renderWithAntd",
    ]) {
      assert.ok(
        appRuntimeContent.includes(requiredText),
        `根组件应通过 React 正式入口消费 ${requiredText}`,
      );
    }
    assert.ok(
      appSourceContent.includes('export { AppRoot as App } from "./app/AppRoot";'),
      "src/App.tsx 应保持轻量 re-export，由 src/app/AppRoot.tsx 承载真实根组件",
    );
    assert.ok(
      !appRuntimeContent.includes("@chips/component-library") &&
        !appRuntimeContent.includes("ChipsEnvironmentProvider") &&
        !appRuntimeContent.includes("useChipsI18n") &&
        !appRuntimeContent.includes("useChipsTheme"),
      "应用源码不得残留已卸担的组件库 Environment hooks",
    );
    assert.ok(
      !useAppCommandsContent.includes('window.chips.invoke("command.') &&
        !useAppCommandsContent.includes("BrowserWindow") &&
        !useAppCommandsContent.includes("ipcRenderer"),
      "命令运行时不得绕过 SDK 直连 Host/Electron",
    );
    const messagesContent = await readFile(messagesPath, "utf8");
    assert.ok(
      messagesContent.includes("export function formatMessage") &&
        messagesContent.includes("app.commands.openWorkspace.title") &&
        messagesContent.includes("app.runtime.dialog.sceneId"),
      "本地文案表应导出 formatMessage 并覆盖关键 key",
    );
    assert.ok(
      appTestContent.includes("formatMessage") &&
        appTestContent.includes("sceneDefinitions") &&
        appTestContent.includes("renderWithAntd") &&
        appTestContent.includes("resolveRuntimeSceneId"),
      "App 单元测试应覆盖文案表、场景注册表与 antd 渲染外壳",
    );
    assert.ok(
      commandTestContent.includes("chips-sdk/testing") &&
        commandTestContent.includes("createMockChipsClient") &&
        commandTestContent.includes("createAppCommands") &&
        commandTestContent.includes("command.onInvoked") &&
        commandTestContent.includes("isAppCommandInvokedEvent"),
      "Command 单元测试应复用 SDK testing mock host 覆盖命令契约",
    );
    await assert.rejects(
      stat(path.join(targetDir, "src/hooks/useChipsBridge.ts")),
      { code: "ENOENT" },
      "初始化工程不应生成旧的 useChipsBridge 私有入口",
    );
    await assert.rejects(
      stat(path.join(targetDir, "src/components/ExamplePanel.tsx")),
      { code: "ENOENT" },
      "初始化工程不应生成旧 ExamplePanel 示例组件",
    );
    await assert.rejects(
      stat(path.join(targetDir, "src/app/AppProviders.tsx")),
      { code: "ENOENT" },
      "初始化工程不应生成旧的 AppProviders 组合文件",
    );
    await assert.rejects(
      stat(path.join(targetDir, "src/i18n/locales.ts")),
      { code: "ENOENT" },
      "初始化工程不应生成旧的多语言 adapter",
    );
    await assert.rejects(
      stat(path.join(targetDir, "src/theme/theme-runtime.ts")),
      { code: "ENOENT" },
      "初始化工程不应生成旧的主题运行时",
    );
    await assert.rejects(
      stat(path.join(targetDir, "src/commands/app-commands.ts")),
      { code: "ENOENT" },
      "命令定义文件应使用 .tsx 后缀",
    );
    await assert.rejects(
      stat(path.join(targetDir, "template.json")),
      { code: "ENOENT" },
      "初始化工程不应生成模板元数据文件 template.json",
    );
    assert.ok(
      !/style=\{\{/.test(appRuntimeContent),
      "初始化工程源码不应使用 inline style",
    );
    assert.ok(
      !/\bapp-standard\b|\bchips-scaffold-app\b|\bExamplePanel\b/.test(appRuntimeContent),
      "初始化工程源码不应泄漏模板身份或旧示例面板",
    );

    for (const dirName of FORBIDDEN_PROJECT_DIRS) {
      await assert.rejects(
        stat(path.join(targetDir, dirName)),
        { code: "ENOENT" },
        `初始化工程不应生成 ${dirName}/ 目录`,
      );
    }
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
});
