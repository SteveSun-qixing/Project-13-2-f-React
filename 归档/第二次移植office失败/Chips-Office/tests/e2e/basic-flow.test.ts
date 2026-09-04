import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "../..");

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function listFilesRecursively(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listFilesRecursively(path.join(dir, entry.name))
      : [path.join(dir, entry.name)],
  );
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
    expect(manifest).toMatch(/^commands:[\s\S]*?- id: chips-office open/m);
    expect(manifest).toMatch(/^\s*- id: chips-office open/m);
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

describe("manifest 能力声明与构建产物校验", () => {
  /** Office 四件套核心格式到 MIME 类型的映射（与生态万能文件处理协议一致）。 */
  const OFFICE_MIME_TYPES: Record<string, string> = {
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pdf: "application/pdf",
  };

  /** 应用插件应对核心格式提供的三类文件处理动作。 */
  const FILE_HANDLER_ACTIONS = ["view", "edit", "preview"] as const;

  it("manifest 的 file-handler 能力应完整覆盖 docx/pptx/xlsx/pdf 三类动作", () => {
    const manifest = readProjectFile("manifest.yaml");

    for (const [extension, mimeType] of Object.entries(OFFICE_MIME_TYPES)) {
      for (const action of FILE_HANDLER_ACTIONS) {
        const capability = `file-handler:${action}:${mimeType}`;
        expect(
          manifest,
          `manifest 应为 .${extension} 声明 ${action} 能力（${capability}）`,
        ).toContain(capability);
      }
    }
  });

  it("manifest 的应用命令与权限声明应完整", () => {
    const manifest = readProjectFile("manifest.yaml");

    expect(manifest).toMatch(/^commands:[\s\S]*?- id: chips-office open/m);
    expect(manifest).toMatch(/- id: chips-office open[\s\S]*?type: builtin/);
    expect(manifest).toMatch(/- id: chips-office open[\s\S]*?description: 使用 Chips Office 打开 Office 文档/);

    for (const permission of [
      "resource.read",
      "file.read",
      "file.write",
      "command.read",
      "command.write",
      "command.invoke",
    ]) {
      expect(
        manifest,
        `manifest 应声明权限 ${permission}`,
      ).toContain(`- ${permission}`);
    }

    expect(manifest).toContain("entry: dist/index.html");
  });

  it("outDir 构建产物应存在关键入口文件且引用完整", () => {
    const config = readProjectFile("chips.config.mjs");
    expect(config).toContain('outDir: "dist"');
    expect(config).toContain('entry: "index.html"');

    const distDir = path.join(projectRoot, "dist");
    expect(existsSync(distDir), "构建产物目录 dist 应存在").toBe(true);

    const entryHtmlPath = path.join(distDir, "index.html");
    expect(existsSync(entryHtmlPath), "构建入口 index.html 应存在").toBe(true);

    const distFiles = listFilesRecursively(distDir);
    expect(
      distFiles.some((filePath) => /^index-.+\.js$/.test(path.basename(filePath))),
      "dist 应存在主入口 JS 产物",
    ).toBe(true);
    expect(
      distFiles.some((filePath) => /^index-.+\.css$/.test(path.basename(filePath))),
      "dist 应存在主入口 CSS 产物",
    ).toBe(true);

    const entryHtml = readFileSync(entryHtmlPath, "utf8");
    const referencedAssets = Array.from(
      entryHtml.matchAll(/(?:src|href)="(?!https?:|\/\/)([^"]+)"/g),
    ).map((match) => match[1]);
    expect(referencedAssets.length, "入口 HTML 应引用本地构建资产").toBeGreaterThan(0);
    for (const asset of referencedAssets) {
      const assetPath = path.join(distDir, asset.replace(/^\//, ""));
      expect(
        existsSync(assetPath),
        `入口 HTML 引用的资产 ${asset} 应存在于构建产物中`,
      ).toBe(true);
    }
  });
});
