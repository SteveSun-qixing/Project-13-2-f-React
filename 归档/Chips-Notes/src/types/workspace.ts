/**
 * 工作区类型定义
 */

/**
 * 笔记应用配置
 * 通过 client.config 以对象形式持久化（user 作用域）
 */
export interface NotesConfig {
  /** 工作目录路径（存放各笔记本 `.box` 文件的目录） */
  workspacePath: string;
  /** 上次打开的笔记本（箱子文件路径） */
  lastOpenedNotebookPath?: string;
  /** 上次打开的笔记（箱子条目 ID） */
  lastOpenedNoteEntryId?: string;
  /** 侧边栏宽度 */
  sidebarWidth: number;
  /** 展开的笔记本（箱子 ID 列表） */
  expandedNotebookIds: string[];
}

/**
 * 工作区状态
 */
export interface WorkspaceState {
  /** 配置 */
  config: NotesConfig | null;
  /** 初始化状态 */
  initialized: boolean;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 默认笔记应用配置（不包含工作目录路径）
 */
export const DEFAULT_NOTES_CONFIG: Omit<NotesConfig, 'workspacePath'> = {
  sidebarWidth: 260,
  expandedNotebookIds: [],
};

/**
 * 默认笔记本名称
 */
export const DEFAULT_NOTEBOOK_NAME = '我的笔记本';

/**
 * 默认笔记标题
 */
export const DEFAULT_NOTE_TITLE = '无标题笔记';
