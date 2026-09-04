import { useCallback, useMemo, useState } from 'react';
import type {
  WordDocumentState,
  WordDocumentMetadata,
  WordDocumentContent,
  WordEditorState,
  CursorPosition,
  ActiveFormats,
  Block,
  CommentInfo,
} from '../types';
import { DEFAULT_SECTION } from '../../../engine/docx-engine/src/section';

const DEFAULT_ACTIVE_FORMATS: ActiveFormats = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  vertAlign: 'none',
  fontName: null,
  fontSize: null,
  color: null,
  highlight: null,
  align: null,
  listStyle: null,
  listNumId: null,
  listLevel: null,
  headingLevel: null,
};

export interface UseDocumentReturn {
  /** 文档状态 */
  documentState: WordDocumentState;
  /** 编辑器状态 */
  editorState: WordEditorState;
  /** 设置文档内容 */
  setDocumentContent: (content: WordDocumentContent) => void;
  /** 设置文档元数据 */
  setDocumentMetadata: (metadata: WordDocumentMetadata) => void;
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;
  /** 设置错误信息 */
  setError: (error: string | null) => void;
  /** 设置保存状态 */
  setSaving: (saving: boolean) => void;
  /** 设置脏标记 */
  setDirty: (dirty: boolean) => void;
  /** 更新块内容 */
  updateBlock: (blockId: string, updates: Partial<Block>) => void;
  /** 删除块 */
  deleteBlock: (blockId: string) => void;
  /** 插入块 */
  insertBlock: (block: Block, afterBlockId?: string) => void;
  /** 设置选中块 */
  setSelectedBlock: (blockId: string | null) => void;
  /** 设置光标位置 */
  setCursorPosition: (position: CursorPosition | null) => void;
  /** 更新格式状态 */
  updateActiveFormats: (formats: Partial<ActiveFormats>) => void;
  /** 设置缩放比例 */
  setZoom: (zoom: number) => void;
  /** 设置页码 */
  setPageInfo: (current: number, total: number) => void;
  /** 更新字数统计 */
  updateWordCount: (count: number) => void;
  /** 设置只读模式 */
  setReadOnly: (readOnly: boolean) => void;
  /** 切换批注面板 */
  toggleCommentPanel: () => void;
  /** 设置选中的批注 */
  setSelectedComment: (commentId: string | null) => void;
  /** 添加批注 */
  addComment: (comment: CommentInfo) => void;
  /** 删除批注 */
  deleteComment: (commentId: string) => void;
  /** 更新批注 */
  updateComment: (commentId: string, updates: Partial<CommentInfo>) => void;
  /** 解析 DOCX 字节数据 */
  parseDocxBytes: (bytes: Uint8Array) => Promise<void>;
  /** 重置编辑器状态 */
  resetEditor: () => void;
}

const initialDocumentState: WordDocumentState = {
  isLoaded: false,
  isLoading: false,
  isSaving: false,
  isDirty: false,
  error: null,
  metadata: null,
  content: null,
};

const initialEditorState: WordEditorState = {
  selectedBlockId: null,
  cursorPosition: null,
  activeFormats: { ...DEFAULT_ACTIVE_FORMATS },
  zoom: 100,
  currentPage: 1,
  totalPages: 1,
  wordCount: 0,
  readOnly: false,
  showCommentPanel: false,
  selectedCommentId: null,
};

export function useDocument(): UseDocumentReturn {
  const [documentState, setDocumentState] = useState<WordDocumentState>(initialDocumentState);
  const [editorState, setEditorState] = useState<WordEditorState>(initialEditorState);

  const setDocumentContent = useCallback((content: WordDocumentContent) => {
    setDocumentState((prev) => ({
      ...prev,
      content,
      isLoaded: true,
      isLoading: false,
      error: null,
    }));
    const wordCount = countWords(content.blocks);
    setEditorState((prev) => ({ ...prev, wordCount }));
  }, []);

  const setDocumentMetadata = useCallback((metadata: WordDocumentMetadata) => {
    setDocumentState((prev) => ({
      ...prev,
      metadata,
    }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setDocumentState((prev) => ({
      ...prev,
      isLoading: loading,
      error: loading ? null : prev.error,
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setDocumentState((prev) => ({
      ...prev,
      isLoading: false,
      error,
    }));
  }, []);

  const setSaving = useCallback((saving: boolean) => {
    setDocumentState((prev) => ({
      ...prev,
      isSaving: saving,
    }));
  }, []);

  const setDirty = useCallback((dirty: boolean) => {
    setDocumentState((prev) => ({
      ...prev,
      isDirty: dirty,
    }));
  }, []);

  const updateBlock = useCallback((blockId: string, updates: Partial<Block>) => {
    setDocumentState((prev) => {
      if (!prev.content) return prev;
      const blocks = prev.content.blocks.map((block) =>
        block.id === blockId ? { ...block, ...updates } : block
      );
      return {
        ...prev,
        content: { ...prev.content, blocks },
        isDirty: true,
      };
    });
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    setDocumentState((prev) => {
      if (!prev.content) return prev;
      const blocks = prev.content.blocks.filter((block) => block.id !== blockId);
      return {
        ...prev,
        content: { ...prev.content, blocks },
        isDirty: true,
      };
    });
  }, []);

  const insertBlock = useCallback((block: Block, afterBlockId?: string) => {
    setDocumentState((prev) => {
      if (!prev.content) return prev;
      let blocks: Block[];
      if (afterBlockId) {
        const index = prev.content.blocks.findIndex((b) => b.id === afterBlockId);
        if (index >= 0) {
          blocks = [
            ...prev.content.blocks.slice(0, index + 1),
            block,
            ...prev.content.blocks.slice(index + 1),
          ];
        } else {
          blocks = [...prev.content.blocks, block];
        }
      } else {
        blocks = [...prev.content.blocks, block];
      }
      return {
        ...prev,
        content: { ...prev.content, blocks },
        isDirty: true,
      };
    });
  }, []);

  const setSelectedBlock = useCallback((blockId: string | null) => {
    setEditorState((prev) => ({ ...prev, selectedBlockId: blockId }));
  }, []);

  const setCursorPosition = useCallback((position: CursorPosition | null) => {
    setEditorState((prev) => ({ ...prev, cursorPosition: position }));
  }, []);

  const updateActiveFormats = useCallback((formats: Partial<ActiveFormats>) => {
    setEditorState((prev) => ({
      ...prev,
      activeFormats: { ...prev.activeFormats, ...formats },
    }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setEditorState((prev) => ({ ...prev, zoom: Math.max(25, Math.min(400, zoom)) }));
  }, []);

  const setPageInfo = useCallback((current: number, total: number) => {
    setEditorState((prev) => ({ ...prev, currentPage: current, totalPages: total }));
  }, []);

  const updateWordCount = useCallback((count: number) => {
    setEditorState((prev) => ({ ...prev, wordCount: count }));
  }, []);

  const setReadOnly = useCallback((readOnly: boolean) => {
    setEditorState((prev) => ({ ...prev, readOnly }));
  }, []);

  const toggleCommentPanel = useCallback(() => {
    setEditorState((prev) => ({ ...prev, showCommentPanel: !prev.showCommentPanel }));
  }, []);

  const setSelectedComment = useCallback((commentId: string | null) => {
    setEditorState((prev) => ({ ...prev, selectedCommentId: commentId }));
  }, []);

  const addComment = useCallback((comment: CommentInfo) => {
    setDocumentState((prev) => {
      if (!prev.content) return prev;
      return {
        ...prev,
        content: {
          ...prev.content,
          comments: [...prev.content.comments, comment],
        },
        isDirty: true,
      };
    });
  }, []);

  const deleteComment = useCallback((commentId: string) => {
    setDocumentState((prev) => {
      if (!prev.content) return prev;
      return {
        ...prev,
        content: {
          ...prev.content,
          comments: prev.content.comments.filter((c) => c.id !== commentId),
        },
        isDirty: true,
      };
    });
  }, []);

  const updateComment = useCallback((commentId: string, updates: Partial<CommentInfo>) => {
    setDocumentState((prev) => {
      if (!prev.content) return prev;
      return {
        ...prev,
        content: {
          ...prev.content,
          comments: prev.content.comments.map((c) =>
            c.id === commentId ? { ...c, ...updates } : c
          ),
        },
        isDirty: true,
      };
    });
  }, []);

  const parseDocxBytes = useCallback(async (bytes: Uint8Array) => {
    setLoading(true);
    setError(null);
    try {
      const { parseDocx } = await import('../../../engine/docx-engine/src/parse');
      const parsed = await parseDocx(bytes);
      const content: WordDocumentContent = {
        blocks: parsed.blocks.filter((b) => !b.hidden),
        comments: parsed.comments,
        footnotes: [],
        endnotes: [],
        headerText: parsed.headerText ?? null,
        footerText: parsed.footerText ?? null,
        watermarkText: parsed.watermarkText ?? null,
        sectionSettings: parsed.internal
          ? { ...DEFAULT_SECTION }
          : DEFAULT_SECTION,
        styles: parsed.styles,
        numbering: parsed.numbering,
      };
      setDocumentContent(content);
      setDirty(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '文档解析失败';
      setError(message);
      throw err;
    }
  }, [setLoading, setError, setDocumentContent, setDirty]);

  const resetEditor = useCallback(() => {
    setDocumentState(initialDocumentState);
    setEditorState(initialEditorState);
  }, []);

  return useMemo(
    () => ({
      documentState,
      editorState,
      setDocumentContent,
      setDocumentMetadata,
      setLoading,
      setError,
      setSaving,
      setDirty,
      updateBlock,
      deleteBlock,
      insertBlock,
      setSelectedBlock,
      setCursorPosition,
      updateActiveFormats,
      setZoom,
      setPageInfo,
      updateWordCount,
      setReadOnly,
      toggleCommentPanel,
      setSelectedComment,
      addComment,
      deleteComment,
      updateComment,
      parseDocxBytes,
      resetEditor,
    }),
    [
      documentState,
      editorState,
      setDocumentContent,
      setDocumentMetadata,
      setLoading,
      setError,
      setSaving,
      setDirty,
      updateBlock,
      deleteBlock,
      insertBlock,
      setSelectedBlock,
      setCursorPosition,
      updateActiveFormats,
      setZoom,
      setPageInfo,
      updateWordCount,
      setReadOnly,
      toggleCommentPanel,
      setSelectedComment,
      addComment,
      deleteComment,
      updateComment,
      parseDocxBytes,
      resetEditor,
    ]
  );
}

function countWords(blocks: Block[]): number {
  let count = 0;
  for (const block of blocks) {
    if (block.runs) {
      for (const run of block.runs) {
        const text = run.text || '';
        const words = text.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g);
        if (words) {
          count += words.length;
        }
      }
    }
    if (block.table) {
      for (const row of block.table.rows) {
        for (const cell of row) {
          // 单元格正文：富文本段落（richParas）优先，否则回退到纯文本段落（paras）
          const paraTexts = cell.richParas
            ? cell.richParas.map((para) => para.runs.map((run) => run.text).join(''))
            : cell.paras;
          for (const paraText of paraTexts) {
            const words = paraText.match(/[\u4e00-\u9fa5]+|[a-zA-Z]+/g);
            if (words) {
              count += words.length;
            }
          }
        }
      }
    }
  }
  return count;
}
