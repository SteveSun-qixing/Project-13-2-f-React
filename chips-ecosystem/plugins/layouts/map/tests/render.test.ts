import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type {
  BoxRenderView,
  Dispose,
  EntryTicket,
  EntryView,
  IBoxLayoutFrameRuntime,
} from '@chips/sdk';
import { DEFAULT_BOUNDS, readConfig } from '../src/config';
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

const CUSTOM_BOUNDS = { west: -10, south: -20, east: 30, north: 40 };

function createBox(overrides: Record<string, unknown> = {}): BoxRenderView {
  return {
    kind: 'box',
    box_id: 'a1B2c3D4e5',
    name: '示例箱子',
    chip_standards_version: '1.0.0',
    revision: 1,
    active_layout_type: 'chips.layout.map',
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

function queryMarker(container: HTMLElement, entryId: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-map-marker][data-entry-id="${entryId}"]`);
}

describe('renderLayout：结构骨架', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.replaceChildren(container);
  });

  it('空箱子呈现地图骨架与空态提示，释放后清空挂载且幂等', () => {
    const dispose = renderLayout(createBox(), container);
    expect(container.textContent).toContain('这里还没有内容');
    expect(container.textContent).toContain('在编辑器中添加卡片或箱子，开始填充这个箱子');
    expect(container.querySelector('[data-map-skeleton]')).not.toBeNull();
    dispose();
    dispose();
    expect(container.childNodes).toHaveLength(0);
  });

  it('禁用条目不参与渲染', () => {
    const disabled = { ...createEntry('e0', '停用条目', 0), enabled: false };
    const dispose = renderLayout(
      createBox({
        entries: [disabled, createEntry('e1', '东京站', 1)],
        layout_config: { map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...DEFAULT_BOUNDS } } },
      }),
      container
    );
    expect(container.textContent).not.toContain('停用条目');
    expect(container.textContent).toContain('东京站');
    dispose();
  });
});

describe('renderLayout：地理投影与标记', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.replaceChildren(container);
  });

  it('按线性边界投影定位标记：西经 10°–东经 30°、南纬 20°–北纬 40°', () => {
    const dispose = renderLayout(
      createBox({
        entries: [createEntry('e1', '东京站', 0), createEntry('e2', '大阪湾', 1)],
        layout_config: {
          map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...CUSTOM_BOUNDS } },
          default_view: { latitude: 10, longitude: 10, zoom: 1 },
          entries: {
            e1: { latitude: 40, longitude: 10 },
            e2: { latitude: -20, longitude: 30, labelOverride: '湾岸' },
          },
        },
      }),
      container
    );

    const first = queryMarker(container, 'e1');
    expect(first).not.toBeNull();
    expect(first?.getAttribute('data-marker-style')).toBe('dot-title');
    expect(first?.style.left).toBe('50%');
    expect(first?.style.top).toBe('0%');
    expect(first?.textContent).toContain('东京站');

    const second = queryMarker(container, 'e2');
    expect(second?.getAttribute('data-marker-style')).toBe('dot-title');
    expect(second?.style.left).toBe('100%');
    expect(second?.style.top).toBe('100%');
    expect(second?.textContent).toContain('湾岸');
    dispose();
  });

  it('pin-title 样式写入 data-marker-style 且显示名覆盖优先', () => {
    const dispose = renderLayout(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: {
          map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...DEFAULT_BOUNDS } },
          marker_style: 'pin-title',
          entries: { e1: { latitude: 10, longitude: 10, labelOverride: '出发地' } },
        },
      }),
      container
    );
    const marker = queryMarker(container, 'e1');
    expect(marker?.getAttribute('data-marker-style')).toBe('pin-title');
    expect(marker?.textContent).toContain('出发地');
    dispose();
  });

  it('未定位条目单列呈现且可经控制区打开', () => {
    const { runtime, openDocument } = createFrameRuntime();
    attachRuntime(runtime);
    const dispose = renderLayout(
      createBox({
        entries: [createEntry('e1', '未定位条目', 0), createEntry('e2', '已定位条目', 1)],
        layout_config: {
          map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...DEFAULT_BOUNDS } },
          entries: { e2: { latitude: 10, longitude: 10 } },
        },
      }),
      container
    );

    const unlocated = container.querySelector('[data-unlocated]');
    expect(unlocated).not.toBeNull();
    expect(unlocated?.textContent).toContain('未定位条目');
    expect(unlocated?.textContent).not.toContain('已定位条目');

    const button = unlocated?.querySelector<HTMLButtonElement>('[data-unlocated-entry]');
    click(button as HTMLElement);
    expect(openDocument).toHaveBeenCalledWith('chips-resource://plugin-1/e1.card');
    dispose();
  });

  it('默认视图决定世界层平移，缩放控制按 0.25 步进夹取', async () => {
    const dispose = renderLayout(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: {
          map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...DEFAULT_BOUNDS } },
          default_view: { latitude: 0, longitude: 0, zoom: 1 },
          entries: { e1: { latitude: 10, longitude: 10 } },
        },
      }),
      container
    );

    const world = (): HTMLElement | null =>
      container.querySelector<HTMLElement>('[data-map-world]');
    expect(world()?.style.transform).toBe('translate(0%, 0%) scale(1)');

    const zoomIn = container.querySelector<HTMLButtonElement>('[data-map-zoom="in"]');
    const zoomOut = container.querySelector<HTMLButtonElement>('[data-map-zoom="out"]');
    click(zoomIn as HTMLElement);
    await vi.waitFor(() => {
      expect(world()?.style.transform).toBe('translate(0%, 0%) scale(1.25)');
    });
    click(zoomIn as HTMLElement);
    click(zoomOut as HTMLElement);
    click(zoomOut as HTMLElement);
    await vi.waitFor(() => {
      expect(world()?.style.transform).toBe('translate(0%, 0%) scale(1)');
    });

    const reset = container.querySelector<HTMLButtonElement>('[data-map-reset-view]');
    click(reset as HTMLElement);
    await vi.waitFor(() => {
      expect(world()?.style.transform).toBe('translate(0%, 0%) scale(1)');
    });
    dispose();
  });

  it('中心点非法时世界层回退居中投影', () => {
    const dispose = renderLayout(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: {
          map_source: {
            mode: 'image',
            projection: 'linear-bounds',
            bounds: { west: 139.5, south: 35.5, east: 139.9, north: 35.9 },
          },
          default_view: { latitude: 91, longitude: 0, zoom: 1 },
          entries: { e1: { latitude: 35.7, longitude: 139.7 } },
        },
      }),
      container
    );
    expect(container.querySelector<HTMLElement>('[data-map-world]')?.style.transform).toBe(
      'translate(0%, 0%) scale(1)'
    );
    dispose();
  });

  it('host-map 模式诚实降级：呈现状态提示且不渲染标记世界层', () => {
    const dispose = renderLayout(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: {
          map_source: { mode: 'host-map', projection: 'web-mercator', bounds: { ...DEFAULT_BOUNDS } },
          entries: { e1: { latitude: 10, longitude: 10 } },
        },
      }),
      container
    );
    const unavailable = container.querySelector('[data-map-unavailable]');
    expect(unavailable).not.toBeNull();
    expect(unavailable?.textContent).toContain('尚未提供');
    expect(container.querySelectorAll('[data-map-marker]')).toHaveLength(0);
    expect(container.querySelector('[data-map-world]')).toBeNull();
    dispose();
  });

  it('图片底图：配置资产路径时呈现底图，缺省时呈现内置静态底图', () => {
    const withAsset = renderLayout(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: {
          map_source: {
            mode: 'image',
            projection: 'linear-bounds',
            assetPath: 'assets/layouts/map/base-map/world.png',
            bounds: { ...DEFAULT_BOUNDS },
          },
          entries: { e1: { latitude: 10, longitude: 10 } },
        },
      }),
      container
    );
    const assetImage = container.querySelector<HTMLImageElement>('[data-map-asset-image]');
    expect(assetImage).not.toBeNull();
    expect(assetImage?.getAttribute('src')).toContain('assets/layouts/map/base-map/world.png');
    withAsset();

    container = document.createElement('div');
    document.body.replaceChildren(container);
    const withoutAsset = renderLayout(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: {
          map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...DEFAULT_BOUNDS } },
          entries: { e1: { latitude: 10, longitude: 10 } },
        },
      }),
      container
    );
    expect(container.querySelector('[data-map-default-image]')).not.toBeNull();
    expect(container.querySelector('[data-map-asset-image]')).toBeNull();
    withoutAsset();
  });
});

describe('renderLayout：顶部内容区', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.replaceChildren(container);
  });

  it('代码模式经受控文档帧内联呈现', () => {
    const dispose = renderLayout(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: {
          map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...DEFAULT_BOUNDS } },
          entries: { e1: { latitude: 10, longitude: 10 } },
          top_region: { mode: 'html', html: '<section>顶部内容</section>' },
        },
      }),
      container
    );
    const frame = container.querySelector<HTMLIFrameElement>('iframe');
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute('srcdoc')).toContain('<section>顶部内容</section>');
    dispose();
  });

  it('图片模式经箱子资源相对路径呈现', () => {
    const dispose = renderLayout(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: {
          map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...DEFAULT_BOUNDS } },
          entries: { e1: { latitude: 10, longitude: 10 } },
          top_region: { mode: 'image', assetPath: 'assets/layouts/map/top-region/header.png' },
        },
      }),
      container
    );
    const frame = container.querySelector<HTMLIFrameElement>('iframe');
    expect(frame?.getAttribute('src')).toContain('assets/layouts/map/top-region/header.png');
    dispose();
  });

  it('none 模式与非法区域不产生帧', () => {
    const dispose = renderLayout(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: {
          map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...DEFAULT_BOUNDS } },
          entries: { e1: { latitude: 10, longitude: 10 } },
          top_region: { mode: 'none' },
        },
      }),
      container
    );
    expect(container.querySelectorAll('iframe')).toHaveLength(0);
    dispose();
  });
});

describe('renderLayout：条目选中与预览', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.replaceChildren(container);
  });

  it('选中标记挂载条目预览帧，再次点击经 openDocument 打开', async () => {
    const { runtime, requestEntries, mountEntry, openDocument } = createFrameRuntime();
    requestEntries.mockResolvedValue([createTicket('e1')]);
    attachRuntime(runtime);
    const dispose = renderLayout(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: {
          map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...DEFAULT_BOUNDS } },
          entries: { e1: { latitude: 10, longitude: 10 } },
        },
      }),
      container
    );

    const marker = queryMarker(container, 'e1');
    click(marker as HTMLElement);
    await vi.waitFor(() => {
      const preview = container.querySelector('[data-map-selected]');
      expect(preview).not.toBeNull();
      expect(requestEntries).toHaveBeenCalledWith({ entryIds: ['e1'] });
      expect(mountEntry).toHaveBeenCalledTimes(1);
      const ticket = mountEntry.mock.calls[0]?.[0];
      expect(ticket?.entry_id).toBe('e1');
      const slot = container.querySelector('[data-entry-slot]');
      expect(slot).not.toBeNull();
      expect(mountEntry.mock.calls[0]?.[1]).toBe(slot);
    });

    click(container.querySelector('[data-map-selected] [data-open-entry]') as HTMLElement);
    expect(openDocument).toHaveBeenCalledWith('chips-resource://plugin-1/e1.card');

    click(queryMarker(container, 'e1') as HTMLElement);
    expect(openDocument).toHaveBeenCalledTimes(2);

    click(container.querySelector('[data-close-preview]') as HTMLElement);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-map-selected]')).toBeNull();
    });
    dispose();
  });

  it('关闭封面显示后选中只呈现标题摘要，不挂载条目帧', async () => {
    const { runtime, requestEntries } = createFrameRuntime();
    attachRuntime(runtime);
    const dispose = renderLayout(
      createBox({
        entries: [
          {
            ...createEntry('e1', '东京站', 0),
            snapshot: { summary: '关东地区交通枢纽' },
          },
        ],
        layout_config: {
          map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...DEFAULT_BOUNDS } },
          show_cover_on_select: false,
          entries: { e1: { latitude: 10, longitude: 10 } },
        },
      }),
      container
    );

    click(queryMarker(container, 'e1') as HTMLElement);
    await vi.waitFor(() => {
      const preview = container.querySelector('[data-map-selected]');
      expect(preview).not.toBeNull();
      expect(preview?.textContent).toContain('东京站');
      expect(preview?.textContent).toContain('关东地区交通枢纽');
    });
    expect(container.querySelector('[data-entry-slot]')).toBeNull();
    expect(requestEntries).not.toHaveBeenCalled();
    dispose();
  });

  it('打开失败映射为简体中文提示', async () => {
    const { runtime, openDocument } = createFrameRuntime();
    openDocument.mockRejectedValue(new Error('denied'));
    attachRuntime(runtime);
    const dispose = renderLayout(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: {
          map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...DEFAULT_BOUNDS } },
          show_cover_on_select: false,
          entries: { e1: { latitude: 10, longitude: 10 } },
        },
      }),
      container
    );

    click(queryMarker(container, 'e1') as HTMLElement);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-map-selected]')).not.toBeNull();
    });
    click(container.querySelector('[data-map-selected] [data-open-entry]') as HTMLElement);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-map-selected]')?.textContent).toContain(
        '条目暂时无法打开'
      );
    });
    dispose();
  });
});

describe('renderEditor', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.replaceChildren(host);
  });

  it('呈现底图、视图与条目定位分区并列出条目', () => {
    const editor = renderEditor(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: readConfig({
          map_source: {
            mode: 'image',
            projection: 'linear-bounds',
            bounds: { west: -10, south: -20, east: 30, north: 40 },
          },
          entries: { e1: { latitude: 10, longitude: 10, labelOverride: '出发地' } },
        }),
      }),
      host
    );
    expect(editor.state).toBe('active');
    expect(editor.isDirty()).toBe(false);
    expect(host.textContent).toContain('地图底图');
    expect(host.textContent).toContain('默认视图');
    expect(host.textContent).toContain('条目定位');
    expect(host.textContent).toContain('顶部内容区');
    expect(host.textContent).toContain('静态图片');
    expect(host.textContent).toContain('东京站');
    const labelOverride = host.querySelector<HTMLInputElement>('#map-entry-label-e1');
    expect(labelOverride?.value).toBe('出发地');
    const west = host.querySelector<HTMLInputElement>('#map-bounds-west');
    expect(west?.value).toBe('-10');
    editor.dispose();
    editor.dispose();
    expect(editor.state).toBe('disposed');
    expect(editor.getChange()).toBeNull();
    expect(editor.isDirty()).toBe(false);
  });

  it('边界输入产出归一化 replace 变更并在提交后清脏', () => {
    const editor = renderEditor(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: readConfig({
          map_source: {
            mode: 'image',
            projection: 'linear-bounds',
            bounds: { west: -10, south: -20, east: 30, north: 40 },
          },
          entries: { e1: { latitude: 10, longitude: 10 } },
        }),
      }),
      host
    );
    const changes: string[] = [];
    editor.subscribe('change', (payload) => {
      changes.push(payload.change.kind);
    });

    const west = host.querySelector<HTMLInputElement>('#map-bounds-west');
    setInputValue(west as HTMLInputElement, '-5');

    const change = editor.getChange();
    expect(change).not.toBeNull();
    expect(change?.kind).toBe('replace');
    if (change?.kind === 'replace') {
      expect(change.schemaVersion).toBe('1.0.0');
      expect(readConfig(change.config).map_source.bounds).toEqual({
        west: -5,
        south: -20,
        east: 30,
        north: 40,
      });
    }
    expect(changes).toEqual(['replace']);
    expect(editor.isDirty()).toBe(true);

    editor.markCommitted(2);
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('条目定位输入与清除定位产出配置变更', () => {
    const editor = renderEditor(
      createBox({
        entries: [createEntry('e1', '东京站', 0), createEntry('e2', '大阪站', 1)],
        layout_config: readConfig({
          map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...DEFAULT_BOUNDS } },
          entries: { e1: { latitude: 10, longitude: 10 } },
        }),
      }),
      host
    );

    const latitude = host.querySelector<HTMLInputElement>('#map-entry-latitude-e1');
    setInputValue(latitude as HTMLInputElement, '35.5');
    let change = editor.getChange();
    expect(change?.kind).toBe('replace');
    if (change?.kind === 'replace') {
      expect(readConfig(change.config).entries['e1']?.latitude).toBe(35.5);
    }

    const clear = host.querySelector<HTMLButtonElement>('[data-clear-location="e1"]');
    click(clear as HTMLElement);
    change = editor.getChange();
    if (change?.kind === 'replace') {
      expect(readConfig(change.config).entries['e1']).toBeUndefined();
      expect(readConfig(change.config).entries['e2']).toBeUndefined();
    }
    editor.dispose();
  });

  it('基线前进替换配置、旧修订忽略，焦点请求不抛错', () => {
    const box = createBox({
      entries: [createEntry('e1', '东京站', 0)],
      layout_config: readConfig({
        map_source: { mode: 'image', projection: 'linear-bounds', bounds: { ...DEFAULT_BOUNDS } },
        entries: { e1: { latitude: 10, longitude: 10 } },
      }),
    });
    const editor = renderEditor(box, host);
    expect(() => editor.focus()).not.toThrow();

    editor.update(
      createBox({
        entries: [createEntry('e1', '东京站', 0)],
        layout_config: readConfig({
          map_source: {
            mode: 'image',
            projection: 'linear-bounds',
            bounds: { west: 0, south: 0, east: 10, north: 10 },
          },
          entries: { e1: { latitude: 5, longitude: 5 } },
        }),
      }),
      4
    );
    expect(editor.isDirty()).toBe(false);
    expect(host.querySelector<HTMLInputElement>('#map-bounds-west')?.value).toBe('0');

    editor.update(box, 2);
    editor.dispose();
  });
});
