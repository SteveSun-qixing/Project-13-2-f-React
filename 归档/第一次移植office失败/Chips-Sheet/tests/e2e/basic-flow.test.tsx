// @vitest-environment jsdom
import "../../src/testing/jsdom-polyfills";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "../..");

/** src/preview 是 Node 侧预览报告工具，不参与浏览器运行时，允许 node: 导入 */
const NODE_TOOLING_DIRECTORIES = new Set([path.join(projectRoot, "src", "preview")]);

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      if (NODE_TOOLING_DIRECTORIES.has(fullPath)) {
        continue;
      }
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.(ts|tsx|js|jsx|css)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

const sourceFiles = collectSourceFiles(path.join(projectRoot, "src"));
const sourceBundle = sourceFiles
  .map((filePath) => readFileSync(filePath, "utf8"))
  .join("\n");

describe("基础链路静态约束", () => {
  it("src 中没有 AI 与专有包引用", () => {
    expect(sourceBundle).not.toMatch(/openai/i);
    expect(sourceBundle).not.toMatch(/\bLLM\b/);
    expect(sourceBundle.match(/from\s+["']@univerjs-pro/g)).toBeNull();
    expect(sourceBundle).not.toContain("xlsx-sidecar-client");
  });

  it("src 中没有 node: 模块导入", () => {
    for (const filePath of sourceFiles) {
      const content = readFileSync(filePath, "utf8");
      expect(content.match(/from\s+["']node:/g)).toBeNull();
      expect(content.match(/require\(["']node:/g)).toBeNull();
    }
  });

  it("自写组件没有内联样式对象，视觉全部走 CSS", () => {
    for (const filePath of sourceFiles) {
      if (!filePath.endsWith(".tsx")) {
        continue;
      }
      const content = readFileSync(filePath, "utf8");
      expect(content.match(/style=\{\{/g)).toBeNull();
    }
  });

  it("没有脚手架示例残留", () => {
    expect(sourceBundle).not.toContain("MainScene");
    expect(sourceBundle).not.toContain("SettingsScene");
    expect(sourceBundle).not.toContain("SceneListView");
    expect(sourceBundle).not.toContain("WorkspaceOverviewView");
    expect(sourceBundle).not.toContain("StateBindingView");
    expect(sourceBundle).not.toContain("EnvironmentStatusView");
    expect(sourceBundle).not.toContain("RuntimeDiagnosticsView");
    expect(sourceBundle).not.toContain("chips-scaffold");
  });

  it("应用根组件 Provider 嵌套顺序符合规范", () => {
    const appRoot = readFileSync(path.join(projectRoot, "src/app/AppRoot.tsx"), "utf8");
    const order = [
      "ConfigProvider",
      "AntdApp",
      "ChipsProvider",
      "CommandProvider",
      "AppRuntimeProvider",
      "AppShell",
    ].map((name) => appRoot.indexOf(`<${name}`));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(appRoot).toContain("zhCN");
    expect(appRoot).toContain("appleTheme");
  });

  it("命令注册覆盖五条文件命令且使用应用命令 ID", () => {
    const commandSource = readFileSync(
      path.join(projectRoot, "src/commands/app-commands.tsx"),
      "utf8",
    );
    for (const suffix of ["file.open", "file.save", "file.save-as", "file.new", "file.export-csv"]) {
      expect(commandSource).toContain(`"com.chips.sheet.${suffix}"`);
    }
    expect(commandSource).toContain("Mod+O");
    expect(commandSource).toContain("Mod+S");
    expect(commandSource).toContain("Mod+Shift+S");
  });

  it("表格层 IO 基于 exceljs，引擎装配基于 Univer 开源 preset", () => {
    const ioSource = readFileSync(path.join(projectRoot, "src/sheet/workbook-io.ts"), "utf8");
    expect(ioSource).toContain('from "exceljs"');
    const presetSource = readFileSync(path.join(projectRoot, "src/sheet/presets.ts"), "utf8");
    expect(presetSource).toContain("@univerjs/preset-sheets-core");
    for (const filePath of sourceFiles) {
      const content = readFileSync(filePath, "utf8");
      expect(content.match(/from\s+["'](fs|crypto)["']/g)).toBeNull();
    }
  });

  it("manifest 保持应用身份与能力配置", () => {
    const manifest = readFileSync(path.join(projectRoot, "manifest.yaml"), "utf8");
    expect(manifest).toContain("id: com.chips.sheet");
    expect(manifest).toContain("name: 表格编辑器");
    expect(manifest).toContain("file-handler:.xlsx");
    expect(manifest).toContain("file-handler:.xlsm");
    expect(manifest).toContain("file-handler:.csv");
  });
});
