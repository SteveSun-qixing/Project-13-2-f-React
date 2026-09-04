/**
 * 富文本基础卡片文件构建与解析测试
 */

import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import {
  buildRichTextCardFiles,
  parseRichTextCardFiles,
  buildRichTextNoteConfig,
  buildDefaultCoverHtml,
  buildMarkdownResourcePath,
  shouldUseFileStorage,
  countMarkdownBytes,
} from '../../src/services/richtext-card';

const BASE_INPUT = {
  cardId: 'a1B2c3D4e5',
  baseCardId: 'f6G7h8I9j0',
  title: '测试笔记',
  createdAt: '2026-09-03T00:00:00.000Z',
  modifiedAt: '2026-09-03T01:00:00.000Z',
};

describe('shouldUseFileStorage', () => {
  it('短内容使用内联存储', () => {
    expect(shouldUseFileStorage('# 标题\n\n短内容')).toBe(false);
  });

  it('超过 200 个纯文本字符时使用文件存储', () => {
    const longText = `内容${'字'.repeat(200)}`;
    expect(shouldUseFileStorage(longText)).toBe(true);
  });

  it('Markdown 语法标记不计入纯文本长度', () => {
    // 198 个纯文本字符 + 大量语法标记，应仍为 inline
    const text = `**${'字'.repeat(99)}** *${'词'.repeat(99)}*`;
    expect(shouldUseFileStorage(text)).toBe(false);
  });
});

describe('buildRichTextNoteConfig', () => {
  it('内联模式写入 content_text 与完整能力声明', () => {
    const config = buildRichTextNoteConfig('# 标题\n\n正文', BASE_INPUT.baseCardId);
    expect(config.card_type).toBe('base.richtext');
    expect(config.content_format).toBe('markdown');
    expect(config.content_source).toBe('inline');
    expect(config.content_text).toBe('# 标题\n\n正文');
    expect(config.content_file).toBeUndefined();
    expect(Object.keys(config.markdown_capabilities).sort()).toEqual(
      ['commonmark', 'gfm', 'highlight', 'math', 'subscript', 'superscript', 'underline'].sort(),
    );
    expect(config.locale).toBe('zh-CN');
  });

  it('长内容自动切换为 file 模式并引用 .md 资源', () => {
    const markdown = `内容${'字'.repeat(300)}`;
    const config = buildRichTextNoteConfig(markdown, BASE_INPUT.baseCardId);
    expect(config.content_source).toBe('file');
    expect(config.content_file).toBe(`richtext/${BASE_INPUT.baseCardId}.md`);
    expect(config.content_text).toBeUndefined();
  });
});

describe('buildRichTextCardFiles', () => {
  it('metadata.yaml 应符合规范字段', () => {
    const files = buildRichTextCardFiles({ ...BASE_INPUT, markdown: '# 测试' });
    const metadata = YAML.parse(files.metadataYaml);
    expect(metadata).toMatchObject({
      chip_standards_version: '1.0.0',
      card_id: BASE_INPUT.cardId,
      name: '测试笔记',
      created_at: BASE_INPUT.createdAt,
      modified_at: BASE_INPUT.modifiedAt,
      cover_ratio: '3:4',
    });
  });

  it('structure.yaml 应包含单个 base.richtext 基础卡片与 manifest', () => {
    const files = buildRichTextCardFiles({ ...BASE_INPUT, markdown: '# 测试' });
    const structure = YAML.parse(files.structureYaml);
    expect(structure.structure).toHaveLength(1);
    expect(structure.structure[0]).toMatchObject({
      id: BASE_INPUT.baseCardId,
      type: 'base.richtext',
    });
    expect(structure.manifest).toMatchObject({ card_count: 1, resource_count: 0 });
    expect(structure.manifest.resources).toEqual([]);
  });

  it('file 模式应在 manifest 登记资源并携带 .md 资源内容', () => {
    const markdown = `内容${'字'.repeat(300)}`;
    const files = buildRichTextCardFiles({ ...BASE_INPUT, markdown });
    expect(files.markdownResource).toBeDefined();
    expect(files.markdownResource?.path).toBe(`richtext/${BASE_INPUT.baseCardId}.md`);
    expect(files.markdownResource?.content.length).toBeGreaterThan(0);

    const structure = YAML.parse(files.structureYaml);
    expect(structure.manifest.resource_count).toBe(1);
    expect(structure.manifest.resources[0]).toMatchObject({
      path: `richtext/${BASE_INPUT.baseCardId}.md`,
      type: 'text/markdown',
    });
    expect(structure.manifest.resources[0].size).toBe(countMarkdownBytes(markdown));
  });

  it('cover.html 应为标准 HTML 文档并包含标题', () => {
    const files = buildRichTextCardFiles({ ...BASE_INPUT, markdown: '' });
    expect(files.coverHtml).toContain('<!doctype html>');
    expect(files.coverHtml).toContain('lang="zh-CN"');
    expect(files.coverHtml).toContain('测试笔记');
  });

  it('标题中的 HTML 特殊字符应转义', () => {
    const files = buildRichTextCardFiles({ ...BASE_INPUT, title: '<b>&</b>', markdown: '' });
    expect(files.coverHtml).toContain('&lt;b&gt;&amp;&lt;/b&gt;');
    expect(files.coverHtml).not.toContain('<b>');
  });
});

describe('parseRichTextCardFiles', () => {
  it('应完整解析内联卡片', () => {
    const files = buildRichTextCardFiles({ ...BASE_INPUT, markdown: '# 解析测试' });
    const document = parseRichTextCardFiles({
      metadataYaml: files.metadataYaml,
      structureYaml: files.structureYaml,
      contentYaml: files.contentYaml,
    });
    expect(document.cardId).toBe(BASE_INPUT.cardId);
    expect(document.baseCardId).toBe(BASE_INPUT.baseCardId);
    expect(document.title).toBe('测试笔记');
    expect(document.config.content_source).toBe('inline');
    expect(document.markdown).toBe('# 解析测试');
  });

  it('应解析 file 模式卡片并读取 .md 资源内容', () => {
    const markdown = `内容${'字'.repeat(300)}`;
    const files = buildRichTextCardFiles({ ...BASE_INPUT, markdown });
    const document = parseRichTextCardFiles({
      metadataYaml: files.metadataYaml,
      structureYaml: files.structureYaml,
      contentYaml: files.contentYaml,
      markdownResourceContent: files.markdownResource?.content,
    });
    expect(document.config.content_source).toBe('file');
    expect(document.config.content_file).toBe(buildMarkdownResourcePath(BASE_INPUT.baseCardId));
    expect(document.markdown).toBe(files.markdownResource?.content);
  });

  it('结构缺少基础卡片 ID 时应抛出错误', () => {
    expect(() =>
      parseRichTextCardFiles({
        metadataYaml: filesEmptyMetadata,
        structureYaml: 'structure: []\nmanifest: { card_count: 0, resource_count: 0 }',
        contentYaml: 'card_type: base.richtext',
      }),
    ).toThrow();
  });

  it('能力声明缺失时按读取归一填充', () => {
    const contentYaml = YAML.stringify({
      card_type: 'base.richtext',
      content_format: 'markdown',
      content_source: 'inline',
      content_text: 'hi',
    });
    const document = parseRichTextCardFiles({
      metadataYaml: filesEmptyMetadata,
      structureYaml: YAML.stringify({ structure: [{ id: 'f6G7h8I9j0', type: 'base.richtext' }], manifest: { card_count: 1, resource_count: 0 } }),
      contentYaml,
    });
    expect(document.config.markdown_capabilities.commonmark).toBe(true);
    expect(document.config.markdown_capabilities.math).toBe(false);
  });
});

describe('buildDefaultCoverHtml', () => {
  it('应包含 viewport 与居中样式', () => {
    const html = buildDefaultCoverHtml('标题');
    expect(html).toContain('viewport');
    expect(html).toContain('place-items: center');
  });
});

const filesEmptyMetadata = YAML.stringify({
  chip_standards_version: '1.0.0',
  card_id: 'a1B2c3D4e5',
  name: '测试',
  created_at: '2026-09-03T00:00:00.000Z',
  modified_at: '2026-09-03T00:00:00.000Z',
});
