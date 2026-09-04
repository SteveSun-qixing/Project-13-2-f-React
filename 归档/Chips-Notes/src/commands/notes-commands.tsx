/**
 * 薯片笔记命令定义
 *
 * 命令与 @chips/ui 的 CommandProvider / CommandPalette 联动，
 * handlers 由场景层提供真实实现，runtime 描述命令可用状态。
 */

import type { CommandItem } from '@chips/ui';
import {
  FileAddOutlined,
  FolderAddOutlined,
  SaveOutlined,
  DeleteOutlined,
  BoldOutlined,
  ItalicOutlined,
} from '@ant-design/icons';

/** 命令处理器集合（由 NotesScene 提供） */
export interface NotesCommandHandlers {
  /** 新建笔记本（打开命名对话框） */
  newNotebook: () => void;
  /** 新建笔记（打开命名对话框） */
  newNote: () => void;
  /** 立即保存当前笔记 */
  save: () => void;
  /** 删除当前笔记 */
  deleteCurrent: () => void;
  /** 加粗选中文本 */
  formatBold: () => void;
  /** 斜体选中文本 */
  formatItalic: () => void;
}

/** 命令运行时状态（控制 enabled） */
export interface NotesCommandRuntime {
  /** 工作区是否就绪 */
  isReady: boolean;
  /** 是否存在至少一个笔记本 */
  hasNotebook: boolean;
  /** 是否有当前打开的笔记 */
  hasCurrentNote: boolean;
}

export function createNotesCommands(
  handlers: NotesCommandHandlers,
  runtime: NotesCommandRuntime,
): CommandItem[] {
  const ready = runtime.isReady;
  return [
    {
      id: 'notes.new-notebook',
      title: '新建笔记本',
      shortcut: 'Mod+Shift+N',
      icon: <FolderAddOutlined />,
      group: '文件',
      menuId: 'file',
      toolbarId: 'main',
      keywords: ['笔记本', '新建'],
      enabled: ready,
      run: handlers.newNotebook,
    },
    {
      id: 'notes.new-note',
      title: '新建笔记',
      shortcut: 'Mod+N',
      icon: <FileAddOutlined />,
      group: '文件',
      menuId: 'file',
      toolbarId: 'main',
      keywords: ['笔记', '新建'],
      enabled: ready && runtime.hasNotebook,
      run: handlers.newNote,
    },
    {
      id: 'notes.save',
      title: '保存笔记',
      shortcut: 'Mod+S',
      icon: <SaveOutlined />,
      group: '文件',
      menuId: 'file',
      toolbarId: 'main',
      keywords: ['保存'],
      enabled: ready && runtime.hasCurrentNote,
      run: handlers.save,
    },
    {
      id: 'notes.delete',
      title: '删除笔记',
      icon: <DeleteOutlined />,
      group: '文件',
      menuId: 'file',
      keywords: ['删除'],
      enabled: ready && runtime.hasCurrentNote,
      run: handlers.deleteCurrent,
    },
    {
      id: 'notes.format-bold',
      title: '加粗',
      shortcut: 'Mod+B',
      icon: <BoldOutlined />,
      group: '格式',
      menuId: 'edit',
      toolbarId: 'editor',
      keywords: ['加粗', '粗体'],
      enabled: ready && runtime.hasCurrentNote,
      run: handlers.formatBold,
    },
    {
      id: 'notes.format-italic',
      title: '斜体',
      shortcut: 'Mod+I',
      icon: <ItalicOutlined />,
      group: '格式',
      menuId: 'edit',
      toolbarId: 'editor',
      keywords: ['斜体', '倾斜'],
      enabled: ready && runtime.hasCurrentNote,
      run: handlers.formatItalic,
    },
  ];
}
