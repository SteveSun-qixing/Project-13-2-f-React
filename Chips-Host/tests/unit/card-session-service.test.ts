import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CardSessionService } from '../../packages/card-service/src';
import type { CardSessionOptions } from '../../packages/card-service/src';

const tempRoots: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-card-session-'));
  tempRoots.push(root);
  return root;
};

const createOptions = (): CardSessionOptions => ({
  basecard: {
    normalizeConfig: (_cardType, baseCardId, config) => ({ ...config, id: baseCardId }),
    collectResourcePaths: (_cardType: string, config: Record<string, unknown>) => {
      const paths: string[] = [];
      const imagePath = config.image_path;
      if (typeof imagePath === 'string') {
        paths.push(imagePath);
      }
      const attachmentPath = config.attachment_path;
      if (typeof attachmentPath === 'string') {
        paths.push(attachmentPath);
      }
      return paths;
    },
    createInitialConfig: (_cardType, baseCardId) => ({ id: baseCardId, content: '' }),
  },
  collectCoverReferences: () => new Set<string>(),
  createDefaultCoverHtml: (name) => `<!doctype html><html><body>${name}</body></html>`,
});

const events: Array<{ event: string; payload: unknown }> = [];

const createService = (): CardSessionService => {
  events.length = 0;
  return new CardSessionService(createOptions(), {
    emit: (event, payload) => {
      events.push({ event, payload });
    },
  });
};

describe('CardSessionService 契约测试', () => {
  let root: string;
  let service: CardSessionService;

  beforeEach(async () => {
    root = await createTempRoot();
    service = createService();
  });

  afterEach(() => {
    service.reset();
  });

  describe('card.init 新建卡片', () => {
    it('创建标准解包态目录结构', async () => {
      const result = await service.initCard(root, '测试卡片');
      expect(result.cardDir.endsWith('.card')).toBe(true);
      expect(result.snapshot.metadata.name).toBe('测试卡片');
      expect(result.snapshot.structure.basicCards).toHaveLength(0);

      const metadata = await fs.readFile(path.join(result.cardDir, '.card', 'metadata.yaml'), 'utf-8');
      expect(metadata).toContain('chip_standards_version:');
      expect(metadata).toContain('1.0.0');
      expect(metadata).toContain('name: 测试卡片');
      expect(metadata).toContain('cover_ratio: 3:4');

      const structure = await fs.readFile(path.join(result.cardDir, '.card', 'structure.yaml'), 'utf-8');
      expect(structure).toContain('card_count: 0');

      const cover = await fs.readFile(path.join(result.cardDir, '.card', 'cover.html'), 'utf-8');
      expect(cover).toContain('测试卡片');
    });

    it('支持初始基础卡片并触发 opened 事件', async () => {
      const result = await service.initCard(root, '带初始内容', {
        type: 'base.richtext',
        data: { content_text: 'hello' },
      });
      expect(result.snapshot.structure.basicCards).toHaveLength(1);
      expect(result.snapshot.structure.basicCards[0]?.data.id).toBeTruthy();
      expect(result.snapshot.structure.basicCards[0]?.data.content_text).toBe('hello');
      expect(events.some((entry) => entry.event === 'card.session.opened')).toBe(true);
    });
  });

  describe('card.session.open 打开已有卡片', () => {
    it('解析既有解包目录', async () => {
      const created = await service.initCard(root, '打开测试');
      const contentDir = path.join(created.cardDir, 'content');
      await fs.mkdir(contentDir, { recursive: true });
      await fs.writeFile(
        path.join(contentDir, 'abc123.yaml'),
        'id: abc123\ncontent_text: 已有内容\n',
        'utf-8',
      );
      await fs.writeFile(
        path.join(created.cardDir, '.card', 'structure.yaml'),
        'structure:\n  - id: abc123\n    type: base.richtext\nmanifest:\n  card_count: 1\n',
        'utf-8',
      );

      const opened = await service.open(created.cardDir);
      expect(opened.snapshot.structure.basicCards).toHaveLength(1);
      expect(opened.snapshot.structure.basicCards[0]?.data.content_text).toBe('已有内容');
      expect(opened.snapshot.structure.basicCards[0]?.data.id).toBe('abc123');
    });
  });

  describe('基础卡片增删改移', () => {
    it('addBasicCard 与 removeBasicCard 闭环', async () => {
      const result = await service.initCard(root, '结构测试');
      const sessionId = result.sessionId;

      const afterAdd = await service.addBasicCard(sessionId, 'base.image', { image_path: 'photo.png' });
      expect(afterAdd.structure.basicCards).toHaveLength(1);

      const afterRemove = await service.removeBasicCard(sessionId, afterAdd.structure.basicCards[0]!.id);
      expect(afterRemove.structure.basicCards).toHaveLength(0);
    });

    it('moveBasicCard 调整顺序', async () => {
      const result = await service.initCard(root, '排序测试');
      const sessionId = result.sessionId;
      const first = await service.addBasicCard(sessionId, 'base.richtext');
      const firstId = first.structure.basicCards[0]!.id;
      const second = await service.addBasicCard(sessionId, 'base.richtext');
      const secondId = second.structure.basicCards[1]!.id;

      const moved = await service.moveBasicCard(sessionId, firstId, 1);
      expect(moved.structure.basicCards.map((card) => card.id)).toEqual([secondId, firstId]);
    });

    it('updateBasicCard 归一配置并登记待导入资源', async () => {
      const result = await service.initCard(root, '更新测试');
      const sessionId = result.sessionId;
      const added = await service.addBasicCard(sessionId, 'base.image');
      const basicCardId = added.structure.basicCards[0]!.id;

      const updated = await service.updateBasicCard(
        sessionId,
        basicCardId,
        { image_path: 'assets/photo.png' },
        { imports: [{ path: 'assets/photo.png', data: new Uint8Array([1, 2, 3]) }] },
      );
      expect(updated.structure.basicCards[0]?.data.image_path).toBe('assets/photo.png');
      expect(updated.isDirty).toBe(true);
      expect(updated.isPersisting).toBe(true);
    });

    it('updateMetadata 更新字段', async () => {
      const result = await service.initCard(root, '元数据测试');
      const updated = await service.updateMetadata(result.sessionId, {
        name: '改名后',
        description: '描述',
        tags: ['a', 'b'],
      });
      expect(updated.metadata.name).toBe('改名后');
      expect(updated.metadata.description).toBe('描述');
      expect(updated.metadata.tags).toEqual(['a', 'b']);
    });

    it('updateCover 保存封面 HTML 与比例', async () => {
      const result = await service.initCard(root, '封面测试');
      const updated = await service.updateCover(result.sessionId, {
        html: '<html><body>custom</body></html>',
        ratio: '16:9',
      });
      expect(updated.cover.html).toBe('<html><body>custom</body></html>');
      expect(updated.cover.ratio).toBe('16:9');
      expect(updated.metadata.coverRatio).toBe('16:9');
    });
  });

  describe('card.session.persist 持久化', () => {
    it('重建文档文件与资源清单', async () => {
      const result = await service.initCard(root, '持久化测试');
      const sessionId = result.sessionId;
      const added = await service.addBasicCard(sessionId, 'base.image', {
        image_path: 'assets/pic.png',
      });
      const basicCardId = added.structure.basicCards[0]!.id;
      await service.updateBasicCard(
        sessionId,
        basicCardId,
        { image_path: 'assets/pic.png' },
        { imports: [{ path: 'assets/pic.png', data: new Uint8Array([9, 8, 7]) }] },
      );

      await service.persist(sessionId);

      const written = await fs.readFile(path.join(result.cardDir, 'assets', 'pic.png'));
      expect([...written]).toEqual([9, 8, 7]);

      const structureRaw = await fs.readFile(path.join(result.cardDir, '.card', 'structure.yaml'), 'utf-8');
      expect(structureRaw).toContain('resource_count: 1');
      expect(structureRaw).toContain('assets/pic.png');
      expect(structureRaw).toContain('card_count: 1');
    });

    it('删除不再被引用的资源', async () => {
      const result = await service.initCard(root, '回收测试');
      const sessionId = result.sessionId;
      const added = await service.addBasicCard(sessionId, 'base.image', { image_path: 'old.png' });
      const basicCardId = added.structure.basicCards[0]!.id;
      await service.updateBasicCard(
        sessionId,
        basicCardId,
        { image_path: 'old.png' },
        { imports: [{ path: 'old.png', data: new Uint8Array([1]) }] },
      );
      await service.persist(sessionId);
      expect(await fs.access(path.join(result.cardDir, 'old.png')).then(() => true).catch(() => false)).toBe(true);

      await service.updateBasicCard(sessionId, basicCardId, { image_path: 'new.png' }, {
        imports: [{ path: 'new.png', data: new Uint8Array([2]) }],
        deletions: ['old.png'],
      });
      await service.persist(sessionId);

      expect(await fs.access(path.join(result.cardDir, 'old.png')).then(() => true).catch(() => false)).toBe(false);
      expect(await fs.access(path.join(result.cardDir, 'new.png')).then(() => true).catch(() => false)).toBe(true);
    });

    it('封面资源落盘到 .card/cardcover/', async () => {
      const result = await service.initCard(root, '封面资源测试');
      await service.updateCover(result.sessionId, {
        html: '<html><body><img src="cardcover/cover.png" /></body></html>',
        resources: [{ path: 'cardcover/cover.png', data: new Uint8Array([5, 5, 5]) }],
      });
      await service.persist(result.sessionId);

      const cover = await fs.readFile(path.join(result.cardDir, '.card', 'cardcover', 'cover.png'));
      expect([...cover]).toEqual([5, 5, 5]);
    });
  });

  describe('undo/redo 历史闭环', () => {
    it('撤销与重做恢复快照', async () => {
      const result = await service.initCard(root, '历史测试');
      const sessionId = result.sessionId;

      await service.updateMetadata(sessionId, { name: '第一步' });
      const second = await service.updateMetadata(sessionId, { name: '第二步' });
      expect(second.metadata.name).toBe('第二步');

      const undone = service.undo(sessionId);
      expect(undone.metadata.name).toBe('第一步');
      expect(service.history(sessionId).redoAvailable).toBe(true);

      const redone = service.redo(sessionId);
      expect(redone.metadata.name).toBe('第二步');
    });

    it('无历史可撤销时保持原状', async () => {
      const result = await service.initCard(root, '空历史测试');
      const before = service.get(result.sessionId);
      const undone = service.undo(result.sessionId);
      expect(undone.metadata.name).toBe(before.metadata.name);
    });
  });

  describe('自动保存调度', () => {
    it('更新后自动防抖持久化并发出事件', async () => {
      const result = await service.initCard(root, '自动保存测试');
      await service.updateMetadata(result.sessionId, { name: '自动保存' });

      await new Promise((resolve) => setTimeout(resolve, 400));

      const structureRaw = await fs.readFile(
        path.join(result.cardDir, '.card', 'structure.yaml'),
        'utf-8',
      );
      expect(structureRaw).toContain('card_count: 0');

      const metadataRaw = await fs.readFile(path.join(result.cardDir, '.card', 'metadata.yaml'), 'utf-8');
      expect(metadataRaw).toContain('name: 自动保存');
      expect(events.some((entry) => entry.event === 'card.session.dirty')).toBe(true);
      expect(events.some((entry) => entry.event === 'card.session.persisted')).toBe(true);
    });
  });

  describe('close 与会话隔离', () => {
    it('close 后会话不可用', async () => {
      const result = await service.initCard(root, '关闭测试');
      service.close(result.sessionId);
      expect(() => service.get(result.sessionId)).toThrow();
    });

    it('会话之间互不影响', async () => {
      const first = await service.initCard(root, '会话A');
      const second = await service.initCard(root, '会话B');
      await service.updateMetadata(first.sessionId, { name: 'A改名' });
      expect(service.get(second.sessionId).metadata.name).toBe('会话B');
    });
  });
});
