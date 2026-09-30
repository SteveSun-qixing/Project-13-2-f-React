import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import type { BoxRenderView, EntryView } from '@chips/sdk';
import {
  DEFAULT_CONFIG,
  UNSCHEDULED_GROUP_ID,
  UNSCHEDULED_LABEL,
  buildTimelineGroups,
  calculatePointPositions,
  createPointId,
  deriveAssetRefs,
  formatPointDate,
  isCompactWidth,
  isSafeBoxAssetPath,
  readConfig,
  toCssAspectRatio,
  validateConfig,
} from '../src/config';
import type { ITimelineConfig } from '../src/config';
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

/**
 * 在 act 环境窗口内驱动 React 更新：仅在与 act 相关的语句期间声明
 * `IS_REACT_ACT_ENVIRONMENT`，避免挂载/卸载路径的非交互更新产生噪声告警。
 */
async function actAsync(block: () => void | Promise<void>): Promise<void> {
  const flags = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = flags.IS_REACT_ACT_ENVIRONMENT === true;
  flags.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => {
      await block();
    });
  } finally {
    flags.IS_REACT_ACT_ENVIRONMENT = previous;
  }
}

/** 在 act 内触发一次点击并等待 React 更新冲刷。 */
async function clickAsync(button: HTMLButtonElement): Promise<void> {
  await actAsync(() => {
    button.click();
  });
}

/** 在 act 内设置输入值并等待 React 更新冲刷。 */
async function inputAsync(element: HTMLInputElement, value: string): Promise<void> {
  await actAsync(() => {
    setInputValue(element, value);
  });
}

function createBox(overrides: Partial<BoxRenderView> = {}): BoxRenderView {
  return {
    kind: 'box',
    box_id: 'a1B2c3D4e5',
    name: '示例箱子',
    chip_standards_version: '1.0.0',
    revision: 1,
    active_layout_type: 'chips.layout.timeline',
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

function entryTitles(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('[data-timeline-entry-title]')
  ).map((node) => node.textContent ?? '');
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (node) => node.textContent === label
  );
  if (button === undefined) {
    throw new Error(`未找到按钮：${label}`);
  }
  return button;
}

function setInputValue(element: HTMLInputElement, value: string): void {
  // 经原型访问器以 element 为接收者写入：绕过 React 受控输入的实例值跟踪，
  // 保证 input 事件被 ChangeEventPlugin 判定为变更。
  Reflect.set(HTMLInputElement.prototype, 'value', value, element);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function pointConfig(
  id: string,
  label: string,
  entryIds: readonly string[],
  extra: { date?: string; note?: string } = {}
): ITimelineConfig['points'][number] {
  return {
    id,
    label,
    entry_ids: [...entryIds],
    ...(extra.date === undefined ? {} : { date: extra.date }),
    ...(extra.note === undefined ? {} : { note: extra.note }),
  };
}

describe('validateConfig', () => {
  it('接受空配置与缺省字段', () => {
    expect(validateConfig(undefined)).toBe(true);
    expect(validateConfig(null)).toBe(true);
    expect(validateConfig({})).toBe(true);
    expect(validateConfig({ orientation: 'horizontal', scale_mode: 'date-distance' })).toBe(true);
    expect(
      validateConfig({
        orientation: 'vertical',
        scale_mode: 'equal-points',
        show_covers: true,
        card_density: 'spacious',
        points: [{ id: 'p1', label: '开幕', entry_ids: ['e1'] }],
        background: { mode: 'none' },
        top_region: { mode: 'none' },
      })
    ).toBe(true);
  });

  it('拒绝非对象与非法枚举', () => {
    expect(validateConfig('timeline')).toBe(false);
    expect(validateConfig(42)).toBe(false);
    expect(validateConfig({ orientation: 'diagonal' })).toBe(false);
    expect(validateConfig({ scale_mode: 'linear' })).toBe(false);
    expect(validateConfig({ show_covers: 'yes' })).toBe(false);
    expect(validateConfig({ card_density: 'dense' })).toBe(false);
  });

  it('校验时间点形状与约束', () => {
    expect(validateConfig({ points: 'p1' })).toBe(false);
    expect(validateConfig({ points: [{ id: 'p1', label: '开幕', entry_ids: [] }] })).toBe(true);
    expect(validateConfig({ points: [{ id: 'p1', label: '  ', entry_ids: [] }] })).toBe(false);
    expect(validateConfig({ points: [{ id: '-p', label: '甲', entry_ids: [] }] })).toBe(false);
    expect(validateConfig({ points: [{ id: 'p'.repeat(65), label: '甲', entry_ids: [] }] })).toBe(
      false
    );
    expect(validateConfig({ points: [{ id: 'p1', label: '甲', entry_ids: 'e1' }] })).toBe(false);
    expect(validateConfig({ points: [{ id: 'p1', label: '甲', entry_ids: [''] }] })).toBe(false);
    expect(
      validateConfig({ points: [{ id: 'p1', label: '甲', entry_ids: ['e1', 'e1'] }] })
    ).toBe(false);
    expect(
      validateConfig({
        points: [
          { id: 'p1', label: '甲', entry_ids: [] },
          { id: 'p1', label: '乙', entry_ids: [] },
        ],
      })
    ).toBe(false);
    expect(validateConfig({ points: [{ id: 'p1', label: '甲', entry_ids: [], date: '' }] })).toBe(
      false
    );
    expect(validateConfig({ points: [{ id: 'p1', label: '甲', entry_ids: [], note: 42 }] })).toBe(
      false
    );
    expect(
      validateConfig({ points: [{ id: 'p1.x-y_z', label: '甲', entry_ids: [], date: '2026-07-06' }] })
    ).toBe(true);
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
    expect(readConfig({})).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ orientation: 'diagonal' }).orientation).toBe('vertical');
    expect(readConfig({ scale_mode: 'linear' }).scale_mode).toBe('equal-points');
    expect(readConfig({ show_covers: 'yes' }).show_covers).toBe(true);
    expect(readConfig({ card_density: 'dense' }).card_density).toBe('comfortable');
    expect(
      readConfig({
        orientation: 'horizontal',
        scale_mode: 'date-distance',
        show_covers: false,
        card_density: 'spacious',
      })
    ).toEqual({
      ...DEFAULT_CONFIG,
      orientation: 'horizontal',
      scale_mode: 'date-distance',
      show_covers: false,
      card_density: 'spacious',
    });
  });

  it('归一时间点：非法标识回退、冲突去重、缺省名称、字段修剪', () => {
    const config = readConfig({
      points: [
        { id: 'p1', label: '开幕', entry_ids: [' e1 ', 'e1', ''] },
        { id: '###', entry_ids: [], date: '  2026-07-06  ', note: ' 说明 ' },
        { id: 'p1', label: '  ', entry_ids: [] },
      ],
    });
    expect(config.points).toHaveLength(3);
    expect(config.points[0]).toEqual({ id: 'p1', label: '开幕', entry_ids: ['e1'] });
    expect(config.points[1]).toEqual({
      id: 'point-2',
      label: '时间点 2',
      entry_ids: [],
      date: '2026-07-06',
      note: '说明',
    });
    expect(config.points[2]).toEqual({ id: 'p1-2', label: '时间点 3', entry_ids: [] });
  });

  it('归一时间点：同一条目只归属最早声明它的时间点', () => {
    const config = readConfig({
      points: [
        { id: 'p1', label: '甲', entry_ids: ['e1'] },
        { id: 'p2', label: '乙', entry_ids: ['e1', 'e2'] },
      ],
    });
    expect(config.points[0]?.entry_ids).toEqual(['e1']);
    expect(config.points[1]?.entry_ids).toEqual(['e2']);
  });

  it('派生去重的资源引用列表', () => {
    const config = readConfig({
      background: { mode: 'image', assetPath: 'assets/layouts/bg.png' },
      top_region: { mode: 'image', assetPath: 'assets/layouts/bg.png' },
    });
    expect(deriveAssetRefs(config)).toEqual(['assets/layouts/bg.png']);
    expect(deriveAssetRefs(DEFAULT_CONFIG)).toEqual([]);
    expect(isSafeBoxAssetPath('assets/bg#1.png')).toBe(false);
    expect(isSafeBoxAssetPath('./assets/bg.png')).toBe(false);
  });

  it('生成不冲突的时间点标识', () => {
    expect(createPointId([])).toBe('point-1');
    expect(createPointId([pointConfig('point-1', '甲', [])])).toBe('point-2');
    expect(
      createPointId([pointConfig('point-1', '甲', []), pointConfig('point-2', '乙', [])])
    ).toBe('point-3');
    expect(
      createPointId([
        pointConfig('point-1', '甲', []),
        pointConfig('point-2', '乙', []),
        pointConfig('point-3', '丙', []),
      ])
    ).toBe('point-4');
  });

  it('日期呈现：不可解析原样透传，可解析按简体中文呈现年份', () => {
    expect(formatPointDate('阶段一')).toBe('阶段一');
    expect(formatPointDate(undefined)).toBeUndefined();
    expect(formatPointDate('2026-07-06')).toContain('2026');
  });

  it('封面比例令牌换算', () => {
    expect(toCssAspectRatio(undefined, '3 / 4')).toBe('3 / 4');
    expect(toCssAspectRatio(1.5, '3 / 4')).toBe('1.5');
    expect(toCssAspectRatio('4:3', '3 / 4')).toBe('4 / 3');
    expect(toCssAspectRatio('wide', '3 / 4')).toBe('wide');
  });

  it('窄容器进入紧凑排布，未测量宽度保持桌面排布', () => {
    expect(isCompactWidth(0)).toBe(false);
    expect(isCompactWidth(480)).toBe(true);
    expect(isCompactWidth(720)).toBe(true);
    expect(isCompactWidth(721)).toBe(false);
  });
});

describe('布局计算', () => {
  it('时间点等距：位置即数组位次', () => {
    const positions = calculatePointPositions(
      [pointConfig('a', '甲', []), pointConfig('b', '乙', []), pointConfig('c', '丙', [])],
      'equal-points'
    );
    expect(positions.get('a')).toBe(0);
    expect(positions.get('b')).toBe(1);
    expect(positions.get('c')).toBe(2);
  });

  it('日期间距：按可解析日期线性映射到 [0, n-1]', () => {
    const positions = calculatePointPositions(
      [
        pointConfig('a', '甲', [], { date: '2026-01-01' }),
        pointConfig('b', '乙', [], { date: '2026-01-02' }),
        pointConfig('c', '丙', [], { date: '2026-01-04' }),
      ],
      'date-distance'
    );
    expect(positions.get('a')).toBe(0);
    expect(positions.get('b')).toBeCloseTo(2 / 3, 6);
    expect(positions.get('c')).toBe(2);
  });

  it('日期间距：不可解析日期回退位次，可解析点不足两个整体退化为等距', () => {
    const positions = calculatePointPositions(
      [
        pointConfig('a', '甲', [], { date: '2026-01-01' }),
        pointConfig('b', '乙', [], { date: '阶段一' }),
        pointConfig('c', '丙', [], { date: '阶段二' }),
      ],
      'date-distance'
    );
    expect(positions.get('a')).toBe(0);
    expect(positions.get('b')).toBe(1);
    expect(positions.get('c')).toBe(2);

    const fallback = calculatePointPositions(
      [pointConfig('a', '甲', [], { date: '2026-01-01' }), pointConfig('b', '乙', [])],
      'date-distance'
    );
    expect(fallback.get('a')).toBe(0);
    expect(fallback.get('b')).toBe(1);

    expect(calculatePointPositions([], 'date-distance').size).toBe(0);
  });

  it('分组：按绑定归组、保持绑定顺序、跳过缺失与禁用条目', () => {
    const config: ITimelineConfig = {
      ...DEFAULT_CONFIG,
      points: [pointConfig('p1', '开幕', ['e3', 'e1', 'missing', 'e0'])],
    };
    const entries = [
      createEntry('e1', '甲', 0),
      createEntry('e2', '乙', 1),
      createEntry('e3', '丙', 2),
      { ...createEntry('e0', '禁用', 3), enabled: false },
    ];
    const groups = buildTimelineGroups(entries, config);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ id: 'p1', label: '开幕', position: 0 });
    expect(groups[0]?.entries.map((entry) => entry.displayTitle)).toEqual(['丙', '甲']);
    expect(groups[1]).toMatchObject({
      id: UNSCHEDULED_GROUP_ID,
      label: UNSCHEDULED_LABEL,
      position: 1,
      isUnscheduled: true,
    });
    expect(groups[1]?.entries.map((entry) => entry.displayTitle)).toEqual(['乙']);
  });

  it('分组：未绑定条目全部归入未安排区块并保持箱子顺序', () => {
    const groups = buildTimelineGroups([createEntry('e1', '甲', 0), createEntry('e2', '乙', 1)], {
      ...DEFAULT_CONFIG,
      points: [],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.isUnscheduled).toBe(true);
    expect(groups[0]?.entries.map((entry) => entry.displayTitle)).toEqual(['甲', '乙']);
  });

  it('分组：跨时间点重复绑定时先到先得，不重复呈现', () => {
    const config: ITimelineConfig = {
      ...DEFAULT_CONFIG,
      points: [pointConfig('p1', '甲', ['e1', 'e1']), pointConfig('p2', '乙', ['e1'])],
    };
    const groups = buildTimelineGroups([createEntry('e1', '甲', 0)], config);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.entries).toHaveLength(1);
    expect(groups[1]?.entries).toHaveLength(0);
    expect(groups.some((group) => group.isUnscheduled)).toBe(false);
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
    dispose();
    expect(container.childNodes).toHaveLength(0);
  });

  it('按时间点分组渲染：名称、日期、说明、计数与未安排区块', () => {
    const box = createBox({
      entries: [createEntry('e1', '旅行日记', 0), createEntry('e2', '随手记', 1)],
      layout_config: {
        points: [
          {
            id: 'p1',
            label: '开幕',
            date: '2026-07-06',
            entry_ids: ['e1'],
            note: '开幕式说明',
          },
        ],
      },
    });
    const dispose = renderLayout(box, container);
    expect(container.textContent).toContain('开幕');
    expect(container.textContent).toContain('开幕式说明');
    expect(container.textContent).toContain('2026');
    expect(container.textContent).toContain('1 个条目');
    expect(container.textContent).toContain('未安排条目');
    expect(entryTitles(container)).toEqual(['旅行日记', '随手记']);
    dispose();
  });

  it('禁用条目不进入布局呈现', () => {
    const disabled = { ...createEntry('e0', '禁用', 0), enabled: false };
    const box = createBox({
      entries: [disabled, createEntry('e1', '旅行日记', 1)],
      layout_config: { points: [pointConfig('p1', '开幕', ['e1'])] },
    });
    const dispose = renderLayout(box, container);
    expect(entryTitles(container)).toEqual(['旅行日记']);
    expect(container.textContent).not.toContain('禁用');
    dispose();
  });

  it('时间点折叠呈现前两个条目，展开与折叠可往复切换', async () => {
    const box = createBox({
      entries: [
        createEntry('e1', '甲', 0),
        createEntry('e2', '乙', 1),
        createEntry('e3', '丙', 2),
      ],
      layout_config: { points: [pointConfig('p1', '开幕', ['e1', 'e2', 'e3'])] },
    });
    const dispose = renderLayout(box, container);
    expect(entryTitles(container)).toEqual(['甲', '乙']);
    await clickAsync(findButton(container, '展开其余 1 个条目'));
    expect(entryTitles(container)).toEqual(['甲', '乙', '丙']);
    const header = container.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
    expect(header).not.toBeNull();
    await clickAsync(header as HTMLButtonElement);
    expect(entryTitles(container)).toEqual(['甲', '乙']);
    expect(container.textContent).toContain('展开其余 1 个条目');
    dispose();
  });

  it('关闭封面开关时不产生条目帧槽位，开启时按条目保留槽位', () => {
    const withCovers = createBox({
      entries: [createEntry('e1', '旅行日记', 0)],
      layout_config: { points: [pointConfig('p1', '开幕', ['e1'])] },
    });
    const first = renderLayout(withCovers, container);
    expect(container.querySelectorAll('[data-timeline-entry-slot]')).toHaveLength(1);
    first();

    container = document.createElement('div');
    document.body.replaceChildren(container);
    const withoutCovers = createBox({
      entries: [createEntry('e1', '旅行日记', 0)],
      layout_config: { show_covers: false, points: [pointConfig('p1', '开幕', ['e1'])] },
    });
    const second = renderLayout(withoutCovers, container);
    expect(container.querySelectorAll('[data-timeline-entry-slot]')).toHaveLength(0);
    expect(entryTitles(container)).toEqual(['旅行日记']);
    second();
  });

  it('横向时间线启用键盘滚动并拦截方向键默认行为，竖向不拦截', () => {
    const entries = [createEntry('e1', '甲', 0)];
    const horizontal = renderLayout(
      createBox({ entries, layout_config: { orientation: 'horizontal' } }),
      container
    );
    const root = container.querySelector<HTMLElement>('[data-timeline-root]');
    expect(root?.getAttribute('data-orientation')).toBe('horizontal');
    expect(root?.tabIndex).toBe(0);
    const scrollBy = vi.fn();
    if (root !== null && root !== undefined) {
      root.scrollBy = scrollBy;
      const accepted = root.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
      );
      expect(accepted).toBe(false);
      expect(scrollBy).toHaveBeenCalledWith({ left: 320, behavior: 'smooth' });
    }
    horizontal();

    container = document.createElement('div');
    document.body.replaceChildren(container);
    const vertical = renderLayout(createBox({ entries }), container);
    const verticalRoot = container.querySelector<HTMLElement>('[data-timeline-root]');
    expect(verticalRoot?.getAttribute('data-orientation')).toBe('vertical');
    expect(verticalRoot?.hasAttribute('tabindex')).toBe(false);
    const scrollByVertical = vi.fn();
    if (verticalRoot !== null && verticalRoot !== undefined) {
      verticalRoot.scrollBy = scrollByVertical;
      const accepted = verticalRoot.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
      );
      expect(accepted).toBe(true);
      expect(scrollByVertical).not.toHaveBeenCalled();
    }
    vertical();
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
  it('渲染时间线字段、区域分组与条目计数', () => {
    vi.useFakeTimers();
    const box = createBox({
      entries: [createEntry('e1', '旅行日记', 0), createEntry('e2', '随手记', 1)],
    });
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const editor = renderEditor(box, host);
    expect(editor.state).toBe('active');
    expect(host.textContent).toContain('方向');
    expect(host.textContent).toContain('比例方式');
    expect(host.textContent).toContain('卡片密度');
    expect(host.textContent).toContain('显示条目封面');
    expect(host.textContent).toContain('时间点');
    expect(host.textContent).toContain('背景区域');
    expect(host.textContent).toContain('顶部区域');
    expect(host.textContent).toContain('新增时间点');
    expect(host.textContent).toContain('还没有时间点');
    expect(host.textContent).toContain('当前箱子包含 2 个条目');
    editor.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('新增时间点产出替换变更，提交后清脏，再次新增顺延标识', async () => {
    vi.useFakeTimers();
    const box = createBox({ entries: [createEntry('e1', '旅行日记', 0)] });
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const editor = renderEditor(box, host);
    const changes: string[] = [];
    const dirtyStates: boolean[] = [];
    editor.subscribe('change', () => {
      changes.push('change');
    });
    editor.subscribe('dirty', ({ isDirty }) => {
      dirtyStates.push(isDirty);
    });
    expect(editor.isDirty()).toBe(false);

    await clickAsync(findButton(host, '新增时间点'));
    expect(changes).toEqual(['change']);
    expect(dirtyStates).toEqual([true]);
    const change = editor.getChange();
    expect(change).not.toBeNull();
    expect(change?.kind).toBe('replace');
    if (change?.kind === 'replace') {
      expect(change.schemaVersion).toBe('1.0.0');
      const points = change.config.points as ITimelineConfig['points'];
      expect(points).toHaveLength(1);
      expect(points[0]).toMatchObject({ id: 'point-1', label: '时间点 1', entry_ids: [] });
    }
    expect(editor.isDirty()).toBe(true);

    editor.markCommitted(2);
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();

    await clickAsync(findButton(host, '新增时间点'));
    const next = editor.getChange();
    if (next?.kind === 'replace') {
      const points = next.config.points as ITimelineConfig['points'];
      expect(points.map((point) => point.id)).toEqual(['point-1', 'point-2']);
    } else {
      throw new Error('第二次新增应产出替换变更');
    }
    expect(changes).toEqual(['change', 'change']);
    expect(dirtyStates).toEqual([true, false, true]);

    editor.dispose();
    editor.dispose();
    expect(editor.getChange()).toBeNull();
    expect(editor.isDirty()).toBe(false);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('时间点名称输入回流为替换变更', async () => {
    vi.useFakeTimers();
    const box = createBox({ entries: [createEntry('e1', '旅行日记', 0)] });
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const editor = renderEditor(box, host);
    await clickAsync(findButton(host, '新增时间点'));
    editor.markCommitted(2);

    const input = host.querySelector<HTMLInputElement>('input[aria-label="名称"]');
    expect(input).not.toBeNull();
    await inputAsync(input as HTMLInputElement, '开幕');
    const change = editor.getChange();
    expect(change?.kind).toBe('replace');
    if (change?.kind === 'replace') {
      const points = change.config.points as ITimelineConfig['points'];
      expect(points[0]?.label).toBe('开幕');
    }
    editor.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('会话视图前进时替换基线并丢弃待提交变更', () => {
    vi.useFakeTimers();
    const box = createBox({ entries: [createEntry('e1', '旅行日记', 0)] });
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const editor = renderEditor(box, host);
    findButton(host, '新增时间点').click();
    expect(editor.isDirty()).toBe(true);

    const nextBox = createBox({
      entries: [createEntry('e1', '旅行日记', 0)],
      layout_config: { scale_mode: 'date-distance' },
      revision: 2,
    });
    editor.update(nextBox, 3);
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    expect(editor.state).toBe('active');
    editor.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
  });
});
