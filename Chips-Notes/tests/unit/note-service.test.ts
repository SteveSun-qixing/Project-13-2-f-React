import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteService } from '../../src/services/note-service';
import type { Client } from 'chips-sdk';

describe('NoteService', () => {
  let service: NoteService;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      workspace: {
        scan: vi.fn(),
        getContext: vi.fn(),
      },
      card: {
        session: {
          init: vi.fn(),
        },
        readMetadata: vi.fn(),
        readStructure: vi.fn(),
      },
      box: {
        session: {
          open: vi.fn(),
          close: vi.fn(),
          addEntry: vi.fn(),
        },
        readMetadata: vi.fn(),
      },
      file: {
        readText: vi.fn(),
        writeText: vi.fn(),
        delete: vi.fn(),
      },
    };
    service = new NoteService(mockClient as Client);
  });

  describe('initialize', () => {
    it('应该正确初始化工作区根路径', async () => {
      await service.initialize('/test/workspace');
      expect(service.getWorkspaceRoot()).toBe('/test/workspace');
    });
  });

  describe('createNote', () => {
    beforeEach(async () => {
      await service.initialize('/test/workspace');
    });

    it('应该在根目录下创建笔记', async () => {
      mockClient.card.session.init.mockResolvedValue({
        cardDir: '/test/workspace/新笔记.card',
      });

      const result = await service.createNote('新笔记');
      expect(mockClient.card.session.init).toHaveBeenCalled();
      expect(result).toBe('/test/workspace/新笔记.card');
    });

    it('应该在笔记本内创建笔记', async () => {
      mockClient.card.session.init.mockResolvedValue({
        cardDir: '/test/workspace/笔记本.box/笔记.card',
      });
      mockClient.box.session.open.mockResolvedValue({
        snapshot: { entries: [] },
        sessionId: 'session-1',
      });
      mockClient.box.session.close.mockResolvedValue(undefined);

      const result = await service.createNote('笔记', '/test/workspace/笔记本.box');
      expect(result).toBe('/test/workspace/笔记本.box/笔记.card');
      expect(mockClient.box.session.addEntry).toHaveBeenCalled();
      expect(mockClient.box.session.close).toHaveBeenCalled();
    });

    it('在未初始化时应该抛出错误', async () => {
      const uninitializedService = new NoteService(mockClient as Client);
      await expect(uninitializedService.createNote('测试')).rejects.toThrow();
    });
  });

  describe('openNote', () => {
    it('应该成功打开笔记并加载所有基础卡片', async () => {
      const mockMetadata = {
        cardId: 'card-1',
        name: '测试笔记',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      };

      const mockStructure = {
        basecards: [
          { id: 'basecard-1', type: 'chips.basecard.rich-text' },
        ],
      };

      const mockContent = 'type: chips.basecard.rich-text\nconfig:\n  content: "<p>Hello</p>"\n';

      mockClient.card.readMetadata.mockResolvedValue(mockMetadata);
      mockClient.card.readStructure.mockResolvedValue(mockStructure);
      mockClient.file.readText.mockResolvedValue(mockContent);

      const note = await service.openNote('/test/workspace/笔记.card');
      expect(note.id).toBe('card-1');
      expect(note.name).toBe('测试笔记');
      expect(note.contents).toHaveLength(1);
      expect(note.contents[0].type).toBe('chips.basecard.rich-text');
    });

    it('应该跳过加载失败的基础卡片', async () => {
      const mockMetadata = {
        cardId: 'card-1',
        name: '测试',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      };

      const mockStructure = {
        basecards: [
          { id: 'basecard-1', type: 'chips.basecard.rich-text' },
          { id: 'basecard-2', type: 'chips.basecard.image' },
        ],
      };

      mockClient.card.readMetadata.mockResolvedValue(mockMetadata);
      mockClient.card.readStructure.mockResolvedValue(mockStructure);
      mockClient.file.readText.mockRejectedValueOnce(new Error('文件不存在'));
      mockClient.file.readText.mockResolvedValueOnce('type: chips.basecard.image\nconfig:\n  src: test.png\n');

      const note = await service.openNote('/test/workspace/笔记.card');
      expect(note.contents).toHaveLength(1);
      expect(note.contents[0].type).toBe('chips.basecard.image');
    });
  });

  describe('saveNote', () => {
    it('应该保存所有基础卡片的配置', async () => {
      await service.initialize('/test/workspace');
      mockClient.card.readMetadata.mockResolvedValue({
        cardId: 'card-1',
        name: '测试笔记',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      });

      const contents = [
        {
          id: 'basecard-1',
          type: 'chips.basecard.rich-text',
          config: { content: '<p>Test</p>' },
        },
      ];

      await service.saveNote('/test/workspace/笔记.card', contents);
      expect(mockClient.file.writeText).toHaveBeenCalled();
    });
  });

  describe('deleteNote', () => {
    it('应该成功删除笔记', async () => {
      mockClient.file.delete.mockResolvedValue(undefined);
      await service.deleteNote('/test/workspace/笔记.card');
      expect(mockClient.file.delete).toHaveBeenCalledWith('/test/workspace/笔记.card');
    });
  });

  describe('renameNote', () => {
    it('应该成功重命名笔记', async () => {
      const mockMetadata = {
        cardId: 'card-1',
        name: '旧名称',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      };

      mockClient.card.readMetadata.mockResolvedValue(mockMetadata);
      mockClient.file.writeText.mockResolvedValue(undefined);

      await service.renameNote('/test/workspace/笔记.card', '新名称');
      expect(mockClient.file.writeText).toHaveBeenCalled();
    });
  });

  describe('insertBasecard', () => {
    it('应该在末尾插入新基础卡片', async () => {
      const mockStructure = { basecards: [] };
      mockClient.card.readStructure.mockResolvedValue(mockStructure);
      mockClient.file.writeText.mockResolvedValue(undefined);

      const id = await service.insertBasecard(
        '/test/workspace/笔记.card',
        'chips.basecard.image'
      );
      expect(id).toContain('basecard-');
      expect(mockClient.file.writeText).toHaveBeenCalledTimes(2);
    });

    it('应该在指定位置插入基础卡片', async () => {
      const mockStructure = {
        basecards: [
          { id: 'a', type: 'chips.basecard.rich-text' },
          { id: 'b', type: 'chips.basecard.rich-text' },
        ],
      };
      mockClient.card.readStructure.mockResolvedValue(mockStructure);
      mockClient.file.writeText.mockResolvedValue(undefined);

      await service.insertBasecard(
        '/test/workspace/笔记.card',
        'chips.basecard.image',
        1
      );
      expect(mockClient.file.writeText).toHaveBeenCalled();
    });
  });

  describe('removeBasecard', () => {
    it('应该成功移除基础卡片', async () => {
      const mockStructure = {
        basecards: [
          { id: 'basecard-1', type: 'chips.basecard.rich-text' },
        ],
      };
      mockClient.card.readStructure.mockResolvedValue(mockStructure);
      mockClient.file.writeText.mockResolvedValue(undefined);
      mockClient.file.delete.mockResolvedValue(undefined);

      await service.removeBasecard('/test/workspace/笔记.card', 'basecard-1');
      expect(mockClient.file.writeText).toHaveBeenCalled();
      expect(mockClient.file.delete).toHaveBeenCalled();
    });
  });

  describe('updateBasecardConfig', () => {
    it('应该更新指定基础卡片的配置', async () => {
      const mockStructure = {
        basecards: [
          { id: 'basecard-1', type: 'chips.basecard.rich-text' },
        ],
      };
      mockClient.card.readStructure.mockResolvedValue(mockStructure);
      mockClient.file.writeText.mockResolvedValue(undefined);

      await service.updateBasecardConfig(
        '/test/workspace/笔记.card',
        'basecard-1',
        { content: '<p>New content</p>' }
      );
      expect(mockClient.file.writeText).toHaveBeenCalled();
    });

    it('在基础卡片不存在时应该抛出错误', async () => {
      const mockStructure = { basecards: [] };
      mockClient.card.readStructure.mockResolvedValue(mockStructure);

      await expect(
        service.updateBasecardConfig(
          '/test/workspace/笔记.card',
          'nonexistent',
          {}
        )
      ).rejects.toThrow();
    });
  });

  describe('reorderBasecards', () => {
    it('应该成功重排基础卡片', async () => {
      const mockStructure = {
        basecards: [
          { id: 'a', type: 'chips.basecard.rich-text' },
          { id: 'b', type: 'chips.basecard.image' },
        ],
      };
      mockClient.card.readStructure.mockResolvedValue(mockStructure);
      mockClient.file.writeText.mockResolvedValue(undefined);

      await service.reorderBasecards('/test/workspace/笔记.card', ['b', 'a']);
      expect(mockClient.file.writeText).toHaveBeenCalled();
    });
  });
});
