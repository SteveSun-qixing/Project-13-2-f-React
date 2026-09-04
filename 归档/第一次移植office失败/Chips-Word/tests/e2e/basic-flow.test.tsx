// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { App } from "../../src/App";
import { renderWithAntd } from "../../src/testing/render-with-antd";

const projectRoot = path.resolve(__dirname, "../..");

function walkSources(dir: string): string[] {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return walkSources(fullPath);
    }
    return /\.tsx?$/.test(entry) ? [fullPath] : [];
  });
}

const sourceFiles = walkSources(path.join(projectRoot, "src"));

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("Chips-Word 基础链路 smoke", () => {
  it("src 浏览器源码不含 AI 语义引用", () => {
    const aiPatterns: RegExp[] = [
      /@genoffice\/agent-core/,
      /@genoffice\/ai-provider/,
      /from ["'][./]*ai\//,
      /from ["']\.\.\/ai\//,
      /window\.desktop/,
      /\bai-queue-anchors\b/,
      /ai-docs-/i,
      /copilot/i,
      /\bAI\b/,
    ];
    for (const file of sourceFiles) {
      const content = readFileSync(file, "utf8");
      for (const pattern of aiPatterns) {
        expect(content, `${file} 不应包含 AI 语义引用：${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("src 浏览器源码不含 node: 导入", () => {
    for (const file of sourceFiles) {
      const content = readFileSync(file, "utf8");
      expect(content, `${file} 属于浏览器代码，不应导入 node: 模块`).not.toMatch(
        /from ["']node:[a-z]+["']/,
      );
    }
  });

  it("TSX 源码不含内联样式与模板占位残留", () => {
    for (const file of sourceFiles) {
      if (!file.endsWith(".tsx")) {
        continue;
      }
      const content = readFileSync(file, "utf8");
      expect(content, `${file} 禁止内联 style={{`).not.toContain("style={{");
      expect(content, `${file} 不应残留 {{ 模板占位`).not.toMatch(/\{\{\s*[A-Za-z_][A-Za-z0-9_.]*\s*\}\}/);
    }
    const manifest = readProjectFile("manifest.yaml");
    expect(manifest).not.toContain("{{");
  });

  it("manifest 与入口保持应用身份", () => {
    const manifest = readProjectFile("manifest.yaml");
    expect(manifest).toContain("id: com.chips.word");
    expect(manifest).toContain("name: 文档编辑器");
    expect(readProjectFile("index.html")).toContain('data-chips-app="com.chips.word"');
  });

  it("编辑器核心不含第二套组件库与禁用依赖", () => {
    for (const file of sourceFiles) {
      const content = readFileSync(file, "utf8");
      expect(content, `${file} 不应引入第二套组件库`).not.toContain("@chips/component-library");
      expect(content, `${file} 不应引用已废弃主题系统`).not.toMatch(/@chips\/ui\/theme/);
    }
  });

  it("缩进工具按钮必须提供可见图标", () => {
    const toolbar = readProjectFile("src/components/WordToolbar.tsx");
    expect(toolbar).toContain("MenuFoldOutlined");
    expect(toolbar).toContain("MenuUnfoldOutlined");
    expect(toolbar).toMatch(/onClick=\{\(\) => activeEditor && stepParagraphIndent\(activeEditor, -1\)\}/);
    expect(toolbar).toMatch(/onClick=\{\(\) => activeEditor && stepParagraphIndent\(activeEditor, 1\)\}/);
  });

  it("应用根组件应当可以完成一次完整渲染", async () => {
    const mounted = render(renderWithAntd(<App />).element);
    expect(mounted.container).toBeTruthy();
    mounted.unmount();
  });
});
