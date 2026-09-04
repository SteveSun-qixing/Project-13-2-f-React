/**
 * 顶部工具栏组件
 *
 * 按参考设计提供分组按钮：文字格式（加粗/斜体/删除线）、标题（H1/H2/H3）、
 * 列表（无序/有序/任务）、引用与分割线、行内代码、链接、图片。
 */

import React from 'react';
import { Tooltip } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  CodeOutlined,
  LinkOutlined,
  PictureOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  CheckSquareOutlined,
  BlockOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import { messages } from '../../lib/messages';
import type { SyntaxInsert } from './MarkdownEditor';

export interface EditorToolbarProps {
  /** 插入行内语法（加粗 / 斜体 / 代码等） */
  onInsert: (insert: SyntaxInsert) => void;
  /** 插入行首前缀（标题 / 列表 / 引用） */
  onInsertLinePrefix: (prefix: string) => void;
  /** 插入水平分割线 */
  onInsertDivider: () => void;
  /** 插入链接（打开输入对话框） */
  onInsertLink: () => void;
}

interface ToolbarItem {
  key: string;
  title: string;
  shortcut?: string;
  icon?: React.ReactNode;
  label?: string;
}

const GROUPS: ToolbarItem[][] = [
  [
    { key: 'bold', title: messages.toolbar.bold, shortcut: 'Mod+B', icon: <BoldOutlined /> },
    { key: 'italic', title: messages.toolbar.italic, shortcut: 'Mod+I', icon: <ItalicOutlined /> },
    { key: 'strikethrough', title: messages.toolbar.strikethrough, icon: <StrikethroughOutlined /> },
  ],
  [
    { key: 'h1', title: messages.toolbar.heading1, shortcut: 'Mod+1', label: 'H1' },
    { key: 'h2', title: messages.toolbar.heading2, shortcut: 'Mod+2', label: 'H2' },
    { key: 'h3', title: messages.toolbar.heading3, shortcut: 'Mod+3', label: 'H3' },
  ],
  [
    { key: 'bullet-list', title: messages.toolbar.bulletList, icon: <UnorderedListOutlined /> },
    { key: 'ordered-list', title: messages.toolbar.orderedList, icon: <OrderedListOutlined /> },
    { key: 'task-list', title: '任务列表', icon: <CheckSquareOutlined /> },
  ],
  [
    { key: 'quote', title: messages.toolbar.quote, icon: <BlockOutlined /> },
    { key: 'divider', title: messages.toolbar.divider, icon: <MinusOutlined /> },
  ],
  [{ key: 'code', title: messages.toolbar.code, shortcut: 'Mod+E', icon: <CodeOutlined /> }],
  [{ key: 'link', title: messages.toolbar.link, shortcut: 'Mod+K', icon: <LinkOutlined /> }],
  [{ key: 'image', title: messages.toolbar.image, icon: <PictureOutlined /> }],
];

const INLINE_SYNTAX: Record<string, SyntaxInsert> = {
  bold: { before: '**', after: '**', placeholder: '加粗文本', selectPlaceholder: true },
  italic: { before: '*', after: '*', placeholder: '斜体文本', selectPlaceholder: true },
  strikethrough: { before: '~~', after: '~~', placeholder: '删除文本', selectPlaceholder: true },
  code: { before: '`', after: '`', placeholder: '代码', selectPlaceholder: true },
  image: { before: '![', after: '](https://)', placeholder: '图片描述', selectPlaceholder: true },
};

const LINE_PREFIX: Record<string, string> = {
  h1: '# ',
  h2: '## ',
  h3: '### ',
  'bullet-list': '- ',
  'ordered-list': '1. ',
  'task-list': '- [ ] ',
  quote: '> ',
};

export function EditorToolbar(props: EditorToolbarProps): React.ReactElement {
  const { onInsert, onInsertLinePrefix, onInsertDivider, onInsertLink } = props;

  const handleAction = (item: ToolbarItem): void => {
    const inline = INLINE_SYNTAX[item.key];
    if (inline) {
      onInsert(inline);
      return;
    }
    const prefix = LINE_PREFIX[item.key];
    if (prefix) {
      onInsertLinePrefix(prefix);
      return;
    }
    if (item.key === 'divider') {
      onInsertDivider();
      return;
    }
    if (item.key === 'link') {
      onInsertLink();
    }
  };

  return (
    <div className="editor-toolbar">
      <div className="editor-toolbar-tools">
        {GROUPS.map((group, groupIndex) => (
          <div key={`group-${groupIndex}`} className="editor-toolbar-group">
            {group.map((item) => (
              <Tooltip
                key={item.key}
                title={item.shortcut ? `${item.title}（${item.shortcut}）` : item.title}
              >
                <button
                  type="button"
                  className="editor-toolbar-button"
                  onClick={() => handleAction(item)}
                  aria-label={item.title}
                >
                  {item.icon ?? <span className="editor-toolbar-label">{item.label}</span>}
                </button>
              </Tooltip>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
