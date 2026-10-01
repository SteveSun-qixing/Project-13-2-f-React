import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BaseCardChange, BaseCardView, IBaseCardEditor, IBaseCardEditorEventMap } from '@chips/sdk';
import { DEFAULT_DISPLAY_CONFIG, buildContent, readContent, validateConfig, validateRichTextContent } from '../src/config';
import { attachMarkdownRendering, renderMarkdown } from '../src/markdown-gateway';
import type { IMarkdownRenderingSource } from '../src/markdown-gateway';
import { renderEditor, renderView } from '../src/render';

/**
 * 查看态 / 编辑态 / 契约消费缝集成面：
 * - 渲染源未注入 → fail-closed 状态行（在册缺位，不伪造成功）；
 * - 渲染源注入（契约同形夹具）→ 安全 HTML 挂载、锚点加固、能力降级提示；
 * - 编辑态 = Milkdown 真编辑器（RA-11）：ProseMirror 装载、序列化与查看态同源、
 *   inline → replace / file → config patch 变更分流、句柄时序与回流唯一时序 journal 锁测。
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

/** 编辑态测试容器：挂入 document（ProseMirror 观察器需要真实文档树），用例后统一清理。 */
const editorContainers: HTMLDivElement[] = [];

function createEditorContainer(): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  editorContainers.push(container);
  return container;
}

afterEach(() => {
  attachMarkdownRendering(null);
  vi.restoreAllMocks();
  for (const container of editorContainers.splice(0)) {
    container.remove();
  }
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

// ---------- 编辑态：Milkdown 真编辑器（程序化驱动面为宿主驱动/测试入口，非契约成员） ----------

/** 程序化编辑驱动面（句柄实现细节；与键入同一事务路径）。 */
interface IEditorDriver {
  insertText(text: string): void;
  replaceDocument(markdown: string): void;
}

type DrivenEditor = IBaseCardEditor & IEditorDriver;

function asDriven(editor: IBaseCardEditor): DrivenEditor {
  return editor as DrivenEditor;
}

/** 等待 Milkdown 引擎装载完成（ProseMirror 编辑面挂载 + 引擎就绪标记）。 */
async function waitForMilkdown(container: HTMLElement): Promise<void> {
  await vi.waitFor(() => {
    expect(container.querySelector('.ProseMirror')).not.toBeNull();
    expect(container.querySelector('[data-engine-ready="true"]')).not.toBeNull();
  });
}

function collectEvents(editor: IBaseCardEditor): {
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

describe('renderEditor（Milkdown 真编辑器：inline 来源 → replace 变更）', () => {
  it('装载后挂载 ProseMirror 编辑面，初始无待提交变更', async () => {
    const container = createEditorContainer();
    const editor = renderEditor(createBasecard(INLINE_CONTENT), container);
    await waitForMilkdown(container);
    const surface = container.querySelector<HTMLElement>('.ProseMirror');
    expect(surface).not.toBeNull();
    expect(surface!.getAttribute('contenteditable')).toBe('true');
    expect(editor.state).toBe('active');
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('正文修改经 ProseMirror 事务发布 replace 变更并保留 locale 与能力矩阵', async () => {
    const container = createEditorContainer();
    const editor = asDriven(renderEditor(createBasecard(INLINE_CONTENT), container));
    await waitForMilkdown(container);
    const { changes, dirties } = collectEvents(editor);
    editor.insertText('增补');
    await vi.waitFor(() => {
      expect(editor.getChange()).not.toBeNull();
    });
    const change = editor.getChange();
    expect(change!.kind).toBe('replace');
    const content = change!.kind === 'replace' ? change!.content : {};
    expect(content['card_type']).toBe('base.richtext');
    expect(content['content_text']).toBe('# 增补标题\n\n正文内容');
    expect(content['locale']).toBe('zh-CN');
    expect(content['markdown_capabilities']).toEqual(readContent(INLINE_CONTENT).markdown_capabilities);
    expect(editor.isDirty()).toBe(true);
    expect(changes.length).toBe(1);
    expect(dirties).toEqual([{ isDirty: true }]);
    editor.dispose();
  });

  it('Milkdown 序列化与查看态同源：GFM 删除线与相对资源引用经编辑回流保真', async () => {
    const container = document.createElement('div');
    const rich = buildContent({ content_text: '# 标题\n\n正文 ~~删除线~~ 与 [资源](assets/note.md) 引用' });
    const editor = asDriven(renderEditor(createBasecard(rich), container));
    await waitForMilkdown(container);
    editor.insertText('增');
    await vi.waitFor(() => {
      expect(editor.getChange()).not.toBeNull();
    });
    const change = editor.getChange();
    const contentText = change!.kind === 'replace' ? String(change!.content['content_text']) : '';
    // 编辑事务只动正文位；删除线（GFM 双波浪）与包内相对资源引用逐字保真，
    // 查看态（markdown 服务同一 content_text）与编辑态呈现同一语义。
    expect(contentText).toContain('# 增标题');
    expect(contentText).toContain('~~删除线~~');
    expect(contentText).toContain('[资源](assets/note.md)');
    editor.dispose();
  });

  it('清空正文的中间非法态不发布不过闸的变更', async () => {
    const container = createEditorContainer();
    const editor = asDriven(renderEditor(createBasecard(INLINE_CONTENT), container));
    await waitForMilkdown(container);
    editor.replaceDocument('有效正文');
    await vi.waitFor(() => {
      expect(editor.getChange()).not.toBeNull();
    });
    editor.replaceDocument('');
    expect(editor.getChange()).not.toBeNull();
    expect((editor.getChange() as Extract<BaseCardChange, { kind: 'replace' }>).content['content_text']).toBe(
      '有效正文'
    );
    editor.dispose();
  });

  it('markCommitted 以新 revision 清除待提交变更并前进基线', async () => {
    const container = createEditorContainer();
    const editor = asDriven(renderEditor(createBasecard(INLINE_CONTENT), container));
    await waitForMilkdown(container);
    editor.insertText('增补');
    await vi.waitFor(() => {
      expect(editor.isDirty()).toBe(true);
    });
    editor.markCommitted(2);
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.markCommitted(1);
    editor.dispose();
  });

  it('200 字闸提示随正文长度切换（编辑入口实时执行）', async () => {
    const container = createEditorContainer();
    const editor = asDriven(renderEditor(createBasecard(INLINE_CONTENT), container));
    await waitForMilkdown(container);
    expect(container.querySelector('[data-testid="richtext-inline-gate"]')?.textContent).toContain(
      '≤200 字阈值内内联保存'
    );
    editor.replaceDocument('字'.repeat(201));
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="richtext-inline-gate"]')?.textContent).toContain(
        '超过 200 字阈值'
      );
    });
    editor.replaceDocument('短文');
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="richtext-inline-gate"]')?.textContent).toContain(
        '≤200 字阈值内内联保存'
      );
    });
    editor.dispose();
  });

  it('update 前进基线：重挂载新内容、清除待提交变更、单实例编辑面', async () => {
    const container = createEditorContainer();
    const editor = asDriven(renderEditor(createBasecard(INLINE_CONTENT), container));
    await waitForMilkdown(container);
    editor.insertText('草稿');
    await vi.waitFor(() => {
      expect(editor.isDirty()).toBe(true);
    });
    editor.update(createBasecard(buildContent({ content_text: '外部新正文' }), { revision: 2 }), 2);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('外部新正文');
    });
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    expect(container.querySelectorAll('.ProseMirror').length).toBe(1);
    editor.dispose();
  });

  it('revision 不大于已知值时 update 忽略', async () => {
    const container = createEditorContainer();
    const editor = asDriven(renderEditor(createBasecard(INLINE_CONTENT), container));
    await waitForMilkdown(container);
    editor.insertText('草稿');
    await vi.waitFor(() => {
      expect(editor.isDirty()).toBe(true);
    });
    editor.update(createBasecard(buildContent({ content_text: '不应出现' }), { revision: 1 }), 1);
    expect(container.textContent).not.toContain('不应出现');
    expect(editor.isDirty()).toBe(true);
    editor.dispose();
  });

  it('dispose 后丢弃待提交变更且不再发布事件', async () => {
    const container = createEditorContainer();
    const editor = asDriven(renderEditor(createBasecard(INLINE_CONTENT), container));
    await waitForMilkdown(container);
    const { changes } = collectEvents(editor);
    editor.dispose();
    expect(editor.state).toBe('disposed');
    editor.insertText('再改一次');
    editor.replaceDocument('再改一次');
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

  it('file 来源呈现正文读取缺位提示，不挂载 Milkdown 正编辑面', () => {
    const container = createEditorContainer();
    const editor = renderEditor(createBasecard(FILE_CONTENT), container);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('读取通道未接入');
    expect(container.querySelector('.ProseMirror')).toBeNull();
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('展示配置修改发布 config 子树 patch，不触碰 content_file', () => {
    const container = createEditorContainer();
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

describe('编辑回流唯一时序（fake 桥 journal 锁测，08 §4.3 / 12 §6.1）', () => {
  /**
   * fake 桥形制编辑链路：订阅 change 事件驱动回流，逐步把时序写入 journal——
   * `getChange()` → 编辑链路校验（configSchema + validateConfig）→ `document:write`
   * （fake 文档服务，记录写次与 revision）→ 渲染会话 `update(view, revision)`
   * → `markCommitted(revision)`。编辑器侧只允许出现 `editor:change` 事件，
   * 写文件只发生在链路 `document:write` 步（编辑器不写文件）。
   */
  function createFakeEditChain(editor: DrivenEditor): {
    journal: string[];
    writes: Array<{ revision: number }>;
    runBackflow: (options?: { validatePasses?: boolean }) => void;
  } {
    const journal: string[] = [];
    const writes: Array<{ revision: number }> = [];
    let nextRevision = 2;
    editor.subscribe('change', () => {
      journal.push('editor:change');
    });
    const runBackflow = (options: { validatePasses?: boolean } = {}): void => {
      const validatePasses = options.validatePasses ?? true;
      journal.push('chain:getChange');
      const change = editor.getChange();
      if (change === null) {
        return;
      }
      journal.push('chain:validate');
      // 宿主校验闸：configSchema + validateConfig（fake 桥内联同口径复核；validatePasses=false 模拟 schema 拒绝）。
      if (!validatePasses) {
        return;
      }
      if (change.kind === 'replace') {
        if (!validateRichTextContent(change.content).valid || !validateConfig(change.content['config'])) {
          return;
        }
      }
      journal.push('chain:document:write');
      writes.push({ revision: nextRevision });
      journal.push('chain:session:update');
      editor.markCommitted(nextRevision);
      nextRevision += 1;
      journal.push('chain:markCommitted');
    };
    return { journal, writes, runBackflow };
  }

  it('回流唯一时序：change → getChange → 校验 → document:write → update → markCommitted', async () => {
    const container = createEditorContainer();
    const editor = asDriven(renderEditor(createBasecard(INLINE_CONTENT), container));
    await waitForMilkdown(container);
    const { journal, writes, runBackflow } = createFakeEditChain(editor);
    editor.insertText('增补');
    await vi.waitFor(() => {
      expect(journal).toContain('editor:change');
    });
    runBackflow();
    expect(journal).toEqual([
      'editor:change',
      'chain:getChange',
      'chain:validate',
      'chain:document:write',
      'chain:session:update',
      'chain:markCommitted',
    ]);
    // 写文件唯一发生在链路 document:write 步；编辑器侧除 change 事件外无任何 journal 记录。
    expect(writes).toEqual([{ revision: 2 }]);
    expect(journal.filter((entry) => entry.startsWith('editor:'))).toEqual(['editor:change']);
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('宿主校验不过闸时不写文档、不推进基线，编辑器保持脏状态等待修正', async () => {
    const container = createEditorContainer();
    const editor = asDriven(renderEditor(createBasecard(INLINE_CONTENT), container));
    await waitForMilkdown(container);
    const { journal, writes, runBackflow } = createFakeEditChain(editor);
    editor.insertText('增补');
    await vi.waitFor(() => {
      expect(journal).toContain('editor:change');
    });
    runBackflow({ validatePasses: false });
    expect(journal).toEqual(['editor:change', 'chain:getChange', 'chain:validate']);
    expect(writes).toEqual([]);
    expect(editor.isDirty()).toBe(true);
    expect(editor.getChange()).not.toBeNull();
    editor.dispose();
  });

  it('连续两轮回流 revision 严格递增，编辑器基线随 markCommitted 前进', async () => {
    const container = createEditorContainer();
    const editor = asDriven(renderEditor(createBasecard(INLINE_CONTENT), container));
    await waitForMilkdown(container);
    const { writes, runBackflow } = createFakeEditChain(editor);
    editor.insertText('第一轮');
    await vi.waitFor(() => {
      expect(editor.isDirty()).toBe(true);
    });
    runBackflow();
    editor.insertText('第二轮');
    await vi.waitFor(() => {
      expect(editor.isDirty()).toBe(true);
    });
    runBackflow();
    expect(writes).toEqual([{ revision: 2 }, { revision: 3 }]);
    expect(editor.isDirty()).toBe(false);
    editor.dispose();
  });
});
