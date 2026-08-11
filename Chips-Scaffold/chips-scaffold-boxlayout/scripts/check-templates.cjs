#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const TEMPLATE_ROOT = path.join(__dirname, "..", "templates");

const TEXT_TEMPLATE_EXTENSIONS = new Set([
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

function collectFiles(dir, predicate) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath, predicate));
      continue;
    }
    if (entry.isFile() && predicate(entryPath)) {
      files.push(entryPath);
    }
  }
  return files;
}

function isTextTemplateFile(filePath) {
  if (path.basename(filePath) === "template.json") {
    return true;
  }
  if (!filePath.endsWith(".tpl")) {
    return false;
  }
  const withoutTemplateExt = filePath.slice(0, -4);
  return TEXT_TEMPLATE_EXTENSIONS.has(path.extname(withoutTemplateExt).toLowerCase());
}

function isRuntimeSourceTemplate(filePath) {
  return /[/\\]src[/\\].*\.(?:ts|tsx|js|jsx|mjs|cjs)\.tpl$/.test(filePath);
}

function isMessagesTable(filePath) {
  return /[/\\]src[/\\]lib[/\\]messages\.ts\.tpl$/.test(filePath);
}

function assertNotMatches(templateId, filePath, source, checks) {
  const relativePath = path.relative(path.join(TEMPLATE_ROOT, templateId), filePath);
  for (const { pattern, message } of checks) {
    if (pattern.test(source)) {
      throw new Error(`模板 ${templateId} 的 ${relativePath} ${message}：${pattern}`);
    }
  }
}

function main() {
  const templates = fs.readdirSync(TEMPLATE_ROOT, { withFileTypes: true });
  if (templates.length === 0) {
    throw new Error("templates 目录为空，至少需要一个模板。");
  }

  for (const entry of templates) {
    if (!entry.isDirectory()) {
      continue;
    }

    const templateId = entry.name;
    const dir = path.join(TEMPLATE_ROOT, templateId);
    const metaPath = path.join(dir, "template.json");
    if (!fs.existsSync(metaPath)) {
      throw new Error(`模板 ${templateId} 缺少 template.json 元数据文件。`);
    }
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    if (meta.supports?.sdk !== true) {
      throw new Error(`模板 ${templateId} 必须声明支持 SDK。`);
    }
    if (meta.supports?.uiKit !== "antd") {
      throw new Error(`模板 ${templateId} 必须声明 antd UI 体系。`);
    }

    const required = [
      "manifest.yaml.tpl",
      "package.json.tpl",
      "README.md.tpl",
      ".eslintrc.cjs.tpl",
      "tsconfig.json.tpl",
      "chips.config.mjs.tpl",
      "vitest.config.mts.tpl",
      path.join("contracts", "layout-config.schema.json.tpl"),
      path.join("src", "index.ts.tpl"),
      path.join("src", "view", "page.tsx.tpl"),
      path.join("src", "view", "runtime.ts.tpl"),
      path.join("src", "editor", "panel.tsx.tpl"),
      path.join("src", "editor", "frame-region-editor.tsx.tpl"),
      path.join("src", "editor", "runtime.ts.tpl"),
      path.join("src", "schema", "layout-config.ts.tpl"),
      path.join("src", "shared", "types.ts.tpl"),
      path.join("src", "lib", "messages.ts.tpl"),
      path.join("tests", "setup.ts.tpl"),
      path.join("tests", "unit", "schema.test.ts.tpl"),
      path.join("tests", "unit", "layout-definition.test.tsx.tpl"),
    ];

    for (const fileName of required) {
      if (!fs.existsSync(path.join(dir, fileName))) {
        throw new Error(`模板 ${templateId} 缺少必要文件：${fileName}`);
      }
    }

    const textTemplateFiles = collectFiles(dir, isTextTemplateFile);
    for (const filePath of textTemplateFiles) {
      const source = fs.readFileSync(filePath, "utf8");
      assertNotMatches(templateId, filePath, source, [
        { pattern: /\b(?:cardId|cardInfo|cardFile|card-window)\b/, message: "不应包含旧 Box Runtime 字段" },
        { pattern: /\bcolumnCount\b/, message: "不应把固定列数作为默认布局配置" },
        { pattern: /\b(?:TODO|FIXME)\b/i, message: "不应包含未收口标记" },
        { pattern: /\bchips dev\b/, message: "不应包含旧 chips dev 命令写法" },
        { pattern: /chips-scaffold-boxlayout/, message: "不应泄露脚手架包名" },
        { pattern: /占位实现|临时实现|最小可用结构/, message: "不应包含临时或占位实现描述" },
      ]);
    }

    const runtimeSourceFiles = collectFiles(dir, isRuntimeSourceTemplate);
    const runtimeSourceText = runtimeSourceFiles
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n");
    for (const [pattern, message] of [
      [/\bChips[A-Z]/, "运行时源码不应引用已卸担的组件库组件"],
      [/@chips\/component-library/, "运行时源码不应引用已卸担的组件库包"],
      [/-{2}chips-(?:sys|comp|base|layout)-/, "运行时源码不应使用已废弃的主题变量"],
      [/\b(?:localStorage|indexedDB)\b/, "运行时源码不应直接使用浏览器持久化存储"],
      [/\b(?:file:\/\/|blob:|data:image)\b/, "运行时源码不应持久化运行时 URL"],
      [/\b(?:readFile|writeFile|readdir)\b/, "运行时源码不应直接执行文件系统读写"],
      [/\bfrom\s+["'](?:node:)?fs["']|\brequire\(["'](?:node:)?fs["']\)/, "运行时源码不应直接引入 fs"],
      [/window\.chips\.invoke/, "运行时源码不应绕过 SDK/正式上下文直连 Bridge"],
    ]) {
      if (pattern.test(runtimeSourceText)) {
        throw new Error(`模板 ${templateId} ${message}：${pattern}`);
      }
    }
    for (const filePath of runtimeSourceFiles.filter((sourcePath) => !isMessagesTable(sourcePath))) {
      const source = fs.readFileSync(filePath, "utf8");
      assertNotMatches(templateId, filePath, source, [
        { pattern: />[^<{]*[\u4e00-\u9fff][^<{]*</, message: "运行时源码不应硬编码中文用户文案" },
      ]);
    }

    const manifest = fs.readFileSync(path.join(dir, "manifest.yaml.tpl"), "utf8");
    if (/ui:\s*\n\s*surface:/.test(manifest)) {
      throw new Error(`模板 ${templateId} 的 layout manifest 不应声明 ui.surface。`);
    }
    if (!/type:\s*layout/.test(manifest)) {
      throw new Error(`模板 ${templateId} 的 manifest 必须声明 type: layout。`);
    }
    if (!/layout:\s*\n\s*layoutType:\s*\{\{\s*LAYOUT_TYPE\s*\}\}/.test(manifest)) {
      throw new Error(`模板 ${templateId} 的 manifest 必须使用 LAYOUT_TYPE 渲染 layout.layoutType。`);
    }
    for (const removedPermission of ["theme.read", "i18n.read", "i18n.write"]) {
      if (manifest.includes(removedPermission)) {
        throw new Error(`模板 ${templateId} 的 manifest 不应声明已移除的权限：${removedPermission}`);
      }
    }

    const packageJson = JSON.parse(fs.readFileSync(path.join(dir, "package.json.tpl"), "utf8"));
    for (const [depName, expectedVersion] of [
      ["antd", "6.5.4"],
      ["@ant-design/icons", "6.3.2"],
      ["dayjs", "1.11.21"],
      ["@chips/ui", "0.1.0"],
    ]) {
      if (packageJson.dependencies?.[depName] !== expectedVersion) {
        throw new Error(`模板 ${templateId} 依赖 ${depName} 必须锁定 ${expectedVersion}。`);
      }
    }
    if (packageJson.dependencies?.["@chips/component-library"] !== undefined) {
      throw new Error(`模板 ${templateId} 不得依赖已卸担的 @chips/component-library。`);
    }
    if (packageJson.devDependencies?.["@types/node"] !== "^22.13.10") {
      throw new Error(`模板 ${templateId} 必须声明 @types/node 以支持 SDK 类型检查。`);
    }
    for (const scriptName of ["lint", "typecheck", "test", "build", "validate", "package", "verify"]) {
      if (typeof packageJson.scripts?.[scriptName] !== "string") {
        throw new Error(`模板 ${templateId} package.json.tpl 缺少脚本：${scriptName}`);
      }
    }
    for (const requiredCommand of [
      "npm run lint",
      "npm run typecheck",
      "npm test",
      "npm run build",
      "npm run validate",
      "npm run package",
    ]) {
      if (!packageJson.scripts.verify.includes(requiredCommand)) {
        throw new Error(`模板 ${templateId} verify 脚本缺少：${requiredCommand}`);
      }
    }

    const readme = fs.readFileSync(path.join(dir, "README.md.tpl"), "utf8");
    if (!readme.includes("@chips/ui")) {
      throw new Error(`模板 ${templateId} README 必须说明共享层接入。`);
    }
    if (readme.includes("@chips/component-library")) {
      throw new Error(`模板 ${templateId} README 不应引用已卸担的组件库。`);
    }
    for (const requiredText of [
      "chipsdev-r create layout",
      "renderEntryCover",
      "renderEntryDocument",
      "releaseEntryDocument",
      "runtime.openEntry",
      "readBoxAsset",
      "importBoxAsset",
      "deleteBoxAsset",
      "schemaVersion",
      "assetRefs",
      "schema_version",
      "asset_refs",
      "npm run verify",
    ]) {
      if (!readme.includes(requiredText)) {
        throw new Error(`模板 ${templateId} README 缺少 vNext 说明：${requiredText}`);
      }
    }

    const typesTs = fs.readFileSync(path.join(dir, "src", "shared", "types.ts.tpl"), "utf8");
    for (const requiredText of [
      "documentId?: string",
      '"documentInfo"',
      '"documentFile"',
      '"document-window"',
      'documentType?: "card" | "box"',
      "BoxEntryDocumentView",
      "renderEntryDocument(",
      "releaseEntryDocument(",
    ]) {
      if (!typesTs.includes(requiredText)) {
        throw new Error(`模板 ${templateId} 运行时类型缺少正式字段：${requiredText}`);
      }
    }

    const indexTs = fs.readFileSync(path.join(dir, "src", "index.ts.tpl"), "utf8");
    const editorRuntimeTs = fs.readFileSync(path.join(dir, "src", "editor", "runtime.ts.tpl"), "utf8");
    const editorPanelTs = fs.readFileSync(path.join(dir, "src", "editor", "panel.tsx.tpl"), "utf8");
    const editorFrameRegionTs = fs.readFileSync(path.join(dir, "src", "editor", "frame-region-editor.tsx.tpl"), "utf8");
    for (const requiredText of [
      "layoutType: \"{{ LAYOUT_TYPE }}\"",
      "readBoxAsset: ctx.readBoxAsset",
      "importBoxAsset: ctx.importBoxAsset",
      "deleteBoxAsset: ctx.deleteBoxAsset",
    ]) {
      if (!indexTs.includes(requiredText)) {
        throw new Error(`模板 ${templateId} 入口契约缺少：${requiredText}`);
      }
    }
    for (const [fileName, source] of [
      ["src/editor/runtime.ts.tpl", editorRuntimeTs],
      ["src/editor/panel.tsx.tpl", editorPanelTs],
      ["src/editor/frame-region-editor.tsx.tpl", editorFrameRegionTs],
    ]) {
      for (const requiredText of ["readBoxAsset?", "importBoxAsset?", "deleteBoxAsset?"]) {
        if (!source.includes(requiredText)) {
          throw new Error(`模板 ${templateId} 的 ${fileName} 缺少资产桥透传：${requiredText}`);
        }
      }
    }
    for (const requiredText of [
      "ConfigProvider",
      "appleTheme",
      "Select",
      "FrameRegionEditor",
      "createLayoutEditorRoot",
      "normalizeLayoutConfig",
      "formatMessage",
    ]) {
      if (!editorPanelTs.includes(requiredText)) {
        throw new Error(`模板 ${templateId} 编辑器面板缺少 antd 配置编辑样板：${requiredText}`);
      }
    }
    for (const forbiddenText of ["ChipsForm", "ChipsSelect", "@chips/component-library"]) {
      if (editorPanelTs.includes(forbiddenText) || editorFrameRegionTs.includes(forbiddenText)) {
        throw new Error(`模板 ${templateId} 编辑器不应包含旧体系残留：${forbiddenText}`);
      }
    }
    for (const requiredText of [
      /importBoxAsset!?\(\{/,
      /deleteBoxAsset\(assetPath\)/,
      /readBoxAsset\(region\.assetPath!?\)/,
      /isSafeBoxAssetPath\(imported\.assetPath\)/,
      /Segmented/,
      /Input\.TextArea/,
      /data-drop-zone/,
    ]) {
      if (!requiredText.test(editorFrameRegionTs)) {
        throw new Error(`模板 ${templateId} 资产桥编辑器缺少正式行为：${requiredText}`);
      }
    }
    for (const forbiddenText of ["Preview</strong>", "{entries.length} entries", "ChipsToolbar", "ChipsSegmentedControl", "ChipsErrorState"]) {
      if (editorPanelTs.includes(forbiddenText) || editorFrameRegionTs.includes(forbiddenText)) {
        throw new Error(`模板 ${templateId} 编辑器不应包含旧体系文案或控件：${forbiddenText}`);
      }
    }

    const messagesTs = fs.readFileSync(path.join(dir, "src", "lib", "messages.ts.tpl"), "utf8");
    if (!messagesTs.includes("export function formatMessage")) {
      throw new Error(`模板 ${templateId} 本地文案表缺少 formatMessage 导出。`);
    }

    const schemaTs = fs.readFileSync(path.join(dir, "src", "schema", "layout-config.ts.tpl"), "utf8");
    for (const requiredText of [
      "sortMode",
      "background",
      "topRegion",
      "assetRefs",
      "isSafeBoxAssetPath",
      "validateLayoutConfigInput",
      "BOX_ASSET_PATH_PATTERN",
    ]) {
      if (!schemaTs.includes(requiredText)) {
        throw new Error(`模板 ${templateId} 配置 Schema 缺少：${requiredText}`);
      }
    }
    if (
      !schemaTs.includes("BOX_ASSET_PATH_PATTERN = /^assets\\/") ||
      !schemaTs.includes("[^\\\\:?#/]+") ||
      !schemaTs.includes("(?:\\/[^\\\\:?#/]+)*")
    ) {
      throw new Error(`模板 ${templateId} 配置 Schema 的资源路径正则必须阻断反斜杠、冒号、查询串、片段和空路径段。`);
    }
    const contractSchema = fs.readFileSync(path.join(dir, "contracts", "layout-config.schema.json.tpl"), "utf8");
    for (const requiredText of ["^assets\\\\/[^\\\\\\\\:?#\\\\/]+", "\"not\"", "(^|/)\\\\.\\\\.($|/)"]) {
      if (!contractSchema.includes(requiredText)) {
        throw new Error(`模板 ${templateId} JSON Schema 资源路径约束缺少：${requiredText}`);
      }
    }
    if (contractSchema.includes('"pattern": "^assets/.+"')) {
      throw new Error(`模板 ${templateId} JSON Schema 不应使用宽松 assets 路径正则。`);
    }

    const viewPageTs = fs.readFileSync(path.join(dir, "src", "view", "page.tsx.tpl"), "utf8");
    const viewRuntimeTs = fs.readFileSync(path.join(dir, "src", "view", "runtime.ts.tpl"), "utf8");
    for (const requiredText of [
      "initialView: BoxEntryPage",
      "runtime.listEntries",
      "nextCursor",
      "EmbeddedDocumentFrame",
      "from \"@chips/ui\"",
      ".readBoxAsset(region.assetPath)",
      ".prefetchEntries({",
      "runtime.openEntry",
      "data-layout-retry",
      "formatMessage",
    ]) {
      if (!viewPageTs.includes(requiredText)) {
        throw new Error(`模板 ${templateId} 查看态 Runtime 样板缺少：${requiredText}`);
      }
    }
    if (!viewRuntimeTs.includes("initialView: options.initialView")) {
      throw new Error(`模板 ${templateId} 查看态 runtime 必须向页面传入完整 initialView。`);
    }
    if (!viewRuntimeTs.includes("ConfigProvider")) {
      throw new Error(`模板 ${templateId} 查看态 runtime 必须包裹 ConfigProvider。`);
    }
    for (const [pattern, message] of [
      [/\bCardCoverFrame\b/, "查看态不应默认使用卡片专用封面包装"],
      [/-{2}chips-(?:sys|comp|base|layout)-/, "查看态不应使用已废弃的主题变量"],
      [/\[data-part=/, "查看态不应依赖旧 EmbeddedDocumentFrame DOM 契约"],
      [/@chips\/component-library/, "查看态不应引用已卸担的组件库"],
    ]) {
      if (pattern.test(viewPageTs)) {
        throw new Error(`模板 ${templateId} ${message}：${pattern}`);
      }
    }
  }

  console.log("templates 检查通过。");
}

main();
