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
    const iconPath = path.join(targetDir, "assets/icons/app-icon.ico");
    const iconIcnsPath = path.join(targetDir, "assets/icons/app-icon.icns");
    const iconPngPath = path.join(targetDir, "assets/icons/app-icon.png");
    const templateMetaLeakPath = path.join(targetDir, "template.json");
    const readmePath = path.join(targetDir, "README.md");

    await stat(manifestPath);
    await stat(pkgPath);
    await stat(indexHtmlPath);
    await stat(eslintConfigPath);
    await stat(iconPath);
    await stat(iconIcnsPath);
    await stat(iconPngPath);
    await assert.rejects(
      stat(templateMetaLeakPath),
      /ENOENT/,
      "模板元数据文件 template.json 不应泄漏到生成工程",
    );

    const manifestContent = await readFile(manifestPath, "utf8");
    const packageContent = JSON.parse(await readFile(pkgPath, "utf8"));
    const readmeContent = await readFile(readmePath, "utf8");
    assert.ok(
      manifestContent.includes("type: app"),
      "manifest.yaml 应声明 type: app",
    );
    assert.ok(
      manifestContent.includes("titleBarStyle: hidden"),
      "manifest.yaml 应包含标准应用窗口 chrome 配置",
    );
    assert.ok(
      manifestContent.includes("launcher:"),
      "manifest.yaml 应声明应用启动入口配置",
    );
    assert.ok(
      manifestContent.includes("icon: assets/icons/app-icon.ico"),
      "manifest.yaml 应声明快捷方式图标资源",
    );
    assert.equal(
      packageContent.dependencies["@chips/component-library"],
      "^0.1.0",
      "模板必须保持组件库正式 semver 依赖，由生态根工作区解析本地包",
    );
    assert.equal(
      packageContent.devDependencies.eslint,
      "^8.57.1",
      "模板必须预置 ESLint，保证 chipsdev lint 可直接运行",
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
    assert.ok(
      !readmeContent.includes("src/layouts/"),
      "README 目录结构不应描述模板未生成的 src/layouts/",
    );
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
});
