/**
 * 真实素材 round-trip 平移等价测试
 *
 * 目标：验证 task034 迁移后 Host 会话服务对**真实成品素材**执行
 * 打开 → 保存 → 重新打开 后数据语义等价（字段集合与取值一致）。
 * 这是「迁移前后行为平移等价」在磁盘格式层面的实证验证。
 */

import fs from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CardSessionService } from '../../packages/card-service/src';
import { BoxService, BoxSessionService } from '../../packages/box-service/src';
import { StoreZipService } from '../../packages/zip-service/src';
import { createDefaultCoverHtml } from '../../packages/card-service/src';

const workspaceRoot = path.resolve(process.cwd(), '..');
const testingSpaceRoot = path.join(workspaceRoot, 'ProductFinishedProductTestingSpace');

const tempRoots: string[] = [];
const zip = new StoreZipService();

const createTempDir = async (label: string): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `chips-roundtrip-${label}-`));
  tempRoots.push(dir);
  return dir;
};

const collectFiles = (extension: '.card' | '.box'): string[] => {
  // 同步收集：describe 收集阶段需要文件列表（不能依赖 beforeAll）
  const files: string[] = [];
  const visit = (directory: string): void => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const nextPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '归档') {
          continue;
        }
        visit(nextPath);
        continue;
      }
      if (entry.isFile() && nextPath.endsWith(extension)) {
        files.push(nextPath);
      }
    }
  };
  visit(testingSpaceRoot);
  return files.sort((left, right) => left.localeCompare(right));
};

const parseYamlRecord = (raw: string): Record<string, unknown> => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const yaml = require('yaml') as { parse(raw: string): unknown };
  const value = yaml.parse(raw);
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const readYamlFile = async (filePath: string): Promise<Record<string, unknown>> => {
  return parseYamlRecord(await fs.readFile(filePath, 'utf-8'));
};

const readTextFile = async (filePath: string): Promise<string | null> => {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
};

const normalizeCardSnapshotForCompare = (snapshot: {
  metadata: { name?: string; description?: string; tags?: unknown; coverRatio?: string; themeId?: string };
  structure: { basicCards: Array<{ id: string; type: string; data: Record<string, unknown> }> };
}): Record<string, unknown> => {
  return {
    metadata: {
      name: snapshot.metadata.name,
      description: snapshot.metadata.description ?? null,
      tags: snapshot.metadata.tags ?? null,
      coverRatio: snapshot.metadata.coverRatio,
      themeId: snapshot.metadata.themeId ?? null,
    },
    basicCards: snapshot.structure.basicCards.map((card) => ({
      id: card.id,
      type: card.type,
      data: card.data,
    })),
  };
};

const createCardSessionService = (): CardSessionService => {
  return new CardSessionService(
    {
      basecard: {
        normalizeConfig: (_cardType, baseCardId, config) => ({ ...config, id: baseCardId }),
        collectResourcePaths: () => [],
        createInitialConfig: (_cardType, baseCardId) => ({ id: baseCardId }),
      },
      collectCoverReferences: () => new Set<string>(),
      createDefaultCoverHtml,
    },
    { emit: () => undefined },
  );
};

const createBoxSessionService = (): BoxSessionService => {
  return new BoxSessionService(
    {
      pack: async (boxDir, outputPath) => {
        await zip.compress(boxDir, outputPath);
      },
      unpack: async (boxFile, outputDir) => {
        await zip.extract(boxFile, outputDir);
      },
      inspect: (boxFile) => boxService.inspect(boxFile),
      layout: {
        readDescriptor: async () => ({ defaultConfig: {} }),
        normalizeConfig: async (_layoutType, config) => config,
      },
      documentInfo: {
        readCardInfo: async () => ({ ready: true }),
        readBoxMetadata: async () => ({ boxId: 'box', name: 'box' }),
      },
      createDefaultCoverHtml,
    },
    { emit: () => undefined },
  );
};

const boxService = new BoxService();

const inspectBox = async (boxFile: string): Promise<{
  metadata: { name?: string; activeLayoutType?: string; coverRatio?: string; description?: string; tags?: unknown };
  content: { activeLayoutType?: string; layoutConfigs?: Record<string, unknown> };
  entries: Array<{ entryId?: string; url?: string; enabled?: boolean; snapshot?: unknown; layoutHints?: unknown }>;
  assets: string[];
}> => {
  const inspection = await boxService.inspect(boxFile);
  return {
    metadata: {
      name: inspection.metadata.name,
      activeLayoutType: inspection.metadata.activeLayoutType,
      coverRatio: inspection.metadata.coverRatio,
      description: inspection.metadata.description,
      tags: inspection.metadata.tags,
    },
    content: {
      activeLayoutType: inspection.content.activeLayoutType,
      layoutConfigs: inspection.content.layoutConfigs,
    },
    entries: inspection.entries.map((entry) => ({
      entryId: entry.entryId,
      url: entry.url,
      enabled: entry.enabled,
      snapshot: entry.snapshot,
      layoutHints: entry.layoutHints,
    })),
    assets: inspection.assets,
  };
};

interface BoxSnapshotForCompare {
  metadata: {
    name?: string;
    activeLayoutType?: string;
    coverRatio: string | null;
    description: string | null;
    tags: unknown;
  };
  content: {
    activeLayoutType?: string;
    layoutConfigs?: Record<string, unknown>;
  };
  entries: Array<{
    entryId?: string;
    url?: string;
    enabled?: boolean;
    snapshot: unknown;
    layoutHints: unknown;
  }>;
}

const normalizeBoxSnapshotForCompare = (snapshot: {
  metadata: { name?: string; activeLayoutType?: string; coverRatio?: string; description?: string; tags?: unknown };
  content: { activeLayoutType?: string; layoutConfigs?: Record<string, unknown> };
  entries: Array<{ entryId?: string; url?: string; enabled?: boolean; snapshot?: unknown; layoutHints?: unknown }>;
}): BoxSnapshotForCompare => {
  return {
    metadata: {
      name: snapshot.metadata.name,
      activeLayoutType: snapshot.metadata.activeLayoutType,
      coverRatio: snapshot.metadata.coverRatio ?? null,
      description: snapshot.metadata.description ?? null,
      tags: snapshot.metadata.tags ?? null,
    },
    content: {
      activeLayoutType: snapshot.content.activeLayoutType,
      layoutConfigs: snapshot.content.layoutConfigs,
    },
    entries: snapshot.entries.map((entry) => ({
      entryId: entry.entryId,
      url: entry.url,
      enabled: entry.enabled,
      snapshot: entry.snapshot ?? null,
      layoutHints: entry.layoutHints ?? null,
    })),
  };
};

afterAll(async () => {
  for (const tempRoot of tempRoots) {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
  tempRoots.length = 0;
});

const cardFiles = collectFiles('.card');
const boxFiles = collectFiles('.box');

describe('真实素材 round-trip 平移等价', () => {
  describe('卡片（.card）打开→保存→重开', () => {

    it('素材可发现（至少 5 张真实卡片）', () => {
      expect(cardFiles.length).toBeGreaterThanOrEqual(5);
    });

    for (const cardFile of cardFiles.slice(0, 8)) {
      it(`round-trip 等价: ${path.relative(testingSpaceRoot, cardFile)}`, { timeout: 60000 }, async () => {
        const sessionService = createCardSessionService();
        const dirA = await createTempDir('cardA');
        const dirB = await createTempDir('cardB');
        const repacked = path.join(dirA, 'repacked.card');

        await zip.extract(cardFile, dirA);
        const openedA = await sessionService.open(dirA);
        const before = normalizeCardSnapshotForCompare(openedA.snapshot);

        await sessionService.persist(openedA.sessionId);
        await zip.compress(dirA, repacked);
        await zip.extract(repacked, dirB);

        const openedB = await sessionService.open(dirB);
        const after = normalizeCardSnapshotForCompare(openedB.snapshot);

        expect(after.metadata).toEqual(before.metadata);
        expect(after.basicCards).toEqual(before.basicCards);
      });
    }
  });

  describe('箱子（.box）打开→保存→重开', () => {

    it('素材可发现（至少 1 个真实箱子）', () => {
      expect(boxFiles.length).toBeGreaterThanOrEqual(1);
    });

    for (const boxFile of boxFiles.slice(0, 4)) {
      it(`round-trip 等价: ${path.relative(testingSpaceRoot, boxFile)}`, { timeout: 60000 }, async () => {
        const sessionService = createBoxSessionService();
        // 重要：操作必须在临时副本上进行，禁止直接修改素材原文件
        const workDir = await createTempDir('box');
        const boxCopy = path.join(workDir, 'fixture.box');
        await fs.copyFile(boxFile, boxCopy);
        await zip.extract(boxCopy, path.join(workDir, 'payload'));

        const opened = await sessionService.openBox(boxCopy);
        const before = normalizeBoxSnapshotForCompare(opened.snapshot);

        await sessionService.persist(opened.sessionId);

        const inspection = await inspectBox(boxCopy);
        const after = normalizeBoxSnapshotForCompare({
          metadata: inspection.metadata,
          content: inspection.content,
          entries: inspection.entries,
        });

        expect(after.metadata).toEqual(before.metadata);
        expect(after.entries).toEqual(before.entries);
        expect(after.content.activeLayoutType).toBe(before.content.activeLayoutType);
      });
    }
  });

  describe('卡片 round-trip 后基础卡片内容文件', () => {
    it('content/*.yaml 与 structure 引用一致', async () => {
      const cardFile = cardFiles[0]!;
      const sessionService = createCardSessionService();
      const dirA = await createTempDir('contentA');
      await zip.extract(cardFile, dirA);

      const opened = await sessionService.open(dirA);
      const structurePath = path.join(dirA, '.card', 'structure.yaml');
      const structure = await readYamlFile(structurePath);
      const entries = Array.isArray(structure.structure) ? structure.structure as Array<Record<string, unknown>> : [];

      for (const entry of entries) {
        const id = entry.id;
        if (typeof id !== 'string') {
          continue;
        }
        const contentPath = path.join(dirA, 'content', `${id}.yaml`);
        const content = await readTextFile(contentPath);
        expect(content, `content 文件缺失: ${id}`).not.toBeNull();
      }

      const expectedIds = new Set(entries.map((entry) => String(entry.id)));
      const contentDir = path.join(dirA, 'content');
      let contentFiles: string[] = [];
      try {
        contentFiles = (await fs.readdir(contentDir)).filter((name) => name.endsWith('.yaml'));
      } catch {
        contentFiles = [];
      }
      for (const name of contentFiles) {
        const id = name.replace(/\.yaml$/, '');
        expect(expectedIds.has(id), `孤儿 content 文件: ${name}`).toBe(true);
      }
    });
  });
});
