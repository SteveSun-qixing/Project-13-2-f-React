/**
 * 侧边栏组件（目录树）
 *
 * 展示笔记本（箱子）与笔记（卡片）两级目录：
 * - 点击笔记本展开 / 收起（展开时向场景层请求箱子条目）；
 * - 点击笔记打开编辑；
 * - 右键菜单提供新建 / 重命名 / 删除；
 * - 右侧分割条可拖拽调整宽度。
 */

import React, { useCallback, useState } from 'react';
import { App, Dropdown, Input, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  FolderOutlined,
  FileTextOutlined,
  DeleteOutlined,
  EditOutlined,
  CaretRightOutlined,
  CaretDownOutlined,
} from '@ant-design/icons';
import type { Note, Notebook, TreeNode } from '../../types';
import { messages } from '../../lib/messages';

interface SidebarProps {
  treeData: TreeNode[];
  expandedKeys: string[];
  selectedNoteId: string | null;
  width: number;
  onExpandNotebook: (notebook: Notebook, expanded: boolean) => void;
  onSelectNote: (note: Note) => void;
  onNewNotebook: () => void;
  onNewNote: (notebook: Notebook) => void;
  onRenameNotebook: (notebook: Notebook, newName: string) => void;
  onDeleteNotebook: (notebook: Notebook) => void;
  onRenameNote: (note: Note, newTitle: string) => void;
  onDeleteNote: (note: Note) => void;
  onWidthChange: (width: number) => void;
}

export function Sidebar(props: SidebarProps): React.ReactElement {
  const { modal } = App.useApp();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isResizing, setIsResizing] = useState(false);

  const confirmAction = useCallback(
    (title: string, content: string, onOk: () => void) => {
      modal.confirm({
        title,
        content,
        okText: messages.dialog.ok,
        cancelText: messages.dialog.cancel,
        okButtonProps: { danger: true },
        onOk,
      });
    },
    [modal],
  );

  const beginEditing = useCallback((key: string, initialValue: string) => {
    setEditingKey(key);
    setEditingValue(initialValue);
  }, []);

  const commitEditing = useCallback(() => {
    const key = editingKey;
    const value = editingValue.trim();
    setEditingKey(null);
    setEditingValue('');
    if (!key || !value) {
      return;
    }
    if (key.startsWith('notebook-')) {
      const notebook = props.treeData.find(
        (node): node is Extract<TreeNode, { type: 'notebook' }> => node.key === key,
      )?.notebook;
      if (notebook && notebook.name !== value) {
        props.onRenameNotebook(notebook, value);
      }
      return;
    }
    if (key.startsWith('note-')) {
      for (const node of props.treeData) {
        if (node.type !== 'notebook' || !node.children) {
          continue;
        }
        const child = node.children.find((item) => item.key === key);
        if (child && child.note.title !== value) {
          props.onRenameNote(child.note, value);
          return;
        }
      }
    }
  }, [editingKey, editingValue, props]);

  const notebookMenu = useCallback(
    (notebook: Notebook): MenuProps['items'] => [
      {
        key: 'new-note',
        icon: <PlusOutlined />,
        label: messages.note.newNote,
        onClick: () => props.onNewNote(notebook),
      },
      {
        key: 'rename',
        icon: <EditOutlined />,
        label: messages.notebook.rename,
        onClick: () => beginEditing(`notebook-${notebook.id}`, notebook.name),
      },
      { type: 'divider' },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: messages.notebook.delete,
        danger: true,
        onClick: () =>
          confirmAction(
            messages.notebook.delete,
            `${messages.notebook.deleteWarning}「${notebook.name}」`,
            () => props.onDeleteNotebook(notebook),
          ),
      },
    ],
    [props, beginEditing, confirmAction],
  );

  const noteMenu = useCallback(
    (note: Note): MenuProps['items'] => [
      {
        key: 'rename',
        icon: <EditOutlined />,
        label: messages.note.rename,
        onClick: () => beginEditing(`note-${note.entryId}`, note.title),
      },
      { type: 'divider' },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: messages.note.delete,
        danger: true,
        onClick: () =>
          confirmAction(
            messages.note.delete,
            `${messages.note.deleteWarning}「${note.title}」`,
            () => props.onDeleteNote(note),
          ),
      },
    ],
    [props, beginEditing, confirmAction],
  );

  const renderNoteRow = useCallback(
    (node: Extract<TreeNode, { type: 'note' }>, depth: number) => {
      const isSelected = props.selectedNoteId === node.key;
      const isEditing = editingKey === node.key;

      return (
        <Dropdown key={node.key} menu={{ items: noteMenu(node.note) }} trigger={['contextMenu']}>
          <div
            className={`sidebar-tree-row note-row ${isSelected ? 'selected' : ''}`}
            style={{ paddingLeft: `${36 + depth * 16}px` }}
            onClick={() => props.onSelectNote(node.note)}
          >
            <span className="sidebar-tree-icon">
              <FileTextOutlined />
            </span>
            {isEditing ? (
              <Input
                className="sidebar-tree-edit"
                value={editingValue}
                onChange={(event) => setEditingValue(event.target.value)}
                onPressEnter={commitEditing}
                onBlur={commitEditing}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setEditingKey(null);
                  }
                }}
                onClick={(event) => event.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="sidebar-tree-title" title={node.title}>
                {node.title}
              </span>
            )}
          </div>
        </Dropdown>
      );
    },
    [props, editingKey, editingValue, noteMenu, commitEditing],
  );

  const renderNotebookNode = useCallback(
    (node: Extract<TreeNode, { type: 'notebook' }>, depth: number) => {
      const isExpanded = props.expandedKeys.includes(node.key);
      const isEditing = editingKey === node.key;

      return (
        <div key={node.key} className="sidebar-tree-notebook">
          <Dropdown menu={{ items: notebookMenu(node.notebook) }} trigger={['contextMenu']}>
            <div
              className={`sidebar-tree-row ${isExpanded ? 'expanded' : ''}`}
              style={{ paddingLeft: `${12 + depth * 16}px` }}
              onClick={() => props.onExpandNotebook(node.notebook, !isExpanded)}
            >
              <span className="sidebar-tree-icon">
                {isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
              </span>
              <span className="sidebar-tree-icon">
                <FolderOutlined />
              </span>
              {isEditing ? (
                <Input
                  className="sidebar-tree-edit"
                  value={editingValue}
                  onChange={(event) => setEditingValue(event.target.value)}
                  onPressEnter={commitEditing}
                  onBlur={commitEditing}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setEditingKey(null);
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span className="sidebar-tree-title" title={node.title}>
                  {node.title}
                </span>
              )}
            </div>
          </Dropdown>
          {isExpanded && node.children && (
            <div className="sidebar-tree-children">
              {node.children.map((child) => renderNoteRow(child, depth + 1))}
            </div>
          )}
        </div>
      );
    },
    [props, editingKey, editingValue, notebookMenu, commitEditing, renderNoteRow],
  );

  const handleResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setIsResizing(true);

      const startX = event.clientX;
      const startWidth = props.width;

      const handleMove = (moveEvent: MouseEvent) => {
        const next = Math.max(200, Math.min(400, startWidth + moveEvent.clientX - startX));
        props.onWidthChange(next);
      };
      const handleUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [props],
  );

  return (
    <div className="sidebar" style={{ width: props.width }}>
      <div className="sidebar-header">
        <span className="sidebar-title">笔记本</span>
        <Tooltip title={messages.notebook.newNotebook}>
          <button
            type="button"
            className="sidebar-new-button"
            onClick={props.onNewNotebook}
            aria-label={messages.notebook.newNotebook}
          >
            <PlusOutlined />
          </button>
        </Tooltip>
      </div>
      <div className="sidebar-tree">
        {props.treeData.map((node) =>
          node.type === 'notebook' ? renderNotebookNode(node, 0) : renderNoteRow(node, 0),
        )}
      </div>
      <div
        className={`sidebar-resizer ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}
