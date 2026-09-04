// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { App } from "../../src/App";
import { renderWithAntd } from "../../src/testing/render-with-antd";

const projectRoot = path.resolve(__dirname, "../..");

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("应用插件起始页参考实现 smoke", () => {
  it("应保持 manifest 身份干净", () => {
    const manifest = readProjectFile("manifest.yaml");
    expect(manifest).toContain("id: com.chips.temp-start-page");
    expect(manifest).not.toContain("{{");
    expect(manifest).not.toContain("chips-scaffold-app");
  });

  it("应保留正式入口与运行配置", () => {
    expect(readProjectFile("index.html")).toContain('data-chips-app="com.chips.temp-start-page"');
    expect(readProjectFile("chips.config.mjs")).toContain("outDir");
    expect(readProjectFile("package.json")).toContain('"chipsdev-r build"');
  });

  it("源码不应保留脚手架示例身份与旧体系引用", () => {
    const shell = readProjectFile("src/app/AppShell.tsx");
    expect(shell).toContain("StartPageStage");
    expect(shell).not.toContain("Segmented");
    expect(shell).not.toContain("MainScene");
    const stage = readProjectFile("src/components/StartPageStage.tsx");
    expect(stage).toContain("StartHome");
    expect(stage).not.toContain("useChipsBridge");
    expect(stage).not.toContain("@chips/component-library");
  });

  it("应用根组件应当可以完成一次渲染", () => {
    const mounted = render(renderWithAntd(<App />).element);
    expect(mounted.container).toBeTruthy();
    mounted.unmount();
  });
});
