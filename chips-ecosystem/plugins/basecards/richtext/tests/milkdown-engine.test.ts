import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMarkdown } from '@milkdown/kit/utils';
import {
  createRichTextEditor,
  insertTextIntoRichTextEditor,
  replaceRichTextDocument,
} from '../src/milkdown/engine';
import type { MilkdownEditor } from '../src/milkdown/engine';
import { normalizeMarkdown } from '../src/markdown/content';

/**
 * Milkdown 编辑引擎（RA-11）装载与序列化真实断言（jsdom，不经任何 mock）：
 * - Editor.make 装载 commonmark + GFM 预设，ProseMirror 实例真实挂载；
 * - remark 序列化往返与查看态 markdown 服务同源：GFM 双波浪删除线、表格、
 *   相对资源引用、扩展语法纯文本、原始 HTML 保真（html:false 同源口径）；
 * - listener 事务回流与程序化编辑入口与键入同一事务路径。
 */

const created: MilkdownEditor[] = [];
const hosts: HTMLDivElement[] = [];

afterEach(() => {
  for (const editor of created) {
    void editor.destroy();
  }
  created.length = 0;
  for (const host of hosts) {
    host.remove();
  }
  hosts.length = 0;
});

/** 创建已装载的引擎实例（真实 Editor.make().create()；装载失败即用例失败）。 */
async function createEngine(
  defaultValue: string,
  changes?: string[]
): Promise<{ editor: MilkdownEditor; host: HTMLDivElement }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  hosts.push(host);
  const editor = await createRichTextEditor({
    host,
    defaultValue,
    onMarkdownChange: (markdown) => changes?.push(markdown),
  });
  created.push(editor);
  return { editor, host };
}

/** remark 转义还原（`\~` → `~` 等）：转义形态与原文在 commonmark/GFM 语义等价。 */
function unescapeMarkdown(markdown: string): string {
  return markdown.replace(/\\([~+=^$[\]<>])/g, '$1');
}

describe('createRichTextEditor（装载）', () => {
  it('在 jsdom 真实装载并在宿主上挂载 ProseMirror 编辑面', async () => {
    const { host } = await createEngine('# 标题');
    const surface = host.querySelector<HTMLElement>('.ProseMirror');
    expect(surface).not.toBeNull();
    expect(surface!.getAttribute('contenteditable')).toBe('true');
    expect(surface!.textContent).toContain('标题');
    expect(surface!.querySelector('h1')).not.toBeNull();
  });

  it('编辑基线经 commonmark/GFM 解析为 ProseMirror 文档结构', async () => {
    const { host } = await createEngine('# 标题\n\n- 列表项\n\n~~删除线~~');
    expect(host.querySelector('h1')).not.toBeNull();
    expect(host.querySelector('ul li')).not.toBeNull();
    // GFM 双波浪删除线与查看态 markdown 服务同方言。
    expect(host.querySelector('del')).not.toBeNull();
  });
});

describe('Milkdown 序列化与查看态同源（getMarkdown 往返）', () => {
  it('GFM 结构（标题/列表/表格/删除线）经序列化保真（remark 规范形态）', async () => {
    const { editor } = await createEngine('# 标题\n\n- 列表项\n\n| 表头 | 列 |\n| --- | --- |\n| 值 | 数据 |\n\n正文 ~~删除线~~ 尾部');
    const markdown = editor.action(getMarkdown());
    expect(markdown).toContain('# 标题');
    // remark 序列化的规范 bullet 为 `*`；与查看态 markdown-it 渲染语义同一。
    expect(markdown).toContain('* 列表项');
    expect(markdown).toMatch(/\| 表头\s*\| 列/);
    expect(markdown).toContain('~~删除线~~');
  });

  it('包内相对资源引用（链接/图片）经序列化逐字保真', async () => {
    const { editor } = await createEngine('[资源](assets/note.md) 与 ![图](assets/picture.png)');
    const markdown = editor.action(getMarkdown());
    expect(markdown).toContain('[资源](assets/note.md)');
    expect(markdown).toContain('![图](assets/picture.png)');
  });

  it('渲染链无承载的扩展语法按纯文本往返（与查看态同源，不引入富渲染臂）', async () => {
    const { editor } = await createEngine('==高亮== 与 $x^2$ 与 ++下划线++ 与 ^上标^ 与 ~下标~');
    const markdown = unescapeMarkdown(editor.action(getMarkdown()));
    expect(markdown).toContain('==高亮==');
    expect(markdown).toContain('$x^2$');
    expect(markdown).toContain('++下划线++');
    expect(markdown).toContain('^上标^');
    expect(markdown).toContain('~下标~');
  });

  it('原始 HTML 保真往返（查看态 html:false 转义呈现的编辑态同源口径）', async () => {
    const { editor } = await createEngine('前 <img src="assets/p.png"> 后\n\n<div class="x">块级</div>');
    const markdown = editor.action(getMarkdown());
    expect(markdown).toContain('<img src="assets/p.png">');
    expect(markdown).toContain('<div class="x">块级</div>');
  });
});

describe('Milkdown 事务回流（listener 序列化）', () => {
  it('编辑事务经 listener 触发序列化回流（与键入同一事务路径）', async () => {
    const changes: string[] = [];
    const { editor } = await createEngine('# 标题', changes);
    insertTextIntoRichTextEditor(editor, '增补');
    await vi.waitFor(() => {
      expect(changes.some((markdown) => markdown.includes('增补'))).toBe(true);
    });
    expect(changes[changes.length - 1]).toContain('# 增补标题');
  });

  it('程序化全文替换触发序列化回流并同步文档结构', async () => {
    const changes: string[] = [];
    const { editor, host } = await createEngine('# 旧基线', changes);
    replaceRichTextDocument(editor, '# 新基线');
    await vi.waitFor(() => {
      expect(changes).toContain('# 新基线');
    });
    // 回流口径与序列化同源：remark 产出的尾随换行经 normalizeMarkdown 归一。
    expect(normalizeMarkdown(editor.action(getMarkdown()))).toBe('# 新基线');
    expect(host.querySelector('h1')?.textContent).toBe('新基线');
  });

  it('全文替换为空文的中间态经归一后回流空串', async () => {
    const changes: string[] = [];
    const { editor } = await createEngine('# 旧基线', changes);
    replaceRichTextDocument(editor, '');
    await vi.waitFor(() => {
      expect(changes.length).toBeGreaterThan(0);
    });
    expect(changes[changes.length - 1]).toBe('');
  });
});
