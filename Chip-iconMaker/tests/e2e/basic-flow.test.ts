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
  it("应生成完整 verify 脚本与预览 smoke 校验入口", () => {
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
      readProjectFile("src/icon-workbench/IconMakerScene.tsx"),
      readProjectFile("src/icon-workbench/cli-runner.ts"),
      readProjectFile("src/icon-workbench/generator.ts"),
      readProjectFile("src/icon-workbench/ico.ts"),
      readProjectFile("src/icon-workbench/icns.ts"),
      readProjectFile("src/icon-workbench/zip-store.ts"),
      readProjectFile("src/icon-workbench/types.ts"),
      readProjectFile("src/icon-workbench/default-fonts.ts"),
      readProjectFile("src/commands/app-commands.tsx"),
      readProjectFile("src/lib/messages.ts"),
    ].join("\n");

    expect(manifest).toContain("type: app");
    expect(manifest).toContain("commandPath: iconmaker generate");
    expect(manifest).toContain("commandId: com.chips.iconmaker.cli.generate");
    expect(manifest).toContain("commandId: com.chips.iconmaker.generate-icons");
    expect(manifest).toContain("overwrite: overwrite");
    expect(manifest).toContain("- cli.task");
    expect(manifest).toContain("- file.read");
    expect(manifest).toContain("- file.write");
    expect(manifest).not.toContain("theme.read");
    expect(manifest).not.toContain("i18n.read");
    expect(manifest).not.toMatch(/^commands\s*:/m);
    expect(previewSmoke).toContain("chipsdev.preview");
    expect(previewSmoke).toContain("reportOnly");
    expect(previewSmoke).toContain("manifest.runtimeTargets");
    expect(previewSmoke).toContain("manifest.surface");
    expect(sourceBundle).toContain("IconMakerScene");
    expect(sourceBundle).toContain("createIcoFile");
    expect(sourceBundle).toContain("createIcnsFile");
    expect(sourceBundle).toContain("createZipStore");
    expect(sourceBundle).toContain("generateIconZip");
    expect(sourceBundle).toContain("runIconMakerCliCommand");
    expect(sourceBundle).toContain("MATERIAL_SYMBOLS_FONT_SOURCE");
    expect(sourceBundle).toContain("EMOJI_FONT_SOURCE");
    expect(sourceBundle).toContain("createPrivateUseGlyphs");
    expect(sourceBundle).toContain("BACKGROUND_PRESETS");
    expect(sourceBundle).toContain("OUTPUT_SIZE_MARKS");
    expect(sourceBundle).toContain("FontFace");
    expect(sourceBundle).toContain("icon-maker__preview-panel");
    expect(sourceBundle).toContain("icon-maker__glyph-grid");
    expect(sourceBundle).not.toContain("@chips/" + "component-library");
    expect(sourceBundle).not.toContain("ChipsToggleButton");
    expect(sourceBundle).not.toContain("ChipsCheckbox");
    expect(sourceBundle).not.toContain("resolveAppToolbarCommands");
    expect(sourceBundle).not.toContain("ChipsDialog");
    expect(sourceBundle).not.toContain("iconset");
  });

  it("应保持 antd 共享壳与图标生成工作台结构", () => {
    const appRoot = readProjectFile("src/app/AppRoot.tsx");
    const shell = readProjectFile("src/app/AppShell.tsx");

    expect(appRoot).toContain("ConfigProvider");
    expect(appRoot).toContain("zhCN");
    expect(appRoot).toContain("appleTheme");
    expect(appRoot).toContain("ChipsProvider");
    expect(appRoot).toContain("CommandProvider");
    expect(shell).toContain("AppChrome");
    expect(shell).toContain("IconMakerScene");
    expect(shell).toContain("paletteShortcut=\"Mod+P\"");
    expect(shell).not.toContain("appName=");
    expect(shell).not.toContain("menus=");
    expect(shell).not.toContain("toolbarItems=");
    expect(shell).not.toContain("toolbarExtra=");
  });

  it("应保持应用结构背景单层，无主题系统残留", () => {
    const appCss = readProjectFile("src/app/app-shell.css");

    expect(appCss).toContain("@font-face");
    expect(appCss).toContain("--icon-maker-canvas: #f5f5f7");
    expect(appCss).toContain(".icon-maker__panel,");
    expect(appCss).not.toContain("chips-" + "sys");
    expect(appCss).not.toContain("data-scope");
  });
});
