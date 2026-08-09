import { describe, it, expect } from "vitest";
import os from "node:os";
import * as path from "node:path";
import { promises as fs } from "node:fs";
import {
  listAvailableTemplates,
  renderTemplateToTarget,
} from "../../src/core/template-engine";
import type {
  BasecardScaffoldTemplateMeta,
  CreateBasecardProjectOptions,
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
    // 忽略清理错误
  }
}

describe("template-engine", () => {
  it("lists available templates", async () => {
    const templates = await listAvailableTemplates();
    const ids = templates.map((t: BasecardScaffoldTemplateMeta) => t.id);
    expect(ids).toContain("card-standard");
  });

  it("renders card-standard template to target directory", async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "chips-basecard-scaffold-test-")
    );
    const targetDir = path.join(tempRoot, "card-standard-project");

    try {
      const options: CreateBasecardProjectOptions = {
        projectName: "card-standard-project",
        targetDir,
        templateId: "card-standard",
        pluginId: "com.example.card-standard",
        cardType: "base.text",
        displayName: "Standard Basecard Plugin",
        version: "0.1.0",
        authorName: "Scaffold",
        authorEmail: "dev@example.com",
      };

      const result = await renderTemplateToTarget(options);
      expect(result.projectDir).toBe(targetDir);
      expect(result.templateId).toBe("card-standard");
      expect(result.filesCreated).toBeGreaterThan(0);

      const manifest = await fs.readFile(
        path.join(targetDir, "manifest.yaml"),
        "utf8"
      );
      const pkg = JSON.parse(
        await fs.readFile(path.join(targetDir, "package.json"), "utf8")
      );
      expect(manifest).toMatch(/type:\s+card/);
      expect(manifest).toMatch(/runtime:\n  targets:\n    desktop:\n      supported:\s+true/);
      expect(manifest).toMatch(/web:\n      supported:\s+false/);
      expect(manifest).toMatch(/mobile:\n      supported:\s+false/);
      expect(manifest).toMatch(/headless:\n      supported:\s+true/);
      expect(manifest).toMatch(/capabilities:\n  cardTypes:\n    - base\.text/);
      expect(manifest).not.toMatch(/chips-scaffold-basecard/);
      expect(manifest).not.toMatch(/ui:\s*\n\s*surface:/);
      expect(manifest).not.toMatch(/theme\.read|i18n\.read/);
      await expect(fs.stat(path.join(targetDir, ".eslintrc.cjs"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(targetDir, "vitest.config.mts"))).resolves.toBeTruthy();
      await expect(fs.stat(path.join(targetDir, "src", "lib", "messages.ts"))).resolves.toBeTruthy();
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
      expect(pkg.devDependencies["@types/react"]).toBe("^18.2.66");
      expect(pkg.devDependencies.eslint).toBe("^8.57.1");
      expect(pkg.devDependencies["@typescript-eslint/parser"]).toBe("^7.18.0");
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

      const readme = await fs.readFile(
        path.join(targetDir, "README.md"),
        "utf8"
      );
      const chipsConfig = await fs.readFile(
        path.join(targetDir, "chips.config.mjs"),
        "utf8"
      );
      const vitestConfig = await fs.readFile(
        path.join(targetDir, "vitest.config.mts"),
        "utf8"
      );
      const indexTs = await fs.readFile(
        path.join(targetDir, "src", "index.ts"),
        "utf8"
      );
      expect(readme).toMatch(/Standard Basecard Plugin/);
      expect(readme).toMatch(/basecardDefinition/);
      expect(readme).toMatch(/@chips\/ui/);
      expect(readme).toMatch(/\bantd\b/);
      expect(readme).not.toMatch(/@chips\/component-library/);
      expect(readme).not.toMatch(/chips-scaffold-basecard/);
      expect(readme).not.toMatch(/\bchips dev\b/);
      expect(chipsConfig).toMatch(/chipsdev-r/);
      expect(chipsConfig).not.toMatch(/\bchips dev\b|最小可用结构/);
      expect(vitestConfig).toMatch(/react\/jsx-runtime/);
      expect(vitestConfig).toMatch(/react-dom\/client/);
      expect(vitestConfig).toMatch(/dedupe:\s*\["react", "react-dom"\]/);
      expect(vitestConfig).toMatch(/setupFiles:\s*\["tests\/setup\.ts"\]/);
      expect(indexTs).toMatch(/export const basecardDefinition/);
      expect(indexTs).toMatch(/export function renderBasecardView/);
      expect(indexTs).toMatch(/export function renderBasecardEditor/);
      expect(indexTs).toMatch(/cardType:\s*"base\.text"/);
      expect(indexTs).toMatch(/pluginId:\s*"com\.example\.card-standard"/);
      expect(indexTs).toMatch(/openResource\?:/);
      expect(indexTs).toMatch(/importArchiveBundle\?:/);
      expect(indexTs).toMatch(/convertTiffToPng\?:/);
      expect(indexTs).toMatch(/collectResourcePaths/);
      expect(indexTs).toMatch(/previewPointerEvents:\s*"native"/);
      expect(indexTs).not.toMatch(/window\.chips|from\s+["']node:fs["']|from\s+["']fs["']/);

      await expect(fs.stat(path.join(targetDir, "template.json"))).rejects.toMatchObject({
        code: "ENOENT",
      });

      const renderView = await fs.readFile(
        path.join(targetDir, "src", "render", "view.tsx"),
        "utf8"
      );
      expect(renderView).not.toMatch(/@chips\/component-library/);
      expect(renderView).toMatch(/resolveResourceUrl/);
      expect(renderView).toMatch(/releaseResourceUrl/);
      expect(renderView).toMatch(/openResource/);
      expect(renderView).toMatch(/formatMessage/);
      expect(renderView).toMatch(/Typography/);
      expect(renderView).not.toMatch(/chips-basecard__surface/);
      expect(renderView).not.toMatch(/box-shadow/);
      expect(renderView).not.toMatch(/radial-gradient/);
      expect(renderView).not.toMatch(/>[^<{]*[\u4e00-\u9fff][^<{]*</);

      const editorPanel = await fs.readFile(
        path.join(targetDir, "src", "editor", "panel.tsx"),
        "utf8"
      );
      expect(editorPanel).not.toMatch(/ChipsForm|ChipsTextField|ChipsTextArea|ChipsErrorState|ChipsBox|ChipsStack|ChipsButton|ChipsText/);
      expect(editorPanel).not.toMatch(/@chips\/component-library/);
      expect(editorPanel).toMatch(/ConfigProvider/);
      expect(editorPanel).toMatch(/appleTheme/);
      expect(editorPanel).toMatch(/antd\/locale\/zh_CN/);
      expect(editorPanel).toMatch(/<Input/);
      expect(editorPanel).toMatch(/Input\.TextArea/);
      expect(editorPanel).toMatch(/Button/);
      expect(editorPanel).toMatch(/formatMessage/);
      expect(editorPanel).toMatch(/importResource/);
      expect(editorPanel).toMatch(/deleteResource/);
      expect(editorPanel).toMatch(/resource_path/);
      expect(editorPanel).not.toMatch(/<input/);
      expect(editorPanel).not.toMatch(/<textarea/);
      expect(editorPanel).not.toMatch(/box-shadow/);
      expect(editorPanel).not.toMatch(/radial-gradient/);
      expect(editorPanel).not.toMatch(/>[^<{]*[\u4e00-\u9fff][^<{]*</);

      const messagesTs = await fs.readFile(
        path.join(targetDir, "src", "lib", "messages.ts"),
        "utf8"
      );
      expect(messagesTs).toMatch(/export function formatMessage/);
      expect(messagesTs).toMatch(/basecard\.field\.title\.label/);
      expect(messagesTs).toMatch(/basecard\.view\.ariaLabel/);

      const schemaTs = await fs.readFile(
        path.join(targetDir, "src", "schema", "card-config.ts"),
        "utf8"
      );
      expect(schemaTs).toMatch(/resource_path\?:\s*string/);
      expect(schemaTs).toMatch(/isCardRootResourcePath/);
      expect(schemaTs).toMatch(/collectBasecardResourcePaths/);

      const defaultConfig = await fs.readFile(
        path.join(targetDir, "templates", "default-card-config.yaml"),
        "utf8"
      );
      expect(defaultConfig).toMatch(/resource_path:\s*""/);

      const parameters = await fs.readFile(
        path.join(targetDir, "templates", "parameters.md"),
        "utf8"
      );
      expect(parameters).toMatch(/resource_path/);

      const renderViewTest = await fs.readFile(
        path.join(targetDir, "tests", "unit", "render-view.test.tsx"),
        "utf8"
      );
      const editorPanelTest = await fs.readFile(
        path.join(targetDir, "tests", "unit", "editor-panel.test.tsx"),
        "utf8"
      );
      const integrationTest = await fs.readFile(
        path.join(targetDir, "tests", "integration", "card-flow.test.ts"),
        "utf8"
      );
      expect(renderViewTest).toMatch(/resolveResourceUrl/);
      expect(renderViewTest).toMatch(/releaseResourceUrl/);
      expect(renderViewTest).toMatch(/openResource/);
      expect(editorPanelTest).toMatch(/importResource/);
      expect(editorPanelTest).toMatch(/deleteResource/);
      expect(editorPanelTest).toMatch(/data-chips-basecard-field="title"/);
      expect(integrationTest).toMatch(/cleans editor container styles after unmount/);

      const generatedTextFiles = [
        "manifest.yaml",
        "README.md",
        "chips.config.mjs",
        path.join("src", "index.ts"),
        path.join("src", "render", "view.tsx"),
        path.join("src", "editor", "panel.tsx"),
        path.join("templates", "parameters.md"),
      ];
      for (const relativePath of generatedTextFiles) {
        const source = await fs.readFile(path.join(targetDir, relativePath), "utf8");
        expect(source).not.toMatch(/\{\{\s*[A-Z0-9_]+\s*\}\}/);
        expect(source).not.toMatch(/\bchips dev\b/);
        expect(source).not.toMatch(/chips-scaffold-basecard/);
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
