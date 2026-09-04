/**
 * 工作区类型与默认值测试
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_NOTES_CONFIG,
  DEFAULT_NOTEBOOK_NAME,
  DEFAULT_NOTE_TITLE,
} from '../../src/types/workspace';

describe('工作区默认值', () => {
  it('DEFAULT_NOTES_CONFIG 应有默认侧栏宽度', () => {
    expect(DEFAULT_NOTES_CONFIG.sidebarWidth).toBeGreaterThan(0);
  });

  it('DEFAULT_NOTES_CONFIG 应有空的展开笔记本列表', () => {
    expect(Array.isArray(DEFAULT_NOTES_CONFIG.expandedNotebookIds)).toBe(true);
    expect(DEFAULT_NOTES_CONFIG.expandedNotebookIds).toHaveLength(0);
  });

  it('DEFAULT_NOTES_CONFIG 不包含工作目录路径', () => {
    expect('workspacePath' in DEFAULT_NOTES_CONFIG).toBe(false);
  });

  it('DEFAULT_NOTEBOOK_NAME 默认为我的笔记本', () => {
    expect(DEFAULT_NOTEBOOK_NAME).toBe('我的笔记本');
  });

  it('DEFAULT_NOTE_TITLE 默认为无标题笔记', () => {
    expect(DEFAULT_NOTE_TITLE).toBe('无标题笔记');
  });
});
