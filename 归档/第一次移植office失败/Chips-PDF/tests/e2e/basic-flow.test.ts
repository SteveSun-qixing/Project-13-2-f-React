// @vitest-environment jsdom

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const testDir = resolve(__dirname);
const projectRoot = resolve(testDir, "../..");
const srcRoot = resolve(projectRoot, "src");

function readProjectFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = listSourceFiles(srcRoot);

describe("Chips-PDF 工程质量静态检查", () => {
  it("源码不包含 AI 相关引用", () => {
    for (const file of sourceFiles) {
      const content = readFileSync(file, "utf8");
      expect(content, `${file} 不应包含 AI 引用`).not.toMatch(/AiAsk|AIPopover|window\.pdfApi|ocr-layer|runOcr|ai\//);
    }
  });

  it("src 运行时代码不包含 node: 模块导入", () => {
    for (const file of sourceFiles) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const content = readFileSync(file, "utf8");
      expect(content, `${file} 不应导入 node: 模块`).not.toMatch(/from\s+["']node:/);
      expect(content, `${file} 不应 require node 内置模块`).not.toMatch(/require\(["']node:/);
    }
  });

  it("TSX 禁止内联 style 对象，样式统一走 CSS 类与变量", () => {
    for (const file of sourceFiles) {
      if (!file.endsWith(".tsx")) continue;
      const content = readFileSync(file, "utf8");
      expect(content, `${file} 不应出现 style={{`).not.toContain("style={{");
    }
  });

  it("源码不残留脚手架模板痕迹", () => {
    for (const file of sourceFiles) {
      const content = readFileSync(file, "utf8");
      expect(content, `${file} 不应残留模板文案`).not.toMatch(/示例应用插件|openWorkspace|openSettings|MainScene|SettingsScene|WorkspaceOverviewView|StateBindingView|SceneListView|EnvironmentStatusView|RuntimeDiagnosticsView|chips-scaffold-app|app-standard/);
    }
  });

  it("源码不引用第二套组件库或已废弃的主题/i18n 依赖", () => {
    for (const file of sourceFiles) {
      const content = readFileSync(file, "utf8");
      expect(content, `${file} 不应引用废弃依赖`).not.toMatch(/@genoffice\/|chips-ui-legacy|antd-theme|react-i18next|i18next/);
    }
  });

  it("manifest 保持应用身份与能力声明", () => {
    const manifest = readProjectFile("manifest.yaml");
    expect(manifest).toContain("id: com.chips.pdf");
    expect(manifest).toContain("name: PDF 编辑器");
    expect(manifest).toContain("type: app");
    expect(manifest).toContain("- resource-handler:view:application/pdf");
    expect(manifest).toContain("- file-handler:.pdf");
    expect(manifest).toContain("- command.invoke");
    expect(manifest).not.toContain("i18n.read");
    expect(manifest).not.toContain("theme.read");
  });

  it("index.html 保持中文语言声明、应用标识与放宽后的 CSP", () => {
    const html = readProjectFile("index.html");
    expect(html).toContain('lang="zh-CN"');
    expect(html).toContain('data-chips-app="com.chips.pdf"');
    expect(html).toContain("worker-src 'self' blob:");
    expect(html).toContain("img-src 'self' file: data: blob: https:");
    expect(html).toContain("frame-src 'self' file: blob:");
  });

  it("依赖清单锁定正式版本与 PDF 能力库", () => {
    const pkg = JSON.parse(readProjectFile("package.json")) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    expect(pkg.dependencies.antd).toBe("6.5.4");
    expect(pkg.dependencies["@ant-design/icons"]).toBe("6.3.2");
    expect(pkg.dependencies["@chips/ui"]).toBe("0.1.0");
    expect(pkg.dependencies["pdfjs-dist"]).toBe("6.2.108");
    expect(pkg.dependencies["pdf-lib"]).toBe("1.17.1");
    expect(pkg.dependencies.react).toBe("^18.2.0");
    expect(pkg.scripts.typecheck).toBe("tsc -p tsconfig.json --noEmit");
  });

  it("工程已声明 pdf.js 静态资源复制脚本", () => {
    const pkg = JSON.parse(readProjectFile("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.prebuild).toContain("copy-pdfjs-assets");
    const copyScript = readProjectFile("scripts/copy-pdfjs-assets.mjs");
    expect(copyScript).toContain("cmaps");
    expect(copyScript).toContain("standard_fonts");
  });

  it("构建产物存在时必须携带 pdf.js cmaps 与标准字体资源", () => {
    const distIndex = join(projectRoot, "dist", "index.html");
    if (!existsSync(distIndex)) {
      return;
    }
    const cmapsDir = join(projectRoot, "dist", "pdfjs", "cmaps");
    const fontsDir = join(projectRoot, "dist", "pdfjs", "standard_fonts");
    expect(existsSync(cmapsDir), "dist/pdfjs/cmaps 必须随构建输出").toBe(true);
    expect(existsSync(fontsDir), "dist/pdfjs/standard_fonts 必须随构建输出").toBe(true);
    expect(readdirSync(cmapsDir).length).toBeGreaterThan(0);
    expect(readdirSync(fontsDir).length).toBeGreaterThan(0);
  });

  it("README 注明移植来源与第三方许可", () => {
    const readme = readProjectFile("README.md");
    expect(readme).toContain("GenOffice");
    expect(readme).toContain("Apache-2.0");
    expect(readme).toContain("MIT");
  });
});
