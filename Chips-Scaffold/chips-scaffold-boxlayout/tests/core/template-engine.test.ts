import { describe, expect, it } from "vitest";
import os from "node:os";
import * as path from "node:path";
import { promises as fs } from "node:fs";
import {
  listAvailableTemplates,
  renderTemplateToTarget,
} from "../../src/core/template-engine";
import type {
  BoxlayoutScaffoldTemplateMeta,
  CreateBoxlayoutProjectOptions,
} from "../../src/core/types";

const FORBIDDEN_PROJECT_DIRS = [
  "需求文档",
  "技术文档",
  "技术手册",
  "开发计划",
];

async function removeDirIfExists(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

describe("template-engine", () => {
  it("lists available templates", async () => {
    const templates = await listAvailableTemplates();
    const ids = templates.map((t: BoxlayoutScaffoldTemplateMeta) => t.id);
    expect(ids).toContain("boxlayout-standard");
  });

  it("renders boxlayout-standard template to target directory", async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "chips-boxlayout-scaffold-test-")
    );
    const targetDir = path.join(tempRoot, "boxlayout-standard-project");

    try {
      const options: CreateBoxlayoutProjectOptions = {
        projectName: "boxlayout-standard-project",
        targetDir,
        templateId: "boxlayout-standard",
        pluginId: "chips.layout.boxlayout-standard",
        layoutType: "chips.layout.grid",
        displayName: "Standard Box Layout Plugin",
        description: "标准布局插件模板生成工程。",
        version: "0.1.0",
        authorName: "Scaffold",
        authorEmail: "dev@example.com",
      };

      const result = await renderTemplateToTarget(options);
      expect(result.projectDir).toBe(targetDir);
      expect(result.templateId).toBe("boxlayout-standard");
      expect(result.filesCreated).toBeGreaterThan(0);

      const manifest = await fs.readFile(path.join(targetDir, "manifest.yaml"), "utf8");
      const pkg = JSON.parse(await fs.readFile(path.join(targetDir, "package.json"), "utf8"));
      expect(manifest).toMatch(/type:\s+layout/);
      expect(manifest).toMatch(/runtime:\n  targets:\n    desktop:\n      supported:\s+true/);
      expect(manifest).toMatch(/headless:\n      supported:\s+true/);
      expect(manifest).toMatch(/layout:/);
      expect(manifest).toMatch(/layoutType:\s+chips\.layout\.grid/);
      expect(manifest).toMatch(/displayName:\s+Standard Box Layout Plugin/);
      expect(manifest).not.toMatch(/ui:\s*\n\s*surface:/);
      expect(manifest).not.toMatch(/theme\.read|i18n\.read/);
      await expect(fs.stat(path.join(targetDir, ".eslintrc.cjs"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(targetDir, "src", "index.ts"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(targetDir, "src", "view", "page.tsx"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(targetDir, "src", "editor", "panel.tsx"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(targetDir, "src", "editor", "frame-region-editor.tsx"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(targetDir, "src", "lib", "messages.ts"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(targetDir, "tests", "setup.ts"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(targetDir, "tests", "unit", "schema.test.ts"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(targetDir, "src", "shared", "i18n.ts"))).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(fs.stat(path.join(targetDir, "i18n", "zh-CN.json"))).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(fs.stat(path.join(targetDir, "i18n", "en-US.json"))).rejects.toMatchObject({
        code: "ENOENT",
      });
      expect(pkg.dependencies.react).toBe("^18.2.0");
      expect(pkg.dependencies["react-dom"]).toBe("^18.2.0");
      expect(pkg.dependencies["@chips/component-library"]).toBeUndefined();
      expect(pkg.dependencies.antd).toBe("6.5.4");
      expect(pkg.dependencies["@ant-design/icons"]).toBe("6.3.2");
      expect(pkg.dependencies.dayjs).toBe("1.11.21");
      expect(pkg.dependencies["@chips/ui"]).toBe("0.1.0");
      expect(pkg.devDependencies["@types/node"]).toBe("^22.13.10");
      expect(pkg.devDependencies["chips-sdk"]).toBe("^0.1.0");
      for (const scriptName of [
        "lint",
        "typecheck",
        "test",
        "build",
        "validate",
        "package",
        "verify",
      ]) {
        expect(typeof pkg.scripts[scriptName]).toBe("string");
      }
      for (const command of [
        "npm run lint",
        "npm run typecheck",
        "npm test",
        "npm run build",
        "npm run validate",
        "npm run package",
      ]) {
        expect(pkg.scripts.verify).toContain(command);
      }
      await expect(fs.stat(path.join(targetDir, "template.json"))).rejects.toMatchObject({
        code: "ENOENT",
      });

      const indexTs = await fs.readFile(path.join(targetDir, "src", "index.ts"), "utf8");
      expect(indexTs).toMatch(/export const layoutDefinition/);
      expect(indexTs).toMatch(/layoutType:\s*"chips\.layout\.grid"/);
      expect(indexTs).toMatch(/pluginId:\s*"chips\.layout\.boxlayout-standard"/);
      expect(indexTs).toMatch(/readBoxAsset:\s*ctx\.readBoxAsset/);
      expect(indexTs).toMatch(/importBoxAsset:\s*ctx\.importBoxAsset/);
      expect(indexTs).toMatch(/deleteBoxAsset:\s*ctx\.deleteBoxAsset/);

      const sharedTypes = await fs.readFile(
        path.join(targetDir, "src", "shared", "types.ts"),
        "utf8"
      );
      expect(sharedTypes).toMatch(/documentId\?:\s*string/);
      expect(sharedTypes).toMatch(/"documentInfo"/);
      expect(sharedTypes).toMatch(/"documentFile"/);
      expect(sharedTypes).toMatch(/"document-window"/);
      expect(sharedTypes).toMatch(/documentType\?:\s*"card" \| "box"/);
      expect(sharedTypes).not.toMatch(/\bcardId\b|\bcardInfo\b|\bcardFile\b|\bcard-window\b/);

      const layoutConfig = await fs.readFile(
        path.join(targetDir, "src", "schema", "layout-config.ts"),
        "utf8"
      );
      expect(layoutConfig).toMatch(/sortMode/);
      expect(layoutConfig).toMatch(/background/);
      expect(layoutConfig).toMatch(/topRegion/);
      expect(layoutConfig).not.toMatch(/\bcolumnCount\b|\binformationDensity\b/);

      const readme = await fs.readFile(path.join(targetDir, "README.md"), "utf8");
      expect(readme).toMatch(/Standard Box Layout Plugin/);
      expect(readme).toMatch(/layoutDefinition/);
      expect(readme).toMatch(/@chips\/ui/);
      expect(readme).toMatch(/\bantd\b/);
      expect(readme).not.toMatch(/@chips\/component-library/);
      expect(readme).toMatch(/chipsdev-r create layout/);
      expect(readme).toMatch(/renderEntryCover/);
      expect(readme).toMatch(/readBoxAsset/);
      expect(readme).toMatch(/importBoxAsset/);
      expect(readme).toMatch(/deleteBoxAsset/);
      expect(readme).toMatch(/schemaVersion/);
      expect(readme).toMatch(/assetRefs/);
      expect(readme).toMatch(/schema_version/);
      expect(readme).toMatch(/asset_refs/);
      expect(readme).toMatch(/npm run verify/);
      expect(readme).not.toMatch(/\bchips dev\b|chips-scaffold-boxlayout/);

      const messagesTs = await fs.readFile(
        path.join(targetDir, "src", "lib", "messages.ts"),
        "utf8"
      );
      expect(messagesTs).toMatch(/export function formatMessage/);
      expect(messagesTs).toMatch(/editor\.entry_count/);
      expect(messagesTs).toMatch(/layout\.empty/);

      const viewPage = await fs.readFile(
        path.join(targetDir, "src", "view", "page.tsx"),
        "utf8"
      );
      expect(viewPage).toMatch(/from\s+"@chips\/ui"/);
      expect(viewPage).toMatch(/formatMessage/);
      expect(viewPage).toMatch(/EmbeddedDocumentFrame/);
      expect(viewPage).not.toMatch(/@chips\/component-library/);
      expect(viewPage).not.toMatch(/-{2}chips-(?:sys|comp|base|layout)-/);
      expect(viewPage).not.toMatch(/\[data-part=/);

      const editorPanel = await fs.readFile(
        path.join(targetDir, "src", "editor", "panel.tsx"),
        "utf8"
      );
      expect(editorPanel).toMatch(/ConfigProvider/);
      expect(editorPanel).toMatch(/appleTheme/);
      expect(editorPanel).toMatch(/Select/);
      expect(editorPanel).toMatch(/FrameRegionEditor/);
      expect(editorPanel).not.toMatch(/@chips\/component-library/);
      expect(editorPanel).not.toMatch(/\bChips[A-Z]/);

      const editorRuntime = await fs.readFile(
        path.join(targetDir, "src", "editor", "runtime.ts"),
        "utf8"
      );
      const viewRuntime = await fs.readFile(
        path.join(targetDir, "src", "view", "runtime.ts"),
        "utf8"
      );
      expect(editorRuntime).toMatch(/createLayoutEditorRoot/);
      expect(viewRuntime).toMatch(/ConfigProvider/);

      const vitestConfig = await fs.readFile(
        path.join(targetDir, "vitest.config.mts"),
        "utf8"
      );
      expect(vitestConfig).toMatch(/setupFiles:\s*\["tests\/setup\.ts"\]/);

      const generatedTextFiles = [
        "manifest.yaml",
        "README.md",
        "chips.config.mjs",
        path.join("src", "index.ts"),
        path.join("src", "shared", "types.ts"),
        path.join("src", "schema", "layout-config.ts"),
        path.join("src", "view", "page.tsx"),
        path.join("src", "editor", "panel.tsx"),
        path.join("src", "editor", "frame-region-editor.tsx"),
      ];
      for (const relativePath of generatedTextFiles) {
        const source = await fs.readFile(path.join(targetDir, relativePath), "utf8");
        expect(source).not.toMatch(/\{\{\s*[A-Z0-9_]+\s*\}\}/);
        expect(source).not.toMatch(/\bchips dev\b/);
        expect(source).not.toMatch(/\bTODO\b|\bFIXME\b/i);
      }

      for (const dirName of FORBIDDEN_PROJECT_DIRS) {
        await expect(fs.stat(path.join(targetDir, dirName))).rejects.toMatchObject({
          code: "ENOENT",
        });
      }
    } finally {
      await removeDirIfExists(tempRoot);
    }
  });
});
