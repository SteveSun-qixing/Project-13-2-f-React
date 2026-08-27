import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BoxSessionService } from '../../packages/box-service/src';
import type { BoxSessionOptions } from '../../packages/box-service/src';

const tempRoots: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-box-session-'));
  tempRoots.push(root);
  return root;
};

const createOptions = (): BoxSessionOptions => ({
  pack: async (_boxDir, outputPath) => {
    await fs.writeFile(outputPath, 'mock-box');
  },
  unpack: async () => {},
  inspect: async () => ({
    metadata: {
      chipStandardsVersion: '1.0.0',
      boxId: 'box-1',
      name: '测试箱子',
      createdAt: '2026-01-01T00:00:00.000Z',
      modifiedAt: '2026-01-01T00:00:00.000Z',
      activeLayoutType: 'chips.layout.grid',
    },
    content: { activeLayoutType: 'chips.layout.grid', layoutConfigs: {} },
    entries: [],
    assets: [],
  }),
  layout: {
    readDescriptor: async () => ({ defaultConfig: { props: {} } }),
    normalizeConfig: async (_layoutType, config) => config,
  },
  documentInfo: {
    readCardInfo: async (cardFile) => ({
      ready: true,
      name: cardFile.split('/').pop()?.replace(/\.card$/i, ''),
      cardId: 'card-embedded-1',
    }),
    readBoxMetadata: async () => ({ boxId: 'box-2', name: '嵌套箱子' }),
  },
  createDefaultCoverHtml: (name) => `<!doctype html><html><body>${name}</body></html>`,
});

const events: Array<{ event: string; payload: unknown }> = [];

const createService = (): BoxSessionService => {
  events.length = 0;
  return new BoxSessionService(createOptions(), {
    emit: (event, payload) => {
      events.push({ event, payload });
    },
  });
};

const SNAPSHOT_FIXTURE = {
  metadata: {
    chipStandardsVersion: '1.0.0',
    boxId: 'box-1',
    name: '测试箱子',
    createdAt: '2026-01-01T00:00:00.000Z',
    modifiedAt: '2026-01-01T00:00:00.000Z',
    activeLayoutType: 'chips.layout.grid',
  },
  content: { activeLayoutType: 'chips.layout.grid', layoutConfigs: {} },
  entries: [] as Array<Record<string, unknown>>,
  assets: [] as string[],
};

describe('BoxSessionService 契约测试', () => {
  let root: string;
  let service: BoxSessionService;
  let boxFile: string;

  beforeEach(async () => {
    root = await createTempRoot();
    service = createService();
    const created = await service.createBoxFile('测试箱子', 'chips.layout.grid', root);
    boxFile = created.boxFile;
  });

  afterEach(() => {
    service.reset();
  });

  it('box.create 生成 .box 文件', async () => {
    expect(boxFile.endsWith('.box')).toBe(true);
    expect(await fs.stat(boxFile).then(() => true).catch(() => false)).toBe(true);
  });

  it('box.session.open 打开会话并解包', async () => {
    const opened = await service.openBox(boxFile);
    expect(opened.sessionId).toBeTruthy();
    expect(opened.snapshot.boxId).toBe('box-1');
    expect(opened.snapshot.isDirty).toBe(false);
    expect(events.some((entry) => entry.event === 'box.session.opened')).toBe(true);
  });

  it('addEntry 添加条目并重建排序键', async () => {
    const opened = await service.openBox(boxFile);
    const after = await service.addEntry(opened.sessionId, { url: 'file:///tmp/a.card' });
    expect(after.entries).toHaveLength(1);
    expect(after.entries[0]?.layoutHints?.sortKey).toBe(0);
    expect(after.entries[0]?.snapshot.contentType).toBe('chips/card');
    expect(after.isDirty).toBe(true);
  });

  it('moveEntry 调整顺序并重建 sortKey', async () => {
    const opened = await service.openBox(boxFile);
    await service.addEntry(opened.sessionId, { url: 'file:///tmp/a.card' });
    await service.addEntry(opened.sessionId, { url: 'file:///tmp/b.card' });
    const firstId = service.get(opened.sessionId).entries[0]!.entryId;

    const moved = await service.moveEntry(opened.sessionId, firstId, 1);
    expect(moved.entries.map((entry) => entry.entryId)).toEqual([
      service.get(opened.sessionId).entries[0]!.entryId,
      firstId,
    ]);
    expect(moved.entries.map((entry) => entry.layoutHints?.sortKey)).toEqual([0, 1]);
  });

  it('removeEntry 删除条目', async () => {
    const opened = await service.openBox(boxFile);
    await service.addEntry(opened.sessionId, { url: 'file:///tmp/a.card' });
    const entryId = service.get(opened.sessionId).entries[0]!.entryId;

    const after = await service.removeEntry(opened.sessionId, entryId);
    expect(after.entries).toHaveLength(0);
  });

  it('updateLayoutConfig 更新布局配置与 activeLayoutType', async () => {
    const opened = await service.openBox(boxFile);
    const after = await service.updateLayoutConfig(opened.sessionId, 'chips.layout.list', { props: { columns: 3 } });
    expect(after.metadata.activeLayoutType).toBe('chips.layout.list');
    expect(after.content.activeLayoutType).toBe('chips.layout.list');
    expect(after.content.layoutConfigs['chips.layout.list']?.props).toEqual({ columns: 3 });
  });

  it('updateCover 写入封面 HTML 与资源', async () => {
    const opened = await service.openBox(boxFile);
    const after = await service.updateCover(opened.sessionId, {
      html: '<html><body>custom</body></html>',
      ratio: '16:9',
      resources: [{ path: 'boxcover/cover.png', data: new Uint8Array([7, 7, 7]) }],
    });
    expect(after.coverHtml).toBe('<html><body>custom</body></html>');
    expect(after.metadata.coverRatio).toBe('16:9');

    const coverFile = path.join(after.workspaceDir, '.box', 'boxcover', 'cover.png');
    const bytes = await fs.readFile(coverFile);
    expect([...bytes]).toEqual([7, 7, 7]);
  });

  it('undo/redo 历史闭环', async () => {
    const opened = await service.openBox(boxFile);
    await service.addEntry(opened.sessionId, { url: 'file:///tmp/a.card' });
    await service.addEntry(opened.sessionId, { url: 'file:///tmp/b.card' });
    const beforeUndo = service.get(opened.sessionId).entries.length;

    const undone = service.undo(opened.sessionId);
    expect(undone.entries.length).toBe(beforeUndo - 1);

    const redone = service.redo(opened.sessionId);
    expect(redone.entries.length).toBe(beforeUndo);
  });

  it('close 清理会话与工作目录', async () => {
    const opened = await service.openBox(boxFile);
    const workDir = opened.snapshot.workspaceDir;
    service.close(opened.sessionId);
    expect(() => service.get(opened.sessionId)).toThrow();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await fs.stat(workDir).then(() => true).catch(() => false)).toBe(false);
  });

  it('自动保存防抖持久化（snapshot 落盘）', async () => {
    const opened = await service.openBox(boxFile);
    await service.addEntry(opened.sessionId, { url: 'file:///tmp/a.card' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(events.some((entry) => entry.event === 'box.session.persisted')).toBe(true);
  });
});
