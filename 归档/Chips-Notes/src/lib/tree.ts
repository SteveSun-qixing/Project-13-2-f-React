/**
 * 目录树数据构建
 *
 * 由笔记本（箱子）列表与展开状态构建目录树：
 * 笔记本为一级节点，展开后从箱子条目快照解析出的笔记列表挂载为二级节点。
 */

import type { Note, Notebook, TreeNode } from '../types';

export interface TreeSource {
  notebooks: Notebook[];
  /** 展开的笔记本 ID 集合 */
  expandedNotebookIds: string[];
  /** 各笔记本的笔记列表（key = 箱子 boxId） */
  notesByNotebook: Record<string, Note[]>;
}

/**
 * 构建目录树数据
 */
export function buildTreeData(source: TreeSource): TreeNode[] {
  return source.notebooks.map((notebook) => {
    const expanded = source.expandedNotebookIds.includes(notebook.id);
    const notes = source.notesByNotebook[notebook.id];
    return {
      key: `notebook-${notebook.id}`,
      title: notebook.name,
      type: 'notebook' as const,
      notebook,
      ...(expanded && notes
        ? {
            children: notes.map(
              (note): Extract<TreeNode, { type: 'note' }> => ({
                key: `note-${note.entryId}`,
                title: note.title,
                type: 'note',
                note,
                isLeaf: true,
              }),
            ),
          }
        : {}),
    };
  });
}
