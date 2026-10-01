import { describe, expect, it } from 'vitest';
import * as richtextCardModule from '../../src/domain/card/richtext-card';
import {
  DEFAULT_RICHTEXT_MARKDOWN_CAPABILITIES,
  MARKDOWN_CONTENT_FORMAT,
  RICHTEXT_CARD_TYPE,
  collectRichTextResourcePaths,
  createFileBasecardConfig,
  createInitialBasecardConfig,
  createInlineBasecardConfig,
  normalizeBasecardConfig,
} from '../../src/domain/card/richtext-card';

describe('base.richtext 内容配置模型（01-卡片文件格式 §6.1、§6.6）', () => {
  it('正式类型与格式常量对齐文档库', () => {
    expect(RICHTEXT_CARD_TYPE).toBe('base.richtext');
    expect(MARKDOWN_CONTENT_FORMAT).toBe('markdown');
  });

  it('LEGACY 兼容面零迁移：不导出旧类型别名，也不消费旧字段别名（ADR-010）', () => {
    expect('LEGACY_RICHTEXT_CARD_TYPE' in richtextCardModule).toBe(false);
    const legacyShaped = normalizeBasecardConfig({
      card_type: 'RichTextCard',
      markdown: '# 旧字段别名',
      content_format: 'markdown',
      content_source: 'inline',
      markdown_capabilities: { ...DEFAULT_RICHTEXT_MARKDOWN_CAPABILITIES },
    });
    expect(legacyShaped.card_type).toBe('base.richtext');
    expect(legacyShaped.content_source).toBe('inline');
    expect(legacyShaped.content_text).toBe('');
  });

  describe('装配面', () => {
    it('内联配置：换行归一为 LF，能力矩阵逐项显式', () => {
      const config = createInlineBasecardConfig('# 标题\r\n\r\n正文\r');
      expect(config).toMatchObject({
        card_type: 'base.richtext',
        theme: '',
        locale: 'zh-CN',
        content_format: 'markdown',
        content_source: 'inline',
        content_text: '# 标题\n\n正文\n',
      });
      expect(config.markdown_capabilities).toEqual({
        commonmark: true,
        gfm: true,
        math: true,
        highlight: true,
        underline: true,
        superscript: true,
        subscript: true,
      });
    });

    it('能力矩阵为防御性拷贝，实例改动不污染默认值', () => {
      const config = createInlineBasecardConfig('# x');
      config.markdown_capabilities.commonmark = false;
      expect(DEFAULT_RICHTEXT_MARKDOWN_CAPABILITIES.commonmark).toBe(true);
      expect(createInlineBasecardConfig('# y').markdown_capabilities.commonmark).toBe(true);
    });

    it('文件化配置：卡片根相对 .md 路径；非法路径置空交校验闸报告', () => {
      expect(createFileBasecardConfig('richtext/a1B2c3D4e5.md')).toMatchObject({
        card_type: 'base.richtext',
        content_format: 'markdown',
        content_source: 'file',
        content_file: 'richtext/a1B2c3D4e5.md',
      });
      expect(createFileBasecardConfig('/Users/demo/body.md').content_file).toBe('');
      expect('content_text' in createFileBasecardConfig('richtext/a.md')).toBe(false);
    });

    it('初始配置：以标题生成有语义的内联正文', () => {
      const config = createInitialBasecardConfig('测试文稿');
      expect(config.content_source).toBe('inline');
      expect(config.content_text).toBe('# 测试文稿\n\n');
      expect(config.locale).toBe('zh-CN');
    });
  });

  describe('资源引用收集（结构清单对照源，01 §5.3）', () => {
    it('file 来源返回归一 .md 路径，非 .md 与非法路径不入清单', () => {
      expect(
        collectRichTextResourcePaths(createFileBasecardConfig('richtext/a1B2c3D4e5.md'))
      ).toEqual(['richtext/a1B2c3D4e5.md']);
      expect(collectRichTextResourcePaths(createFileBasecardConfig('richtext/body.txt'))).toEqual(
        []
      );
      expect(collectRichTextResourcePaths(createFileBasecardConfig('../escape.md'))).toEqual([]);
    });

    it('inline 来源扫描链接、图片与内联 HTML 引用，去重并稳定排序', () => {
      const markdown = [
        '![封面](b.jpg)',
        '[链接](a.png "标题")',
        '<img src="c.png" alt="x">',
        '<a href="d.html">y</a>',
        '![重复](b.jpg)',
      ].join('\n');
      expect(collectRichTextResourcePaths(createInlineBasecardConfig(markdown))).toEqual([
        'a.png',
        'b.jpg',
        'c.png',
        'd.html',
      ]);
    });

    it('inline 来源丢弃协议化与绝对路径引用', () => {
      const markdown = [
        '![外链](https://file.example/a.png)',
        '![绝对](/Users/demo/a.png)',
        '[文本](b.png)',
      ].join('\n');
      expect(collectRichTextResourcePaths(createInlineBasecardConfig(markdown))).toEqual(['b.png']);
    });

    it('inline 空正文返回空清单', () => {
      expect(collectRichTextResourcePaths(createInlineBasecardConfig(''))).toEqual([]);
    });
  });

  describe('归一面（读取视角；正式合法性由文档校验闸裁决）', () => {
    it('空输入收敛为默认内联配置', () => {
      const config = normalizeBasecardConfig(null);
      expect(config).toMatchObject({
        card_type: 'base.richtext',
        theme: '',
        locale: 'zh-CN',
        content_format: 'markdown',
        content_source: 'inline',
        content_text: '',
      });
      expect(config.markdown_capabilities).toEqual(DEFAULT_RICHTEXT_MARKDOWN_CAPABILITIES);
    });

    it('file 来源按显式 content_source 判定', () => {
      const config = normalizeBasecardConfig({
        content_source: 'file',
        content_file: 'richtext/a1B2c3D4e5.md',
      });
      expect(config.content_source).toBe('file');
      expect(config.content_file).toBe('richtext/a1B2c3D4e5.md');
      expect('content_text' in config).toBe(false);
    });

    it('file 来源路径非法时保留 file 来源、路径置空交校验闸', () => {
      const config = normalizeBasecardConfig({ content_source: 'file', content_file: '/abs.md' });
      expect(config.content_source).toBe('file');
      expect(config.content_file).toBe('');
    });

    it('非 file 来源一律按 inline 收敛，正文做换行归一', () => {
      expect(
        normalizeBasecardConfig({ content_source: 'inline', content_text: 'a\r\nb' }).content_text
      ).toBe('a\nb');
      expect(normalizeBasecardConfig({ content_text: 42 }).content_text).toBe('');
      expect(normalizeBasecardConfig({}).content_source).toBe('inline');
    });

    it('locale 与 theme 缺省取文档默认；现存值原样保留', () => {
      expect(normalizeBasecardConfig({ locale: ' en ', theme: ' warm ' }).locale).toBe('en');
      expect(normalizeBasecardConfig({ locale: ' en ', theme: ' warm ' }).theme).toBe('warm');
      expect(normalizeBasecardConfig({ theme: '' }).theme).toBe('');
    });

    it('能力矩阵：仅显式 false 关闭，缺失与非布尔取默认 true', () => {
      expect(
        normalizeBasecardConfig({
          markdown_capabilities: { commonmark: false, gfm: 'yes', math: null },
        }).markdown_capabilities
      ).toEqual({
        commonmark: false,
        gfm: true,
        math: true,
        highlight: true,
        underline: true,
        superscript: true,
        subscript: true,
      });
      expect(normalizeBasecardConfig({}).markdown_capabilities).toEqual(
        DEFAULT_RICHTEXT_MARKDOWN_CAPABILITIES
      );
    });
  });
});
