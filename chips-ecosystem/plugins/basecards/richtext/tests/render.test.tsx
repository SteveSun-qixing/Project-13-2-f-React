import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BaseCardChange, BaseCardView, IBaseCardEditorEventMap } from '@chips/sdk';
import { DEFAULT_DISPLAY_CONFIG, buildContent, readContent } from '../src/config';
import { attachMarkdownRendering, renderMarkdown } from '../src/markdown-gateway';
import type { IMarkdownRenderingSource } from '../src/markdown-gateway';
import { renderEditor, renderView } from '../src/render';

/**
 * 查看态 / 编辑态 / 契约消费缝集成面：
 * - 渲染源未注入 → fail-closed 状态行（在册缺位，不伪造成功）；
 * - 渲染源注入（契约同形夹具）→ 安全 HTML 挂载、锚点加固、能力降级提示；
 * - 编辑器 inline → replace / file → config patch 的变更分流与句柄时序。
 */

function createBasecard(content: Record<string, unknown>, overrides: Partial<BaseCardView> = {}): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.richtext',
    content,
    revision: 1,
    card: {
      card_id: 'z9Y8x7W6v5',
      name: '示例卡片',
      chip_standards_version: '1.0.0',
      cover_ratio: '3:4',
      tags: [],
    },
    ...overrides,
  };
}

const INLINE_CONTENT = buildContent({ content_text: '# 标题\n\n正文内容' });
const FILE_CONTENT = buildContent({ content_source: 'file', content_file: 'richtext/note.md' });

/** 契约同形渲染源夹具：返回安全 HTML 片段（形态与 markdown 服务 renderHtml 输出一致）。 */
function createFakeSource(html: string): IMarkdownRenderingSource & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    renderHtml(input: { markdown: string }): Promise<{ html: string }> {
      calls.push(input.markdown);
      return Promise.resolve({ html });
    },
  };
}

const RENDERED_HTML = [
  '<h2>标题</h2>',
  '<p>正文 <a href="https://example.com">外链</a> 与 <a href="assets/a.md">内部资源</a></p>',
  '<img src="assets/b.png" alt="图">',
].join('');

afterEach(() => {
  attachMarkdownRendering(null);
  vi.restoreAllMocks();
});

describe('renderMarkdown（契约消费缝）', () => {
  it('未注入渲染源时 fail-closed 拒绝，不伪造渲染', async () => {
    await expect(renderMarkdown('# 标题')).rejects.toThrow('富文本渲染通道未接入');
  });

  it('注入后经契约方法面消费并返回安全 HTML', async () => {
    const source = createFakeSource('<p>安全 HTML</p>');
    attachMarkdownRendering(source);
    await expect(renderMarkdown('# 标题')).resolves.toBe('<p>安全 HTML</p>');
    expect(source.calls).toEqual(['# 标题']);
  });
});

describe('renderView', () => {
  it('渲染源未注入时呈现渲染通道未接入状态，不伪造内容', async () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(INLINE_CONTENT), container);
    expect(typeof dispose).toBe('function');
    expect(container.querySelector('[data-card-type="base.richtext"]')).not.toBeNull();
    await vi.waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('渲染通道未接入');
    });
    expect(container.querySelector('.chips-richtext-card__surface')).toBeNull();
    dispose();
  });

  it('注入渲染源后挂载安全 HTML，应用展示配置', async () => {
    attachMarkdownRendering(createFakeSource(RENDERED_HTML));
    const container = document.createElement('div');
    renderView(createBasecard(INLINE_CONTENT, { content: buildContent({ content_text: '正文' }, { fontSize: 20, lineHeight: 2 }) }), container);
    await vi.waitFor(() => {
      expect(container.querySelector('.chips-richtext-card__surface')).not.toBeNull();
    });
    const surface = container.querySelector<HTMLElement>('.chips-richtext-card__surface');
    expect(surface!.style.fontSize).toBe('20px');
    expect(surface!.style.lineHeight).toBe('2');
    expect(surface!.querySelectorAll('a').length).toBe(2);
  });

  it('锚点加固：外链补安全属性，资源引用补资源路径数据属性', async () => {
    attachMarkdownRendering(createFakeSource(RENDERED_HTML));
    const container = document.createElement('div');
    renderView(createBasecard(INLINE_CONTENT), container);
    await vi.waitFor(() => {
      expect(container.querySelector('.chips-richtext-card__surface')).not.toBeNull();
    });
    const anchors = container.querySelectorAll<HTMLAnchorElement>('a');
    const external = anchors[0]!;
    const resource = anchors[1]!;
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toBe('noopener noreferrer');
    expect(external.hasAttribute('data-chips-resource-path')).toBe(false);
    expect(resource.getAttribute('rel')).toBe('noopener noreferrer');
    expect(resource.getAttribute('data-chips-resource-path')).toBe('assets/a.md');
  });

  it('声明而渲染链暂不承载的扩展能力呈现降级提示', async () => {
    attachMarkdownRendering(createFakeSource('<p>正文</p>'));
    const container = document.createElement('div');
    renderView(createBasecard(INLINE_CONTENT), container);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('以下扩展语法当前按纯文本呈现');
    });
    expect(container.textContent).toContain('数学公式');
  });

  it('file 来源呈现文件读取通道未接入，不调用渲染源', async () => {
    const source = createFakeSource('<p>不应出现</p>');
    attachMarkdownRendering(source);
    const container = document.createElement('div');
    renderView(createBasecard(FILE_CONTENT), container);
    await vi.waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('文件内容读取通道未接入');
    });
    expect(source.calls).toEqual([]);
  });

  it('更新调用覆盖旧内容且释放句柄幂等', async () => {
    attachMarkdownRendering(createFakeSource('<p>第一版</p>'));
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(INLINE_CONTENT), container);
    attachMarkdownRendering(createFakeSource('<p>第二版</p>'));
    renderView(
      createBasecard(buildContent({ content_text: '新正文' }), { revision: 2 }),
      container
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain('第二版');
    });
    expect(container.textContent).not.toContain('第一版');
    dispose();
    dispose();
  });
});

describe('renderEditor（inline 来源：replace 变更）', () => {
  function collectEvents(editor: ReturnType<typeof renderEditor>): {
    changes: IBaseCardEditorEventMap['change'][];
    dirties: IBaseCardEditorEventMap['dirty'][];
  } {
    const changes: IBaseCardEditorEventMap['change'][] = [];
    const dirties: IBaseCardEditorEventMap['dirty'][] = [];
    editor.subscribe('change', (payload) => {
      changes.push(payload);
    });
    editor.subscribe('dirty', (payload) => {
      dirties.push(payload);
    });
    return { changes, dirties };
  }

  function writeTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
    // 经原型原生 setter 写值触发 React 受控变更（母型判例）；unbound-method 属误报，定向豁免。
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('挂载后呈现编辑表单，getChange 初始为 null', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(INLINE_CONTENT), container);
    expect(container.querySelector('form')).not.toBeNull();
    expect(container.querySelector('textarea')).not.toBeNull();
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('正文修改发布 replace 变更并保留 locale 与能力矩阵', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(INLINE_CONTENT), container);
    const { changes, dirties } = collectEvents(editor);
    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    writeTextareaValue(textarea!, '# 新正文');
    const change = editor.getChange();
    expect(change).not.toBeNull();
    expect(change!.kind).toBe('replace');
    const content = change!.kind === 'replace' ? change!.content : {};
    expect(content['card_type']).toBe('base.richtext');
    expect(content['content_text']).toBe('# 新正文');
    expect(content['locale']).toBe('zh-CN');
    expect(content['markdown_capabilities']).toEqual(readContent(INLINE_CONTENT).markdown_capabilities);
    expect(editor.isDirty()).toBe(true);
    expect(changes.length).toBe(1);
    expect(dirties).toEqual([{ isDirty: true }]);
    editor.dispose();
  });

  it('清空正文的中间非法态不发布不过闸的变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(INLINE_CONTENT), container);
    const textarea = container.querySelector('textarea')!;
    writeTextareaValue(textarea, '有效正文');
    expect(editor.getChange()).not.toBeNull();
    writeTextareaValue(textarea, '');
    expect(editor.getChange()).not.toBeNull();
    expect((editor.getChange() as Extract<BaseCardChange, { kind: 'replace' }>).content['content_text']).toBe(
      '有效正文'
    );
    editor.dispose();
  });

  it('markCommitted 以新 revision 清除待提交变更并前进基线', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(INLINE_CONTENT), container);
    writeTextareaValue(container.querySelector('textarea')!, '# 新正文');
    expect(editor.isDirty()).toBe(true);
    editor.markCommitted(2);
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.markCommitted(1);
    editor.dispose();
  });

  it('200 字阈值提示随正文长度切换', () => {
    const container = document.createElement('div');
    renderEditor(createBasecard(INLINE_CONTENT), container);
    expect(container.textContent).toContain('≤200 字阈值内内联保存');
    writeTextareaValue(container.querySelector('textarea')!, '字'.repeat(201));
    expect(container.textContent).toContain('超过 200 字阈值');
  });

  it('dispose 后丢弃待提交变更且不再发布事件', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(INLINE_CONTENT), container);
    const { changes } = collectEvents(editor);
    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    editor.dispose();
    expect(editor.state).toBe('disposed');
    writeTextareaValue(textarea!, '再改一次');
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(0);
  });
});

describe('renderEditor（file 来源：config patch 变更）', () => {
  function writeInputValue(input: HTMLInputElement, value: string): void {
    // 经原型原生 setter 写值触发 React 受控变更（母型判例）；unbound-method 属误报，定向豁免。
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('file 来源呈现正文读取缺位提示，且不出现正文字段', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(FILE_CONTENT), container);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('读取通道未接入');
    expect(container.querySelector('textarea')).toBeNull();
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('展示配置修改发布 config 子树 patch，不触碰 content_file', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(FILE_CONTENT), container);
    const input = container.querySelector<HTMLInputElement>('input');
    expect(input).not.toBeNull();
    writeInputValue(input!, '24');
    const change = editor.getChange();
    expect(change).not.toBeNull();
    expect(change!.kind).toBe('patch');
    if (change!.kind === 'patch') {
      expect(change!.operations).toEqual([
        { op: 'replace', path: '/config/fontSize', value: 24 },
        { op: 'replace', path: '/config/lineHeight', value: DEFAULT_DISPLAY_CONFIG.lineHeight },
      ]);
    }
    expect(JSON.stringify(change)).not.toContain('content_file');
    editor.dispose();
  });
});
