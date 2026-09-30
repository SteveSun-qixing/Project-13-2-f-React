import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BaseCardView } from '@chips/sdk';
import { buildContent, DEFAULT_CONFIG, validateConfig } from '../src/config';
import { renderEditor, renderView } from '../src/render';
import type { IBaseCardEditorEventMap } from '@chips/sdk';

/**
 * 渲染面测试：jsdom 真实挂载 renderView / renderEditor（IBaseCardPlugin 渲染面）；
 * 打开臂断言 SDK `chips` 客户端真调用 `resource:open` 携带 14 §5.4 载荷。
 */

/**
 * 经 HTMLInputElement 原生的 value setter 写值：
 * React 受控输入在实例上覆盖了 value 属性，直接赋值会被变更追踪去重；
 * 必须经原型原生 setter 携带接收器写入才能触发 onChange（模拟真实用户输入）。
 */
function writeInputValue(input: HTMLInputElement, value: string): void {
  // Object.getOwnPropertyDescriptor 是 lib 静态方法引用（不消费 this），
  // 提取原生 setter 的唯一正规入口，此处 unbound-method 属误报，定向豁免。
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    ?.set;
  setter?.call(input, value);
}

function createBasecard(
  config: Record<string, unknown>,
  overrides: Partial<BaseCardView> = {}
): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.book',
    content: buildContent({ ...DEFAULT_CONFIG, ...config }),
    revision: 1,
    card: {
      card_id: 'z9Y8x7W6v5',
      name: '示例卡片',
      chip_standards_version: '1.0.0',
      cover_ratio: '3:2',
      tags: [],
    },
    ...overrides,
  };
}

const FULL_EBOOK_CONFIG = {
  source_type: 'ebook' as const,
  book_file: 'books/demo.epub',
  book_format: 'epub',
  book_name: '示例书籍',
  book_author: '艾丽丝',
  cover_image: 'covers/demo.jpg',
  image_sequence: [],
  image_sort_basis: 'filename' as const,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('renderView', () => {
  it('呈现封面、标题、作者与格式元信息，同步提交首帧', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(FULL_EBOOK_CONFIG), container);
    expect(typeof dispose).toBe('function');
    expect(container.querySelector('[data-card-type="base.book"]')).not.toBeNull();
    expect(container.textContent).toContain('示例书籍');
    expect(container.textContent).toContain('艾丽丝');
    expect(container.textContent).toContain('EPUB');
    expect(container.querySelector('img[data-role="book-cover"]')).not.toBeNull();
    expect(container.querySelector('button[data-role="book-open"]')).not.toBeNull();
  });

  it('封面引用按内容原样进入协议路径', () => {
    const container = document.createElement('div');
    renderView(createBasecard(FULL_EBOOK_CONFIG), container);
    const cover = container.querySelector('img[data-role="book-cover"]');
    expect((cover as HTMLImageElement).getAttribute('src')).toBe('covers/demo.jpg');
  });

  it('未配置封面时呈现占位图标', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ ...FULL_EBOOK_CONFIG, cover_image: '' }), container);
    expect(container.querySelector('img[data-role="book-cover"]')).toBeNull();
    expect(container.querySelector('[data-role="book-cover-placeholder"]')).not.toBeNull();
  });

  it('书名缺失时从文件名派生标题，作者缺失时呈现兜底文案', () => {
    const container = document.createElement('div');
    renderView(
      createBasecard({
        book_file: 'books/三国演义.epub',
        book_format: 'epub',
        cover_image: '',
      }),
      container
    );
    expect(container.textContent).toContain('三国演义');
    expect(container.textContent).toContain('未知作者');
  });

  it('未配置主资源时呈现空态且不提供打开按钮', () => {
    const container = document.createElement('div');
    renderView(createBasecard({}), container);
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('未选择电子书');
  });

  it('图片序列呈现张数元信息与序列格式标签', () => {
    const container = document.createElement('div');
    renderView(
      createBasecard({
        source_type: 'image-sequence',
        book_name: '漫画',
        book_format: 'cbz',
        cover_image: 'comic/001.jpg',
        image_sequence: [
          { id: 'one', file_path: 'comic/001.jpg', file_name: '001.jpg' },
          { id: 'two', file_path: 'comic/002.jpg', file_name: '002.jpg' },
        ],
      }),
      container
    );
    expect(container.textContent).toContain('CBZ');
    expect(container.textContent).toContain('2 张图片');
  });

  it('点击打开经 SDK chips 客户端真调用 resource:open 并携带书籍卡片载荷', async () => {
    const request = vi.fn().mockResolvedValue({ mode: 'app' });
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(createBasecard(FULL_EBOOK_CONFIG), container);
    const button = container.querySelector<HTMLButtonElement>('button[data-role="book-open"]');
    expect(button).not.toBeNull();
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();
    await Promise.resolve();
    const [capabilityId, input] = request.mock.calls[0] as [string, Record<string, unknown>];
    expect(capabilityId).toBe('resource:open');
    expect(input['intent']).toBe('view');
    const resource = input['resource'] as Record<string, unknown>;
    expect(resource['uri']).toBe('books/demo.epub');
    expect(resource['mimeType']).toBe('application/epub+zip');
    expect(resource['title']).toBe('示例书籍');
    const payload = resource['payload'] as Record<string, unknown>;
    expect(payload['kind']).toBe('chips.book-card');
    expect(payload['cardType']).toBe('base.book');
    expect(payload['mode']).toBe('ebook');
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('图片序列按排序依据整组随载荷打开，主资源为序列首项', async () => {
    const request = vi.fn().mockResolvedValue({ mode: 'app' });
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(
      createBasecard({
        source_type: 'image-sequence',
        book_name: '漫画',
        image_sequence: [
          { id: 'two', file_path: 'comic/002.jpg', file_name: '002.jpg', entry_time: 2 },
          { id: 'one', file_path: 'comic/001.jpg', file_name: '001.jpg', entry_time: 1 },
        ],
        image_sort_basis: 'entry-time',
      }),
      container
    );
    container
      .querySelector<HTMLButtonElement>('button[data-role="book-open"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });
    const [, input] = request.mock.calls[0] as [string, Record<string, unknown>];
    const resource = input['resource'] as Record<string, unknown>;
    expect(resource['uri']).toBe('comic/001.jpg');
    const payload = resource['payload'] as Record<string, unknown>;
    expect(payload['mode']).toBe('image-sequence');
    const images = (payload['resources'] as Record<string, unknown>)['images'] as Array<
      Record<string, unknown>
    >;
    expect(images.map((image) => image['uri'])).toEqual(['comic/001.jpg', 'comic/002.jpg']);
  });

  it('打开被拒绝时呈现行内错误提示，不伪造成功', async () => {
    const request = vi.fn().mockRejectedValue(new Error('handler missing'));
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(createBasecard(FULL_EBOOK_CONFIG), container);
    container
      .querySelector<HTMLButtonElement>('button[data-role="book-open"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('暂时无法打开');
    });
  });

  it('更新调用覆盖旧内容且释放句柄幂等', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(FULL_EBOOK_CONFIG), container);
    renderView(
      createBasecard({ ...FULL_EBOOK_CONFIG, book_name: '更新后的书名' }, { revision: 2 }),
      container
    );
    expect(container.textContent).toContain('更新后的书名');
    expect(container.textContent).not.toContain('示例书籍');
    dispose();
    dispose();
  });
});

describe('renderEditor', () => {
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

  function writeField(container: HTMLElement, role: string, value: string): void {
    const input = container.querySelector<HTMLInputElement>(`input[data-role="${role}"]`);
    expect(input).not.toBeNull();
    writeInputValue(input!, value);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('挂载后容器内呈现编辑表单，getChange 初始为 null', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(FULL_EBOOK_CONFIG), container);
    expect(container.querySelector('input[data-role="book-path-input"]')).not.toBeNull();
    expect(container.querySelector('input[data-role="book-name-input"]')).not.toBeNull();
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('书籍路径与格式完整即可发布 replace 变更并标记 dirty', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const { changes, dirties } = collectEvents(editor);

    writeField(container, 'book-path-input', 'books/demo.epub');
    expect(editor.getChange()).toBeNull();

    writeField(container, 'book-format-input', 'epub');

    const change = editor.getChange();
    expect(change).not.toBeNull();
    expect(change!.kind).toBe('replace');
    const content = change!.kind === 'replace' ? change!.content : {};
    expect(content['card_type']).toBe('base.book');
    expect(validateConfig(content['config'])).toBe(true);
    expect((content['config'] as Record<string, unknown>)['book_file']).toBe('books/demo.epub');
    expect(editor.isDirty()).toBe(true);
    expect(changes.length).toBe(1);
    expect(dirties).toEqual([{ isDirty: true }]);
    editor.dispose();
  });

  it('书籍路径非法时不发布变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const { changes } = collectEvents(editor);

    writeField(container, 'book-path-input', '../escape.epub');
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(0);
    editor.dispose();
  });

  it('格式非法时呈现行内错误且不发布，修正后恢复发布', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(FULL_EBOOK_CONFIG), container);
    const { changes } = collectEvents(editor);

    writeField(container, 'book-format-input', 'lit');
    expect(editor.getChange()).toBeNull();
    expect(container.textContent).toContain('book_format 必须为受支持的电子书或图片包格式');

    writeField(container, 'book-format-input', 'pdf');
    expect(editor.getChange()).not.toBeNull();
    expect(changes.length).toBe(1);
    editor.dispose();
  });

  it('图片序列可添加条目，路径填写完整后进入变更', async () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({
      source_type: 'image-sequence',
      image_sequence: [],
      book_file: '',
      book_format: '',
    }), container);
    collectEvents(editor);

    container
      .querySelector<HTMLButtonElement>('button[data-role="add-image-item"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // 新条目路径为空：允许的中间非法态，不发布变更。
    expect(editor.getChange()).toBeNull();

    // 面板草稿状态在微任务中落 DOM，排空后再查询新增条目的路径输入。
    await Promise.resolve();
    await Promise.resolve();
    const input = container.querySelector<HTMLInputElement>('input[data-role^="image-path-input-"]');
    expect(input).not.toBeNull();
    writeInputValue(input!, 'comic/001.jpg');
    input!.dispatchEvent(new Event('input', { bubbles: true }));

    const change = editor.getChange()!;
    const images = (change.kind === 'replace'
      ? (change.content['config'] as Record<string, unknown>)['image_sequence']
      : []) as Array<Record<string, unknown>>;
    expect(images).toHaveLength(1);
    expect(images[0]!['file_path']).toBe('comic/001.jpg');
    expect(images[0]!['file_name']).toBe('001.jpg');
    editor.dispose();
  });

  it('图片序列条目可移除并进入变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({
      source_type: 'image-sequence',
      image_sequence: [
        { id: 'one', file_path: 'comic/001.jpg', file_name: '001.jpg' },
        { id: 'two', file_path: 'comic/002.jpg', file_name: '002.jpg' },
      ],
      book_file: '',
      book_format: '',
    }), container);
    collectEvents(editor);

    container
      .querySelector<HTMLButtonElement>('button[data-role="remove-image-item-two"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const change = editor.getChange()!;
    const images = (change.kind === 'replace'
      ? (change.content['config'] as Record<string, unknown>)['image_sequence']
      : []) as Array<Record<string, unknown>>;
    expect(images.map((image) => image['id'])).toEqual(['one']);
    editor.dispose();
  });

  it('markCommitted 以新 revision 清除待提交变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    writeField(container, 'book-path-input', 'books/demo.epub');
    writeField(container, 'book-format-input', 'epub');
    expect(editor.isDirty()).toBe(true);

    editor.markCommitted(2);
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.markCommitted(1);
    editor.dispose();
  });

  it('dispose 后丢弃待提交变更且不再发布事件', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(FULL_EBOOK_CONFIG), container);
    const { changes } = collectEvents(editor);
    const input = container.querySelector<HTMLInputElement>('input');
    expect(input).not.toBeNull();
    editor.dispose();
    expect(editor.state).toBe('disposed');
    writeInputValue(input!, '再改一次');
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(0);
    editor.dispose();
  });

  it('dispose 后同一容器可重新挂载编辑器，不并存两个编辑器', () => {
    const container = document.createElement('div');
    const first = renderEditor(createBasecard(FULL_EBOOK_CONFIG), container);
    first.dispose();
    const second = renderEditor(createBasecard(FULL_EBOOK_CONFIG), container);
    expect(second).not.toBe(first);
    second.dispose();
  });
});
