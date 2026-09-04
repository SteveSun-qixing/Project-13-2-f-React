/**
 * 笔记本（箱子）类型定义
 *
 * 每个笔记本对应一个符合《Chips 箱子文件规范》的 `.box` 文件，
 * 笔记以内嵌卡片形式保存在箱子内部。
 */

import type { Note } from './note';

/**
 * 笔记本信息，对应一个 `.box` 箱子文件
 */
export interface Notebook {
  /** 箱子 ID（box_id，10 位 Base62） */
  id: string;
  /** 笔记本名称 */
  name: string;
  /** 箱子文件路径 */
  path: string;
  /** 最近修改时间 */
  modifiedAt: string;
}

/**
 * 笔记树节点
 */
export interface NoteTreeNode {
  /** 唯一标识（note-<entryId>） */
  key: string;
  /** 显示标题 */
  title: string;
  /** 节点类型 */
  type: 'note';
  /** 笔记详情 */
  note: Note;
  /** 是否叶子节点 */
  isLeaf: true;
}

/**
 * 笔记本树节点
 */
export interface NotebookTreeNode {
  /** 唯一标识（notebook-<boxId>） */
  key: string;
  /** 显示标题 */
  title: string;
  /** 节点类型 */
  type: 'notebook';
  /** 笔记本详情 */
  notebook: Notebook;
  /** 子节点（仅展开后填充） */
  children?: NoteTreeNode[];
}

/**
 * 目录树节点联合类型
 */
export type TreeNode = NotebookTreeNode | NoteTreeNode;
