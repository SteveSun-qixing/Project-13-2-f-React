import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotebookService } from '../../src/services/notebook-service';
import type { Client } from 'chips-sdk';

function createMockWorkspaceView(overrides: Record<string, unknown> = {}) {
  return {
    id: 'workspace-root',
    name: 'root',
    path: '/test/workspace',
    type: 'folder',
    children: [],
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    ...overrides,
  } as any;
}

function createMockBoxView(overrides: Record<string, unknown> = {}) {
  return {
    id: 'box-1',
    name: '测试笔记本.box',
    path: '/test/workspace/测试笔记本.box',
    type: 'box',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    ...overrides,
  } as any;
}

function createMockCardView(overrides: Record<string, unknown> = {}) {
  return {
    id: 'card-1',
    name: '测试笔记.card',
    path: '/test/workspace/测试笔记.card',
    type: 'card',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    ...overrides,
  } as any;
}

describe('NotebookService', () => {
  let service: NotebookService;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      workspace: {
        scan: vi.fn(),
        getContext: vi.fn(),
      },
      box: {
        session: {
          create: vi.fn(),
          rename: vi.fn(),
          open: vi.fn(),
          close: vi.fn(),
          addEntry: vi.fn(),
        },
        readMetadata: vi.fn(),
      },
      card: {
        readMetadata: vi.fn(),
      },
      file: {
        delete: vi.fn(),
      },
    };
    service = new NotebookService(mockClient as Client);
  });

  describe('initialize', () => {
    it('应该正确初始化工作区根路径', async () => {
      await service.initialize('/test/workspace');
      expect(service.getWorkspaceRoot()).toBe('/test/workspace');
    });
  });

  describe('createNotebook', () => {
    it('应该成功创建笔记本', async () => {
      await service.initialize('/test/workspace');
      mockClient.box.session.create.mockResolvedValue({
        boxFile: '/test/workspace/新笔记本.box',
      });

      const result = await service.createNotebook('新笔记本');
      expect(mockClient.box.session.create).toHaveBeenCalledWith(
        '新笔记本',
        'chips.layout.document-library',
        '/test/workspace'
      );
      expect(result).toBe('/test/workspace/新笔记本.box');
    });

    it('应该在未初始化时抛出错误', async () => {
      await expect(service.createNotebook('测试')).rejects.toThrow();
    });
  });

  describe('deleteNotebook', () => {
    it('应该成功删除笔记本', async () => {
      mockClient.file.delete.mockResolvedValue(undefined);
      await service.deleteNotebook('/test/workspace/旧笔记本.box');
      expect(mockClient.file.delete).toHaveBeenCalledWith('/test/workspace/旧笔记本.box');
    });
  });

  describe('renameNotebook', () => {
    it('应该成功重命名笔记本', async () => {
      mockClient.box.session.rename.mockResolvedValue({
        boxFile: '/test/workspace/新名称.box',
      });

      const result = await service.renameNotebook('/test/workspace/旧名称.box', '新名称');
      expect(mockClient.box.session.rename).toHaveBeenCalledWith(
        '/test/workspace/旧名称.box',
        '新名称'
      );
      expect(result).toBe('/test/workspace/新名称.box');
    });
  });

  describe('listNotes', () => {
    it('应该成功列出笔记本内的笔记', async () => {
      const mockEntries = [
        {
          entryType: 'card',
          cardPath: '/test/workspace/note1.card',
          entryId: 'entry-1',
        },
      ];

      const mockMetadata = {
        cardId: 'card-1',
        name: '笔记1',
        createdAt: '2026-01-01T00:00:00Z',
        modifiedAt: '2026-01-01T00:00:00Z',
      };

      mockClient.box.session.open.mockResolvedValue({
        snapshot: { entries: mockEntries },
        sessionId: 'session-1',
      });
      mockClient.card.readMetadata.mockResolvedValue(mockMetadata);
      mockClient.box.session.close.mockResolvedValue(undefined);

      const notes = await service.listNotes('/test/workspace/笔记本.box');
      expect(notes).toHaveLength(1);
      expect(notes[0].id).toBe('card-1');
      expect(notes[0].path).toBe('/test/workspace/note1.card');
      expect(mockClient.box.session.close).toHaveBeenCalled();
    });

    it('应该跳过读取失败的卡片', async () => {
      const mockEntries = [
        {
          entryType: 'card',
          cardPath: '/test/workspace/坏的笔记.card',
          entryId: 'entry-1',
        },
      ];

      mockClient.box.session.open.mockResolvedValue({
        snapshot: { entries: mockEntries },
        sessionId: 'session-1',
      });
      mockClient.card.readMetadata.mockRejectedValue(new Error('读取失败'));
      mockClient.box.session.close.mockResolvedValue(undefined);

      const notes = await service.listNotes('/test/workspace/笔记本.box');
      expect(notes).toHaveLength(0);
    });
  });

  describe('buildTree', () => {
    it('应该构建包含笔记本和笔记的树形结构', async () => {
      const mockBoxView = createMockBoxView();
      const mockCardView = createMockCardView();

      mockClient.workspace.scan.mockResolvedValue([mockBoxView, mockCardView]);
      mockClient.box.session.open.mockResolvedValue({
        snapshot: { entries: [] },
        sessionId: 'session-1',
      });
      mockClient.box.session.close.mockResolvedValue(undefined);

      const tree = await service.buildTree('/test/workspace');
      expect(tree).toHaveLength(2);
      expect(tree[0].type).toBe('notebook');
      expect(tree[1].type).toBe('note');
    });

    it('应该在工作区为空时返回空树', async () => {
      mockClient.workspace.scan.mockResolvedValue([]);

      const tree = await service.buildTree('/test/workspace');
      expect(tree).toHaveLength(0);
    });
  });
});
