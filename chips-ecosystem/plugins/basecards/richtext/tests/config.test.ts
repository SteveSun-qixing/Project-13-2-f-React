import { describe, expect, it } from 'vitest';
import {
  CARD_TYPE_ID,
  DEFAULT_CAPABILITIES,
  DEFAULT_DISPLAY_CONFIG,
  buildContent,
  inlineStorageGate,
  readContent,
  readDisplayConfig,
  validateConfig,
  validateRichTextContent,
} from '../src/config';
import { createInitialContent } from '../src/main';

/** 旧 schema/card-config.ts 归一与校验面迁移：内容字段、展示配置与内容组装。 */
describe('readContent', () => {
  it('空输入回退默认：inline、空正文、zh-CN、全能力矩阵', () => {
    const resolved = readContent(undefined);
    expect(resolved.card_type).toBe(CARD_TYPE_ID);
    expect(resolved.content_source).toBe('inline');
    expect(resolved.content_text).toBe('');
    expect(resolved.locale).toBe('zh-CN');
    expect(resolved.markdown_capabilities).toEqual(DEFAULT_CAPABILITIES);
  });

  it('file 来源按 content_file 推断并归一路径', () => {
    const resolved = readContent({ content_file: 'richtext/note.md' });
    expect(resolved.content_source).toBe('file');
    expect(resolved.content_file).toBe('richtext/note.md');
    expect(resolved['content_text']).toBeUndefined();
  });

  it('能力矩阵缺省字段回退 true、显式 false 保留', () => {
    const resolved = readContent({ markdown_capabilities: { math: false } });
    expect(resolved.markdown_capabilities.math).toBe(false);
    expect(resolved.markdown_capabilities.gfm).toBe(true);
  });
});

describe('readDisplayConfig', () => {
  it('缺失回退默认值，越界同样回退', () => {
    expect(readDisplayConfig(undefined)).toEqual(DEFAULT_DISPLAY_CONFIG);
    expect(readDisplayConfig({ config: { fontSize: 8, lineHeight: 0.5 } })).toEqual(DEFAULT_DISPLAY_CONFIG);
    expect(readDisplayConfig({ config: { fontSize: 20, lineHeight: 1.8 } })).toEqual({
      fontSize: 20,
      lineHeight: 1.8,
    });
  });
});

describe('validateConfig（展示配置，与 configSchema 同口径）', () => {
  it('undefined / null 必须通过', () => {
    expect(validateConfig(undefined)).toBe(true);
    expect(validateConfig(null)).toBe(true);
  });

  it('字号整数 12~48、行高 ≥1', () => {
    expect(validateConfig({ fontSize: 16, lineHeight: 1.6 })).toBe(true);
    expect(validateConfig({ fontSize: 16.5 })).toBe(false);
    expect(validateConfig({ fontSize: 11 })).toBe(false);
    expect(validateConfig({ fontSize: 49 })).toBe(false);
    expect(validateConfig({ lineHeight: 0.9 })).toBe(false);
    expect(validateConfig('nope')).toBe(false);
  });
});

describe('validateRichTextContent（内容字段）', () => {
  it('初始内容与合法 inline 内容通过', () => {
    expect(validateRichTextContent(createInitialContent()).valid).toBe(true);
  });

  it('inline 空正文拒绝、file 非法路径拒绝、互斥字段拒绝', () => {
    expect(validateRichTextContent({ content_text: '' }).errors['content_text']).toBe(
      'Markdown 内容不能为空'
    );
    expect(validateRichTextContent({ content_source: 'file', content_file: 'note.txt' }).errors['content_file']).toBe(
      'content_file 必须为卡片根目录相对 .md 路径'
    );
    expect(
      validateRichTextContent({ content_source: 'inline', content_text: '正文', content_file: 'a.md' }).errors[
        'content_source'
      ]
    ).toBe('inline 模式下不能同时保存 content_file');
  });
});

describe('buildContent 与存储闸', () => {
  it('组装内容带展示 config 并按来源二选一出料', () => {
    const inline = buildContent({ content_text: '# 标题' }, { fontSize: 20, lineHeight: 2 });
    expect(inline['card_type']).toBe(CARD_TYPE_ID);
    expect(inline['content_text']).toBe('# 标题');
    expect(inline['config']).toEqual({ fontSize: 20, lineHeight: 2 });
    expect(inline['content_file']).toBeUndefined();

    const file = buildContent({ content_source: 'file', content_file: 'richtext/note.md' });
    expect(file['content_file']).toBe('richtext/note.md');
    expect(file['content_text']).toBeUndefined();
  });

  it('200 字阈值提示口径：短文内联、长文文件化', () => {
    expect(inlineStorageGate('字'.repeat(200)).shouldUseFile).toBe(false);
    expect(inlineStorageGate('字'.repeat(201)).shouldUseFile).toBe(true);
  });
});

describe('createInitialContent（主进程纯函数口径）', () => {
  it('通过内容校验与展示配置校验，正文为默认富文本', () => {
    const content = createInitialContent();
    expect(content['card_type']).toBe(CARD_TYPE_ID);
    expect(content['content_source']).toBe('inline');
    expect(validateConfig(content['config'])).toBe(true);
    expect(validateRichTextContent(content).valid).toBe(true);
    expect((content['config'] as Record<string, unknown>)['fontSize']).toBe(DEFAULT_DISPLAY_CONFIG.fontSize);
  });
});
