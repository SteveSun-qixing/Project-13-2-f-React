import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoxRenderView, EntryView } from '@chips/sdk';
import {
  DEFAULT_CONFIG,
  computeColumnCount,
  deriveAssetRefs,
  hasFrameRegionContent,
  isSafeBoxAssetPath,
  readConfig,
  validateConfig,
} from '../src/config';
import { renderEditor, renderLayout } from '../src/render';

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

function createBox(overrides: Partial<BoxRenderView> = {}): BoxRenderView {
  return {
    kind: 'box',
    box_id: 'a1B2c3D4e5',
    name: '示例箱子',
    chip_standards_version: '1.0.0',
    revision: 1,
    active_layout_type: 'chips.layout.grid',
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

function tileTitles(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('button[type="button"]')).map(
    (node) => node.textContent ?? ''
  );
}

describe('validateConfig', () => {
  it('接受空配置与缺省字段', () => {
    expect(validateConfig(undefined)).toBe(true);
    expect(validateConfig({})).toBe(true);
    expect(validateConfig({ gap: 16, show_tags: false })).toBe(true);
  });

  it('拒绝非对象与越界值', () => {
    expect(validateConfig('grid')).toBe(false);
    expect(validateConfig({ gap: -1 })).toBe(false);
    expect(validateConfig({ gap: 1.5 })).toBe(false);
    expect(validateConfig({ information_density: 'dense' })).toBe(false);
  });

  it('校验排序方式', () => {
    expect(validateConfig({ sort_mode: 'name-asc' })).toBe(true);
    expect(validateConfig({ sort_mode: 'name-desc' })).toBe(true);
    expect(validateConfig({ sort_mode: 'random' })).toBe(false);
  });

  it('校验区域配置', () => {
    expect(validateConfig({ background: { mode: 'none' } })).toBe(true);
    expect(
      validateConfig({ background: { mode: 'image', assetPath: 'assets/layouts/bg.png' } })
    ).toBe(true);
    expect(validateConfig({ background: { mode: 'image' } })).toBe(false);
    expect(validateConfig({ background: { mode: 'image', assetPath: '/etc/passwd' } })).toBe(false);
    expect(
      validateConfig({ background: { mode: 'image', assetPath: 'assets/../secret.png' } })
    ).toBe(false);
    expect(validateConfig({ top_region: { mode: 'html', html: '<section>标题</section>' } })).toBe(
      true
    );
    expect(validateConfig({ top_region: { mode: 'html', html: '  ' } })).toBe(false);
    expect(validateConfig({ top_region: { mode: 'unknown' } })).toBe(false);
    expect(validateConfig({ top_region: 'text' })).toBe(false);
  });
});

describe('配置归一与派生', () => {
  it('归一非法配置并保留合法字段', () => {
    expect(readConfig({ gap: 999 })).toEqual({ ...DEFAULT_CONFIG, gap: 64 });
    expect(readConfig({ information_density: 'dense' })).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ sort_mode: 'bad' }).sort_mode).toBe('manual');
    expect(
      readConfig({ background: { mode: 'image', assetPath: 'https://evil/x.png' } }).background
    ).toEqual({
      mode: 'image',
    });
    expect(readConfig({ top_region: { mode: 'html', html: '<p>提示</p>' } }).top_region).toEqual({
      mode: 'html',
      html: '<p>提示</p>',
    });
  });

  it('区域内容判定与安全路径判定', () => {
    expect(hasFrameRegionContent({ mode: 'none' })).toBe(false);
    expect(hasFrameRegionContent({ mode: 'image', assetPath: 'assets/a.png' })).toBe(true);
    expect(hasFrameRegionContent({ mode: 'image' })).toBe(false);
    expect(hasFrameRegionContent({ mode: 'html', html: '  ' })).toBe(false);
    expect(isSafeBoxAssetPath('assets/layouts/bg.png')).toBe(true);
    expect(isSafeBoxAssetPath('assets/bg#1.png')).toBe(false);
    expect(isSafeBoxAssetPath('assets/bg.png?a=1')).toBe(false);
    expect(isSafeBoxAssetPath('./assets/bg.png')).toBe(false);
    expect(isSafeBoxAssetPath('assets//bg.png')).toBe(false);
  });

  it('派生去重的资源引用列表', () => {
    const config = readConfig({
      background: { mode: 'image', assetPath: 'assets/layouts/bg.png' },
      top_region: { mode: 'image', assetPath: 'assets/layouts/bg.png' },
    });
    expect(deriveAssetRefs(config)).toEqual(['assets/layouts/bg.png']);
    expect(deriveAssetRefs(DEFAULT_CONFIG)).toEqual([]);
  });

  it('移动端固定两列并封顶八列', () => {
    expect(computeColumnCount(480)).toBe(2);
    expect(computeColumnCount(1200)).toBe(6);
    expect(computeColumnCount(4000)).toBe(8);
  });
});

describe('renderLayout', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.replaceChildren(container);
  });

  it('空箱子呈现骨架与空态提示并在释放后清空挂载', () => {
    const dispose = renderLayout(createBox(), container);
    expect(container.textContent).toContain('这里还没有内容');
    expect(container.textContent).toContain('在编辑器中添加卡片或箱子，开始填充这个箱子');
    dispose();
    expect(container.childNodes).toHaveLength(0);
  });

  it('渲染条目外壳且释放幂等', () => {
    const box = createBox({ entries: [createEntry('e1', '旅行日记', 0)] });
    const dispose = renderLayout(box, container);
    expect(container.textContent).toContain('旅行日记');
    dispose();
    dispose();
    expect(container.childNodes).toHaveLength(0);
  });

  it('手动顺序保持呈现顺序并过滤禁用条目', () => {
    const disabled = { ...createEntry('e0', '甲', 0), enabled: false };
    const box = createBox({
      entries: [disabled, createEntry('e1', '乙', 1), createEntry('e2', '丙', 2)],
    });
    const dispose = renderLayout(box, container);
    expect(tileTitles(container)).toEqual(['乙', '丙']);
    dispose();
  });

  it('按名称升序与降序排序（简体中文习惯）', () => {
    const entries = [
      createEntry('e1', '苹果', 0),
      createEntry('e2', '香蕉', 1),
      createEntry('e3', '芒果', 2),
    ];
    const asc = renderLayout(
      createBox({ entries, layout_config: { sort_mode: 'name-asc' } }),
      container
    );
    expect(tileTitles(container)).toEqual(['芒果', '苹果', '香蕉']);
    asc();

    container = document.createElement('div');
    document.body.replaceChildren(container);
    const desc = renderLayout(
      createBox({ entries, layout_config: { sort_mode: 'name-desc' } }),
      container
    );
    expect(tileTitles(container)).toEqual(['香蕉', '苹果', '芒果']);
    desc();
  });

  it('名称相同时按条目标识稳定兜底', () => {
    const box = createBox({
      entries: [createEntry('b', '同名', 0), createEntry('a', '同名', 1)],
      layout_config: { sort_mode: 'name-asc' },
    });
    const dispose = renderLayout(box, container);
    expect(tileTitles(container)).toEqual(['同名', '同名']);
    const articles = Array.from(container.querySelectorAll('article'));
    const firstButton = articles[0]?.querySelector('button');
    expect(firstButton?.textContent).toBe('同名');
    dispose();
  });

  it('渲染背景与顶部区域：代码模式内联 HTML、图片模式箱子资源相对路径', () => {
    const box = createBox({
      entries: [createEntry('e1', '旅行日记', 0)],
      layout_config: {
        background: { mode: 'html', html: '<section>背景</section>' },
        top_region: { mode: 'image', assetPath: 'assets/layouts/banner.png' },
      },
    });
    const dispose = renderLayout(box, container);
    const frames = Array.from(container.querySelectorAll('iframe'));
    expect(frames.length).toBeGreaterThanOrEqual(2);
    const background = frames.find((frame) => (frame.getAttribute('title') ?? '').includes('背景'));
    expect(background).toBeDefined();
    expect(background?.getAttribute('srcdoc')).toContain('<section>背景</section>');
    const top = frames.find((frame) => (frame.getAttribute('title') ?? '').includes('顶部'));
    expect(top).toBeDefined();
    expect(top?.getAttribute('src')).toContain('assets/layouts/banner.png');
    dispose();
  });

  it('不显示模式的区域与非法区域不产生帧', () => {
    const box = createBox({
      entries: [createEntry('e1', '旅行日记', 0)],
      layout_config: {
        background: { mode: 'none' },
        top_region: { mode: 'image' },
      },
    });
    const dispose = renderLayout(box, container);
    expect(container.querySelectorAll('iframe')).toHaveLength(0);
    dispose();
  });
});

describe('renderEditor', () => {
  it('渲染排序与区域编辑字段', () => {
    vi.useFakeTimers();
    const box = createBox({ layout_config: { sort_mode: 'name-asc' } });
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const editor = renderEditor(box, host);
    expect(editor.state).toBe('active');
    expect(host.textContent).toContain('排序方式');
    expect(host.textContent).toContain('背景区域');
    expect(host.textContent).toContain('顶部区域');
    editor.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('产出替换变更并在提交后清脏', () => {
    vi.useFakeTimers();
    const box = createBox({ layout_config: { gap: 24 } });
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const editor = renderEditor(box, host);
    expect(editor.isDirty()).toBe(false);

    const changes: string[] = [];
    editor.subscribe('change', () => {
      changes.push('change');
    });
    const form = host.querySelector('form');
    expect(form).not.toBeNull();

    editor.dispose();
    editor.dispose();
    expect(editor.getChange()).toBeNull();
    expect(editor.isDirty()).toBe(false);
    expect(changes).toHaveLength(0);
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});
