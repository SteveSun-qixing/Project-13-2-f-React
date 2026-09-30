import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type {
  BoxRenderView,
  Dispose,
  EntryTicket,
  EntryView,
  IBoxLayoutFrameRuntime,
} from '@chips/sdk';
import { readConfig } from '../src/config';
import { attachRuntime, renderEditor, renderLayout } from '../src/render';

class StubIntersectionObserver {
  public constructor(_callback: IntersectionObserverCallback) {}

  public observe(): void {}

  public unobserve(): void {}

  public disconnect(): void {}
}

class StubResizeObserver {
  public constructor(_callback: ResizeObserverCallback) {}

  public observe(): void {}

  public unobserve(): void {}

  public disconnect(): void {}
}

vi.stubGlobal('IntersectionObserver', StubIntersectionObserver);
vi.stubGlobal('ResizeObserver', StubResizeObserver);

function createBox(overrides: Record<string, unknown> = {}): BoxRenderView {
  return {
    kind: 'box',
    box_id: 'a1B2c3D4e5',
    name: '示例箱子',
    chip_standards_version: '1.0.0',
    revision: 1,
    active_layout_type: 'chips.layout.documentlibrary',
    layout_config: {},
    entries: [],
    ...overrides,
  } as unknown as BoxRenderView;
}

function createEntry(entryId: string, displayTitle: string, order: number): EntryView {
  return {
    entry_id: entryId,
    url: `chips-resource://plugin-1/${entryId}.card`,
    enabled: true,
    displayTitle,
    order,
  };
}

function createTicket(entryId: string): EntryTicket {
  return {
    entry_id: entryId,
    slotIndex: 0,
    view: { kind: 'card', card_id: entryId } as unknown as EntryTicket['view'],
    resourceBase: 'chips-resource://box-1/',
    pluginEntries: {},
    estimatedHeight: 120,
  };
}

interface IFrameRuntimeHarness {
  runtime: IBoxLayoutFrameRuntime;
  requestEntries: Mock<() => Promise<EntryTicket[]>>;
  mountEntry: Mock<(ticket: EntryTicket, container: HTMLElement) => Promise<Dispose>>;
  openDocument: Mock<(source: string) => Promise<void>>;
  notify: Mock<
    (notification: { level: 'info' | 'warning' | 'error'; message: string }) => Promise<void>
  >;
}

function createFrameRuntime(): IFrameRuntimeHarness {
  const requestEntries = vi.fn<() => Promise<EntryTicket[]>>(() => Promise.resolve([]));
  const mountEntry = vi.fn<(ticket: EntryTicket, container: HTMLElement) => Promise<Dispose>>(() =>
    Promise.resolve(() => undefined)
  );
  const openDocument = vi.fn<(source: string) => Promise<void>>(() => Promise.resolve());
  const openExternal = vi.fn<(url: string) => Promise<void>>(() => Promise.resolve());
  const copyText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
  const notify = vi.fn<
    (notification: { level: 'info' | 'warning' | 'error'; message: string }) => Promise<void>
  >(() => Promise.resolve());
  const runtime: IBoxLayoutFrameRuntime = {
    requestEntries,
    mountEntry,
    openDocument,
    openExternal,
    copyText,
    notify,
  };
  return { runtime, requestEntries, mountEntry, openDocument, notify };
}

function click(node: Element): void {
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function pressKey(node: Element, key: string): void {
  node.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  );
}

interface ITreeScenario {
  box: BoxRenderView;
}

/** 配置树：组 g1（第一章）> 文档 d-e1（旅行日记）、d-ghost（缺失）；e2 未放入目录树（未归档）。 */
function createTreeScenario(): ITreeScenario {
  return {
    box: createBox({
      entries: [createEntry('e1', '旅行日记', 0), createEntry('e2', '未归档文档', 1)],
      layout_config: readConfig({
        sort_mode: 'manual',
        tree_nodes: [
          {
            id: 'g1',
            titleOverride: '第一章',
            collapsed: false,
            children: [
              { id: 'd-e1', entryId: 'e1', collapsed: false, children: [] },
              { id: 'd-ghost', entryId: 'ghost', titleOverride: '幽灵文档', collapsed: false, children: [] },
            ],
          },
        ],
      }),
    }),
  };
}

function createEditorScenario(): ITreeScenario {
  return createTreeScenario();
}

function queryTreeTitles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-tree-title]')).map(
    (node) => node.textContent ?? ''
  );
}

function queryTreeItem(container: HTMLElement, nodeId: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-tree-row][data-node-id="${nodeId}"]`);
}

describe('renderLayout：结构骨架与空态', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.replaceChildren(container);
  });

  it('空箱子呈现目录骨架与空态提示，释放后清空挂载且幂等', () => {
    const dispose = renderLayout(createBox(), container);
    expect(container.textContent).toContain('这里还没有内容');
    expect(container.textContent).toContain('在编辑器中添加卡片或箱子，开始填充这个箱子');
    expect(container.querySelector('[data-library-skeleton]')).not.toBeNull();
    dispose();
    dispose();
    expect(container.childNodes).toHaveLength(0);
  });

  it('禁用条目不进入目录树', () => {
    const disabled = { ...createEntry('e0', '停用文档', 0), enabled: false };
    const dispose = renderLayout(
      createBox({ entries: [disabled, createEntry('e1', '旅行日记', 1)] }),
      container
    );
    expect(container.textContent).not.toContain('停用文档');
    expect(container.textContent).toContain('旅行日记');
    dispose();
  });
});

describe('renderLayout：目录树层级与交互', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.replaceChildren(container);
  });

  it('配置树按层级呈现：标题覆盖、未归档追加、缺失标记与缩进', () => {
    const { box } = createTreeScenario();
    const dispose = renderLayout(box, container);
    expect(queryTreeTitles(container)).toEqual(['第一章', '旅行日记', '幽灵文档', '未归档文档']);

    const group = queryTreeItem(container, 'g1');
    expect(group?.getAttribute('aria-expanded')).toBe('true');
    expect(group?.getAttribute('style')).toContain('calc(0px)');

    const child = queryTreeItem(container, 'd-e1');
    expect(child?.getAttribute('style')).toContain('calc(16px)');

    const ghost = queryTreeItem(container, 'd-ghost');
    expect(ghost?.getAttribute('data-missing')).toBe('true');

    const unarchived = queryTreeItem(container, 'unconfigured-e2');
    expect(unarchived?.getAttribute('data-unconfigured')).toBe('true');
    dispose();
  });

  it('折叠目录隐藏后代，再展开恢复', async () => {
    const { box } = createTreeScenario();
    const dispose = renderLayout(box, container);

    const toggle = queryTreeItem(container, 'g1')?.querySelector<HTMLButtonElement>(
      '[data-tree-toggle]'
    );
    click(toggle as HTMLElement);
    await vi.waitFor(() => {
      expect(queryTreeItem(container, 'd-e1')).toBeNull();
      expect(queryTreeItem(container, 'g1')?.getAttribute('aria-expanded')).toBe('false');
    });

    click(queryTreeItem(container, 'g1')?.querySelector('[data-tree-toggle]') as HTMLElement);
    await vi.waitFor(() => {
      expect(queryTreeItem(container, 'd-e1')).not.toBeNull();
    });
    dispose();
  });

  it('名称排序递归作用于目录树', () => {
    const { box } = createTreeScenario();
    const sorted = {
      ...box,
      layout_config: readConfig({
        sort_mode: 'name-asc',
        tree_nodes: [
          {
            id: 'g1',
            titleOverride: '香蕉',
            collapsed: false,
            children: [
              { id: 'd-e1', titleOverride: '苹果', entryId: 'e1', collapsed: false, children: [] },
              { id: 'd-ghost', titleOverride: '芒果', entryId: 'ghost', collapsed: false, children: [] },
            ],
          },
        ],
      }),
    } as unknown as BoxRenderView;
    const dispose = renderLayout(sorted, container);
    expect(queryTreeTitles(container)).toEqual(['未归档文档', '香蕉', '芒果', '苹果']);
    const childTitles = Array.from(container.querySelectorAll('[data-tree-row]'))
      .filter((row) => (row as HTMLElement).getAttribute('style')?.includes('calc(16px)'))
      .map((row) => row.querySelector('[data-tree-title]')?.textContent);
    expect(childTitles).toEqual(['芒果', '苹果']);
    dispose();
  });

  it('键盘导航在可见节点间移动选中并折叠展开', async () => {
    const { box } = createTreeScenario();
    const dispose = renderLayout(box, container);
    const nav = container.querySelector('[data-document-tree]');
    expect(nav).not.toBeNull();

    expect(queryTreeItem(container, 'd-e1')?.getAttribute('aria-selected')).toBe('true');
    pressKey(nav as HTMLElement, 'ArrowDown');
    await vi.waitFor(() => {
      expect(queryTreeItem(container, 'd-ghost')?.getAttribute('aria-selected')).toBe('true');
    });
    pressKey(nav as HTMLElement, 'ArrowDown');
    await vi.waitFor(() => {
      expect(queryTreeItem(container, 'unconfigured-e2')?.getAttribute('aria-selected')).toBe(
        'true'
      );
    });
    pressKey(nav as HTMLElement, 'ArrowUp');
    await vi.waitFor(() => {
      expect(queryTreeItem(container, 'd-ghost')?.getAttribute('aria-selected')).toBe('true');
    });
    dispose();
  });

  it('侧栏显隐是会话态：切换只改呈现、不产出配置变更', async () => {
    const { box } = createTreeScenario();
    const dispose = renderLayout(box, container);
    expect(container.querySelector('[data-document-tree]')).not.toBeNull();

    click(container.querySelector('[data-sidebar-toggle]') as HTMLElement);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-document-tree]')).toBeNull();
      expect(
        container.querySelector('[data-sidebar-toggle]')?.getAttribute('aria-expanded')
      ).toBe('false');
    });

    click(container.querySelector('[data-sidebar-toggle]') as HTMLElement);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-document-tree]')).not.toBeNull();
    });
    dispose();
  });
});

describe('renderLayout：右侧预览', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.replaceChildren(container);
  });

  it('内容态把右侧空间交给条目帧：按需挂载且不重复标题元信息', async () => {
    const { runtime, requestEntries, mountEntry } = createFrameRuntime();
    requestEntries.mockResolvedValue([createTicket('e1')]);
    attachRuntime(runtime);
    const dispose = renderLayout(createTreeScenario().box, container);

    await vi.waitFor(() => {
      expect(requestEntries).toHaveBeenCalledWith({ entryIds: ['e1'] });
      expect(mountEntry).toHaveBeenCalledTimes(1);
      const ticket = mountEntry.mock.calls[0]?.[0];
      expect(ticket?.entry_id).toBe('e1');
      const slot = container.querySelector('[data-entry-slot]');
      expect(slot).not.toBeNull();
      expect(mountEntry.mock.calls[0]?.[1]).toBe(slot);
    });
    const preview = container.querySelector('[data-document-preview][data-presentation="content"]');
    expect(preview?.getAttribute('data-entry-id')).toBe('e1');
    expect(preview?.querySelector('[data-document-title]')).toBeNull();
    expect(preview?.querySelector('[data-open-document]')).toBeNull();
    dispose();
  });

  it('封面态呈现封面壳层与元信息，打开入口经 openDocument 打开', () => {
    const { runtime, requestEntries, openDocument } = createFrameRuntime();
    requestEntries.mockResolvedValue([createTicket('e2')]);
    attachRuntime(runtime);
    const dispose = renderLayout(
      createBox({
        entries: [
          {
            ...createEntry('e2', '画册', 0),
            snapshot: { summary: '旅行照片集', tags: ['摄影', '旅行'] },
          },
        ],
        layout_config: readConfig({
          tree_nodes: [{ id: 'd-e2', entryId: 'e2', presentation: 'cover', collapsed: false, children: [] }],
        }),
      }),
      container
    );

    const preview = container.querySelector('[data-document-preview][data-presentation="cover"]');
    expect(preview).not.toBeNull();
    expect(preview?.getAttribute('data-entry-id')).toBe('e2');
    expect(preview?.textContent).toContain('画册');
    expect(preview?.textContent).toContain('旅行照片集');
    expect(preview?.textContent).toContain('摄影');
    const shell = preview?.querySelector<HTMLElement>('[data-cover-shell]');
    expect(shell?.getAttribute('aria-label')).toContain('打开文档');
    expect(shell?.getAttribute('data-cover-ratio')).toBe('3 / 4');

    click(preview?.querySelector('[data-open-document]') as HTMLElement);
    expect(openDocument).toHaveBeenCalledWith('chips-resource://plugin-1/e2.card');
    dispose();
  });

  it('点击目录标题切换右侧预览，缺失节点呈现保留提示', async () => {
    const { box } = createTreeScenario();
    const dispose = renderLayout(box, container);

    click(queryTreeItem(container, 'd-ghost')?.querySelector('[data-tree-title]') as HTMLElement);
    await vi.waitFor(() => {
      const preview = container.querySelector('[data-document-preview][data-missing="true"]');
      expect(preview?.textContent).toContain('幽灵文档');
      expect(preview?.textContent).toContain('当前不在箱子中');
      expect(container.querySelector('[data-entry-slot]')).toBeNull();
    });

    click(queryTreeItem(container, 'd-e1')?.querySelector('[data-tree-title]') as HTMLElement);
    await vi.waitFor(() => {
      const preview = container.querySelector('[data-document-preview][data-entry-id="e1"]');
      expect(preview).not.toBeNull();
    });
    dispose();
  });

  it('箱子条目固定封面呈现', () => {
    const dispose = renderLayout(
      createBox({
        entries: [
          { ...createEntry('e3', '子箱子', 0), snapshot: { contentType: 'chips/box' } },
        ],
        layout_config: readConfig({
          tree_nodes: [{ id: 'd-e3', entryId: 'e3', collapsed: false, children: [] }],
        }),
      }),
      container
    );
    expect(
      container.querySelector('[data-document-preview][data-presentation="cover"]')
    ).not.toBeNull();
    dispose();
  });

  it('条目帧挂载失败呈现简体中文状态提示', async () => {
    const { runtime, requestEntries, mountEntry } = createFrameRuntime();
    requestEntries.mockRejectedValue(new Error('denied'));
    attachRuntime(runtime);
    const dispose = renderLayout(createTreeScenario().box, container);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-entry-status]')?.textContent).toContain(
        '条目内容暂时不可用'
      );
    });
    expect(mountEntry).not.toHaveBeenCalled();
    dispose();
  });
});

describe('renderLayout：背景与顶部区域', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.replaceChildren(container);
  });

  it('代码模式背景经受控文档帧内联呈现，图片顶部区域经箱子资源相对路径', () => {
    const dispose = renderLayout(
      createBox({
        entries: [createEntry('e1', '旅行日记', 0)],
        layout_config: readConfig({
          background: { mode: 'html', html: '<section>背景</section>' },
          top_region: { mode: 'image', assetPath: 'assets/layouts/banner.png' },
        }),
      }),
      container
    );
    const frames = Array.from(container.querySelectorAll('iframe'));
    expect(frames.length).toBeGreaterThanOrEqual(2);
    const background = frames.find((frame) => (frame.getAttribute('title') ?? '').includes('背景'));
    expect(background?.getAttribute('srcdoc')).toContain('<section>背景</section>');
    const top = frames.find((frame) => (frame.getAttribute('title') ?? '').includes('顶部'));
    expect(top?.getAttribute('src')).toContain('assets/layouts/banner.png');
    dispose();
  });

  it('不显示模式的区域不产生帧', () => {
    const dispose = renderLayout(createBox(), container);
    expect(container.querySelectorAll('iframe')).toHaveLength(0);
    dispose();
  });
});

describe('renderEditor', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.replaceChildren(host);
  });

  it('呈现显示、目录树与区域分区，未归档条目给出加入入口', () => {
    const { box } = createTreeScenario();
    const editor = renderEditor(box, host);
    expect(editor.state).toBe('active');
    expect(editor.isDirty()).toBe(false);
    expect(host.textContent).toContain('排序方式');
    expect(host.textContent).toContain('侧边栏宽度');
    expect(host.textContent).toContain('显示摘要');
    expect(host.textContent).toContain('目录树');
    expect(host.textContent).toContain('背景区域');
    expect(host.textContent).toContain('顶部内容区');
    expect(host.textContent).toContain('目录节点');
    expect(host.textContent).toContain('加入：未归档文档');
    const groupTitle = host.querySelector<HTMLInputElement>('[data-node-title="g1"]');
    expect(groupTitle?.value).toBe('第一章');
    const titleInput = host.querySelector<HTMLInputElement>('[data-node-title="d-e1"]');
    expect(titleInput?.getAttribute('placeholder')).toBe('旅行日记');
    editor.dispose();
    editor.dispose();
    expect(editor.state).toBe('disposed');
    expect(editor.getChange()).toBeNull();
    expect(editor.isDirty()).toBe(false);
  });

  it('标题覆盖输入产出归一化 replace 变更并在提交后清脏', () => {
    const { box } = createTreeScenario();
    const editor = renderEditor(box, host);
    const changes: string[] = [];
    editor.subscribe('change', (payload) => {
      changes.push(payload.change.kind);
    });

    const titleInput = host.querySelector<HTMLInputElement>('[data-node-title="d-e1"]');
    setInputValue(titleInput as HTMLInputElement, '东海游记');

    const change = editor.getChange();
    expect(change).not.toBeNull();
    expect(change?.kind).toBe('replace');
    if (change?.kind === 'replace') {
      expect(change.schemaVersion).toBe('1.0.0');
      const nodes = readConfig(change.config).tree_nodes;
      expect(nodes[0]?.children[0]?.titleOverride).toBe('东海游记');
    }
    expect(changes).toEqual(['replace']);
    expect(editor.isDirty()).toBe(true);

    editor.markCommitted(2);
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('添加目录与加入条目扩展目录树', async () => {
    const { box } = createEditorScenario();
    const editor = renderEditor(box, host);

    click(host.querySelector('[data-action="add-group"]') as HTMLElement);
    await vi.waitFor(() => {
      expect(host.querySelector('[data-editor-node="group-1"]')).not.toBeNull();
    });
    let change = editor.getChange();
    if (change?.kind === 'replace') {
      const nodes = readConfig(change.config).tree_nodes;
      expect(nodes).toHaveLength(2);
      expect(nodes[1]?.entryId).toBeUndefined();
    }

    click(host.querySelector('[data-add-entry="e2"]') as HTMLElement);
    await vi.waitFor(() => {
      expect(host.querySelector('[data-editor-node="entry-e2"]')).not.toBeNull();
    });
    change = editor.getChange();
    if (change?.kind === 'replace') {
      const nodes = readConfig(change.config).tree_nodes;
      expect(nodes).toHaveLength(3);
      expect(nodes[2]?.entryId).toBe('e2');
      expect(nodes[2]?.presentation).toBe('content');
    }
    expect(host.querySelector('[data-add-entry="e2"]')).toBeNull();
    editor.dispose();
  });

  it('节点操作按钮完成移动、缩进与移除', async () => {
    const { box } = createEditorScenario();
    const editor = renderEditor(box, host);
    const rowIds = (): (string | null)[] =>
      Array.from(host.querySelectorAll('[data-editor-node]')).map((node) =>
        node.getAttribute('data-editor-node')
      );
    const queryAction = (nodeId: string, action: string): HTMLElement | null =>
      host.querySelector(`[data-editor-node="${nodeId}"] [data-action="${action}"]`);
    const waitRowMargin = async (nodeId: string, margin: number): Promise<void> => {
      await vi.waitFor(() => {
        const row = host.querySelector<HTMLElement>(`[data-editor-node="${nodeId}"]`);
        expect(row?.getAttribute('style') ?? '').toContain(`${margin}px`);
      });
    };

    click(queryAction('d-ghost', 'move-up') as HTMLElement);
    await vi.waitFor(() => {
      expect(rowIds()).toEqual(['g1', 'd-ghost', 'd-e1']);
    });
    let change = editor.getChange();
    if (change?.kind === 'replace') {
      expect(readConfig(change.config).tree_nodes[0]?.children.map((node) => node.id)).toEqual([
        'd-ghost',
        'd-e1',
      ]);
    }

    click(queryAction('d-ghost', 'move-down') as HTMLElement);
    await vi.waitFor(() => {
      expect(rowIds()).toEqual(['g1', 'd-e1', 'd-ghost']);
    });
    change = editor.getChange();
    if (change?.kind === 'replace') {
      expect(readConfig(change.config).tree_nodes[0]?.children.map((node) => node.id)).toEqual([
        'd-e1',
        'd-ghost',
      ]);
    }

    click(queryAction('d-ghost', 'indent') as HTMLElement);
    await waitRowMargin('d-ghost', 32);
    change = editor.getChange();
    if (change?.kind === 'replace') {
      const nodes = readConfig(change.config).tree_nodes;
      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.children.map((node) => node.id)).toEqual(['d-e1']);
      expect(nodes[0]?.children[0]?.children.map((node) => node.id)).toEqual(['d-ghost']);
    }

    click(queryAction('d-ghost', 'outdent') as HTMLElement);
    await waitRowMargin('d-ghost', 16);
    change = editor.getChange();
    if (change?.kind === 'replace') {
      expect(readConfig(change.config).tree_nodes[0]?.children.map((node) => node.id)).toEqual([
        'd-e1',
        'd-ghost',
      ]);
    }

    click(queryAction('d-ghost', 'remove') as HTMLElement);
    await vi.waitFor(() => {
      expect(host.querySelector('[data-editor-node="d-ghost"]')).toBeNull();
    });
    change = editor.getChange();
    if (change?.kind === 'replace') {
      expect(readConfig(change.config).tree_nodes[0]?.children.map((node) => node.id)).toEqual([
        'd-e1',
      ]);
    }
    editor.dispose();
  });

  it('默认折叠与展示方式切换写入节点配置', () => {
    const { box } = createEditorScenario();
    const editor = renderEditor(box, host);

    const collapsed = host.querySelector<HTMLInputElement>(
      '[data-editor-node="d-e1"] input[type="checkbox"]'
    );
    click(collapsed as HTMLElement);
    let change = editor.getChange();
    if (change?.kind === 'replace') {
      expect(readConfig(change.config).tree_nodes[0]?.children[0]?.collapsed).toBe(true);
    }

    const coverRadio = host.querySelectorAll<HTMLInputElement>(
      '[data-editor-node="d-e1"] [data-node-presentation] input[type="radio"]'
    )[1];
    click(coverRadio as HTMLElement);
    change = editor.getChange();
    if (change?.kind === 'replace') {
      expect(readConfig(change.config).tree_nodes[0]?.children[0]?.presentation).toBe('cover');
    }
    editor.dispose();
  });

  it('呈现配置分区：显示、目录树、背景与顶部区域', () => {
    const { box } = createTreeScenario();
    const editor = renderEditor(box, host);
    expect(host.querySelector('[data-editor-section="display"]')).not.toBeNull();
    expect(host.querySelector('[data-editor-section="tree"]')).not.toBeNull();
    expect(host.querySelector('[data-editor-section="background"]')).not.toBeNull();
    expect(host.querySelector('[data-editor-section="top_region"]')).not.toBeNull();
    editor.dispose();
  });

  it('基线前进替换配置、旧修订忽略，焦点请求不抛错', () => {
    const { box } = createTreeScenario();
    const editor = renderEditor(box, host);
    expect(() => editor.focus()).not.toThrow();

    const next = createBox({
      entries: box.entries,
      layout_config: readConfig({
        sidebar_width: 'wide',
        tree_nodes: [{ id: 'd-e1', entryId: 'e1', collapsed: false, children: [] }],
      }),
    });
    editor.update(next, 4);
    expect(editor.isDirty()).toBe(false);
    expect(host.querySelector('[data-editor-node="d-ghost"]')).toBeNull();

    editor.update(box, 2);
    editor.dispose();
  });
});
