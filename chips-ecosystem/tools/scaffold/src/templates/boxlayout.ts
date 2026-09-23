import type { IScaffoldContext, IScaffoldFile } from '../types.js';

/** `boxlayout` 角色模板：一个可直接构建的响应式网格布局插件。 */

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="3" y="3" width="7" height="7" rx="1" />
  <rect x="14" y="3" width="7" height="7" rx="1" />
  <rect x="3" y="14" width="7" height="7" rx="1" />
  <rect x="14" y="14" width="7" height="7" rx="1" />
</svg>
`;

function configTs(): string {
  return `/** 布局配置。 */
export interface IGridConfig {
  gap: number;
  show_tags: boolean;
  information_density: 'compact' | 'comfortable';
}

/** 默认值；必须与 assets/schemas 下配置 schema 的约束保持一致。 */
export const DEFAULT_CONFIG: IGridConfig = {
  gap: 16,
  show_tags: true,
  information_density: 'comfortable',
};

/** 编辑器产出配置所遵循的 schema 版本，必须落在 manifest 的 schemaVersions 范围内。 */
export const CONFIG_SCHEMA_VERSION = '1.0.0';

export const GAP_MIN = 0;
export const GAP_MAX = 64;

export const DENSITY_OPTIONS = ['comfortable', 'compact'] as const;

export const DENSITY_LABELS: Readonly<Record<IGridConfig['information_density'], string>> = {
  comfortable: '舒适',
  compact: '紧凑',
};

/** 响应式列数：容器不超过 600px 时固定两列，否则按最小格子宽度计算并封顶八列。 */
export const MOBILE_MAX_WIDTH = 600;
export const MIN_TILE_WIDTH = 200;
export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDensity(value: unknown): value is IGridConfig['information_density'] {
  return value === 'compact' || value === 'comfortable';
}

/**
 * 归一布局配置：字段缺失或非法时回退默认值，保证渲染不因坏配置失败。
 *
 * @param input - 布局配置原始值
 * @returns 归一后的配置
 */
export function readConfig(input: unknown): IGridConfig {
  const record = isRecord(input) ? input : {};
  const gap = record.gap;
  const showTags = record.show_tags;
  const density = record.information_density;
  return {
    gap:
      typeof gap === 'number' && Number.isFinite(gap)
        ? Math.min(Math.max(Math.round(gap), GAP_MIN), GAP_MAX)
        : DEFAULT_CONFIG.gap,
    show_tags: typeof showTags === 'boolean' ? showTags : DEFAULT_CONFIG.show_tags,
    information_density: isDensity(density) ? density : DEFAULT_CONFIG.information_density,
  };
}

/**
 * 校验布局配置；纯函数、同步、不抛异常。
 *
 * @param config - 布局配置原始值
 * @returns 合法返回 true，否则 false
 */
export function validateConfig(config: unknown): boolean {
  if (config === undefined || config === null) {
    return true;
  }
  if (!isRecord(config)) {
    return false;
  }
  const gap = config.gap;
  const showTags = config.show_tags;
  const density = config.information_density;
  if (gap !== undefined) {
    if (typeof gap !== 'number' || !Number.isInteger(gap) || gap < GAP_MIN || gap > GAP_MAX) {
      return false;
    }
  }
  if (showTags !== undefined && typeof showTags !== 'boolean') {
    return false;
  }
  if (density !== undefined && !isDensity(density)) {
    return false;
  }
  return true;
}

/**
 * 计算列数。
 *
 * @param containerWidth - 容器内容宽度（px）
 * @returns 列数，介于 MIN_COLUMNS 与 MAX_COLUMNS 之间
 */
export function computeColumnCount(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= MOBILE_MAX_WIDTH) {
    return MIN_COLUMNS;
  }
  const byWidth = Math.floor(containerWidth / MIN_TILE_WIDTH);
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, byWidth));
}
`;
}

function mainTs(): string {
  return `import type { IBoxLayoutPlugin } from '@chips/sdk';
import { validateConfig } from './config';

/** 主进程入口集合：布局插件的主进程侧只有纯函数 validateConfig。 */
export const mainPlugin: Pick<IBoxLayoutPlugin, 'validateConfig'> = { validateConfig };

export default mainPlugin;
`;
}

function renderTsx(): string {
  return `import type { ReactElement } from 'react';
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Form, Select, Slider, Switch, theme } from '@chips/ui';
import type {
  BoxRenderView,
  Dispose,
  EditorState,
  EntryView,
  IBoxLayoutFrameRuntime,
  IBoxLayoutPlugin,
  IBoxLayoutRuntimeAware,
  ILayoutEditor,
  ILayoutEditorEventMap,
  ISubscription,
  LayoutChange,
} from '@chips/sdk';
import {
  CONFIG_SCHEMA_VERSION,
  DENSITY_LABELS,
  DENSITY_OPTIONS,
  GAP_MAX,
  GAP_MIN,
  computeColumnCount,
  readConfig,
  validateConfig,
} from './config';
import type { IGridConfig } from './config';

/** 条目槽位的最小保留高度（结构常量，与 MIN_TILE_WIDTH 同类，不是视觉令牌）。 */
const SLOT_MIN_HEIGHT = 80;

// ---------- 帧运行时注入 ----------

let frameRuntime: IBoxLayoutFrameRuntime | null = null;

/** 帧运行时在首次调用 renderLayout 前注入句柄。 */
function attachRuntime(runtime: IBoxLayoutFrameRuntime): void {
  frameRuntime = runtime;
}

// ---------- 响应式列数 ----------

/**
 * 观察容器宽度并返回当前列数。
 *
 * @param container - 布局根容器
 * @returns 当前列数
 */
function useColumnCount(container: HTMLElement | null): number {
  const [columns, setColumns] = React.useState(() =>
    container === null ? 0 : computeColumnCount(container.clientWidth)
  );

  React.useEffect(() => {
    if (container === null) {
      return undefined;
    }
    setColumns(computeColumnCount(container.clientWidth));
    const observer = new ResizeObserver((records) => {
      const record = records[0];
      if (record !== undefined) {
        setColumns(computeColumnCount(record.contentRect.width));
      }
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [container]);

  return columns;
}

// ---------- 条目外壳与条目帧挂载 ----------

interface IEntryTileProps {
  entry: EntryView;
  dense: boolean;
  showTags: boolean;
}

function readTagLabels(snapshot: Record<string, unknown> | undefined): readonly string[] {
  if (snapshot === undefined) {
    return [];
  }
  const tags = snapshot.tags;
  if (!Array.isArray(tags)) {
    return [];
  }
  const labels: string[] = [];
  for (const tag of tags) {
    if (typeof tag === 'string' && tag.length > 0) {
      labels.push(tag);
    } else if (Array.isArray(tag)) {
      const nested = tag.filter((item): item is string => typeof item === 'string' && item.length > 0);
      if (nested.length > 0) {
        labels.push(nested.join(' / '));
      }
    }
  }
  return labels;
}

function EntryTile({ entry, dense, showTags }: IEntryTileProps): ReactElement {
  const { token } = theme.useToken();
  const slotRef = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const slot = slotRef.current;
    if (slot === null) {
      return undefined;
    }
    const observer = new IntersectionObserver((records) => {
      for (const record of records) {
        if (record.target === slot) {
          setVisible(record.isIntersecting);
        }
      }
    });
    observer.observe(slot);
    return () => {
      observer.disconnect();
    };
  }, []);

  React.useEffect(() => {
    const runtime = frameRuntime;
    const slot = slotRef.current;
    if (!visible || slot === null || runtime === null) {
      return undefined;
    }
    let disposed = false;
    let release: Dispose | null = null;
    runtime
      .requestEntries({ entryIds: [entry.entry_id] })
      .then(async (tickets) => {
        const ticket = tickets[0];
        if (disposed || ticket === undefined) {
          return;
        }
        const handle = await runtime.mountEntry(ticket, slot);
        if (disposed) {
          handle();
        } else {
          release = handle;
        }
      })
      .catch(() => {
        if (!disposed) {
          setMessage('条目内容暂时不可用');
        }
      });
    return () => {
      disposed = true;
      release?.();
    };
  }, [entry.entry_id, visible]);

  const openEntry = (): void => {
    const runtime = frameRuntime;
    if (runtime === null) {
      return;
    }
    void runtime.openDocument(entry.url).catch(() => {
      setMessage('条目暂时无法打开，请稍后重试');
    });
  };

  const labels = showTags ? readTagLabels(entry.snapshot) : [];

  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: dense ? token.marginXXS : token.marginXS,
        minWidth: 0,
      }}
    >
      <div
        ref={slotRef}
        style={{
          minHeight: SLOT_MIN_HEIGHT,
          borderRadius: token.borderRadius,
          overflow: 'hidden',
        }}
      />
      <button
        type="button"
        onClick={openEntry}
        style={{
          border: 0,
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'center',
          color: token.colorText,
          fontSize: token.fontSize,
          fontFamily: 'inherit',
        }}
      >
        {entry.displayTitle.length > 0 ? entry.displayTitle : '未命名条目'}
      </button>
      {labels.length > 0 ? (
        <p style={{ margin: 0, textAlign: 'center', color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
          {labels.join(' · ')}
        </p>
      ) : null}
      {message !== null ? (
        <p style={{ margin: 0, textAlign: 'center', color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
          {message}
        </p>
      ) : null}
    </article>
  );
}

// ---------- 查看态：renderLayout ----------

interface IGridLayoutProps {
  box: BoxRenderView;
}

function GridLayout({ box }: IGridLayoutProps): ReactElement {
  const { token } = theme.useToken();
  const [rootElement, setRootElement] = React.useState<HTMLDivElement | null>(null);
  const columns = useColumnCount(rootElement);
  const config = readConfig(box.layout_config);
  const entries = box.entries.filter((entry) => entry.enabled);
  const dense = config.information_density === 'compact';

  return (
    <div
      ref={setRootElement}
      style={{
        minHeight: '100%',
        padding: dense ? token.paddingSM : token.padding,
        boxSizing: 'border-box',
      }}
    >
      {entries.length === 0 ? (
        <p style={{ margin: 0, textAlign: 'center', color: token.colorTextSecondary }}>
          暂无条目
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: config.gap,
            alignItems: 'start',
            gridTemplateColumns: 'repeat(' + String(Math.max(columns, 2)) + ', minmax(0, 1fr))',
          }}
        >
          {entries.map((entry) => (
            <EntryTile
              key={entry.entry_id}
              entry={entry}
              dense={dense}
              showTags={config.show_tags}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const layoutMounts = new WeakMap<HTMLElement, Dispose>();

/**
 * 查看态渲染：把箱子渲染进容器，返回幂等释放句柄。
 *
 * @param box - 只读箱子渲染视图
 * @param container - 布局帧为该视图提供的容器
 * @returns 释放本次挂载的幂等句柄
 */
function renderLayout(box: BoxRenderView, container: HTMLElement): Dispose {
  layoutMounts.get(container)?.();
  container.replaceChildren();

  const root: Root = createRoot(container);
  flushSync(() => {
    root.render(<GridLayout box={box} />);
  });

  let released = false;
  const dispose = (): void => {
    if (released) {
      return;
    }
    released = true;
    root.unmount();
    if (layoutMounts.get(container) === dispose) {
      layoutMounts.delete(container);
    }
  };
  layoutMounts.set(container, dispose);
  return dispose;
}

// ---------- 编辑态：renderEditor ----------

interface IGridEditorViewProps {
  config: IGridConfig;
  onChange: (next: IGridConfig) => void;
}

function GridEditorView({ config, onChange }: IGridEditorViewProps): ReactElement {
  const { token } = theme.useToken();

  const handleValuesChange = (_changed: Partial<IGridConfig>, values: IGridConfig): void => {
    onChange(readConfig(values));
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        padding: token.padding,
        boxSizing: 'border-box',
      }}
    >
      <Form<IGridConfig>
        layout="vertical"
        initialValues={config}
        onValuesChange={handleValuesChange}
      >
        <Form.Item label="间距（px）" name="gap">
          <Slider min={GAP_MIN} max={GAP_MAX} step={1} />
        </Form.Item>
        <Form.Item label="信息密度" name="information_density">
          <Select
            options={DENSITY_OPTIONS.map((value) => ({ value, label: DENSITY_LABELS[value] }))}
          />
        </Form.Item>
        <Form.Item label="显示标签" name="show_tags" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </div>
  );
}

class GridEditor implements ILayoutEditor {
  public state: EditorState = 'active';

  private base: IGridConfig;
  private revision: number;
  private pending: LayoutChange | null = null;
  private dirty = false;
  private readonly host: HTMLElement;
  private readonly root: Root;
  private readonly changeHandlers = new Set<(payload: ILayoutEditorEventMap['change']) => void>();
  private readonly dirtyHandlers = new Set<(payload: ILayoutEditorEventMap['dirty']) => void>();

  public constructor(box: BoxRenderView, container: HTMLElement) {
    this.base = readConfig(box.layout_config);
    this.revision = box.revision;
    this.host = container;
    container.replaceChildren();
    this.root = createRoot(container);
    this.mount();
  }

  public isDirty(): boolean {
    return this.pending !== null;
  }

  public getChange(): LayoutChange | null {
    return this.pending;
  }

  public markCommitted(revision: number): void {
    if (this.state === 'disposed' || revision <= this.revision) {
      return;
    }
    const committed = this.pending;
    this.revision = revision;
    if (committed !== null && committed.kind === 'replace') {
      this.base = readConfig(committed.config);
    }
    if (this.pending === committed) {
      this.pending = null;
      this.setDirty(false);
    }
  }

  public update(box: BoxRenderView, revision: number): void {
    if (this.state === 'disposed' || revision <= this.revision) {
      return;
    }
    this.revision = revision;
    this.base = readConfig(box.layout_config);
    this.pending = null;
    this.setDirty(false);
    this.mount();
  }

  public subscribe<TEvent extends keyof ILayoutEditorEventMap>(
    event: TEvent,
    handler: (payload: ILayoutEditorEventMap[TEvent]) => void
  ): ISubscription {
    if (this.state === 'disposed') {
      return { dispose: (): void => undefined };
    }
    if (event === 'change') {
      const typed = handler as (payload: ILayoutEditorEventMap['change']) => void;
      this.changeHandlers.add(typed);
      return {
        dispose: (): void => {
          this.changeHandlers.delete(typed);
        },
      };
    }
    const typed = handler as (payload: ILayoutEditorEventMap['dirty']) => void;
    this.dirtyHandlers.add(typed);
    return {
      dispose: (): void => {
        this.dirtyHandlers.delete(typed);
      },
    };
  }

  public focus(): void {
    if (this.state !== 'active') {
      return;
    }
    this.host.querySelector<HTMLInputElement>('input')?.focus();
  }

  public dispose(): void {
    if (this.state === 'disposed') {
      return;
    }
    this.root.unmount();
    this.changeHandlers.clear();
    this.dirtyHandlers.clear();
    this.pending = null;
    this.dirty = false;
    this.state = 'disposed';
  }

  private mount(): void {
    flushSync(() => {
      this.root.render(
        <GridEditorView key={this.revision} config={this.base} onChange={this.handleConfigChange} />
      );
    });
  }

  private readonly handleConfigChange = (next: IGridConfig): void => {
    if (this.state !== 'active') {
      return;
    }
    const change: LayoutChange = {
      kind: 'replace',
      config: { ...next },
      schemaVersion: CONFIG_SCHEMA_VERSION,
    };
    const wasDirty = this.pending !== null;
    this.pending = change;
    if (!wasDirty) {
      this.setDirty(true);
    }
    for (const handler of this.changeHandlers) {
      handler({ change });
    }
  };

  private setDirty(next: boolean): void {
    if (this.dirty === next) {
      return;
    }
    this.dirty = next;
    for (const handler of this.dirtyHandlers) {
      handler({ isDirty: next });
    }
  }
}

/**
 * 编辑态渲染：在就近渲染容器内挂载布局配置编辑器。
 *
 * @param box - 只读箱子渲染视图
 * @param container - 编辑链路的 EditorHost 挂载点
 * @returns 布局编辑会话句柄
 */
function renderEditor(box: BoxRenderView, container: HTMLElement): ILayoutEditor {
  return new GridEditor(box, container);
}

/** 渲染入口：默认导出 IBoxLayoutPlugin 完整实现，由布局帧装载；validateConfig 直发于 ./config。 */
export const renderPlugin: IBoxLayoutPlugin & IBoxLayoutRuntimeAware = {
  attachRuntime,
  renderLayout,
  renderEditor,
  validateConfig,
};

export { attachRuntime, renderLayout, renderEditor };

export default renderPlugin;
`;
}

function indexTs(): string {
  return `// 源码只做拆分导出：构建以 src/main.ts 生成 dist/index.js、以 src/render.tsx 生成 render.js。
export { validateConfig } from './config';
export { mainPlugin } from './main';
export { renderPlugin, renderLayout, renderEditor, attachRuntime } from './render';
export { default } from './render';
`;
}

function configSchema(context: IScaffoldContext): string {
  return `${JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: `${context.options.name}配置`,
      type: 'object',
      additionalProperties: false,
      properties: {
        gap: {
          type: 'integer',
          minimum: 0,
          maximum: 64,
          default: 16,
          description: '条目间距（px）',
        },
        show_tags: {
          type: 'boolean',
          default: true,
          description: '是否显示条目标签',
        },
        information_density: {
          type: 'string',
          enum: ['comfortable', 'compact'],
          default: 'comfortable',
          description: '信息密度',
        },
      },
    },
    null,
    2
  )}\n`;
}

function testsTs(): string {
  return `import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoxRenderView } from '@chips/sdk';
import {
  DEFAULT_CONFIG,
  computeColumnCount,
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
});

describe('readConfig 与 computeColumnCount', () => {
  it('归一非法配置', () => {
    expect(readConfig({ gap: 999 })).toEqual({ ...DEFAULT_CONFIG, gap: 64 });
    expect(readConfig({ information_density: 'dense' })).toEqual(DEFAULT_CONFIG);
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

  it('渲染空态并在释放后清空挂载', () => {
    const dispose = renderLayout(createBox(), container);
    expect(container.textContent).toContain('暂无条目');
    dispose();
    expect(container.childNodes).toHaveLength(0);
  });

  it('渲染条目外壳且释放幂等', () => {
    const box = createBox({
      entries: [
        {
          entry_id: 'e1',
          url: 'chips-resource://plugin-1/card.card',
          enabled: true,
          displayTitle: '旅行日记',
          order: 0,
        },
      ],
    });
    const dispose = renderLayout(box, container);
    expect(container.textContent).toContain('旅行日记');
    dispose();
    dispose();
    expect(container.childNodes).toHaveLength(0);
  });
});

describe('renderEditor', () => {
  it('产出替换变更并在提交后清脏', () => {
    vi.useFakeTimers();
    const box = createBox({ layout_config: { gap: 24 } });
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const editor = renderEditor(box, host);
    expect(editor.state).toBe('active');
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
`;
}

/** 构建 `boxlayout` 角色的全部角色文件（公共文件由模板装配器补充）。 */
export function buildBoxlayoutFiles(context: IScaffoldContext): IScaffoldFile[] {
  const { assetSlug } = context;
  return [
    { path: 'src/config.ts', content: configTs() },
    { path: 'src/main.ts', content: mainTs() },
    { path: 'src/render.tsx', content: renderTsx() },
    { path: 'src/index.ts', content: indexTs() },
    { path: `assets/icons/${assetSlug}.svg`, content: ICON_SVG },
    { path: `assets/schemas/${assetSlug}-config.schema.json`, content: configSchema(context) },
    { path: 'tests/render.test.ts', content: testsTs() },
  ];
}
