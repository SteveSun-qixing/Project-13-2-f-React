/**
 * 编辑区容器组件
 *
 * 组合标题栏、顶部工具栏、编辑 / 预览双模式与状态栏。
 * 自动保存调度由场景层（NotesScene）统一负责。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Form, Input, Modal, Segmented, Spin } from 'antd';
import type { Note } from '../../types';
import { messages } from '../../lib/messages';
import { EditorToolbar } from './EditorToolbar';
import { MarkdownEditor, type MarkdownEditorHandle, type SyntaxInsert } from './MarkdownEditor';
import { MarkdownRenderer } from './MarkdownRenderer';

export type EditorMode = 'edit' | 'preview' | 'split';

interface LinkDraft {
  text: string;
  url: string;
  hasSelection: boolean;
}

interface EditorViewProps {
  note: Note;
  content: string;
  modified: boolean;
  loading: boolean;
  saving: boolean;
  onContentChange: (content: string) => void;
  onManualSave: () => void;
  onRename: (title: string) => void;
}

export function EditorView(props: EditorViewProps): React.ReactElement {
  const { note, content, modified, loading, saving, onContentChange, onManualSave, onRename } = props;
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const [mode, setMode] = useState<EditorMode>('split');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(note.title);
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null);
  const [form] = Form.useForm<{ text: string; url: string }>();

  useEffect(() => {
    setTitleValue(note.title);
    setEditingTitle(false);
  }, [note]);

  const handleInsert = useCallback((insert: SyntaxInsert) => {
    editorRef.current?.insertSyntax(insert);
  }, []);

  const handleInsertLinePrefix = useCallback((prefix: string) => {
    editorRef.current?.insertLinePrefix(prefix);
  }, []);

  const handleInsertDivider = useCallback(() => {
    editorRef.current?.insertText('\n\n---\n\n');
  }, []);

  // 链接：弹出输入对话框（有选区时自动带入链接文本）
  const openLinkDialog = useCallback(() => {
    const selection = editorRef.current?.getSelection();
    const selected = selection ? content.slice(selection.start, selection.end) : '';
    form.setFieldsValue({ text: selected, url: '' });
    setLinkDraft({ text: selected, url: '', hasSelection: Boolean(selected) });
  }, [content, form]);

  const handleLinkSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const text = values.text.trim();
      const url = values.url.trim();
      if (!text || !url) {
        return;
      }
      editorRef.current?.insertSyntax({
        before: `[${text}](${url})`,
        after: '',
        placeholder: '',
      });
      setLinkDraft(null);
    } catch {
      // 校验失败保持对话框打开
    }
  }, [form]);

  // 编辑区快捷键（命令面板快捷键在可编辑元素内不生效，编辑器内自行处理）
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) {
        return;
      }
      const key = event.key.toLowerCase();

      if (key === 's') {
        event.preventDefault();
        onManualSave();
        return;
      }
      if (key === 'b') {
        event.preventDefault();
        handleInsert(INLINE_SYNTAX_BOLD);
        return;
      }
      if (key === 'i') {
        event.preventDefault();
        handleInsert(INLINE_SYNTAX_ITALIC);
        return;
      }
      if (key === 'e') {
        event.preventDefault();
        handleInsert({ before: '`', after: '`', placeholder: '代码', selectPlaceholder: true });
        return;
      }
      if (key === 'k') {
        event.preventDefault();
        openLinkDialog();
        return;
      }
      if (key === '1' || key === '2' || key === '3') {
        event.preventDefault();
        handleInsertLinePrefix('#'.repeat(Number(key)) + ' ');
      }
    },
    [handleInsert, handleInsertLinePrefix, onManualSave, openLinkDialog],
  );

  const handleTitleCommit = useCallback(() => {
    const nextTitle = titleValue.trim();
    setEditingTitle(false);
    if (nextTitle && nextTitle !== note.title) {
      onRename(nextTitle);
    } else {
      setTitleValue(note.title);
    }
  }, [titleValue, note.title, onRename]);

  if (loading) {
    return (
      <div className="editor-view editor-view-loading">
        <div className="editor-view-loading-spinner">
          <Spin />
        </div>
        <div className="editor-view-loading-text">加载中...</div>
      </div>
    );
  }

  return (
    <div className="editor-view">
      <div className="editor-view-header">
        <div className="editor-view-title">
          {editingTitle ? (
            <Input
              className="editor-view-title-input"
              value={titleValue}
              onChange={(event) => setTitleValue(event.target.value)}
              onBlur={handleTitleCommit}
              onPressEnter={handleTitleCommit}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setTitleValue(note.title);
                  setEditingTitle(false);
                }
              }}
              autoFocus
            />
          ) : (
            <span
              className="editor-view-title-text"
              title="点击编辑标题"
              onClick={() => setEditingTitle(true)}
            >
              {note.title || messages.editor.untitled}
            </span>
          )}
        </div>
        <div className="editor-view-mode">
          <Segmented
            value={mode}
            onChange={(value) => setMode(value as EditorMode)}
            size="small"
            options={[
              { value: 'edit', label: '编辑' },
              { value: 'preview', label: '预览' },
              { value: 'split', label: '分屏' },
            ]}
          />
        </div>
      </div>

      <EditorToolbar
        onInsert={handleInsert}
        onInsertLinePrefix={handleInsertLinePrefix}
        onInsertDivider={handleInsertDivider}
        onInsertLink={openLinkDialog}
      />

      <div className="editor-view-content">
        {(mode === 'edit' || mode === 'split') && (
          <div className="editor-view-pane editor-view-edit">
            <div className="editor-view-content-container">
              <MarkdownEditor
                ref={editorRef}
                content={content}
                onChange={onContentChange}
                onKeyDown={handleKeyDown}
                placeholder="开始书写..."
              />
            </div>
          </div>
        )}
        {(mode === 'preview' || mode === 'split') && (
          <div className="editor-view-pane editor-view-preview">
            <div className="editor-view-content-container">
              <MarkdownRenderer content={content} />
            </div>
          </div>
        )}
      </div>

      <div className="editor-view-footer">
        <span className={`editor-view-status ${saving ? 'saving' : modified ? 'modified' : 'saved'}`}>
          {saving ? messages.editor.saving : modified ? messages.editor.modified : messages.editor.saved}
        </span>
        <span className="editor-view-stats">{content.length} 字符</span>
      </div>

      <Modal
        title="插入链接"
        open={linkDraft !== null}
        okText={messages.dialog.ok}
        cancelText={messages.dialog.cancel}
        onOk={() => {
          void handleLinkSubmit();
        }}
        onCancel={() => setLinkDraft(null)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="text"
            label="链接文本"
            rules={[{ required: true, message: '请输入链接文本' }]}
          >
            <Input placeholder="链接文本" />
          </Form.Item>
          <Form.Item
            name="url"
            label="链接地址"
            rules={[{ required: true, message: '请输入链接地址' }]}
          >
            <Input placeholder="https://" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

const INLINE_SYNTAX_BOLD: SyntaxInsert = { before: '**', after: '**', placeholder: '加粗文本', selectPlaceholder: true };
const INLINE_SYNTAX_ITALIC: SyntaxInsert = { before: '*', after: '*', placeholder: '斜体文本', selectPlaceholder: true };
