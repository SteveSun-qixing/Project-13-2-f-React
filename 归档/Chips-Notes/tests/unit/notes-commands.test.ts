/**
 * 命令定义测试
 */

import { describe, it, expect } from 'vitest';
import {
  createNotesCommands,
  type NotesCommandHandlers,
  type NotesCommandRuntime,
} from '../../src/commands/notes-commands';

describe('薯片笔记命令', () => {
  const stubHandlers: NotesCommandHandlers = {
    newNotebook: () => undefined,
    newNote: () => undefined,
    save: () => undefined,
    deleteCurrent: () => undefined,
    formatBold: () => undefined,
    formatItalic: () => undefined,
  };

  const readyRuntime: NotesCommandRuntime = {
    isReady: true,
    hasNotebook: true,
    hasCurrentNote: true,
  };

  it('应创建 6 个命令', () => {
    const commands = createNotesCommands(stubHandlers, readyRuntime);
    expect(commands).toHaveLength(6);
  });

  it('应包含新建笔记本命令并使用 Mod+Shift+N 快捷键', () => {
    const commands = createNotesCommands(stubHandlers, readyRuntime);
    const cmd = commands.find((c) => c.id === 'notes.new-notebook');
    expect(cmd).toBeDefined();
    expect(cmd?.shortcut).toBe('Mod+Shift+N');
  });

  it('应包含新建笔记命令并使用 Mod+N 快捷键', () => {
    const commands = createNotesCommands(stubHandlers, readyRuntime);
    const cmd = commands.find((c) => c.id === 'notes.new-note');
    expect(cmd).toBeDefined();
    expect(cmd?.shortcut).toBe('Mod+N');
  });

  it('应包含保存命令并使用 Mod+S 快捷键', () => {
    const commands = createNotesCommands(stubHandlers, readyRuntime);
    const cmd = commands.find((c) => c.id === 'notes.save');
    expect(cmd).toBeDefined();
    expect(cmd?.shortcut).toBe('Mod+S');
  });

  it('应包含加粗与斜体命令', () => {
    const commands = createNotesCommands(stubHandlers, readyRuntime);
    const bold = commands.find((c) => c.id === 'notes.format-bold');
    const italic = commands.find((c) => c.id === 'notes.format-italic');
    expect(bold).toBeDefined();
    expect(italic).toBeDefined();
    expect(bold?.shortcut).toBe('Mod+B');
    expect(italic?.shortcut).toBe('Mod+I');
  });

  it('所有命令都有 run 处理函数与合法 id 命名空间', () => {
    const commands = createNotesCommands(stubHandlers, readyRuntime);
    for (const cmd of commands) {
      expect(typeof cmd.run).toBe('function');
      expect(cmd.id.startsWith('notes.')).toBe(true);
    }
  });

  it('工作区未就绪时全部命令应禁用', () => {
    const commands = createNotesCommands(stubHandlers, {
      isReady: false,
      hasNotebook: true,
      hasCurrentNote: true,
    });
    for (const cmd of commands) {
      expect(cmd.enabled).toBe(false);
    }
  });

  it('没有笔记时保存 / 删除 / 格式化命令应禁用', () => {
    const commands = createNotesCommands(stubHandlers, {
      isReady: true,
      hasNotebook: true,
      hasCurrentNote: false,
    });
    const disabledIds = ['notes.save', 'notes.delete', 'notes.format-bold', 'notes.format-italic'];
    for (const id of disabledIds) {
      expect(commands.find((cmd) => cmd.id === id)?.enabled).toBe(false);
    }
    expect(commands.find((cmd) => cmd.id === 'notes.new-notebook')?.enabled).toBe(true);
  });
});
