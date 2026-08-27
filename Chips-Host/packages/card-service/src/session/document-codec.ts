/**
 * 卡片解包态文档编解码（metadata.yaml / structure.yaml / content/*.yaml / cover.html）
 *
 * 逻辑来源：Chips-EditingEngine `src/core/card-service.ts`（task034 M2 上移）。
 * 与 Host `card-packer` 的打包态校验共用格式口径；本模块处理解包态目录的双向读写。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { createError } from '../../../../src/shared/errors';
import {
  joinResourcePath,
  normalizeRelativeResourcePath,
} from '../../../../src/shared/resource-path';
import type {
  CardSessionBasicCard,
  CardSessionCover,
  CardSessionLayout,
  CardSessionMetadata,
  CardSessionSnapshot,
} from './types';

export interface ParsedCardDocument {
  cardId: string;
  metadata: CardSessionMetadata;
  coverHtml: string;
  coverRatio: string;
  basicCards: CardSessionBasicCard[];
  layout: CardSessionLayout;
}

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const asString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const DEFAULT_LAYOUT: CardSessionLayout = { padding: 16, gap: 12 };

export const DEFAULT_COVER_RATIO = '3:4';

/** 规范化封面比例：容忍 / 与 : 混写，解析任意数值比例，非法值回退默认 3:4。 */
export const normalizeCoverRatio = (value: unknown): string => {
  if (typeof value !== 'string') {
    return DEFAULT_COVER_RATIO;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_COVER_RATIO;
  }

  const normalized = trimmed.replace('/', ':');
  const parts = normalized.split(':').map((part) => part.trim());
  if (parts.length !== 2) {
    return DEFAULT_COVER_RATIO;
  }

  const [width, height] = parts;
  const widthValue = Number(width);
  const heightValue = Number(height);
  if (!Number.isFinite(widthValue) || !Number.isFinite(heightValue) || widthValue <= 0 || heightValue <= 0) {
    return DEFAULT_COVER_RATIO;
  }

  return `${width}:${height}`;
};

/** 解析解包态卡片目录文档。 */
export async function parseCardDocument(
  cardDir: string,
  options: {
    normalizeBasecardConfig(
      cardType: string,
      baseCardId: string,
      config: Record<string, unknown>,
    ): Record<string, unknown> | Promise<Record<string, unknown>>;
    createDefaultCoverHtml(name: string): string;
  },
): Promise<ParsedCardDocument> {
  const join = (...parts: string[]): string => path.join(cardDir, ...parts);
  const readYamlRecord = async (relativePath: string): Promise<Record<string, unknown>> => {
    try {
      const raw = await fs.readFile(join(relativePath), 'utf-8');
      return asRecord(yaml.parse(raw));
    } catch (error) {
      throw createError('CARD_SCHEMA_INVALID', `Failed to parse card YAML: ${relativePath}`, {
        cardDir,
        relativePath,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const metadataRaw = await readYamlRecord(path.join('.card', 'metadata.yaml'));
  const structureRaw = await readYamlRecord(path.join('.card', 'structure.yaml'));

  const cardId = asString(metadataRaw.card_id) ?? '';

  let coverHtml = '';
  try {
    coverHtml = await fs.readFile(join('.card', 'cover.html'), 'utf-8');
  } catch {
    coverHtml = options.createDefaultCoverHtml(asString(metadataRaw.name) ?? cardId);
  }

  const basicCards: CardSessionBasicCard[] = [];
  const structureEntries = Array.isArray(structureRaw.structure) ? structureRaw.structure : [];
  for (const entry of structureEntries) {
    const record = asRecord(entry);
    const basicCardId = asString(record.id);
    const type = asString(record.type);
    if (!basicCardId || !type) {
      continue;
    }

    let parsedContent: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(join('content', `${basicCardId}.yaml`), 'utf-8');
      parsedContent = asRecord(yaml.parse(raw));
    } catch {
      // content 文件缺失时使用空配置
    }

    basicCards.push({
      id: basicCardId,
      type,
      data: await options.normalizeBasecardConfig(type, basicCardId, parsedContent),
      createdAt: asString(record.created_at) ?? asString(metadataRaw.created_at) ?? new Date().toISOString(),
      modifiedAt: asString(record.modified_at) ?? asString(metadataRaw.modified_at) ?? new Date().toISOString(),
    });
  }

  const coverRatio = normalizeCoverRatio(asString(metadataRaw.cover_ratio) ?? asString(metadataRaw.coverRatio));

  return {
    cardId,
    metadata: {
      name: asString(metadataRaw.name) ?? cardId,
      description: asString(metadataRaw.description),
      themeId: asString(metadataRaw.theme),
      coverRatio,
      createdAt: asString(metadataRaw.created_at) ?? new Date().toISOString(),
      modifiedAt: asString(metadataRaw.modified_at) ?? new Date().toISOString(),
      tags: Array.isArray(metadataRaw.tags) ? metadataRaw.tags.map((tag) => String(tag)) : undefined,
    },
    coverHtml,
    coverRatio,
    basicCards,
    layout: DEFAULT_LAYOUT,
  };
}

/** 将会话快照序列化为解包态卡片目录文档（重建全部正式文件）。 */
export async function writeCardDocument(
  cardDir: string,
  snapshot: CardSessionSnapshot,
  options: {
    createDefaultCoverHtml(name: string): string;
    resourceManifest?: {
      card_count?: number;
      resource_count: number;
      resources: Array<{ path: string; size: number; type: string }>;
    };
  },
): Promise<void> {
  const join = (...parts: string[]): string => path.join(cardDir, ...parts);
  const ensureDir = async (relativePath: string): Promise<void> => {
    await fs.mkdir(join(relativePath), { recursive: true });
  };

  await ensureDir(path.join('.card'));
  await ensureDir('content');

  const metadata: Record<string, unknown> = {
    chip_standards_version: '1.0.0',
    card_id: snapshot.cardId,
    name: snapshot.metadata.name,
    created_at: snapshot.metadata.createdAt,
    modified_at: snapshot.metadata.modifiedAt,
    theme: snapshot.metadata.themeId ?? '',
    cover_ratio: normalizeCoverRatio(snapshot.metadata.coverRatio ?? snapshot.cover.ratio),
    description: snapshot.metadata.description ?? '',
    tags: snapshot.metadata.tags ?? [],
  };
  await fs.writeFile(join('.card', 'metadata.yaml'), yaml.stringify(metadata), 'utf-8');
  await fs.writeFile(
    join('.card', 'cover.html'),
    snapshot.cover.html ?? options.createDefaultCoverHtml(snapshot.metadata.name),
    'utf-8',
  );

  const expectedContentFiles = new Set<string>();
  for (const basicCard of snapshot.structure.basicCards) {
    const contentPath = join('content', `${basicCard.id}.yaml`);
    expectedContentFiles.add(contentPath);
    await fs.writeFile(contentPath, yaml.stringify(basicCard.data), 'utf-8');
  }

  for (const resource of snapshot.cover.resources) {
    const normalizedPath = normalizeRelativeResourcePath(resource.path);
    if (!normalizedPath) {
      throw createError('CARD_SESSION_INVALID_RESOURCE_PATH', `Invalid cover resource path: ${resource.path}`);
    }
    const resourcePath = join('.card', normalizedPath);
    await fs.mkdir(path.dirname(resourcePath), { recursive: true });
    await fs.writeFile(resourcePath, resource.data);
  }

  const structure: Record<string, unknown> = {
    structure: snapshot.structure.basicCards.map((basicCard) => ({
      id: basicCard.id,
      type: basicCard.type,
      created_at: basicCard.createdAt,
      modified_at: basicCard.modifiedAt,
    })),
    manifest: options.resourceManifest ?? {
      card_count: snapshot.structure.basicCards.length,
    },
  };
  await fs.writeFile(join('.card', 'structure.yaml'), yaml.stringify(structure), 'utf-8');

  await cleanupOrphanContentFiles(cardDir, expectedContentFiles);
}

/** 清理不再被 structure 引用的 content/*.yaml 孤儿文件。 */
export async function cleanupOrphanContentFiles(cardDir: string, expectedContentFiles: Set<string>): Promise<void> {
  const contentDir = path.join(cardDir, 'content');
  let entries: Array<{ path: string; isDirectory: boolean; isFile: boolean }> = [];
  try {
    entries = (await fs.readdir(contentDir, { withFileTypes: true })).map((entry) => ({
      path: path.join(contentDir, entry.name),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isFile && entry.path.endsWith('.yaml') && !expectedContentFiles.has(entry.path)) {
      await fs.rm(entry.path, { force: true });
    }
  }
}

/** 扫描卡片根目录并重建资源清单（排除 .card/ 与 content/）。 */
export async function buildCardResourceManifest(
  cardDir: string,
  options: { guessMimeType(path: string): string },
): Promise<{
  resource_count: number;
  resources: Array<{ path: string; size: number; type: string }>;
}> {
  const resources: Array<{ path: string; size: number; type: string }> = [];

  const walk = async (dir: string, relativeDir: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      const relativePath = joinResourcePath(relativeDir, entry.name);
      if (entry.isDirectory()) {
        if (relativePath.startsWith('.card/') || relativePath === '.card' || relativePath === 'content') {
          continue;
        }
        await walk(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const normalizedPath = normalizeRelativeResourcePath(relativePath);
      if (!normalizedPath || normalizedPath.startsWith('.card/') || normalizedPath.startsWith('content/')) {
        continue;
      }
      const stat = await fs.stat(absolutePath);
      resources.push({
        path: normalizedPath,
        size: stat.size,
        type: options.guessMimeType(normalizedPath),
      });
    }
  };

  await walk(cardDir, '');
  resources.sort((left, right) => left.path.localeCompare(right.path));
  return {
    resource_count: resources.length,
    resources,
  };
}
