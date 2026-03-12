import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCardPackageService, readDocumentMode } from "../../src/domains/card-package/card-package-service";
import { parseYamlLite } from "../../src/domains/card-package/yaml-lite";

let workspace: string;
const richtextInstallPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../Chips-BaseCardPlugin/richtext-BCP",
);

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), "chips-editing-engine-card-package-"));
});

afterEach(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
});

function createFileClient() {
  return {
    async read(targetPath: string, options?: { encoding?: "utf-8" | "binary" }) {
      if (options?.encoding === "utf-8") {
        return fs.readFile(targetPath, "utf-8");
      }
      return new Uint8Array(await fs.readFile(targetPath));
    },
    async write(targetPath: string, content: string | Uint8Array) {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content);
    },
    async stat(targetPath: string) {
      const stats = await fs.stat(targetPath);
      return {
        path: targetPath,
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        mtimeMs: stats.mtimeMs,
      };
    },
    async list(dir: string) {
      return fs.readdir(dir);
    },
    async exists(targetPath: string) {
      try {
        await fs.access(targetPath);
        return true;
      } catch {
        return false;
      }
    },
    async mkdir(targetPath: string, options?: { recursive?: boolean }) {
      await fs.mkdir(targetPath, { recursive: options?.recursive ?? true });
    },
    async delete(targetPath: string, options?: { recursive?: boolean }) {
      await fs.rm(targetPath, { recursive: options?.recursive ?? true, force: true });
    },
    async copy(source: string, destination: string, options?: { overwrite?: boolean }) {
      const destinationExists = await this.exists(destination);
      if ((options?.overwrite ?? true) && destinationExists) {
        await fs.rm(destination, { recursive: true, force: true });
      }
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.cp(source, destination, { recursive: true, force: options?.overwrite ?? true });
    },
    async move(source: string, destination: string, options?: { overwrite?: boolean }) {
      const destinationExists = await this.exists(destination);
      if ((options?.overwrite ?? true) && destinationExists) {
        await fs.rm(destination, { recursive: true, force: true });
      }
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.rename(source, destination);
    },
  };
}

async function copyDirectoryContents(sourceDir: string, destinationDir: string) {
  await fs.mkdir(destinationDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    await fs.cp(path.join(sourceDir, entry.name), path.join(destinationDir, entry.name), { recursive: true });
  }
}

async function writeFixtureCard(cardDir: string) {
  await fs.mkdir(path.join(cardDir, ".card"), { recursive: true });
  await fs.mkdir(path.join(cardDir, "content"), { recursive: true });
  await fs.writeFile(
    path.join(cardDir, ".card", "metadata.yaml"),
    [
      'chip_standards_version: "1.0.0"',
      'card_id: "a1B2c3D4e5"',
      'name: "Demo Card"',
      'created_at: "2026-03-11T00:00:00.000Z"',
      'modified_at: "2026-03-11T00:00:00.000Z"',
      'editor_state:',
      '  mode: "edit"',
      "",
    ].join("\n"),
    "utf-8",
  );
  await fs.writeFile(
    path.join(cardDir, ".card", "structure.yaml"),
    [
      'structure:',
      '  - id: "node000001"',
      '    type: "base.richtext"',
      'manifest:',
      '  card_count: 1',
      '  resource_count: 0',
      "",
    ].join("\n"),
    "utf-8",
  );
  await fs.writeFile(
    path.join(cardDir, "content", "node000001.yaml"),
    ['id: "node000001"', 'card_type: "base.richtext"', 'title: "Existing"', 'body: "<p>Body</p>"', ""].join("\n"),
    "utf-8",
  );
}

function createClient(cardPluginInstallPath: string) {
  const file = createFileClient();
  return {
    file,
    zip: {
      async extract(zipPath: string, outputDir: string) {
        await copyDirectoryContents(zipPath, outputDir);
      },
      async compress(inputDir: string, outputZip: string) {
        await copyDirectoryContents(inputDir, outputZip);
      },
      async list() {
        return [];
      },
    },
    plugin: {
      async query() {
        return [
          {
            id: "chips.basecard.richtext",
            manifestPath: path.join(cardPluginInstallPath, "manifest.yaml"),
            enabled: true,
            version: "0.1.0",
            type: "card",
            name: "富文本基础卡片插件",
            installPath: cardPluginInstallPath,
            installedAt: 0,
            capabilities: ["base.richtext"],
          },
        ];
      },
    },
  } as never;
}

describe("card-package-service", () => {
  it("lists template-backed base card types", async () => {
    const service = createCardPackageService(createClient(richtextInstallPath));
    await expect(service.listAvailableBaseCardTypes()).resolves.toEqual([
      {
        pluginId: "chips.basecard.richtext",
        pluginName: "富文本基础卡片插件",
        cardType: "base.richtext",
        templatePath: path.join(richtextInstallPath, "templates/default-card-config.yaml"),
      },
    ]);
  });

  it("adds, reorders, removes base cards and updates document mode", async () => {
    const cardDir = path.join(workspace, "demo.card");
    await writeFixtureCard(cardDir);
    const service = createCardPackageService(createClient(richtextInstallPath));

    const added = await service.addBaseCard({
      cardFile: cardDir,
      cardType: "base.richtext",
      insertIndex: 1,
    });

    const structureAfterAdd = parseYamlLite(await fs.readFile(path.join(cardDir, ".card", "structure.yaml"), "utf-8"));
    expect(Array.isArray(structureAfterAdd.structure)).toBe(true);
    expect((structureAfterAdd.structure as Array<unknown>).length).toBe(2);
    expect(await fs.readFile(path.join(cardDir, "content", `${added.nodeId}.yaml`), "utf-8")).toContain('card_type: "base.richtext"');

    await service.reorderBaseCard({
      cardFile: cardDir,
      nodeId: added.nodeId,
      targetIndex: 0,
    });

    const structureAfterMove = parseYamlLite(await fs.readFile(path.join(cardDir, ".card", "structure.yaml"), "utf-8"));
    const movedNodes = structureAfterMove.structure as Array<{ id: string }>;
    expect(movedNodes[0]?.id).toBe(added.nodeId);

    await service.removeBaseCard({
      cardFile: cardDir,
      nodeId: added.nodeId,
    });

    const structureAfterRemove = parseYamlLite(await fs.readFile(path.join(cardDir, ".card", "structure.yaml"), "utf-8"));
    expect((structureAfterRemove.structure as Array<unknown>).length).toBe(1);
    await expect(fs.access(path.join(cardDir, "content", `${added.nodeId}.yaml`))).rejects.toBeDefined();

    await service.setDocumentMode({
      cardFile: cardDir,
      mode: "view",
    });

    const metadataAfterMode = parseYamlLite(await fs.readFile(path.join(cardDir, ".card", "metadata.yaml"), "utf-8"));
    expect(readDocumentMode({ metadata: metadataAfterMode })).toBe("view");
    expect(typeof metadataAfterMode.modified_at).toBe("string");
  });
});
