import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import yaml from 'yaml';
import { createError } from '../../../src/shared/errors';
import { guessMimeType, normalizeRelativeResourcePath } from '../../../src/shared';
import { StoreZipService, type ZipEntryPlan } from '../../zip-service/src';

export interface CardPackResourceEntry {
  path: string;
  size: number;
  type: string;
}

export interface CardPackContext {
  metadata: Record<string, unknown>;
  structure: Record<string, unknown>;
  fileCount: number;
  resources: CardPackResourceEntry[];
}

const REQUIRED_CARD_FILES = ['.card/metadata.yaml', '.card/structure.yaml', '.card/cover.html'] as const;

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
};

const parseYamlRecord = (raw: string, filePath: string): Record<string, unknown> => {
  try {
    return asRecord(yaml.parse(raw));
  } catch (error) {
    throw createError('CARD_SCHEMA_INVALID', `Invalid YAML in ${filePath}.`, {
      filePath,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

const isReservedCardFile = (relativePath: string): boolean => {
  return (
    relativePath === '.card/metadata.yaml' ||
    relativePath === '.card/structure.yaml' ||
    relativePath === '.card/cover.html' ||
    relativePath.startsWith('content/')
  );
};

const deepCloneRecord = (value: Record<string, unknown>): Record<string, unknown> => {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
};

export class CardPacker {
  public constructor(private readonly zip = new StoreZipService()) {}

  public async pack(cardDir: string, outputPath: string, options?: { entryPlan?: ZipEntryPlan[] }): Promise<string> {
    const sourceStats = await this.safeStat(cardDir);
    if (!sourceStats?.isDirectory()) {
      throw createError('CARD_PACK_FAILED', `Card directory does not exist: ${cardDir}`, {
        cardDir
      });
    }

    const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-card-pack-'));
    const stagingDir = path.join(stagingRoot, 'card');
    try {
      await fs.cp(cardDir, stagingDir, { recursive: true, force: true });
      const context = await this.preparePackContext(stagingDir);
      const generatedAt = new Date().toISOString();
      const metadataForChecksum = deepCloneRecord(context.metadata);
      delete metadataForChecksum.file_info;
      const checksum = await this.computePayloadChecksum(stagingDir, metadataForChecksum);

      context.metadata.file_info = {
        ...asRecord(context.metadata.file_info),
        total_size: 0,
        file_count: context.fileCount,
        checksum,
        generated_at: generatedAt
      };

      const totalSize = await this.packUntilSizeStabilizes(stagingDir, outputPath, context.metadata, options?.entryPlan);
      context.metadata.file_info = {
        ...asRecord(context.metadata.file_info),
        total_size: totalSize
      };
      await this.writeYamlFile(path.join(stagingDir, '.card/metadata.yaml'), context.metadata);
      await this.zip.compress(stagingDir, outputPath, { entryPlan: options?.entryPlan });
      return outputPath;
    } finally {
      await fs.rm(stagingRoot, { recursive: true, force: true });
    }
  }

  public async unpack(cardFile: string, outputDir: string): Promise<string> {
    const sourceStats = await this.safeStat(cardFile);
    if (!sourceStats?.isFile()) {
      throw createError('CARD_UNPACK_FAILED', `Card file does not exist: ${cardFile}`, {
        cardFile
      });
    }

    await this.zip.extract(cardFile, outputDir);
    return outputDir;
  }

  public async readMetadata(cardFile: string): Promise<Record<string, unknown>> {
    const sourceStats = await this.safeStat(cardFile);
    if (!sourceStats) {
      throw createError('CARD_NOT_FOUND', `Card path does not exist: ${cardFile}`, {
        cardFile
      });
    }

    if (sourceStats.isDirectory()) {
      await this.assertCardDirectory(cardFile);
      const metadataPath = path.join(cardFile, '.card/metadata.yaml');
      return parseYamlRecord(await fs.readFile(metadataPath, 'utf-8'), metadataPath);
    }

    const raw = await this.zip.readEntry(cardFile, '.card/metadata.yaml');
    return parseYamlRecord(raw.toString('utf-8'), `${cardFile}::.card/metadata.yaml`);
  }

  private async preparePackContext(cardDir: string): Promise<CardPackContext> {
    await this.assertCardDirectory(cardDir);

    const metadataPath = path.join(cardDir, '.card/metadata.yaml');
    const structurePath = path.join(cardDir, '.card/structure.yaml');
    const metadata = parseYamlRecord(await fs.readFile(metadataPath, 'utf-8'), metadataPath);
    const structure = parseYamlRecord(await fs.readFile(structurePath, 'utf-8'), structurePath);
    const contentFiles = await this.listFiles(path.join(cardDir, 'content'));
    const resources = await this.collectResourceEntries(cardDir);

    const structureNodes = Array.isArray(structure.structure)
      ? structure.structure
      : Array.isArray(structure.cards)
        ? structure.cards
        : [];

    structure.manifest = {
      ...asRecord(structure.manifest),
      card_count: structureNodes.length > 0 ? structureNodes.length : contentFiles.length,
      resource_count: resources.length,
      resources
    };

    await this.writeYamlFile(structurePath, structure);

    const fileCount = (await this.listFiles(cardDir)).length;
    return {
      metadata,
      structure,
      fileCount,
      resources
    };
  }

  private async assertCardDirectory(cardDir: string): Promise<void> {
    const stats = await this.safeStat(cardDir);
    if (!stats?.isDirectory()) {
      throw createError('CARD_PACK_FAILED', `Card directory does not exist: ${cardDir}`, {
        cardDir
      });
    }

    const missing: string[] = [];
    for (const requiredPath of REQUIRED_CARD_FILES) {
      const absolutePath = path.join(cardDir, requiredPath);
      const exists = await this.safeStat(absolutePath);
      if (!exists?.isFile()) {
        missing.push(requiredPath);
      }
    }

    const contentDir = await this.safeStat(path.join(cardDir, 'content'));
    if (!contentDir?.isDirectory()) {
      missing.push('content/');
    }

    if (missing.length > 0) {
      throw createError('CARD_SCHEMA_INVALID', 'Card directory is missing required files.', {
        cardDir,
        missing
      });
    }

    const metadataPath = path.join(cardDir, '.card/metadata.yaml');
    const structurePath = path.join(cardDir, '.card/structure.yaml');
    parseYamlRecord(await fs.readFile(metadataPath, 'utf-8'), metadataPath);
    parseYamlRecord(await fs.readFile(structurePath, 'utf-8'), structurePath);
  }

  private async collectResourceEntries(cardDir: string): Promise<CardPackResourceEntry[]> {
    const allFiles = await this.listFiles(cardDir);
    const resources: CardPackResourceEntry[] = [];

    for (const relativePath of allFiles) {
      if (isReservedCardFile(relativePath)) {
        continue;
      }
      const resourcePath = normalizeRelativeResourcePath(relativePath);
      if (!resourcePath) {
        continue;
      }
      const absolutePath = path.join(cardDir, relativePath);
      const stat = await fs.stat(absolutePath);
      resources.push({
        path: resourcePath,
        size: stat.size,
        type: guessMimeType(resourcePath)
      });
    }

    resources.sort((left, right) => left.path.localeCompare(right.path));
    return resources;
  }

  private async computePayloadChecksum(cardDir: string, metadataForChecksum: Record<string, unknown>): Promise<string> {
    const files = await this.listFiles(cardDir);
    const hash = crypto.createHash('sha256');

    for (const relativePath of files) {
      hash.update(relativePath, 'utf-8');
      hash.update('\0', 'utf-8');
      if (relativePath === '.card/metadata.yaml') {
        hash.update(yaml.stringify(metadataForChecksum), 'utf-8');
      } else {
        hash.update(await fs.readFile(path.join(cardDir, relativePath)));
      }
      hash.update('\0', 'utf-8');
    }

    return hash.digest('hex');
  }

  private async packUntilSizeStabilizes(
    cardDir: string,
    outputPath: string,
    metadata: Record<string, unknown>,
    entryPlan?: ZipEntryPlan[]
  ): Promise<number> {
    let expectedSize = 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      metadata.file_info = {
        ...asRecord(metadata.file_info),
        total_size: expectedSize
      };
      await this.writeYamlFile(path.join(cardDir, '.card/metadata.yaml'), metadata);
      await this.zip.compress(cardDir, outputPath, { entryPlan });
      const archiveStat = await fs.stat(outputPath);
      if (archiveStat.size === expectedSize) {
        return archiveStat.size;
      }
      expectedSize = archiveStat.size;
    }

    throw createError('CARD_PACK_FAILED', 'Failed to stabilize metadata.file_info.total_size for card package.', {
      cardDir,
      outputPath
    });
  }

  private async writeYamlFile(filePath: string, value: Record<string, unknown>): Promise<void> {
    await fs.writeFile(filePath, yaml.stringify(value), 'utf-8');
  }

  private async listFiles(root: string): Promise<string[]> {
    const files: string[] = [];
    const stack = [root];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile()) {
          files.push(path.relative(root, fullPath).split(path.sep).join('/'));
        }
      }
    }

    files.sort();
    return files;
  }

  private async safeStat(filePath: string): Promise<import('node:fs').Stats | undefined> {
    try {
      return await fs.stat(filePath);
    } catch {
      return undefined;
    }
  }
}
