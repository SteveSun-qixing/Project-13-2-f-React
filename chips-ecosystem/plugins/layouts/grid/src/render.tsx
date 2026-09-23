import type { ReactElement } from 'react';
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import {
  EmbeddedDocumentFrame,
  EmptyHint,
  Form,
  Input,
  LayoutSkeleton,
  Select,
  SkeletonBlock,
  SkeletonLine,
  Slider,
  Switch,
  theme,
} from '@chips/ui';
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
  BACKGROUND_TITLE,
  CONFIG_SCHEMA_VERSION,
  DENSITY_LABELS,
  DENSITY_OPTIONS,
  FRAME_REGION_MODE_LABELS,
  FRAME_REGION_MODE_OPTIONS,
  GAP_MAX,
  GAP_MIN,
  SORT_LABELS,
  SORT_OPTIONS,
  TOP_REGION_TITLE,
  computeColumnCount,
  hasFrameRegionContent,
  isSafeBoxAssetPath,
  readConfig,
  validateConfig,
} from './config';
import type { IFrameRegion, IGridConfig } from './config';

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
      const nested = tag.filter(
        (item): item is string => typeof item === 'string' && item.length > 0
      );
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
        <p
          style={{
            margin: 0,
            textAlign: 'center',
            color: token.colorTextSecondary,
            fontSize: token.fontSizeSM,
          }}
        >
          {labels.join(' · ')}
        </p>
      ) : null}
      {message !== null ? (
        <p
          style={{
            margin: 0,
            textAlign: 'center',
            color: token.colorTextSecondary,
            fontSize: token.fontSizeSM,
          }}
        >
          {message}
        </p>
      ) : null}
    </article>
  );
}

// ---------- 排序与区域呈现 ----------

/**
 * 按配置的排序方式对条目排序：名称比较用简体中文习惯，同名称按条目标识稳定兜底。
 *
 * @param entries - 已过滤为启用的条目列表
 * @param sortMode - 排序方式
 * @returns 排序后的新数组；手动顺序保持呈现顺序
 */
function sortEntries(
  entries: readonly EntryView[],
  sortMode: IGridConfig['sort_mode']
): EntryView[] {
  if (sortMode === 'manual') {
    return [...entries];
  }
  const direction = sortMode === 'name-desc' ? -1 : 1;
  return [...entries].sort((left, right) => {
    const compared = left.displayTitle.localeCompare(right.displayTitle, 'zh-CN');
    if (compared !== 0) {
      return compared * direction;
    }
    return left.entry_id.localeCompare(right.entry_id);
  });
}

interface IFrameRegionSurfaceProps {
  region: IFrameRegion;
  title: string;
  /** 区域版式：背景区固定 16:9，顶部内容区按内容自适应高度。 */
  variant: 'background' | 'top';
}

/**
 * 区域呈现表面：代码模式以内联 HTML 交给受控文档帧；图片模式以箱子资源相对路径
 * 交给受控文档帧，由布局帧注入的 `chips-resource://` 基址解析到箱子作用域
 * （09-箱子布局插件接口 §6.4）。
 */
function FrameRegionSurface({
  region,
  title,
  variant,
}: IFrameRegionSurfaceProps): ReactElement | null {
  if (!hasFrameRegionContent(region)) {
    return null;
  }
  if (region.mode === 'html' && region.html !== undefined) {
    return variant === 'background' ? (
      <EmbeddedDocumentFrame
        title={title}
        srcDoc={region.html}
        ratio="16:9"
        sandbox="allow-scripts"
      />
    ) : (
      <EmbeddedDocumentFrame
        title={title}
        srcDoc={region.html}
        autoHeight
        maxHeightFactor={3}
        sandbox="allow-scripts"
      />
    );
  }
  if (
    region.mode === 'image' &&
    region.assetPath !== undefined &&
    isSafeBoxAssetPath(region.assetPath)
  ) {
    return variant === 'background' ? (
      <EmbeddedDocumentFrame
        title={title}
        src={region.assetPath}
        ratio="16:9"
        sandbox="allow-scripts"
      />
    ) : (
      <EmbeddedDocumentFrame
        title={title}
        src={region.assetPath}
        autoHeight
        sandbox="allow-scripts"
      />
    );
  }
  return null;
}

// ---------- 查看态：renderLayout ----------

interface IGridLayoutProps {
  box: BoxRenderView;
}

const SKELETON_CELL_KEYS = [0, 1, 2, 3, 4, 5] as const;

function GridLayout({ box }: IGridLayoutProps): ReactElement {
  const { token } = theme.useToken();
  const [rootElement, setRootElement] = React.useState<HTMLDivElement | null>(null);
  const columns = useColumnCount(rootElement);
  const config = readConfig(box.layout_config);
  const entries = sortEntries(
    box.entries.filter((entry) => entry.enabled),
    config.sort_mode
  );
  const dense = config.information_density === 'compact';
  const showBackground = hasFrameRegionContent(config.background);
  const showTopRegion = hasFrameRegionContent(config.top_region);

  return (
    <div
      ref={setRootElement}
      aria-label="网格箱子布局"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginXS,
        minHeight: '100%',
        padding: dense ? token.paddingSM : token.padding,
        boxSizing: 'border-box',
      }}
    >
      {showBackground ? (
        <div aria-hidden="true" style={{ width: '100%' }}>
          <FrameRegionSurface
            region={config.background}
            title={BACKGROUND_TITLE}
            variant="background"
          />
        </div>
      ) : null}
      {showTopRegion ? (
        <div style={{ width: '100%' }}>
          <FrameRegionSurface region={config.top_region} title={TOP_REGION_TITLE} variant="top" />
        </div>
      ) : null}
      {entries.length === 0 ? (
        <LayoutSkeleton
          hint={
            <EmptyHint
              title="这里还没有内容"
              description="在编辑器中添加卡片或箱子，开始填充这个箱子"
            />
          }
        >
          <div
            style={{
              display: 'grid',
              gap: config.gap,
              gridTemplateColumns: 'repeat(' + String(Math.max(columns, 2)) + ', minmax(0, 1fr))',
            }}
          >
            {SKELETON_CELL_KEYS.map((key) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: token.marginXXS,
                  minWidth: 0,
                }}
              >
                <SkeletonBlock width="100%" radius={12} style={{ aspectRatio: '3 / 4' }} />
                <SkeletonLine width="62%" />
                <SkeletonLine width="40%" height={8} radius={4} />
              </div>
            ))}
          </div>
        </LayoutSkeleton>
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

interface IFrameRegionFieldsProps {
  title: string;
  field: 'background' | 'top_region';
}

/**
 * 区域编辑字段组：呈现模式选择、图片模式的箱子资源路径输入（含安全路径校验）、
 * 代码模式的内联 HTML 输入。编辑器只产出配置变更，不写文件、不导入资源
 * （05.06 §6.3：资源写入与清理由编辑链路的正式资源桥承担）。
 */
function FrameRegionFields({ title, field }: IFrameRegionFieldsProps): ReactElement {
  const { token } = theme.useToken();
  return (
    <fieldset
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        padding: token.paddingXS,
        margin: 0,
      }}
    >
      <legend style={{ paddingInline: token.paddingXXS }}>{title}</legend>
      <Form.Item label="呈现模式" name={[field, 'mode']}>
        <Select
          options={FRAME_REGION_MODE_OPTIONS.map((value) => ({
            value,
            label: FRAME_REGION_MODE_LABELS[value],
          }))}
        />
      </Form.Item>
      <Form.Item noStyle shouldUpdate>
        {({ getFieldValue }) => {
          const mode: unknown = getFieldValue([field, 'mode']);
          if (mode === 'image') {
            return (
              <Form.Item
                label="箱子资源路径"
                name={[field, 'assetPath']}
                extra="以 assets/ 开头的箱子自有资源相对路径"
                rules={[
                  {
                    validator: (_rule, value: unknown) => {
                      if (
                        typeof value === 'string' &&
                        value.length > 0 &&
                        !isSafeBoxAssetPath(value)
                      ) {
                        return Promise.reject(new Error('请输入以 assets/ 开头的合法箱子资源路径'));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input placeholder="assets/layouts/background.png" />
              </Form.Item>
            );
          }
          if (mode === 'html') {
            return (
              <Form.Item label="HTML 代码" name={[field, 'html']}>
                <Input.TextArea rows={6} placeholder="<section>…</section>" />
              </Form.Item>
            );
          }
          return null;
        }}
      </Form.Item>
    </fieldset>
  );
}

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
        <Form.Item label="排序方式" name="sort_mode" extra="手动顺序请在「内容列表」标签页拖拽调整">
          <Select options={SORT_OPTIONS.map((value) => ({ value, label: SORT_LABELS[value] }))} />
        </Form.Item>
        <FrameRegionFields title={BACKGROUND_TITLE} field="background" />
        <FrameRegionFields title={TOP_REGION_TITLE} field="top_region" />
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
