import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "../..");

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("万能文件查看器工程基线", () => {
  it("应生成完整 verify 脚本与 antd 依赖基线", () => {
    const pkg = JSON.parse(readProjectFile("package.json"));
    expect(pkg.scripts.typecheck).toBe("tsc -p tsconfig.json --noEmit");
    expect(pkg.scripts["preview:smoke"]).toContain("chipsdev-r preview --mode mock --target app");
    expect(pkg.scripts["quality:gate"]).toContain("chipsdev-r quality gate");
    expect(pkg.scripts.verify).toContain("npm run preview:smoke");
    expect(pkg.scripts.verify).toContain("npm run quality:gate");
    expect(pkg.dependencies.antd).toBe("6.5.4");
    expect(pkg.dependencies["@ant-design/icons"]).toBe("6.3.2");
    expect(pkg.dependencies.dayjs).toBe("1.11.21");
    expect(pkg.dependencies["@chips/ui"]).toBe("0.1.0");
    expect(pkg.dependencies["@chips/" + "component-library"]).toBeUndefined();
  });

  it("应保持 manifest 身份、兜底能力声明与运行目标干净", () => {
    const manifest = readProjectFile("manifest.yaml");

    expect(manifest).toContain("id: com.chips.universal-file-viewer");
    expect(manifest).toContain("type: app");
    expect(manifest).not.toContain("theme.read");
    expect(manifest).not.toContain("i18n.read");
    expect(manifest).not.toContain("i18n.write");
    expect(manifest).toContain("- command.invoke");
    expect(manifest).not.toMatch(/^commands\s*:/m);
    expect(manifest).toContain("commandPath: universal-file-viewer open");

    expect(manifest.match(/@fallback/g)?.length).toBeGreaterThan(100);
    expect(manifest).toContain("resource-handler:view:image/*@fallback");
    expect(manifest).toContain("file-handler:.pdf@fallback");
    expect(manifest).not.toContain("file-handler:.card");
    expect(manifest).not.toContain("file-handler:.box");
    expect(manifest).not.toMatch(/resource-handler:view:[^\n@]*@fallback@/);
  });

  it("应保持 antd 共享壳与查看器场景结构", () => {
    const appRoot = readProjectFile("src/app/AppRoot.tsx");
    const shell = readProjectFile("src/app/AppShell.tsx");
    const appCss = readProjectFile("src/app/app-shell.css");

    expect(appRoot).toContain("ConfigProvider");
    expect(appRoot).toContain("zhCN");
    expect(appRoot).toContain("appleTheme");
    expect(appRoot).toContain("ChipsProvider");
    expect(appRoot).toContain("CommandProvider");
    expect(shell).toContain("AppChrome");
    expect(shell).toContain("UniversalViewerStage");
    expect(appCss).toContain(".universal-viewer-stage");
    expect(appCss).not.toContain("chips-" + "sys");
    expect(appCss).not.toContain("data-scope");
  });

  it("引擎移植应携带许可证归属并保持 zh-CN locale", () => {
    const license = readProjectFile("src/viewer-engine/LICENSE.open-file-viewer");
    expect(license).toContain("MIT");

    const engineViewer = readProjectFile("src/views/EngineViewer.tsx");
    expect(engineViewer).toContain('locale: "zh-CN"');
    expect(engineViewer).toContain("createViewer");
  });
});
