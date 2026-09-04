/**
 * 常量定义测试
 */

import { describe, it, expect } from 'vitest';
import {
  CHIP_STANDARDS_VERSION,
  NOTE_FILE_EXTENSION,
  NOTEBOOK_FILE_EXTENSION,
  NOTEBOOK_LAYOUT_TYPE,
  RICHTEXT_CARD_TYPE,
  RICHTEXT_CONTENT_FORMAT,
  RUNTIME_DIR_NAME,
  NOTES_CONFIG_KEY,
  MAX_INLINE_RICHTEXT_LENGTH,
  RICHTEXT_RESOURCE_DIR,
  DEFAULT_COVER_RATIO,
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  AUTO_SAVE_DEBOUNCE_MS,
  WORKSPACE_DIR_NAME,
} from '../../src/lib/constants';

describe('核心常量', () => {
  it('CHIP_STANDARDS_VERSION 应为 1.0.0', () => {
    expect(CHIP_STANDARDS_VERSION).toBe('1.0.0');
  });

  it('NOTE_FILE_EXTENSION 应为 .card', () => {
    expect(NOTE_FILE_EXTENSION).toBe('.card');
  });

  it('NOTEBOOK_FILE_EXTENSION 应为 .box', () => {
    expect(NOTEBOOK_FILE_EXTENSION).toBe('.box');
  });

  it('NOTEBOOK_LAYOUT_TYPE 应为文档库布局', () => {
    expect(NOTEBOOK_LAYOUT_TYPE).toBe('chips.layout.documentlibrary.blp');
  });

  it('RICHTEXT_CARD_TYPE 应为 base.richtext', () => {
    expect(RICHTEXT_CARD_TYPE).toBe('base.richtext');
  });

  it('RICHTEXT_CONTENT_FORMAT 应为 markdown', () => {
    expect(RICHTEXT_CONTENT_FORMAT).toBe('markdown');
  });

  it('RUNTIME_DIR_NAME 应为隐藏的运行时目录', () => {
    expect(RUNTIME_DIR_NAME).toBe('.chips-notes-runtime');
  });

  it('NOTES_CONFIG_KEY 应使用插件命名空间', () => {
    expect(NOTES_CONFIG_KEY).toBe('chips.notes.config');
  });

  it('内联阈值应为 200 个纯文本字符', () => {
    expect(MAX_INLINE_RICHTEXT_LENGTH).toBe(200);
  });

  it('Markdown 资源目录应为 richtext', () => {
    expect(RICHTEXT_RESOURCE_DIR).toBe('richtext');
  });

  it('默认封面比例应为 3:4', () => {
    expect(DEFAULT_COVER_RATIO).toBe('3:4');
  });

  it('侧边栏宽度区间应包含默认值', () => {
    expect(MIN_SIDEBAR_WIDTH).toBeLessThan(DEFAULT_SIDEBAR_WIDTH);
    expect(DEFAULT_SIDEBAR_WIDTH).toBeLessThan(MAX_SIDEBAR_WIDTH);
  });

  it('自动保存防抖延迟应为 500ms', () => {
    expect(AUTO_SAVE_DEBOUNCE_MS).toBe(500);
  });

  it('WORKSPACE_DIR_NAME 应为 ChipsNotes', () => {
    expect(WORKSPACE_DIR_NAME).toBe('ChipsNotes');
  });
});
