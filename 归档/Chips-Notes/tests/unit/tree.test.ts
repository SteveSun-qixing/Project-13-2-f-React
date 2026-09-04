/**
 * 目录树构建测试
 */

import { describe, it, expect } from 'vitest';
import { buildTreeData } from '../../src/lib/tree';
import type { Note, Notebook } from '../../src/types';

const notebookA: Notebook = {
  id: 'boxAAAAAAA',
  name: '工作笔记',
  path: '/workspace/工作笔记.box',
  modifiedAt: '2026-09-03T00:00:00.000Z',
};

const notebookB: Notebook = {
  id: 'boxBBBBBBB',
  name: '生活笔记',
  path: '/workspace/生活笔记.box',
  modifiedAt: '2026-09-02T00:00:00.000Z',
};

const note1: Note = {
  entryId: 'entryAAAAA1',
  cardId: 'cardAAAAA1',
  notebookId: notebookA.id,
  notebookPath: notebookA.path,
  url: '会议记录.card',
  title: '会议记录',
  summary: '本周例会要点',
  modifiedAt: '2026-09-03T01:00:00.000Z',
};

const note2: Note = {
  entryId: 'entryAAAAA2',
  cardId: 'cardAAAAA2',
  notebookId: notebookA.id,
  notebookPath: notebookA.path,
  url: '待办事项.card',
  title: '待办事项',
  summary: '',
  modifiedAt: '2026-09-03T02:00:00.000Z',
};

describe('buildTreeData', () => {
  it('无笔记本时返回空数组', () => {
    expect(buildTreeData({ notebooks: [], expandedNotebookIds: [], notesByNotebook: {} })).toEqual([]);
  });

  it('收起状态的笔记本节点不含子节点', () => {
    const tree = buildTreeData({
      notebooks: [notebookA],
      expandedNotebookIds: [],
      notesByNotebook: { [notebookA.id]: [note1] },
    });
    expect(tree).toHaveLength(1);
    const node = tree[0];
    expect(node).toMatchObject({
      key: `notebook-${notebookA.id}`,
      title: '工作笔记',
      type: 'notebook',
    });
    if (node.type === 'notebook') {
      expect(node.children).toBeUndefined();
    }
  });

  it('展开的笔记本节点挂载笔记子节点', () => {
    const tree = buildTreeData({
      notebooks: [notebookA],
      expandedNotebookIds: [notebookA.id],
      notesByNotebook: { [notebookA.id]: [note1, note2] },
    });
    const node = tree[0];
    expect(node.type === 'notebook' && node.children).toBeTruthy();
    if (node.type === 'notebook' && node.children) {
      expect(node.children).toHaveLength(2);
      expect(node.children[0]).toMatchObject({
        key: `note-${note1.entryId}`,
        title: '会议记录',
        type: 'note',
        isLeaf: true,
      });
      expect(node.children[0].note).toBe(note1);
    }
  });

  it('展开但尚未加载笔记列表时不含子节点', () => {
    const tree = buildTreeData({
      notebooks: [notebookA],
      expandedNotebookIds: [notebookA.id],
      notesByNotebook: {},
    });
    const node = tree[0];
    if (node.type === 'notebook') {
      expect(node.children).toBeUndefined();
    }
  });

  it('多个笔记本各自独立挂载', () => {
    const tree = buildTreeData({
      notebooks: [notebookA, notebookB],
      expandedNotebookIds: [notebookB.id],
      notesByNotebook: { [notebookB.id]: [note1] },
    });
    expect(tree).toHaveLength(2);
    const aNode = tree.find((node) => node.key === `notebook-${notebookA.id}`);
    const bNode = tree.find((node) => node.key === `notebook-${notebookB.id}`);
    if (aNode?.type === 'notebook') {
      expect(aNode.children).toBeUndefined();
    }
    if (bNode?.type === 'notebook') {
      expect(bNode.children).toBeTruthy();
    }
  });
});
