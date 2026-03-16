import { describe, it, expect } from "vitest";
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

const TEMP_ROOT = path.join(__dirname, "..", ".tmp-basecard-tests");

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
    const targetDir = path.join(TEMP_ROOT, "card-standard-project");
    await removeDirIfExists(targetDir);

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
    expect(manifest).toMatch(/capabilities:/);
    await expect(fs.stat(path.join(targetDir, ".eslintrc.cjs"))).resolves.toBeTruthy();
    expect(pkg.devDependencies.eslint).toBe("^8.57.1");
    expect(pkg.devDependencies["@typescript-eslint/parser"]).toBe("^7.18.0");
    expect(pkg.devDependencies["chips-sdk"]).toBe("^0.1.0");

    const readme = await fs.readFile(
      path.join(targetDir, "README.md"),
      "utf8"
    );
    const runtimeContract = await fs.readFile(
      path.join(targetDir, "src", "runtime-contract.ts"),
      "utf8"
    );
    const entrySource = await fs.readFile(
      path.join(targetDir, "src", "index.ts"),
      "utf8"
    );
    expect(readme).toMatch(/Standard Basecard Plugin/);
    expect(runtimeContract).toMatch(/export function getBasecardDescriptor/);
    expect(runtimeContract).toMatch(/export function collectReferencedResources/);
    expect(entrySource).toMatch(/from "\.\/runtime-contract"/);
    expect(entrySource).toMatch(/getBasecardDescriptor/);
    expect(entrySource).toMatch(/collectReferencedResources/);
  });
});
