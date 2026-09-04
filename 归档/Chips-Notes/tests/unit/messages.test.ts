/**
 * 消息文案测试
 */

import { describe, it, expect } from 'vitest';
import { messages } from '../../src/lib/messages';

describe('界面文案', () => {
  it('应用名称应为薯片笔记', () => {
    expect(messages.appName).toBe('薯片笔记');
  });

  it('应包含笔记本相关文案', () => {
    expect(messages.notebook.newNotebook).toBe('新建笔记本');
    expect(messages.notebook.rename).toBe('重命名');
    expect(messages.notebook.delete).toBe('删除笔记本');
    expect(messages.notebook.confirmDelete).toContain('确定');
  });

  it('应包含笔记相关文案', () => {
    expect(messages.note.newNote).toBe('新建笔记');
    expect(messages.note.defaultTitle).toBe('无标题笔记');
  });

  it('应包含编辑器相关文案', () => {
    expect(messages.editor.untitled).toBe('无标题');
    expect(messages.editor.modified).toBe('已修改');
    expect(messages.editor.saved).toBe('已保存');
    expect(messages.editor.saving).toBe('保存中...');
  });

  it('应包含工具栏相关文案', () => {
    expect(messages.toolbar.bold).toBe('加粗');
    expect(messages.toolbar.italic).toBe('斜体');
    expect(messages.toolbar.heading1).toBe('标题1');
    expect(messages.toolbar.bulletList).toBe('无序列表');
    expect(messages.toolbar.orderedList).toBe('有序列表');
    expect(messages.toolbar.code).toBe('行内代码');
    expect(messages.toolbar.link).toBe('链接');
  });

  it('应包含空状态文案', () => {
    expect(messages.empty.noNote).toContain('笔记');
    expect(messages.empty.noNotebook).toContain('笔记本');
  });

  it('应包含错误文案', () => {
    expect(messages.error.saveFailed).toBe('保存失败');
    expect(messages.error.notebookLoadFailed).toContain('笔记本');
  });
});
