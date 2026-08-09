import { describe, expect, it } from "vitest";
import os from "node:os";
import * as path from "node:path";
import { promises as fs } from "node:fs";
import {
  listAvailableTemplates,
  renderTemplateToTarget,
} from "../../src/core/template-engine";
import type {
  CreateModuleProjectOptions,
  ModuleScaffoldTemplateMeta,
} from "../../src/core/types";

const FORBIDDEN_PROJECT_DIRS = [
  "需求文档",
  "技术文档",
  "技术手册",
  "开发计划",
];

const EXPECTED_TEMPLATE_IDS = [
  "module-standard",
  "module-pure-function",
  "module-file-conversion",
  "module-html-rendering",
  "module-image-processing",
  "module-color-extraction",
  "module-orchestration",
];

const FORBIDDEN_RENDERED_PATTERNS = [
  /\{\{\s*[A-Z0-9_]+\s*\}\}/,
  /template\.json/,
  /mountModule/,
  /ctx\.services/,
  /ui\.surface/,
  /runtime\.tsx/,
  /\bchips dev\b/i,
  /TODO|FIXME/,
];

const HOST_FIXED_CLI_COMMAND_ROOTS = new Set([
  "help",
  "host",
  "start",
  "stop",
  "status",
  "config",
  "logs",
  "theme",
  "plugin",
  "update",
  "doctor",
  "open",
  "completion",
]);

const assertModuleCliCommandContract = (
  templateId: string,
  manifest: string,
  expected: {
    commandSuffix: string;
    method: string;
    titleKey: string;
    permissionSnippets?: string[];
    snippets: string[];
  }
) => {
  expect(manifest, templateId).toMatch(/cli:\n\s+commands:/);
  expect(manifest, templateId).toContain(`commandPath: ${templateId}-project ${expected.commandSuffix}`);
  expect(manifest, templateId).toContain("target:\n        type: module");
  expect(manifest, templateId).toContain(`method: ${expected.method}`);
  expect(manifest, templateId).toContain(`titleKey: ${expected.titleKey}`);
  expect(manifest, templateId).toMatch(/output:\n\s+mode:\s+json/);

  const commandPathMatch = manifest.match(/commandPath:\s+([^\n]+)/);
  expect(commandPathMatch, `${templateId} should declare commandPath`).not.toBeNull();
  const root = commandPathMatch?.[1]?.trim().split(/\s+/)[0] ?? "";
  expect(HOST_FIXED_CLI_COMMAND_ROOTS.has(root), `${templateId} CLI root should not shadow Host fixed commands`).toBe(false);

  for (const snippet of expected.permissionSnippets ?? []) {
    expect(manifest, templateId).toContain(snippet);
  }
  for (const snippet of expected.snippets) {
    expect(manifest, templateId).toContain(snippet);
  }
  for (const forbiddenPattern of [
    /^plugin\s*:/m,
    /^theme\s*:/m,
    /^themeId\s*:/m,
    /^displayName\s*:/m,
    /^layout\s*:/m,
    /^ui:\n(?:[\s\S]*?^\S|\s*$)/m,
  ]) {
    expect(manifest, `${templateId} should not declare ${forbiddenPattern}`).not.toMatch(forbiddenPattern);
  }
};

async function removeDirIfExists(targetDir: string): Promise<void> {
  try {
    await fs.rm(targetDir, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
}

async function listFiles(rootDir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        results.push(path.relative(rootDir, absolutePath).split(path.sep).join("/"));
      }
    }
  }

  await walk(rootDir);
  return results.sort();
}

async function assertRenderedProjectIsClean(targetDir: string): Promise<void> {
  const files = await listFiles(targetDir);
  expect(files).not.toContain("template.json");

  for (const relativePath of files) {
    const ext = path.extname(relativePath).toLowerCase();
    if (![".ts", ".js", ".json", ".yaml", ".yml", ".md", ".mjs", ".cjs", ".css", ".html"].includes(ext)) {
      continue;
    }
    const content = await fs.readFile(path.join(targetDir, relativePath), "utf8");
    for (const pattern of FORBIDDEN_RENDERED_PATTERNS) {
      expect(content, `${relativePath} should not match ${pattern}`).not.toMatch(pattern);
    }
  }
}

describe("module template-engine", () => {
  it("lists available templates", async () => {
    const templates = await listAvailableTemplates();
    const ids = templates.map((item: ModuleScaffoldTemplateMeta) => item.id);
    expect(ids).toEqual(expect.arrayContaining(EXPECTED_TEMPLATE_IDS));
  });

  it("renders module-standard template to target directory", async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "chips-module-scaffold-test-")
    );
    const targetDir = path.join(tempRoot, "module-standard-project");

    try {
      const options: CreateModuleProjectOptions = {
        projectName: "module-standard-project",
        targetDir,
        templateId: "module-standard",
        pluginId: "chips.module.standard-project",
        moduleCapability: "module.standard.project",
        displayName: "Standard Module Plugin",
        version: "0.1.0",
        authorName: "Scaffold",
        authorEmail: "dev@example.com",
      };

      const result = await renderTemplateToTarget(options);
      expect(result.projectDir).toBe(targetDir);
      expect(result.templateId).toBe("module-standard");
      expect(result.filesCreated).toBeGreaterThan(0);
      await assertRenderedProjectIsClean(targetDir);

      const manifest = await fs.readFile(path.join(targetDir, "manifest.yaml"), "utf8");
      const pkg = JSON.parse(await fs.readFile(path.join(targetDir, "package.json"), "utf8"));
      const moduleDefinitionTest = await fs.readFile(
        path.join(targetDir, "tests", "unit", "module-definition.test.ts"),
        "utf8"
      );

      expect(manifest).toMatch(/type:\s+module/);
      expect(manifest).toMatch(/entry:\s+dist\/index\.mjs/);
      expect(manifest).toMatch(/runtime:\n  targets:\n    desktop:\n      supported:\s+true/);
      expect(manifest).toMatch(/headless:\n      supported:\s+true/);
      expect(manifest).toMatch(/module:\n/);
      expect(manifest).toMatch(/capability:\s+module\.standard\.project/);
      assertModuleCliCommandContract("module-standard", manifest, {
        commandSuffix: "run",
        method: "run",
        titleKey: "module.cli.run.title",
        snippets: [
          "mapsTo: sourceText",
          "mapsTo: uppercase",
          "mapsTo: prefix",
          "commandPath: module-standard-project run-async",
          "method: runAsync",
          "mapsTo: delayMs",
          "cancelOnInterrupt: true",
        ],
      });
      expect(pkg.devDependencies.react).toBeUndefined();
      expect(pkg.devDependencies["chips-sdk"]).toBe("^0.1.0");
      expect(moduleDefinitionTest).toMatch(/runAsync/);
      expect(moduleDefinitionTest).not.toMatch(/mountModule/);

      const readme = await fs.readFile(path.join(targetDir, "README.md"), "utf8");
      expect(readme).toMatch(/Standard Module Plugin/);
      expect(readme).toMatch(/安装到 Host 中的无界面能力模块/);
      expect(readme).toMatch(/chipsdev-r module invoke/);
      expect(readme).toMatch(/\.cpk/);
      expect(readme).toMatch(/MODULE_TIMEOUT/);
      expect(readme).toMatch(/MODULE_JOB_CANCELLED/);
      expect(readme).toMatch(/module\.consumes/);

      for (const dirName of FORBIDDEN_PROJECT_DIRS) {
        await expect(fs.stat(path.join(targetDir, dirName))).rejects.toMatchObject({
          code: "ENOENT",
        });
      }
    } finally {
      await removeDirIfExists(tempRoot);
    }
  });

  it("renders all module shape templates with expected contracts and methods", async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "chips-module-scaffold-matrix-test-")
    );

    const expectations: Record<
      string,
      {
        method: string;
        commandSuffix: string;
        titleKey: string;
        cliSnippets: string[];
        cliPermissionSnippets?: string[];
        contracts: string[];
        manifest: RegExp[];
        source: RegExp[];
      }
    > = {
      "module-standard": {
        method: "runAsync",
        commandSuffix: "run",
        titleKey: "module.cli.run.title",
        cliSnippets: [
          "mapsTo: sourceText",
          "mapsTo: uppercase",
          "mapsTo: prefix",
          "commandPath: module-standard-project run-async",
          "method: runAsync",
          "mapsTo: delayMs",
          "ui:\n            control: slider",
          "cancelOnInterrupt: true",
        ],
        contracts: [
          "contracts/run.input.schema.json",
          "contracts/run.output.schema.json",
          "contracts/runAsync.input.schema.json",
          "contracts/runAsync.output.schema.json",
        ],
        manifest: [/name:\s+run/, /name:\s+runAsync/, /mode:\s+job/, /consumes:\s+\[\]/],
        source: [/reportProgress/],
      },
      "module-pure-function": {
        method: "run",
        commandSuffix: "run",
        titleKey: "module.cli.run.title",
        cliSnippets: [
          "mapsTo: value",
          "mapsTo: trim",
          "mapsTo: caseMode",
          "choices: [preserve, upper, lower]",
        ],
        contracts: [
          "contracts/run.input.schema.json",
          "contracts/run.output.schema.json",
        ],
        manifest: [/name:\s+run/, /mode:\s+sync/, /consumes:\s+\[\]/],
        source: [/normalizeValue/],
      },
      "module-file-conversion": {
        method: "convert",
        commandSuffix: "convert",
        titleKey: "module.cli.convert.title",
        cliPermissionSnippets: ["- file.read", "- file.write"],
        cliSnippets: [
          "mapsTo: sourceFile",
          "mapsTo: output.path",
          "mapsTo: output.overwrite",
          "mapsTo: options",
          "artifacts:\n          - outputPath",
          "cancelOnInterrupt: true",
        ],
        contracts: [
          "contracts/convert.input.schema.json",
          "contracts/convert.output.schema.json",
        ],
        manifest: [/file\.read/, /file\.write/, /name:\s+convert/, /mode:\s+job/],
        source: [/ctx\.host\.invoke\("file\.write"/, /CONVERTER_OUTPUT_EXISTS/],
      },
      "module-html-rendering": {
        method: "convert",
        commandSuffix: "render",
        titleKey: "module.cli.render.title",
        cliPermissionSnippets: ["- file.read", "- file.write", "- platform.read"],
        cliSnippets: [
          "mapsTo: htmlDir",
          "mapsTo: outputFile",
          "mapsTo: options.target",
          "mapsTo: entryFile",
          "mapsTo: options.pdf",
          "mapsTo: options.image",
          "choices: [pdf, image]",
          "cancelOnInterrupt: true",
        ],
        contracts: [
          "contracts/convert.input.schema.json",
          "contracts/convert.output.schema.json",
        ],
        manifest: [/platform\.read/, /name:\s+convert/, /mode:\s+job/],
        source: [/platform\.renderHtmlToPdf/, /platform\.renderHtmlToImage/],
      },
      "module-image-processing": {
        method: "process",
        commandSuffix: "process",
        titleKey: "module.cli.process.title",
        cliPermissionSnippets: ["- file.read"],
        cliSnippets: [
          "mapsTo: imagePath",
          "mapsTo: options.sampleSize",
          "min: 16",
          "max: 256",
        ],
        contracts: [
          "contracts/process.input.schema.json",
          "contracts/process.output.schema.json",
        ],
        manifest: [/file\.read/, /name:\s+process/, /mode:\s+sync/],
        source: [/file\.read/, /buildSignature/],
      },
      "module-color-extraction": {
        method: "pick",
        commandSuffix: "colors",
        titleKey: "module.cli.colors.title",
        cliPermissionSnippets: ["- file.read"],
        cliSnippets: [
          "mapsTo: imagePath",
          "mapsTo: options.sampleSize",
          "min: 48",
          "max: 160",
        ],
        contracts: [
          "contracts/pick.input.schema.json",
          "contracts/pick.output.schema.json",
        ],
        manifest: [/file\.read/, /name:\s+pick/, /mode:\s+sync/],
        source: [/backgroundColor/, /accentColor/],
      },
      "module-orchestration": {
        method: "execute",
        commandSuffix: "execute",
        titleKey: "module.cli.execute.title",
        cliPermissionSnippets: ["- module.read", "- module.invoke"],
        cliSnippets: [
          "mapsTo: steps",
          "ui:\n            control: textarea",
          "cancelOnInterrupt: true",
        ],
        contracts: [
          "contracts/execute.input.schema.json",
          "contracts/execute.output.schema.json",
        ],
        manifest: [/module\.read/, /module\.invoke/, /name:\s+execute/, /module\.example\.step/],
        source: [/ctx\.module\.invoke/, /ctx\.module\.job\.get/, /ctx\.module\.job\.cancel/],
      },
    };

    try {
      for (const templateId of EXPECTED_TEMPLATE_IDS) {
        const targetDir = path.join(tempRoot, templateId);
        const options: CreateModuleProjectOptions = {
          projectName: `${templateId}-project`,
          targetDir,
          templateId,
          pluginId: `chips.module.${templateId.replace(/^module-/, "").replace(/-/g, ".")}`,
          moduleCapability: `module.${templateId.replace(/^module-/, "").replace(/-/g, ".")}`,
          moduleConsumes:
            templateId === "module-orchestration"
              ? [{ capability: "module.example.step", versionRange: "^1.0.0" }]
              : [],
          displayName: `${templateId} Project`,
          version: "0.1.0",
          authorName: "Scaffold",
          authorEmail: "dev@example.com",
        };

        await renderTemplateToTarget(options);
        await assertRenderedProjectIsClean(targetDir);

        const files = await listFiles(targetDir);
        const expected = expectations[templateId];
        for (const contract of expected.contracts) {
          expect(files, templateId).toContain(contract);
        }
        expect(files, templateId).toContain("package.json");
        expect(files, templateId).toContain("tests/unit/module-definition.test.ts");
        if (templateId === "module-standard") {
          expect(files, templateId).toContain("contracts/runAsync.input.schema.json");
        } else {
          expect(files, templateId).not.toContain("contracts/runAsync.input.schema.json");
          expect(files, templateId).not.toContain("contracts/runAsync.output.schema.json");
        }

        const manifest = await fs.readFile(path.join(targetDir, "manifest.yaml"), "utf8");
        const readme = await fs.readFile(path.join(targetDir, "README.md"), "utf8");
        const source = await fs.readFile(path.join(targetDir, "src", "index.ts"), "utf8");
        const testFile = await fs.readFile(
          path.join(targetDir, "tests", "unit", "module-definition.test.ts"),
          "utf8"
        );
        for (const pattern of expected.manifest) {
          expect(manifest, templateId).toMatch(pattern);
        }
        assertModuleCliCommandContract(templateId, manifest, {
          commandSuffix: expected.commandSuffix,
          method: expected.method,
          titleKey: expected.titleKey,
          permissionSnippets: expected.cliPermissionSnippets,
          snippets: expected.cliSnippets,
        });
        for (const pattern of expected.source) {
          expect(source, templateId).toMatch(pattern);
        }
        expect(readme, templateId).toMatch(/chipsdev-r module invoke/);
        expect(readme, templateId).toMatch(/\.cpk/);
        expect(readme, templateId).toMatch(/MODULE_TIMEOUT/);
        expect(readme, templateId).toMatch(/MODULE_JOB_CANCELLED/);
        expect(readme, templateId).toMatch(/module\.consumes/);
        expect(testFile, templateId).toMatch(new RegExp(expected.method));
      }
    } finally {
      await removeDirIfExists(tempRoot);
    }
  });
});
