/**
 * HTML 转换核心断言：块级映射、内联样式、资源引用、空文档、嵌套结构与转义安全臂。
 */

import { describe, expect, it } from 'vitest';

import { buildCardHtml, renderBlockValue, type IRenderContext } from '../src/html.js';
import type { ICardDocumentModel, ICardResourceEntry } from '../src/types.js';

const RESOURCES: readonly ICardResourceEntry[] = [
  { path: 'resources/pictures/photo.png', type: 'image/png', width: 100, height: 50 },
  { path: 'resources/clips/clip.mp4', type: 'video/mp4' },
  { path: 'resources/audio/take.mp3', type: 'audio/mpeg' },
  { path: 'resources/files/notes.txt', type: 'text/plain' },
];

function buildModel(overrides: Partial<ICardDocumentModel> = {}): ICardDocumentModel {
  return {
    documentId: 'card-1',
    source: '/docs/cards/demo.card',
    digest: 'digest-1',
    title: '标题',
    metadata: {
      cardId: 'card-1',
      name: '标题',
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-09-24T00:00:00Z',
      tags: ['简单', ['键', '值一', '值二']],
    },
    structure: [{ id: 'node-1', type: 'content' }],
    resources: RESOURCES,
    nodes: [{ nodeId: 'node-1', cardType: 'demo.text', value: {}, diagnostics: [] }],
    nodeWarnings: [],
    ...overrides,
  };
}

describe('转义安全臂', () => {
  it('元数据标题中的脚本标记被全量转义，不产生可执行标记', () => {
    const model = buildModel({
      metadata: { cardId: 'card-1', name: '<script>alert("x")</script>', tags: [] },
    });
    const { html } = buildCardHtml(model, { includeAssets: true });
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('内容值与卡片类型属性中的注入载荷被转义', () => {
    const model = buildModel({
      nodes: [
        {
          nodeId: 'node-1',
          cardType: 'demo.text"><svg onload=alert(1)>',
          value: { text: '<img src=x onerror=alert(1)>' },
          diagnostics: [],
        },
      ],
    });
    const { html } = buildCardHtml(model, { includeAssets: true });
    expect(html).toContain('<img src=x onerror=alert(1)>'.replace('<', '&lt;').replace(/>/g, '&gt;'));
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('data-chips-card-type="demo.text&quot;&gt;&lt;svg onload=alert(1)&gt;"');
    expect(html).not.toContain('demo.text"><svg');
  });

  it('资源路径 URL 逐段编码，属性值转义', () => {
    const model = buildModel({
      resources: [{ path: 'resources/图片 一号.png', type: 'image/png' }],
      nodes: [
        {
          nodeId: 'node-1',
          cardType: 'demo',
          value: { 图: 'resources/图片 一号.png' },
          diagnostics: [],
        },
      ],
    });
    const { html, assetReferences } = buildCardHtml(model, { includeAssets: true });
    expect(html).toContain('src="./assets/content/resources/%E5%9B%BE%E7%89%87%20%E4%B8%80%E5%8F%B7.png"');
    expect(assetReferences).toEqual(['resources/图片 一号.png']);
  });
});

describe('块级映射', () => {
  const emptyCtx = (): IRenderContext => ({
    resources: new Map<string, ICardResourceEntry>(),
    includeAssets: true,
    references: new Set<string>(),
  });

  it('标量映射为段落，null 跳过，行内换行转 <br>', () => {
    const ctx = emptyCtx();
    expect(renderBlockValue('第一行\n第二行', ctx, 0)).toBe(
      '<p class="chips-export-text">第一行<br>第二行</p>'
    );
    expect(renderBlockValue(42, ctx, 0)).toBe('<p class="chips-export-text">42</p>');
    expect(renderBlockValue(true, ctx, 0)).toBe('<p class="chips-export-text">true</p>');
    expect(renderBlockValue(null, ctx, 0)).toBe('');
  });

  it('数组映射为列表，嵌套数组递归展开', () => {
    const ctx = emptyCtx();
    const html = renderBlockValue(['甲', ['乙', '丙']], ctx, 0);
    expect(html).toContain('<ul class="chips-export-list">');
    expect(html).toContain('<li class="chips-export-list__item"><p class="chips-export-text">甲</p></li>');
    expect((html.match(/<ul class="chips-export-list">/g) ?? []).length).toBe(2);
  });

  it('映射对象映射为 dt/dd 字段，null 值字段整体跳过', () => {
    const ctx = emptyCtx();
    const html = renderBlockValue({ 标题: '值', 空值: null }, ctx, 0);
    expect(html).toContain('<dl class="chips-export-fields">');
    expect(html).toContain('<dt class="chips-export-field__key">标题</dt>');
    expect(html).toContain('<p class="chips-export-text">值</p>');
    expect(html).not.toContain('空值');
  });

  it('超过最大深度后以单行 JSON 文本收口，不失控递归', () => {
    const ctx = emptyCtx();
    let deep: unknown = '底';
    for (let index = 0; index < 10; index += 1) {
      deep = { 层: deep };
    }
    const html = renderBlockValue(deep, ctx, 0);
    expect(html).toContain('{"层":');
    expect(html).not.toContain('<dl class="chips-export-fields"><div class="chips-export-field"><dt class="chips-export-field__key">层</dt>'.repeat(7));
  });

  it('引用资源路径但路径不安全时按普通文本渲染，不进引用清单', () => {
    const ctx = {
      resources: new Map<string, ICardResourceEntry>([
        ['../escape.png', { path: '../escape.png', type: 'image/png' }],
      ]),
      includeAssets: true,
      references: new Set<string>(),
    };
    const html = renderBlockValue('../escape.png', ctx, 0);
    expect(html).toBe('<p class="chips-export-text">../escape.png</p>');
    expect(ctx.references.size).toBe(0);
  });
});

describe('资源引用', () => {
  it('图片/视频/音频/通用文件分别渲染为对应资产元素', () => {
    const model = buildModel({
      nodes: [
        {
          nodeId: 'node-1',
          cardType: 'demo',
          value: {
            图: 'resources/pictures/photo.png',
            视频: 'resources/clips/clip.mp4',
            音频: 'resources/audio/take.mp3',
            附件: 'resources/files/notes.txt',
          },
          diagnostics: [],
        },
      ],
    });
    const { html, assetReferences } = buildCardHtml(model, { includeAssets: true });
    expect(html).toContain(
      '<img class="chips-export-asset" src="./assets/content/resources/pictures/photo.png" alt="resources/pictures/photo.png" width="100" height="50">'
    );
    expect(html).toContain(
      '<video class="chips-export-asset" src="./assets/content/resources/clips/clip.mp4" controls></video>'
    );
    expect(html).toContain(
      '<audio class="chips-export-asset" src="./assets/content/resources/audio/take.mp3" controls></audio>'
    );
    expect(html).toContain(
      '<a class="chips-export-asset-link" href="./assets/content/resources/files/notes.txt">notes.txt</a>'
    );
    expect(assetReferences).toEqual([
      'resources/pictures/photo.png',
      'resources/clips/clip.mp4',
      'resources/audio/take.mp3',
      'resources/files/notes.txt',
    ]);
  });

  it('includeAssets=false 时保留包内相对引用且不进复制计划', () => {
    const model = buildModel({
      nodes: [
        {
          nodeId: 'node-1',
          cardType: 'demo',
          value: { 图: 'resources/pictures/photo.png' },
          diagnostics: [],
        },
      ],
    });
    const { html } = buildCardHtml(model, { includeAssets: false });
    expect(html).toContain('src="resources/pictures/photo.png"');
    expect(html).not.toContain('./assets/content/');
  });

  it('同一资源多次引用在引用清单中去重', () => {
    const model = buildModel({
      nodes: [
        {
          nodeId: 'node-1',
          cardType: 'demo',
          value: { 一: 'resources/pictures/photo.png', 二: 'resources/pictures/photo.png' },
          diagnostics: [],
        },
      ],
    });
    const { assetReferences } = buildCardHtml(model, { includeAssets: true });
    expect(assetReferences).toEqual(['resources/pictures/photo.png']);
  });
});

describe('布局容器与空文档', () => {
  it('产物包含舞台容器分层与卡片容器、节点 section 与头部元数据', () => {
    const { html } = buildCardHtml(buildModel(), { includeAssets: true });
    expect(html).toContain('<!doctype html><html lang="zh-CN">');
    expect(html).toContain('<div class="chips-export-stage"><div class="chips-export-stage__viewport">');
    expect(html).toContain('<article class="chips-export-card" data-chips-card-id="card-1">');
    expect(html).toContain('<section class="chips-export-node" data-chips-node-id="node-1" data-chips-card-type="demo.text">');
    expect(html).toContain('<h1 class="chips-export-card__title">标题</h1>');
    expect(html).toContain('<li class="chips-export-card__tag" data-chips-tag-key="键">键：值一 / 值二</li>');
    expect(html).toContain('<style data-chips-export-shell="card-html">');
    expect(html).toContain('<meta name="chips-digest" content="digest-1">');
  });

  it('空文档（无结构节点）产出合法空卡片产物且无引用', () => {
    const model = buildModel({ structure: [], nodes: [] });
    const { html, assetReferences } = buildCardHtml(model, { includeAssets: true });
    expect(html).toContain('<article class="chips-export-card" data-chips-card-id="card-1">');
    expect(html).not.toContain('<section class="chips-export-node"');
    expect(assetReferences).toEqual([]);
    expect(html.endsWith('</html>')).toBe(true);
  });
});
