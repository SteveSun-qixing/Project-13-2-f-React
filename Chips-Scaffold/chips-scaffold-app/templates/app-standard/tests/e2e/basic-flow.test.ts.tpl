import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "../..");

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("应用插件预览与质量脚本 smoke", () => {
  it("应生成完整 verify 脚本与 antd 依赖基线", () => {
    const pkg = JSON.parse(readProjectFile("package.json"));
    expect(pkg.scripts.typecheck).toBe("tsc -p tsconfig.json --noEmit");
    expect(pkg.scripts["preview:smoke"]).toContain("chipsdev-r preview --mode mock --target app");
    expect(pkg.scripts["preview:smoke"]).toContain("reports/preview/app-preview-smoke.json");
    expect(pkg.scripts["quality:gate"]).toContain("chipsdev-r quality gate");
    expect(pkg.scripts["quality:gate"]).toContain("reports/quality/quality-gate.json");
    expect(pkg.scripts.verify).toContain("npm run preview:smoke");
    expect(pkg.scripts.verify).toContain("npm run quality:gate");
    expect(pkg.dependencies.antd).toBe("6.5.4");
    expect(pkg.dependencies["@ant-design/icons"]).toBe("6.3.2");
    expect(pkg.dependencies.dayjs).toBe("1.11.21");
    expect(pkg.dependencies["@chips/ui"]).toBe("0.1.0");
    expect(pkg.dependencies["@chips/" + "component-library"]).toBeUndefined();
  });

  it("应保持 manifest、预览脚本与源码身份干净", () => {
    const manifest = readProjectFile("manifest.yaml");
    const previewSmoke = readProjectFile("src/preview/preview-smoke.js");
    const sourceBundle = [
      readProjectFile("src/App.tsx"),
      readProjectFile("src/app/AppRoot.tsx"),
      readProjectFile("src/app/AppRuntimeProvider.tsx"),
      readProjectFile("src/app/AppShell.tsx"),
      readProjectFile("src/app/scene-registry.ts"),
      readProjectFile("src/scenes/MainScene.tsx"),
      readProjectFile("src/scenes/SettingsScene.tsx"),
      readProjectFile("src/views/WorkspaceOverviewView.tsx"),
      readProjectFile("src/views/StateBindingView.tsx"),
      readProjectFile("src/views/SceneListView.tsx"),
      readProjectFile("src/views/EnvironmentStatusView.tsx"),
      readProjectFile("src/views/RuntimeDiagnosticsView.tsx"),
      readProjectFile("src/commands/app-commands.tsx"),
      readProjectFile("src/commands/useAppCommands.ts"),
      readProjectFile("src/lib/messages.ts"),
      readProjectFile("src/testing/mock-environment.ts"),
      readProjectFile("src/testing/render-with-antd.tsx"),
    ].join("\n");

    expect(manifest).toContain("type: app");
    expect(manifest).not.toContain("theme.read");
    expect(manifest).not.toContain("i18n.read");
    expect(manifest).not.toContain("i18n.write");
    expect(manifest).toContain("- command.invoke");
    expect(manifest).not.toMatch(/^commands\s*:/m);
    expect(manifest).toContain("commandPath: {{ CLI_COMMAND_ROOT }} open");
    expect(previewSmoke).toContain("chipsdev.preview");
    expect(previewSmoke).toContain("reportOnly");
    expect(previewSmoke).toContain("manifest.runtimeTargets");
    expect(previewSmoke).toContain("manifest.surface");
    expect(sourceBundle).toContain("ConfigProvider");
    expect(sourceBundle).toContain("zhCN");
    expect(sourceBundle).toContain("appleTheme");
    expect(sourceBundle).toContain("ChipsProvider");
    expect(sourceBundle).toContain("CommandProvider");
    expect(sourceBundle).toContain("AppChrome");
    expect(sourceBundle).toContain("useCommandRegistry");
    expect(sourceBundle).toContain("createAppCommands");
    expect(sourceBundle).toContain("formatMessage");
    expect(sourceBundle).toContain("app-shell__workspace");
    expect(sourceBundle).not.toContain("@chips/" + "component-library");
    expect(sourceBundle).not.toContain("ChipsDialog");
    expect(sourceBundle).not.toContain("ChipsView");
    expect(sourceBundle).not.toContain("resolveAppToolbarCommands");
    const forbiddenIdentityPattern = new RegExp([
      "app-" + "standard",
      "chips-" + "scaffold-app",
      "Example" + "Panel",
    ].join("|"));
    expect(sourceBundle).not.toMatch(forbiddenIdentityPattern);
    expect(sourceBundle).not.toContain("style={{");
  });

  it("应保持 antd 共享壳与场景结构", () => {
    const appRoot = readProjectFile("src/app/AppRoot.tsx");
    const shell = readProjectFile("src/app/AppShell.tsx");
    const appCss = readProjectFile("src/app/app-shell.css");

    expect(appRoot).toContain("ConfigProvider");
    expect(appRoot).toContain("zhCN");
    expect(appRoot).toContain("appleTheme");
    expect(appRoot).toContain("ChipsProvider");
    expect(appRoot).toContain("CommandProvider");
    expect(shell).toContain("AppChrome");
    expect(shell).toContain("Segmented");
    expect(shell).toContain("MenuBarGroup");
    expect(appCss).toContain(".app-shell__workspace");
    expect(appCss).not.toContain("chips-" + "sys");
    expect(appCss).not.toContain("data-scope");
  });
});
