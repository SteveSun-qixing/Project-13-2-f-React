import React, { useCallback, useState, useEffect } from 'react';
import { Alert, message } from 'antd';
import { WordToolbar } from './components/Toolbar';
import { PageCanvas } from './components/PageCanvas';
import { TableEditor } from './components/TableEditor';
import { ImageInsert } from './components/ImageInsert';
import { CommentPanel } from './components/CommentPanel';
import { useDocument } from './hooks/useDocument';
import type { WordDocumentContent } from './types';
import { DEFAULT_SECTION } from '../../engine/docx-engine/src/section';
import { formatMessage } from './lib/messages';
import './styles/word-editor.css';

interface WordEditorProps {
  /** 初始 DOCX 字节数据 */
  initialBytes?: Uint8Array;
  /** 文件路径 */
  filePath?: string;
  /** 文件名 */
  fileName?: string;
  /** 是否只读模式 */
  readOnly?: boolean;
  /** SDK 客户端 */
  client?: import('chips-sdk').Client;
  /** 文档会话 ID */
  sessionId?: string;
  /** 保存回调 */
  onSave?: (bytes: Uint8Array) => Promise<void>;
  /** 关闭回调 */
  onClose?: () => void;
}

export function WordEditor({
  initialBytes,
  filePath,
  fileName,
  readOnly = false,
  client,
  sessionId,
  onSave,
  onClose,
}: WordEditorProps) {
  const {
    documentState,
    editorState,
    setDocumentContent,
    setDocumentMetadata,
    setLoading,
    setError,
    setSaving,
    setDirty,
    setReadOnly,
    setZoom,
    toggleCommentPanel,
    setSelectedComment,
    addComment,
    deleteComment,
    updateComment,
    parseDocxBytes,
    resetEditor,
  } = useDocument();

  const [showTableEditor, setShowTableEditor] = useState(false);
  const [showImageInsert, setShowImageInsert] = useState(false);
  const [undoStack, setUndoStack] = useState<WordDocumentContent[]>([]);
  const [redoStack, setRedoStack] = useState<WordDocumentContent[]>([]);

  useEffect(() => {
    setReadOnly(readOnly);
  }, [readOnly, setReadOnly]);

  useEffect(() => {
    if (initialBytes) {
      parseDocxBytes(initialBytes).catch((err) => {
        console.error('Failed to parse DOCX:', err);
      });
    }
  }, [initialBytes, parseDocxBytes]);

  const handleSave = useCallback(async () => {
    if (readOnly || !onSave) return;
    if (!documentState.content) return;

    setSaving(true);
    try {
      const { saveDocx } = await import('../../engine/docx-engine/src/patch');
      const parsed = await parseDocxBytesToFullDoc(initialBytes!, documentState.content);
      const bytes = await saveDocx(parsed, buildFinalBlocks(documentState.content), {
        savedAt: new Date().toISOString(),
      });
      await onSave(bytes);
      setDirty(false);
      message.success(formatMessage('word.editor.saved'));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '保存失败';
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }, [readOnly, documentState, onSave, setSaving, setDirty, setError, initialBytes]);

  const handleCommand = useCallback(
    (command: string, value?: unknown) => {
      if (readOnly) return;

      switch (command) {
        case 'undo':
          if (undoStack.length > 0) {
            const prevContent = undoStack[undoStack.length - 1];
            setRedoStack((r) => [...r, documentState.content!]);
            setUndoStack((u) => u.slice(0, -1));
            setDocumentContent(prevContent);
          }
          break;
        case 'redo':
          if (redoStack.length > 0) {
            const nextContent = redoStack[redoStack.length - 1];
            setUndoStack((u) => [...u, documentState.content!]);
            setRedoStack((r) => r.slice(0, -1));
            setDocumentContent(nextContent);
          }
          break;
        case 'bold':
        case 'italic':
        case 'underline':
        case 'strikethrough':
        case 'superscript':
        case 'subscript':
          console.log(`Format command: ${command}`, value);
          break;
        case 'fontName':
        case 'fontSize':
          console.log(`Font command: ${command}`, value);
          break;
        case 'alignLeft':
        case 'alignCenter':
        case 'alignRight':
        case 'alignJustify':
          console.log(`Align command: ${command}`);
          break;
        case 'unorderedList':
        case 'orderedList':
          console.log(`List command: ${command}`);
          break;
        case 'heading':
          console.log(`Heading command: level=${value}`);
          break;
        case 'paragraph':
          console.log('Paragraph command');
          break;
      }
    },
    [readOnly, undoStack, redoStack, documentState.content, setDocumentContent]
  );

  const handleInsertTable = useCallback(() => {
    if (readOnly) return;
    setShowTableEditor(true);
  }, [readOnly]);

  const handleTableInsert = useCallback(
    (config: { rows: number; columns: number }) => {
      if (readOnly) return;
      console.log('Insert table:', config);
      setShowTableEditor(false);
    },
    [readOnly]
  );

  const handleInsertImage = useCallback(() => {
    if (readOnly) return;
    setShowImageInsert(true);
  }, [readOnly]);

  const handleImageInsert = useCallback(
    (config: unknown) => {
      if (readOnly) return;
      console.log('Insert image:', config);
      setShowImageInsert(false);
    },
    [readOnly]
  );

  const handleInsertComment = useCallback(() => {
    if (readOnly) return;
    toggleCommentPanel();
  }, [readOnly, toggleCommentPanel]);

  const handleBlockClick = useCallback((blockId: string) => {
    console.log('Block clicked:', blockId);
  }, []);

  const handleCommentSelect = useCallback(
    (commentId: string | null) => {
      setSelectedComment(commentId);
    },
    [setSelectedComment]
  );

  const handleAddComment = useCallback(
    (content: string) => {
      if (readOnly) return;
      const comment = {
        id: generateId(),
        author: '当前用户',
        date: new Date().toISOString(),
        text: content,
      };
      addComment(comment as any);
    },
    [readOnly, addComment]
  );

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      if (readOnly) return;
      deleteComment(commentId);
    },
    [readOnly, deleteComment]
  );

  const handleResolveComment = useCallback(
    (commentId: string) => {
      if (readOnly) return;
      updateComment(commentId, { done: true } as any);
    },
    [readOnly, updateComment]
  );

  const blocks = documentState.content?.blocks || [];
  const sectionSettings = documentState.content?.sectionSettings || DEFAULT_SECTION;
  const comments = documentState.content?.comments || [];

  return (
    <div className="word-editor">
      {documentState.error && (
        <Alert
          message={formatMessage('word.editor.error')}
          description={documentState.error}
          type="error"
          showIcon
          closable
          style={{ margin: 16 }}
        />
      )}

      <WordToolbar
        editorState={editorState}
        onCommand={handleCommand}
        onInsertImage={handleInsertImage}
        onInsertTable={handleInsertTable}
        onInsertComment={handleInsertComment}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
      />

      <div className="word-editor__main">
        <PageCanvas
          blocks={blocks}
          sectionSettings={sectionSettings}
          zoom={editorState.zoom}
          currentPage={editorState.currentPage}
          totalPages={editorState.totalPages}
          selectedBlockId={editorState.selectedBlockId}
          readOnly={editorState.readOnly}
          isLoading={documentState.isLoading}
          isEmpty={blocks.length === 0 && !documentState.isLoading}
          onBlockClick={handleBlockClick}
        />

        {editorState.showCommentPanel && (
          <CommentPanel
            comments={comments}
            selectedCommentId={editorState.selectedCommentId}
            onSelectComment={handleCommentSelect}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onResolveComment={handleResolveComment}
          />
        )}
      </div>

      <div className="word-editor__statusbar">
        <span className="word-statusbar__page">
          {formatMessage('word.statusBar.page', {
            current: editorState.currentPage,
            total: editorState.totalPages,
          })}
        </span>
        <span className="word-statusbar__words">
          {formatMessage('word.statusBar.words', { count: editorState.wordCount })}
        </span>
        <span className="word-statusbar__zoom">
          {formatMessage('word.statusBar.zoom', { percent: editorState.zoom })}
        </span>
        {documentState.isDirty && (
          <span className="word-statusbar__dirty">*</span>
        )}
      </div>

      <TableEditor
        visible={showTableEditor}
        onClose={() => setShowTableEditor(false)}
        onInsert={handleTableInsert}
      />

      <ImageInsert
        visible={showImageInsert}
        onClose={() => setShowImageInsert(false)}
        onInsert={handleImageInsert}
      />
    </div>
  );
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

async function parseDocxBytesToFullDoc(
  bytes: Uint8Array,
  content: WordDocumentContent
): Promise<any> {
  const { parseDocx } = await import('../../engine/docx-engine/src/parse');
  return await parseDocx(bytes);
}

function buildFinalBlocks(content: WordDocumentContent): any[] {
  return content.blocks.map((block, index) => ({
    kind: 'original',
    docxIndex: index,
  }));
}

export default WordEditor;
