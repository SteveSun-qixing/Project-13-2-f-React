import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocument } from '../../src/apps/word/hooks/useDocument';
import type { WordDocumentContent, Block } from '../../src/apps/word/types';

const createMockBlock = (id: string, text: string): Block => ({
  id,
  type: 'paragraph',
  docxIndex: null,
  originalXml: null,
  runs: [{ text }],
});

const createMockContent = (blocks: Block[]): WordDocumentContent => ({
  blocks,
  comments: [],
  footnotes: [],
  endnotes: [],
  headerText: null,
  footerText: null,
  watermarkText: null,
  sectionSettings: {
    pageWidth: 12240,
    pageHeight: 15840,
    orientation: 'portrait',
    marginTop: 1440,
    marginRight: 1440,
    marginBottom: 1440,
    marginLeft: 1440,
    pageBorder: false,
    columns: 1,
  },
  styles: new Map(),
  numbering: new Map(),
});

describe('useDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('初始状态', () => {
    it('应返回正确的初始状态', () => {
      const { result } = renderHook(() => useDocument());

      expect(result.current.documentState.isLoaded).toBe(false);
      expect(result.current.documentState.isLoading).toBe(false);
      expect(result.current.documentState.isSaving).toBe(false);
      expect(result.current.documentState.isDirty).toBe(false);
      expect(result.current.documentState.error).toBe(null);
      expect(result.current.documentState.metadata).toBe(null);
      expect(result.current.documentState.content).toBe(null);
    });

    it('应返回正确的编辑器初始状态', () => {
      const { result } = renderHook(() => useDocument());

      expect(result.current.editorState.selectedBlockId).toBe(null);
      expect(result.current.editorState.cursorPosition).toBe(null);
      expect(result.current.editorState.zoom).toBe(100);
      expect(result.current.editorState.currentPage).toBe(1);
      expect(result.current.editorState.totalPages).toBe(1);
      expect(result.current.editorState.wordCount).toBe(0);
      expect(result.current.editorState.readOnly).toBe(false);
      expect(result.current.editorState.showCommentPanel).toBe(false);
      expect(result.current.editorState.selectedCommentId).toBe(null);
    });
  });

  describe('setDocumentContent', () => {
    it('应正确设置文档内容并更新加载状态', () => {
      const { result } = renderHook(() => useDocument());
      const blocks = [createMockBlock('1', 'Hello World')];
      const content = createMockContent(blocks);

      act(() => {
        result.current.setDocumentContent(content);
      });

      expect(result.current.documentState.isLoaded).toBe(true);
      expect(result.current.documentState.isLoading).toBe(false);
      expect(result.current.documentState.error).toBe(null);
      expect(result.current.documentState.content).not.toBeNull();
      expect(result.current.documentState.content?.blocks).toHaveLength(1);
    });

    it('应计算字数统计', () => {
      const { result } = renderHook(() => useDocument());
      const blocks = [
        createMockBlock('1', '你好世界'),
        createMockBlock('2', 'Hello World'),
        createMockBlock('3', '测试123'),
      ];
      const content = createMockContent(blocks);

      act(() => {
        result.current.setDocumentContent(content);
      });

      expect(result.current.editorState.wordCount).toBe(4);
    });
  });

  describe('setLoading', () => {
    it('应正确设置加载状态', () => {
      const { result } = renderHook(() => useDocument());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.documentState.isLoading).toBe(true);
      expect(result.current.documentState.error).toBe(null);
    });
  });

  describe('setError', () => {
    it('应正确设置错误信息并清除加载状态', () => {
      const { result } = renderHook(() => useDocument());

      act(() => {
        result.current.setError('测试错误');
      });

      expect(result.current.documentState.isLoading).toBe(false);
      expect(result.current.documentState.error).toBe('测试错误');
    });
  });

  describe('setSaving', () => {
    it('应正确设置保存状态', () => {
      const { result } = renderHook(() => useDocument());

      act(() => {
        result.current.setSaving(true);
      });

      expect(result.current.documentState.isSaving).toBe(true);
    });
  });

  describe('setDirty', () => {
    it('应正确设置脏标记', () => {
      const { result } = renderHook(() => useDocument());

      act(() => {
        result.current.setDirty(true);
      });

      expect(result.current.documentState.isDirty).toBe(true);
    });
  });

  describe('updateBlock', () => {
    it('应正确更新块内容', () => {
      const { result } = renderHook(() => useDocument());
      const blocks = [createMockBlock('1', 'Original')];
      const content = createMockContent(blocks);

      act(() => {
        result.current.setDocumentContent(content);
      });

      act(() => {
        result.current.updateBlock('1', { type: 'heading', level: 1 });
      });

      expect(result.current.documentState.content?.blocks[0].type).toBe('heading');
      expect(result.current.documentState.content?.blocks[0].level).toBe(1);
      expect(result.current.documentState.isDirty).toBe(true);
    });

    it('不应更新不存在的块', () => {
      const { result } = renderHook(() => useDocument());
      const blocks = [createMockBlock('1', 'Content')];
      const content = createMockContent(blocks);

      act(() => {
        result.current.setDocumentContent(content);
      });

      act(() => {
        result.current.updateBlock('999', { type: 'heading' });
      });

      expect(result.current.documentState.content?.blocks[0].type).toBe('paragraph');
    });
  });

  describe('deleteBlock', () => {
    it('应正确删除块', () => {
      const { result } = renderHook(() => useDocument());
      const blocks = [
        createMockBlock('1', 'First'),
        createMockBlock('2', 'Second'),
      ];
      const content = createMockContent(blocks);

      act(() => {
        result.current.setDocumentContent(content);
      });

      act(() => {
        result.current.deleteBlock('1');
      });

      expect(result.current.documentState.content?.blocks).toHaveLength(1);
      expect(result.current.documentState.content?.blocks[0].id).toBe('2');
      expect(result.current.documentState.isDirty).toBe(true);
    });
  });

  describe('insertBlock', () => {
    it('应正确插入块', () => {
      const { result } = renderHook(() => useDocument());
      const blocks = [createMockBlock('1', 'First')];
      const content = createMockContent(blocks);

      act(() => {
        result.current.setDocumentContent(content);
      });

      const newBlock = createMockBlock('2', 'Inserted');

      act(() => {
        result.current.insertBlock(newBlock);
      });

      expect(result.current.documentState.content?.blocks).toHaveLength(2);
      expect(result.current.documentState.content?.blocks[1].id).toBe('2');
      expect(result.current.documentState.isDirty).toBe(true);
    });

    it('应正确在指定块后插入', () => {
      const { result } = renderHook(() => useDocument());
      const blocks = [
        createMockBlock('1', 'First'),
        createMockBlock('2', 'Last'),
      ];
      const content = createMockContent(blocks);

      act(() => {
        result.current.setDocumentContent(content);
      });

      const newBlock = createMockBlock('3', 'Middle');

      act(() => {
        result.current.insertBlock(newBlock, '1');
      });

      expect(result.current.documentState.content?.blocks).toHaveLength(3);
      expect(result.current.documentState.content?.blocks[1].id).toBe('3');
    });
  });

  describe('setSelectedBlock', () => {
    it('应正确设置选中块', () => {
      const { result } = renderHook(() => useDocument());

      act(() => {
        result.current.setSelectedBlock('1');
      });

      expect(result.current.editorState.selectedBlockId).toBe('1');
    });

    it('应正确清除选中块', () => {
      const { result } = renderHook(() => useDocument());

      act(() => {
        result.current.setSelectedBlock('1');
      });

      act(() => {
        result.current.setSelectedBlock(null);
      });

      expect(result.current.editorState.selectedBlockId).toBe(null);
    });
  });

  describe('setZoom', () => {
    it('应正确设置缩放比例', () => {
      const { result } = renderHook(() => useDocument());

      act(() => {
        result.current.setZoom(150);
      });

      expect(result.current.editorState.zoom).toBe(150);
    });

    it('应限制最小缩放比例', () => {
      const { result } = renderHook(() => useDocument());

      act(() => {
        result.current.setZoom(10);
      });

      expect(result.current.editorState.zoom).toBe(25);
    });

    it('应限制最大缩放比例', () => {
      const { result } = renderHook(() => useDocument());

      act(() => {
        result.current.setZoom(500);
      });

      expect(result.current.editorState.zoom).toBe(400);
    });
  });

  describe('setPageInfo', () => {
    it('应正确设置页码信息', () => {
      const { result } = renderHook(() => useDocument());

      act(() => {
        result.current.setPageInfo(3, 10);
      });

      expect(result.current.editorState.currentPage).toBe(3);
      expect(result.current.editorState.totalPages).toBe(10);
    });
  });

  describe('setReadOnly', () => {
    it('应正确设置只读模式', () => {
      const { result } = renderHook(() => useDocument());

      act(() => {
        result.current.setReadOnly(true);
      });

      expect(result.current.editorState.readOnly).toBe(true);
    });
  });

  describe('toggleCommentPanel', () => {
    it('应正确切换批注面板', () => {
      const { result } = renderHook(() => useDocument());

      expect(result.current.editorState.showCommentPanel).toBe(false);

      act(() => {
        result.current.toggleCommentPanel();
      });

      expect(result.current.editorState.showCommentPanel).toBe(true);

      act(() => {
        result.current.toggleCommentPanel();
      });

      expect(result.current.editorState.showCommentPanel).toBe(false);
    });
  });

  describe('批注操作', () => {
    it('应正确添加批注', () => {
      const { result } = renderHook(() => useDocument());
      const blocks = [createMockBlock('1', 'Content')];
      const content = createMockContent(blocks);

      act(() => {
        result.current.setDocumentContent(content);
      });

      const comment = {
        id: 'c1',
        author: 'Test Author',
        date: '2024-01-01',
        text: 'Test comment',
      };

      act(() => {
        result.current.addComment(comment);
      });

      expect(result.current.documentState.content?.comments).toHaveLength(1);
      expect(result.current.documentState.content?.comments[0].id).toBe('c1');
      expect(result.current.documentState.isDirty).toBe(true);
    });

    it('应正确删除批注', () => {
      const { result } = renderHook(() => useDocument());
      const blocks = [createMockBlock('1', 'Content')];
      const content = createMockContent(blocks);

      act(() => {
        result.current.setDocumentContent(content);
      });

      const comment = {
        id: 'c1',
        author: 'Author',
        date: '2024-01-01',
        text: 'Comment',
      };

      act(() => {
        result.current.addComment(comment);
      });

      act(() => {
        result.current.deleteComment('c1');
      });

      expect(result.current.documentState.content?.comments).toHaveLength(0);
    });

    it('应正确更新批注', () => {
      const { result } = renderHook(() => useDocument());
      const blocks = [createMockBlock('1', 'Content')];
      const content = createMockContent(blocks);

      act(() => {
        result.current.setDocumentContent(content);
      });

      const comment = {
        id: 'c1',
        author: 'Author',
        date: '2024-01-01',
        text: 'Original',
      };

      act(() => {
        result.current.addComment(comment);
      });

      act(() => {
        result.current.updateComment('c1', { text: 'Updated' } as any);
      });

      expect(result.current.documentState.content?.comments[0].text).toBe('Updated');
    });
  });

  describe('resetEditor', () => {
    it('应正确重置编辑器状态', () => {
      const { result } = renderHook(() => useDocument());

      act(() => {
        result.current.setDocumentContent(createMockContent([createMockBlock('1', 'Test')]));
        result.current.setDirty(true);
        result.current.setSelectedBlock('1');
        result.current.setZoom(200);
        result.current.setReadOnly(true);
      });

      act(() => {
        result.current.resetEditor();
      });

      expect(result.current.documentState.isLoaded).toBe(false);
      expect(result.current.documentState.isDirty).toBe(false);
      expect(result.current.editorState.selectedBlockId).toBe(null);
      expect(result.current.editorState.zoom).toBe(100);
      expect(result.current.editorState.readOnly).toBe(false);
    });
  });
});
