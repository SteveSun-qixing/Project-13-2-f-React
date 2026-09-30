import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BaseCardView, IBaseCardEditorEventMap } from '@chips/sdk';
import { DEFAULT_CONFIG, buildContent, readConfig, validateConfig } from '../src/config';
import type { IImageConfig, IImageItem } from '../src/config';
import { resolveInsertionIndex } from '../src/shared/utils';
import { renderEditor, renderView } from '../src/render';

/**
 * 经 HTMLInputElement 原生的 value setter 写值：React 受控输入在实例上覆盖了 value 属性，
 * 直接赋值会被变更追踪去重；必须经原型原生 setter 携带接收器写入才能触发 onChange。
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
  config: Partial<IImageConfig>,
  overrides: Partial<BaseCardView> = {}
): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.image',
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

function urlItem(id: string, name: string, extra: Partial<IImageItem> = {}): IImageItem {
  return {
    id,
    source: 'url',
    file_path: '',
    url: `https://example.com/${name}`,
    alt: `${name} 替代文本`,
    title: `${name} 标题`,
    ...extra,
  };
}

function fileItem(id: string, path: string, extra: Partial<IImageItem> = {}): IImageItem {
  return {
    id,
    source: 'file',
    file_path: path,
    url: '',
    alt: '',
    title: '',
    ...extra,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('renderView（查看态）', () => {
  it('空配置呈现空态，不渲染任何图片', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard({}), container);
    expect(typeof dispose).toBe('function');
    expect(container.querySelector('[data-card-type="base.image"]')).not.toBeNull();
    expect(container.textContent).toContain('暂无图片内容');
    expect(container.querySelector('img')).toBeNull();
  });

  it('单图布局：渲染 img 的 src/alt/title，宽度百分比与对齐生效', () => {
    const container = document.createElement('div');
    renderView(
      createBasecard({
        images: [urlItem('a', 'hero.png')],
        layout_type: 'single',
        layout_options: {
          grid_mode: '2x2',
          single_width_percent: 70,
          single_alignment: 'left',
          spacing_mode: 'comfortable',
        },
      }),
      container
    );
    const img = container.querySelector<HTMLImageElement>('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://example.com/hero.png');
    expect(img!.getAttribute('alt')).toBe('hero.png 替代文本');
    expect(img!.getAttribute('title')).toBe('hero.png 标题');
    const frame = container.querySelector<HTMLElement>('[data-role="image-frame"]');
    expect(frame).not.toBeNull();
    const single = container.querySelector<HTMLElement>('[data-role="single-surface"]');
    expect(single?.style.justifyContent).toBe('flex-start');
    const holder = single?.firstElementChild as HTMLElement | null;
    expect(holder?.style.width).toBe('70%');
  });

  it('仅一张图时即使声明 grid 也按 single 有效布局渲染', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ images: [urlItem('a', 'one.png')], layout_type: 'grid' }), container);
    expect(container.querySelector('[data-role="single-surface"]')).not.toBeNull();
    expect(container.querySelector('[data-role="grid-surface"]')).toBeNull();
  });

  it('网格布局 2x2：六图裁剪为四格，末格呈现 +3 溢出角标', () => {
    const container = document.createElement('div');
    const images = Array.from({ length: 6 }, (_, index) => urlItem(`a${index}`, `${index}.png`));
    renderView(createBasecard({ images, layout_type: 'grid' }), container);
    const grid = container.querySelector<HTMLElement>('[data-role="grid-surface"]');
    expect(grid).not.toBeNull();
    expect(grid!.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    const frames = container.querySelectorAll('[data-role="image-frame"]');
    expect(frames).toHaveLength(4);
    const badge = container.querySelector('[data-role="grid-overflow-badge"]');
    expect(badge?.textContent).toBe('+3');
    const cells = container.querySelectorAll('[data-role="grid-cell"]');
    expect(cells).toHaveLength(4);
    expect(cells[cells.length - 1]?.contains(badge)).toBe(true);
  });

  it('3x3 网格三列渲染；3 列无限不裁剪且无溢出角标', () => {
    const images = Array.from({ length: 6 }, (_, index) => urlItem(`a${index}`, `${index}.png`));
    const three = document.createElement('div');
    renderView(createBasecard({ images, layout_type: 'grid', layout_options: { ...DEFAULT_CONFIG.layout_options, grid_mode: '3x3' } }), three);
    expect(
      (three.querySelector<HTMLElement>('[data-role="grid-surface"]') as HTMLElement).style.gridTemplateColumns
    ).toBe('repeat(3, minmax(0, 1fr))');
    expect(three.querySelectorAll('[data-role="image-frame"]')).toHaveLength(6);
    expect(three.querySelector('[data-role="grid-overflow-badge"]')).toBeNull();

    const infinite = document.createElement('div');
    renderView(
      createBasecard({
        images,
        layout_type: 'grid',
        layout_options: { ...DEFAULT_CONFIG.layout_options, grid_mode: '3-column-infinite' },
      }),
      infinite
    );
    expect(infinite.querySelectorAll('[data-role="image-frame"]')).toHaveLength(6);
    expect(infinite.querySelector('[data-role="grid-overflow-badge"]')).toBeNull();
  });

  it('间距模式 none：网格零间距且图框无圆角；comfortable 保留间距与圆角', () => {
    const images = [urlItem('a', '1.png'), urlItem('b', '2.png')];
    const flush = document.createElement('div');
    renderView(
      createBasecard({
        images,
        layout_type: 'grid',
        layout_options: { ...DEFAULT_CONFIG.layout_options, spacing_mode: 'none' },
      }),
      flush
    );
    const flushGrid = flush.querySelector<HTMLElement>('[data-role="grid-surface"]');
    expect(flushGrid!.style.gap).toBe('0px');
    expect(
      (flush.querySelector<HTMLElement>('[data-role="image-frame"]') as HTMLElement).style.borderRadius
    ).toBe('0px');

    const comfortable = document.createElement('div');
    renderView(createBasecard({ images, layout_type: 'grid' }), comfortable);
    const cozyGrid = comfortable.querySelector<HTMLElement>('[data-role="grid-surface"]');
    expect(cozyGrid!.style.gap).toBe('10px');
    expect(
      (comfortable.querySelector<HTMLElement>('[data-role="image-frame"]') as HTMLElement).style.borderRadius
    ).toBe('12px');
  });

  it('纵向长图布局按顺序完整展开全部图片', () => {
    const container = document.createElement('div');
    const images = [urlItem('a', '1.png'), urlItem('b', '2.png'), urlItem('c', '3.png')];
    renderView(createBasecard({ images, layout_type: 'long-scroll' }), container);
    expect(container.querySelector('[data-role="long-scroll-stack"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-role="image-frame"]')).toHaveLength(3);
    const sources = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));
    expect(sources).toEqual([
      'https://example.com/1.png',
      'https://example.com/2.png',
      'https://example.com/3.png',
    ]);
  });

  it('横向滚动布局渲染滚动容器，纵向滚轮转为横向滚动', () => {
    const container = document.createElement('div');
    const images = [urlItem('a', '1.png'), urlItem('b', '2.png')];
    renderView(createBasecard({ images, layout_type: 'horizontal-scroll' }), container);
    const scroller = container.querySelector<HTMLElement>('[data-role="horizontal-scroller"]');
    expect(scroller).not.toBeNull();
    expect(container.querySelectorAll('[data-role="image-frame"]')).toHaveLength(2);
    scroller!.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true }));
    expect(scroller!.scrollLeft).toBe(120);
  });

  it('file 来源以包内相对路径为 src，经帧内协议路径直接加载', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ images: [fileItem('a', 'photos/hero.png')] }), container);
    const img = container.querySelector<HTMLImageElement>('img');
    expect(img!.getAttribute('src')).toBe('photos/hero.png');
  });

  it('加载失败错误态：onError 后呈现占位提示，图片移除', async () => {
    const container = document.createElement('div');
    renderView(createBasecard({ images: [fileItem('a', 'photos/missing.png')] }), container);
    expect(container.querySelector('img')).not.toBeNull();
    container.querySelector('img')!.dispatchEvent(new Event('error'));
    await vi.waitFor(() => {
      expect(container.querySelector('img')).toBeNull();
      expect(container.textContent).toContain('图片暂时不可用');
    });
  });

  it('点击图片经 SDK chips 客户端真调用 resource:open 并携带资源描述', async () => {
    const request = vi.fn().mockResolvedValue({ mode: 'app' });
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(createBasecard({ images: [urlItem('a', 'hero.png')] }), container);
    const frame = container.querySelector<HTMLElement>('[data-role="image-frame"]');
    expect(frame?.getAttribute('role')).toBe('button');
    frame!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });
    const [capabilityId, input] = request.mock.calls[0] as [string, Record<string, unknown>];
    expect(capabilityId).toBe('resource:open');
    expect(input['intent']).toBe('view');
    const resource = input['resource'] as Record<string, unknown>;
    expect(resource['uri']).toBe('https://example.com/hero.png');
    expect(resource['mimeType']).toBe('image/png');
    expect(resource['fileName']).toBe('hero.png');
    expect(resource['title']).toBe('hero.png 标题');
    await vi.waitFor(() => {
      expect(container.querySelector('[role="status"]')).toBeNull();
    });
  });

  it('file 来源点击同样进入打开臂且 uri 为包内相对路径', async () => {
    const request = vi.fn().mockResolvedValue({});
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(createBasecard({ images: [fileItem('a', 'photos/hero.png', { title: '夜景' })] }), container);
    container
      .querySelector<HTMLElement>('[data-role="image-frame"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });
    const [, input] = request.mock.calls[0] as [string, Record<string, unknown>];
    expect((input['resource'] as Record<string, unknown>)['uri']).toBe('photos/hero.png');
    expect((input['resource'] as Record<string, unknown>)['title']).toBe('夜景');
  });

  it('打开被拒绝时呈现行内错误提示，不伪造成功', async () => {
    const request = vi.fn().mockRejectedValue(new Error('handler missing'));
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(createBasecard({ images: [urlItem('a', 'hero.png')] }), container);
    container
      .querySelector<HTMLElement>('[data-role="image-frame"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('暂时无法打开');
    });
  });

  it('未提供打开通道的渲染环境（无 window.chips）点击后行内如实提示', async () => {
    const container = document.createElement('div');
    renderView(createBasecard({ images: [urlItem('a', 'hero.png')] }), container);
    container
      .querySelector<HTMLElement>('[data-role="image-frame"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('暂时无法打开');
    });
  });

  it('更新调用覆盖旧内容且释放句柄幂等', () => {
    const container = document.createElement('div');
    const dispose = renderView(
      createBasecard({ images: [urlItem('a', '1.png'), urlItem('b', '2.png')] }),
      container
    );
    renderView(createBasecard({ images: [urlItem('a', '替换.png')] }, { revision: 2 }), container);
    expect(container.textContent).not.toContain('2.png 标题');
    expect((container.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe(
      'https://example.com/替换.png'
    );
    dispose();
    dispose();
  });
});

describe('renderEditor（编辑态）', () => {
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

  function clickButton(container: HTMLElement, role: string): void {
    const button = container.querySelector<HTMLButtonElement>(`[data-role="${role}"]`);
    expect(button, `缺少 data-role="${role}" 的按钮`).not.toBeNull();
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function writeByUrlInput(container: HTMLElement, value: string): void {
    const input = container.querySelector<HTMLInputElement>('input[data-role="add-url-input"]');
    expect(input).not.toBeNull();
    writeInputValue(input!, value);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function publishedConfig(editor: ReturnType<typeof renderEditor>): IImageConfig {
    const change = editor.getChange();
    expect(change).not.toBeNull();
    expect(change!.kind).toBe('replace');
    const content = change!.kind === 'replace' ? change!.content : {};
    expect(content['card_type']).toBe('base.image');
    return readConfig(content['config']);
  }

  it('挂载后呈现编辑表单与添加面板，getChange 初始为 null', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    expect(container.querySelector('input[data-role="add-url-input"]')).not.toBeNull();
    expect(container.querySelector('[data-role="add-by-url"]')).not.toBeNull();
    expect(container.textContent).toContain('工单063');
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('通过链接添加合法图片并发布 replace 变更，首图应用智能默认（单图 70% 居中）', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const { changes, dirties } = collectEvents(editor);

    writeByUrlInput(container, 'https://example.com/hero.png');
    clickButton(container, 'add-by-url');

    const config = publishedConfig(editor);
    expect(config.images).toHaveLength(1);
    expect(config.images[0]?.source).toBe('url');
    expect(config.images[0]?.url).toBe('https://example.com/hero.png');
    expect(config.layout_type).toBe('single');
    expect(config.layout_options.single_width_percent).toBe(70);
    expect(config.layout_options.single_alignment).toBe('center');
    expect(editor.isDirty()).toBe(true);
    expect(validateConfig(publishedConfig(editor))).toBe(true);
    expect(changes.length).toBe(1);
    expect(dirties).toEqual([{ isDirty: true }]);
    editor.dispose();
  });

  it('第二张图入列时智能默认切换为 grid 3x3', () => {
    const container = document.createElement('div');
    const editor = renderEditor(
      createBasecard({
        images: [urlItem('a', '1.png')],
        layout_type: 'single',
      }),
      container
    );
    collectEvents(editor);

    writeByUrlInput(container, 'https://example.com/2.png');
    clickButton(container, 'add-by-url');

    const config = publishedConfig(editor);
    expect(config.images).toHaveLength(2);
    expect(config.layout_type).toBe('grid');
    expect(config.layout_options.grid_mode).toBe('3x3');
    editor.dispose();
  });

  it('非法 URL（含 data:）行内报错且不发布变更', async () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const { changes } = collectEvents(editor);

    writeByUrlInput(container, 'data:image/png;base64,AAAA');
    clickButton(container, 'add-by-url');
    await vi.waitFor(() => {
      expect(container.textContent).toContain('图片 URL 不合法');
    });
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(0);

    writeByUrlInput(container, 'https://example.com/ok.png');
    clickButton(container, 'add-by-url');
    await vi.waitFor(() => {
      expect(container.textContent).not.toContain('图片 URL 不合法');
    });
    expect(editor.getChange()).not.toBeNull();
    editor.dispose();
  });

  it('空输入不发布变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const { changes } = collectEvents(editor);
    writeByUrlInput(container, '   ');
    clickButton(container, 'add-by-url');
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(0);
    editor.dispose();
  });

  it('选中图片可编辑标题与替代文本并随变更发布', () => {
    const container = document.createElement('div');
    const editor = renderEditor(
      createBasecard({ images: [urlItem('a', 'hero.png')] }),
      container
    );
    collectEvents(editor);

    const titleInput = container.querySelector<HTMLInputElement>('input[data-role="image-title-input"]');
    expect(titleInput).not.toBeNull();
    expect(titleInput!.value).toBe('hero.png 标题');
    writeInputValue(titleInput!, '东京塔夜景');
    titleInput!.dispatchEvent(new Event('input', { bubbles: true }));

    const altInput = container.querySelector<HTMLInputElement>('input[data-role="image-alt-input"]');
    writeInputValue(altInput!, '东京塔夜景照片');
    altInput!.dispatchEvent(new Event('input', { bubbles: true }));

    const config = publishedConfig(editor);
    expect(config.images[0]?.title).toBe('东京塔夜景');
    expect(config.images[0]?.alt).toBe('东京塔夜景照片');
    editor.dispose();
  });

  it('替换链接把选中图片切换为 url 来源', () => {
    const container = document.createElement('div');
    const editor = renderEditor(
      createBasecard({ images: [fileItem('a', 'photos/old.png')] }),
      container
    );
    collectEvents(editor);

    const replaceInput = container.querySelector<HTMLInputElement>('input[data-role="replace-url-input"]');
    writeInputValue(replaceInput!, 'https://example.com/new.png');
    replaceInput!.dispatchEvent(new Event('input', { bubbles: true }));
    clickButton(container, 'replace-by-url');

    const config = publishedConfig(editor);
    expect(config.images[0]?.source).toBe('url');
    expect(config.images[0]?.url).toBe('https://example.com/new.png');
    expect(config.images[0]?.file_path).toBe('');
    editor.dispose();
  });

  it('删除此图与清空全部发布合法变更（空图列表可发布）', () => {
    const container = document.createElement('div');
    const editor = renderEditor(
      createBasecard({ images: [urlItem('a', '1.png'), urlItem('b', '2.png')] }),
      container
    );
    collectEvents(editor);

    clickButton(container, 'remove-image');
    expect(publishedConfig(editor).images).toHaveLength(1);

    clickButton(container, 'clear-all');
    const cleared = publishedConfig(editor);
    expect(cleared.images).toHaveLength(0);
    expect(validateConfig(cleared)).toBe(true);
    editor.dispose();
  });

  it('多图时呈现布局类型卡，切换布局类型进入变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(
      createBasecard({
        images: [urlItem('a', '1.png'), urlItem('b', '2.png')],
        layout_type: 'grid',
      }),
      container
    );
    collectEvents(editor);

    expect(container.querySelector('[data-role="layout-card-horizontal_scroll"]')).not.toBeNull();
    expect(container.querySelector('[data-role="layout-card-single"]')).toBeNull();
    clickButton(container, 'layout-card-horizontal_scroll');

    expect(publishedConfig(editor).layout_type).toBe('horizontal-scroll');
    editor.dispose();
  });

  it('单图时呈现单图模式提示、宽度滑杆与对齐按钮', () => {
    const container = document.createElement('div');
    const editor = renderEditor(
      createBasecard({ images: [urlItem('a', '1.png')] }),
      container
    );
    collectEvents(editor);

    expect(container.textContent).toContain('当前只有 1 张图片');
    expect(container.querySelector('[data-role="single-width-slider"]')).not.toBeNull();
    expect(container.querySelector('[data-role="align-left"]')).not.toBeNull();

    clickButton(container, 'align-right');
    expect(publishedConfig(editor).layout_options.single_alignment).toBe('right');
    editor.dispose();
  });

  it('网格模式下可切换网格模式与间距模式', () => {
    const container = document.createElement('div');
    const editor = renderEditor(
      createBasecard({
        images: [urlItem('a', '1.png'), urlItem('b', '2.png')],
        layout_type: 'grid',
      }),
      container
    );
    collectEvents(editor);

    const segmentedInputs = container.querySelectorAll<HTMLInputElement>(
      '[data-role="grid-mode-segmented"] input[type="radio"]'
    );
    expect(segmentedInputs.length).toBe(3);
    segmentedInputs[2]!.click();
    expect(publishedConfig(editor).layout_options.grid_mode).toBe('3-column-infinite');

    clickButton(container, 'spacing-none');
    expect(publishedConfig(editor).layout_options.spacing_mode).toBe('none');

    clickButton(container, 'spacing-comfortable');
    expect(publishedConfig(editor).layout_options.spacing_mode).toBe('comfortable');
    editor.dispose();
  });

  it('拖拽排序：越阈值启动拖拽，落点发布顺序变更', async () => {
    const container = document.createElement('div');
    const editor = renderEditor(
      createBasecard({ images: [urlItem('a', '1.png'), urlItem('b', '2.png')] }),
      container
    );
    collectEvents(editor);

    const tiles = container.querySelectorAll<HTMLElement>('[data-role="image-tile"]');
    expect(tiles).toHaveLength(2);
    tiles[1]!.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 300,
        clientY: 300,
      })
    );
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 330, clientY: 330 }));
    await vi.waitFor(() => {
      expect(container.querySelector('[data-role="delete-tray"]')?.getAttribute('data-active')).toBe('true');
    });

    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 330, clientY: 330 }));
    const config = publishedConfig(editor);
    expect(config.images.map((image) => image.id)).toEqual(['b', 'a']);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-role="delete-tray"]')?.getAttribute('data-active')).toBe('false');
    });
    editor.dispose();
  });

  it('拖入删除托盘删除图片', async () => {
    const container = document.createElement('div');
    const editor = renderEditor(
      createBasecard({ images: [urlItem('a', '1.png'), urlItem('b', '2.png')] }),
      container
    );
    collectEvents(editor);

    const tiles = container.querySelectorAll<HTMLElement>('[data-role="image-tile"]');
    tiles[0]!.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 200,
        clientY: 200,
      })
    );
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 230, clientY: 230 }));
    await vi.waitFor(() => {
      expect(container.querySelector('[data-role="delete-tray"]')?.getAttribute('data-active')).toBe('true');
    });

    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 0 }));
    await vi.waitFor(() => {
      expect(container.querySelector('[data-role="delete-tray"]')?.getAttribute('data-over')).toBe('true');
    });
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 0, clientY: 0 }));

    expect(publishedConfig(editor).images.map((image) => image.id)).toEqual(['b']);
    editor.dispose();
  });

  it('dispose 后丢弃待提交变更且不再发布事件；同容器可重新挂载', () => {
    const container = document.createElement('div');
    const editor = renderEditor(
      createBasecard({ images: [urlItem('a', '1.png')] }),
      container
    );
    const { changes } = collectEvents(editor);
    const input = container.querySelector<HTMLInputElement>('input[data-role="add-url-input"]');
    expect(input).not.toBeNull();
    editor.dispose();
    expect(editor.state).toBe('disposed');
    writeInputValue(input!, 'https://example.com/late.png');
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(0);
    editor.dispose();

    const second = renderEditor(createBasecard({ images: [urlItem('a', '1.png')] }), container);
    expect(second).not.toBe(editor);
    second.dispose();
  });

  it('markCommitted 以新 revision 清除待提交变更；旧 revision 不生效', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    writeByUrlInput(container, 'https://example.com/hero.png');
    clickButton(container, 'add-by-url');
    expect(editor.isDirty()).toBe(true);

    editor.markCommitted(1);
    expect(editor.isDirty()).toBe(true);

    editor.markCommitted(2);
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('update 以更高 revision 重挂载基线配置并清空待提交变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    writeByUrlInput(container, 'https://example.com/hero.png');
    clickButton(container, 'add-by-url');
    expect(editor.isDirty()).toBe(true);

    editor.update(
      createBasecard({ images: [urlItem('x', '外部.png')] }, { revision: 5 }),
      5
    );
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    const titleInput = container.querySelector<HTMLInputElement>('input[data-role="image-title-input"]');
    expect(titleInput?.value).toBe('外部.png 标题');
    editor.dispose();
  });
});

describe('resolveInsertionIndex（拖拽落点纯函数）', () => {
  const rect = (left: number, top: number, width = 100, height = 100): DOMRect =>
    ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      x: left,
      y: top,
      toJSON: () => undefined,
    });

  it('取与拖拽图块中心最近的槽位', () => {
    const rects = [rect(0, 0), rect(120, 0), rect(240, 0)];
    expect(resolveInsertionIndex(50, 50, rects, 3)).toBe(0);
    expect(resolveInsertionIndex(170, 10, rects, 3)).toBe(1);
    expect(resolveInsertionIndex(1000, 1000, rects, 3)).toBe(2);
  });

  it('无图块时回落到末尾槽位', () => {
    expect(resolveInsertionIndex(10, 10, [], 2)).toBe(2);
  });
});
