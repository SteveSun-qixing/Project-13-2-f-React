/**
 * Markdown 编辑器组件（textarea 实现，供工具栏与命令系统调用）
 */

import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

/** 编辑器命令插入语法描述 */
export interface SyntaxInsert {
  /** 选区前插入的标记 */
  before: string;
  /** 选区后插入的标记 */
  after?: string;
  /** 无选区时的占位文本 */
  placeholder?: string;
  /** 占位文本选中状态（插入后全选占位文本） */
  selectPlaceholder?: boolean;
}

export interface MarkdownEditorHandle {
  /** 在光标选区处插入语法标记 */
  insertSyntax: (insert: SyntaxInsert) => void;
  /** 在当前行行首插入前缀（标题 / 列表 / 引用） */
  insertLinePrefix: (prefix: string) => void;
  /** 在光标处插入纯文本 */
  insertText: (text: string) => void;
  /** 读取当前选区位置 */
  getSelection: () => { start: number; end: number };
  /** 聚焦编辑器 */
  focus: () => void;
}

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(props, ref) {
    const { content, onChange, onKeyDown, placeholder } = props;
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const insertSyntax = useCallback(
      (insert: SyntaxInsert) => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = content.slice(start, end);
        const inner = selected || insert.placeholder || '';
        const next =
          content.slice(0, start) + insert.before + inner + (insert.after ?? '') + content.slice(end);
        onChange(next);

        const innerStart = start + insert.before.length;
        const innerEnd = innerStart + inner.length;
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (!el) {
            return;
          }
          el.focus();
          if (!selected && insert.selectPlaceholder && inner) {
            el.setSelectionRange(innerStart, innerEnd);
          } else if (insert.after) {
            el.setSelectionRange(innerEnd, innerEnd);
          } else {
            el.setSelectionRange(innerEnd, innerEnd);
          }
        });
      },
      [content, onChange],
    );

    const insertLinePrefix = useCallback(
      (prefix: string) => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }
        const value = textarea.value;
        const lineStart = value.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
        const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
        onChange(next);
        const offset = prefix.length;
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (!el) {
            return;
          }
          el.focus();
          el.setSelectionRange(textarea.selectionStart + offset, textarea.selectionEnd + offset);
        });
      },
      [onChange],
    );

    const insertText = useCallback(
      (text: string) => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const next = content.slice(0, start) + text + content.slice(end);
        onChange(next);
        const cursor = start + text.length;
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (!el) {
            return;
          }
          el.focus();
          el.setSelectionRange(cursor, cursor);
        });
      },
      [content, onChange],
    );

    useImperativeHandle(ref, () => ({
      insertSyntax,
      insertLinePrefix,
      insertText,
      getSelection: () => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return { start: 0, end: 0 };
        }
        return { start: textarea.selectionStart, end: textarea.selectionEnd };
      },
      focus: () => textareaRef.current?.focus(),
    }));

    return (
      <textarea
        ref={textareaRef}
        className="rich-text-editor-textarea"
        value={content}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder || '开始书写...'}
        spellCheck={false}
      />
    );
  },
);
