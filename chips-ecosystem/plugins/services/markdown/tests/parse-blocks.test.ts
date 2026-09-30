/**
 * parseBlocks 结构化块断言：块模型逐型覆盖，内联面口径与 renderHtml 一致。
 */

import { describe, expect, it } from 'vitest';
import { createMarkdownService } from '../src/service.js';

const service = createMarkdownService();

describe('parseBlocks：块模型', () => {
  it('标题块携带层级与内联 HTML', async () => {
    const { document } = await service.parseBlocks({ markdown: '# 标题 **粗**' });
    expect(document.blocks).toEqual([
      { type: 'heading', level: 1, inline: { html: '标题 <strong>粗</strong>' } },
    ]);
  });

  it('段落与内联样式', async () => {
    const { document } = await service.parseBlocks({ markdown: 'a *b* `c`' });
    expect(document.blocks).toEqual([
      { type: 'paragraph', inline: { html: 'a <em>b</em> <code>c</code>' } },
    ]);
  });

  it('围栏代码块携带语言与原文', async () => {
    const { document } = await service.parseBlocks({
      markdown: '```python\nprint("hi")\n```',
    });
    expect(document.blocks).toEqual([{ type: 'code', language: 'python', text: 'print("hi")\n' }]);
  });

  it('缩进代码块语言为 null', async () => {
    const { document } = await service.parseBlocks({ markdown: '    plain code' });
    expect(document.blocks).toEqual([{ type: 'code', language: null, text: 'plain code\n' }]);
  });

  it('引用块递归为块序列', async () => {
    const { document } = await service.parseBlocks({ markdown: '> 引用段\n> > 嵌套引用' });
    expect(document.blocks).toEqual([
      {
        type: 'blockquote',
        blocks: [
          { type: 'paragraph', inline: { html: '引用段' } },
          {
            type: 'blockquote',
            blocks: [{ type: 'paragraph', inline: { html: '嵌套引用' } }],
          },
        ],
      },
    ]);
  });

  it('无序列表：紧凑项直接落为段落块', async () => {
    const { document } = await service.parseBlocks({ markdown: '- 甲\n- 乙' });
    expect(document.blocks).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          { blocks: [{ type: 'paragraph', inline: { html: '甲' } }] },
          { blocks: [{ type: 'paragraph', inline: { html: '乙' } }] },
        ],
      },
    ]);
  });

  it('有序列表：start 属性映射为 start 字段', async () => {
    const { document } = await service.parseBlocks({ markdown: '5. 五\n6. 六' });
    const list = document.blocks[0];
    expect(list).toMatchObject({ type: 'list', ordered: true, start: 5 });
    expect(list?.type === 'list' && list.items.length === 2).toBe(true);
  });

  it('嵌套列表递归展开', async () => {
    const { document } = await service.parseBlocks({ markdown: '- 甲\n  - 甲一' });
    const list = document.blocks[0];
    expect(list?.type).toBe('list');
    if (list?.type !== 'list') {
      throw new Error('首块应为列表');
    }
    expect(list.items).toHaveLength(1);
    const [item] = list.items;
    expect(item?.blocks[0]).toMatchObject({ type: 'paragraph', inline: { html: '甲' } });
    expect(item?.blocks[1]).toMatchObject({ type: 'list', ordered: false });
    const nested = item?.blocks[1];
    if (nested?.type !== 'list') {
      throw new Error('第二块应为嵌套列表');
    }
    expect(nested.items[0]?.blocks[0]).toMatchObject({ type: 'paragraph', inline: { html: '甲一' } });
  });

  it('表格块：对齐、表头与数据行', async () => {
    const { document } = await service.parseBlocks({
      markdown: '| 名 | 值 |\n|:---|---:|\n| a | 1 |',
    });
    expect(document.blocks).toEqual([
      {
        type: 'table',
        align: ['left', 'right'],
        header: [{ html: '名' }, { html: '值' }],
        rows: [[{ html: 'a' }, { html: '1' }]],
      },
    ]);
  });

  it('分隔线块', async () => {
    const { document } = await service.parseBlocks({ markdown: '---' });
    expect(document.blocks).toEqual([{ type: 'rule' }]);
  });

  it('块级 HTML 原文落为转义段落，不产生独立 HTML 块', async () => {
    const { document } = await service.parseBlocks({ markdown: '<script>alert(1)</script>' });
    expect(document.blocks).toEqual([
      { type: 'paragraph', inline: { html: '&lt;script&gt;alert(1)&lt;/script&gt;' } },
    ]);
  });

  it('内联面与 renderHtml 共享同一 XSS 口径', async () => {
    const { document } = await service.parseBlocks({ markdown: '前 [x](javascript:alert(1)) 后' });
    const block = document.blocks[0];
    if (block?.type !== 'paragraph') {
      throw new Error('首块应为段落');
    }
    expect(block.inline.html).not.toContain('javascript:');
    expect(block.inline.html).toContain('<a href="">x</a>');
  });

  it('多块文档保持源文顺序', async () => {
    const { document } = await service.parseBlocks({
      markdown: '# 题\n\n段落\n\n- 项\n\n```\ncode\n```\n\n---',
    });
    expect(document.blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'list',
      'code',
      'rule',
    ]);
  });
});
