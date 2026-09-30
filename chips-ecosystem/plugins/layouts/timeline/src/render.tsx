import type { CSSProperties, ReactElement } from 'react';
import React, { useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import {
  Button,
  EmbeddedDocumentFrame,
  EmptyHint,
  Form,
  Input,
  LayoutSkeleton,
  Segmented,
  Select,
  SkeletonBlock,
  SkeletonDot,
  SkeletonLine,
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
  COLLAPSED_VISIBLE_ENTRIES,
  CONFIG_SCHEMA_VERSION,
  DENSITY_COVER_SIZE,
  DENSITY_LABELS,
  DENSITY_OPTIONS,
  FRAME_REGION_MODE_LABELS,
  FRAME_REGION_MODE_OPTIONS,
  HORIZONTAL_SCROLL_STEP,
  ORIENTATION_LABELS,
  ORIENTATION_OPTIONS,
  SCALE_MODE_HINT,
  SCALE_MODE_LABELS,
  SCALE_MODE_OPTIONS,
  TOP_REGION_TITLE,
  UNSCHEDULED_GROUP_ID,
  buildTimelineGroups,
  createPointId,
  formatPointDate,
  hasFrameRegionContent,
  isCompactWidth,
  isSafeBoxAssetPath,
  readConfig,
  toCssAspectRatio,
  validateConfig,
} from './config';
import type {
  IFrameRegion,
  ITimelineConfig,
  ITimelineGroup,
  ITimelinePointConfig,
  TimelineCardDensity,
} from './config';

/** 空箱骨架的节点数（结构常量）。 */
const SKELETON_NODE_KEYS = [0, 1, 2, 3, 4] as const;

/** 条目封面槽位的最小保留高度（结构常量）。 */
const SLOT_MIN_HEIGHT = 96;

// ---------- 帧运行时注入 ----------

let frameRuntime: IBoxLayoutFrameRuntime | null = null;

/** 帧运行时在首次调用 renderLayout 前注入句柄。 */
function attachRuntime(runtime: IBoxLayoutFrameRuntime): void {
  frameRuntime = runtime;
}

// ---------- 容器宽度观测 ----------

/**
 * 观察容器宽度并返回当前内容宽度。
 *
 * @param container - 布局根容器
 * @returns 当前内容宽度（px）；未测量时为 0
 */
function useContainerWidth(container: HTMLElement | null): number {
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    if (container === null) {
      return undefined;
    }
    setWidth(container.clientWidth);
    const observer = new ResizeObserver((records) => {
      const record = records[0];
      if (record !== undefined) {
        setWidth(record.contentRect.width);
      }
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [container]);

  return width;
}

// ---------- 区域呈现表面 ----------

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
function FrameRegionSurface({ region, title, variant }: IFrameRegionSurfaceProps): ReactElement | null {
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

// ---------- 条目槽位与条目外壳 ----------

interface IEntrySlotProps {
  entry: EntryView;
}

/** 条目帧槽位：进入可见范围后经帧运行时请求票证并挂载平台管理的条目帧。 */
function EntrySlot({ entry }: IEntrySlotProps): ReactElement {
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

  const aspectRatio = toCssAspectRatio(entry.layout_hints?.aspectRatio, '3 / 4');

  return (
    <div style={{ display: 'grid', minWidth: 0 }}>
      <div
        ref={slotRef}
        data-timeline-entry-slot
        style={{
          width: '100%',
          minHeight: SLOT_MIN_HEIGHT,
          aspectRatio,
          borderRadius: token.borderRadius,
          overflow: 'hidden',
        }}
      />
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
    </div>
  );
}

interface ITimelineEntryProps {
  entry: EntryView;
  showCover: boolean;
  coverSize: number;
  stackCover: boolean;
  padding: number;
}

/** 条目外壳：封面槽位（可选）+ 标题 + 可选摘要；激活经 openDocument 转发。 */
function TimelineEntry({
  entry,
  showCover,
  coverSize,
  stackCover,
  padding,
}: ITimelineEntryProps): ReactElement {
  const { token } = theme.useToken();
  const [message, setMessage] = React.useState<string | null>(null);

  const title = entry.displayTitle.length > 0 ? entry.displayTitle : '未命名条目';
  const summary = React.useMemo(() => {
    const value = entry.snapshot?.summary;
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }, [entry.snapshot]);

  const openEntry = (): void => {
    const runtime = frameRuntime;
    if (runtime === null) {
      return;
    }
    void runtime.openDocument(entry.url).catch(() => {
      setMessage('条目暂时无法打开，请稍后重试');
    });
  };

  return (
    <article
      data-timeline-entry
      data-entry-id={entry.entry_id}
      style={{
        display: 'grid',
        gridTemplateColumns:
          showCover && !stackCover ? `${coverSize}px minmax(0, 1fr)` : 'minmax(0, 1fr)',
        gap: token.marginXS,
        minWidth: 0,
        alignItems: 'start',
        padding,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        background: token.colorBgContainer,
      }}
    >
      {showCover ? <EntrySlot entry={entry} /> : null}
      <div style={{ display: 'grid', gap: token.marginXS, minWidth: 0 }}>
        <button
          type="button"
          data-timeline-entry-title
          onClick={openEntry}
          title={title}
          style={{
            border: 0,
            margin: 0,
            padding: 0,
            background: 'none',
            cursor: 'pointer',
            color: token.colorText,
            fontFamily: 'inherit',
            fontSize: token.fontSize,
            fontWeight: token.fontWeightStrong,
            textAlign: 'start',
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {title}
        </button>
        {summary !== null ? (
          <p
            style={{
              margin: 0,
              color: token.colorTextSecondary,
              fontSize: token.fontSizeSM,
              overflowWrap: 'anywhere',
            }}
          >
            {summary}
          </p>
        ) : null}
        {message !== null ? (
          <p
            style={{
              margin: 0,
              color: token.colorTextSecondary,
              fontSize: token.fontSizeSM,
            }}
          >
            {message}
          </p>
        ) : null}
      </div>
    </article>
  );
}

// ---------- 时间点分组呈现 ----------

interface ITimelinePointProps {
  group: ITimelineGroup;
  vertical: boolean;
  compact: boolean;
  config: ITimelineConfig;
  expanded: boolean;
  onToggle: (groupId: string) => void;
}

function densityPadding(density: TimelineCardDensity, tokenPaddingXS: number, tokenPaddingSM: number, tokenPadding: number): number {
  if (density === 'compact') {
    return tokenPaddingXS;
  }
  if (density === 'spacious') {
    return tokenPadding;
  }
  return tokenPaddingSM;
}

function TimelinePoint({
  group,
  vertical,
  compact,
  config,
  expanded,
  onToggle,
}: ITimelinePointProps): ReactElement {
  const { token } = theme.useToken();
  const dateLabel = group.isUnscheduled ? undefined : formatPointDate(group.date);
  const visibleEntries =
    expanded || group.entries.length <= COLLAPSED_VISIBLE_ENTRIES
      ? group.entries
      : group.entries.slice(0, COLLAPSED_VISIBLE_ENTRIES);
  const coverSize = DENSITY_COVER_SIZE[config.card_density];
  const padding = densityPadding(
    config.card_density,
    token.paddingXS,
    token.paddingSM,
    token.padding
  );

  const activatePoint = (): void => {
    if (group.entries.length === 1) {
      const onlyEntry = group.entries[0];
      if (onlyEntry !== undefined) {
        const runtime = frameRuntime;
        if (runtime !== null) {
          void runtime.openDocument(onlyEntry.url).catch(() => undefined);
        }
      }
      return;
    }
    onToggle(group.id);
  };

  const articleStyle: CSSProperties =
    vertical && !compact
      ? {
          position: 'relative',
          display: 'grid',
          gap: token.marginSM,
          minWidth: 0,
          paddingBottom: token.marginSM,
          gridTemplateColumns: 'minmax(96px, 148px) minmax(0, 1fr)',
        }
      : {
          position: 'relative',
          display: 'grid',
          gap: token.marginSM,
          minWidth: 0,
          paddingBottom: token.marginSM,
          alignContent: 'start',
          ...(vertical
            ? {}
            : {
                flex: '0 0 clamp(240px, 32vw, 360px)',
                scrollSnapAlign: 'start',
              }),
        };

  return (
    <article data-timeline-point data-point-id={group.id} style={articleStyle}>
      {vertical && !compact ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 7,
            top: 20,
            bottom: -12,
            width: 2,
            background: token.colorSplit,
          }}
        />
      ) : null}
      {!vertical ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 16,
            right: -16,
            top: 7,
            height: 2,
            background: token.colorSplit,
          }}
        />
      ) : null}
      <div
        style={{
          display: 'grid',
          gap: token.marginXS,
          alignContent: 'start',
          minWidth: 0,
          isolation: 'isolate',
        }}
      >
        <span
          aria-hidden="true"
          data-timeline-dot
          style={{
            width: 16,
            height: 16,
            borderRadius: 999,
            background: token.colorPrimary,
            boxShadow: `0 0 0 4px ${token.colorPrimaryBg}`,
          }}
        />
        <button
          type="button"
          onClick={activatePoint}
          aria-expanded={group.entries.length > 1 ? expanded : undefined}
          style={{
            border: 0,
            padding: 0,
            background: 'none',
            cursor: 'pointer',
            display: 'grid',
            gap: token.marginXXS,
            textAlign: 'start',
            justifyItems: 'start',
            color: token.colorText,
            fontFamily: 'inherit',
            fontSize: token.fontSize,
          }}
        >
          <span
            style={{
              fontSize: token.fontSizeLG,
              fontWeight: token.fontWeightStrong,
              overflowWrap: 'anywhere',
            }}
          >
            {group.label}
          </span>
          {dateLabel !== undefined ? (
            <span
              data-timeline-date
              style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}
            >
              {dateLabel}
            </span>
          ) : null}
          <span
            data-timeline-count
            style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}
          >
            {`${group.entries.length} 个条目`}
          </span>
        </button>
        {group.note !== undefined ? (
          <p
            style={{
              margin: 0,
              color: token.colorTextSecondary,
              fontSize: token.fontSizeSM,
              overflowWrap: 'anywhere',
            }}
          >
            {group.note}
          </p>
        ) : null}
      </div>
      <div style={{ display: 'grid', gap: token.marginXS, minWidth: 0, alignContent: 'start' }}>
        {visibleEntries.map((entry) => (
          <TimelineEntry
            key={entry.entry_id}
            entry={entry}
            showCover={config.show_covers}
            coverSize={coverSize}
            stackCover={compact}
            padding={padding}
          />
        ))}
        {!expanded && group.entries.length > visibleEntries.length ? (
          <button
            type="button"
            data-timeline-expand
            onClick={() => {
              onToggle(group.id);
            }}
            style={{
              border: 0,
              margin: 0,
              padding: 0,
              background: 'none',
              cursor: 'pointer',
              color: token.colorPrimary,
              fontFamily: 'inherit',
              fontSize: token.fontSizeSM,
              textAlign: 'start',
            }}
          >
            {`展开其余 ${group.entries.length - visibleEntries.length} 个条目`}
          </button>
        ) : null}
      </div>
    </article>
  );
}

// ---------- 查看态：renderLayout ----------

interface ITimelineLayoutProps {
  box: BoxRenderView;
}

const UNSCHEDULED_HINT = '未绑定任何时间点的条目会集中呈现在这里，不会丢失';

function TimelineLayout({ box }: ITimelineLayoutProps): ReactElement {
  const { token } = theme.useToken();
  const [rootElement, setRootElement] = React.useState<HTMLDivElement | null>(null);
  const containerWidth = useContainerWidth(rootElement);
  const compact = isCompactWidth(containerWidth);
  const [expandedGroupIds, setExpandedGroupIds] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );
  const config = React.useMemo(() => readConfig(box.layout_config), [box.layout_config]);
  const groups = React.useMemo(
    () => [...buildTimelineGroups(box.entries, config)].sort(
      (left, right) => left.position - right.position
    ),
    [box.entries, config]
  );
  const enabledEntries = React.useMemo(
    () => box.entries.filter((entry) => entry.enabled),
    [box.entries]
  );
  const vertical = config.orientation === 'vertical';
  const showBackground = hasFrameRegionContent(config.background);
  const showTopRegion = hasFrameRegionContent(config.top_region);

  const toggleGroup = useCallback((groupId: string): void => {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>): void => {
      if (vertical) {
        return;
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }
      event.preventDefault();
      const root = event.currentTarget;
      if (typeof root.scrollBy === 'function') {
        root.scrollBy({
          left: event.key === 'ArrowRight' ? HORIZONTAL_SCROLL_STEP : -HORIZONTAL_SCROLL_STEP,
          behavior: 'smooth',
        });
      }
    },
    [vertical]
  );

  const timelineRootStyle: CSSProperties = vertical
    ? {
        display: 'grid',
        gap: token.margin,
        minWidth: 0,
      }
    : {
        display: 'flex',
        gap: token.margin,
        minWidth: 0,
        overflowX: 'auto',
        scrollSnapType: 'x proximity',
        paddingBottom: token.marginXS,
      };

  return (
    <div
      ref={setRootElement}
      aria-label="时间线箱子布局"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginXS,
        width: '100%',
        minWidth: 0,
        minHeight: '100%',
        padding: token.padding,
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
      {enabledEntries.length === 0 ? (
        <LayoutSkeleton
          minHeight={320}
          hint={
            <EmptyHint
              align="start"
              title="这里还没有内容"
              description="在编辑器中添加卡片或箱子，开始填充这个箱子"
            />
          }
        >
          {SKELETON_NODE_KEYS.map((key) => (
            <div
              key={key}
              data-timeline-skeleton-node
              style={{
                display: 'flex',
                gap: token.marginSM,
                alignItems: 'stretch',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: 40,
                  flexShrink: 0,
                }}
              >
                <SkeletonDot size={12} />
                {key < SKELETON_NODE_KEYS.length - 1 ? (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 8,
                      marginTop: token.marginXXS,
                      background: token.colorSplit,
                    }}
                  />
                ) : null}
              </div>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 420,
                  flexShrink: 0,
                }}
              >
                <SkeletonBlock width="100%" height={64} radius={10} dashed />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    padding: `${token.paddingSM}px ${token.padding}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: token.marginXS,
                  }}
                >
                  <SkeletonLine width="50%" />
                  <SkeletonLine width="32%" height={8} />
                </div>
              </div>
            </div>
          ))}
        </LayoutSkeleton>
      ) : (
        <div
          data-timeline-root
          data-orientation={config.orientation}
          data-scale-mode={config.scale_mode}
          data-density={config.card_density}
          tabIndex={vertical ? undefined : 0}
          onKeyDown={handleKeyDown}
          style={timelineRootStyle}
        >
          {groups.map((group) => (
            <TimelinePoint
              key={group.id === UNSCHEDULED_GROUP_ID ? `${group.id}-${group.position}` : group.id}
              group={group}
              vertical={vertical}
              compact={compact}
              config={config}
              expanded={expandedGroupIds.has(group.id)}
              onToggle={toggleGroup}
            />
          ))}
          {groups.some((group) => group.isUnscheduled) ? (
            <p
              style={{
                margin: 0,
                color: token.colorTextSecondary,
                fontSize: token.fontSizeSM,
              }}
            >
              {UNSCHEDULED_HINT}
            </p>
          ) : null}
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
    root.render(<TimelineLayout box={box} />);
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

interface ITimelineEditorViewProps {
  config: ITimelineConfig;
  entries: readonly EntryView[];
  onChange: (next: ITimelineConfig) => void;
}

function TimelineEditorView({
  config: initialConfig,
  entries,
  onChange,
}: ITimelineEditorViewProps): ReactElement {
  const { token } = theme.useToken();
  const [config, setConfig] = React.useState<ITimelineConfig>(() => readConfig(initialConfig));

  const commit = useCallback(
    (next: ITimelineConfig): void => {
      const normalized = readConfig(next);
      setConfig(normalized);
      onChange(normalized);
    },
    [onChange]
  );

  const handleValuesChange = (
    _changed: Partial<ITimelineConfig>,
    values: ITimelineConfig
  ): void => {
    commit({ ...config, ...values });
  };

  const commitPoints = useCallback(
    (points: readonly ITimelinePointConfig[]): void => {
      commit({ ...config, points: [...points] });
    },
    [commit, config]
  );

  const addPoint = useCallback((): void => {
    commitPoints([
      ...config.points,
      {
        id: createPointId(config.points),
        label: `时间点 ${config.points.length + 1}`,
        entry_ids: [],
      },
    ]);
  }, [commitPoints, config.points]);

  const removePoint = useCallback(
    (pointId: string): void => {
      commitPoints(config.points.filter((point) => point.id !== pointId));
    },
    [commitPoints, config.points]
  );

  const updatePoint = useCallback(
    (pointId: string, patch: Partial<ITimelinePointConfig>): void => {
      commitPoints(
        config.points.map((point) => (point.id === pointId ? { ...point, ...patch } : point))
      );
    },
    [commitPoints, config.points]
  );

  const enabledEntries = useMemo(() => entries.filter((entry) => entry.enabled), [entries]);
  const assignedIds = useMemo(
    () => new Set(config.points.flatMap((point) => point.entry_ids)),
    [config.points]
  );

  const fieldLabelStyle: CSSProperties = {
    fontSize: token.fontSizeSM,
    color: token.colorTextSecondary,
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
        display: 'grid',
        gap: token.margin,
      }}
    >
      <Form<ITimelineConfig>
        layout="vertical"
        initialValues={config}
        onValuesChange={handleValuesChange}
      >
        <Form.Item label="方向" name="orientation">
          <Segmented
            options={ORIENTATION_OPTIONS.map((value) => ({
              value,
              label: ORIENTATION_LABELS[value],
            }))}
          />
        </Form.Item>
        <Form.Item label="比例方式" name="scale_mode" extra={SCALE_MODE_HINT}>
          <Segmented
            options={SCALE_MODE_OPTIONS.map((value) => ({
              value,
              label: SCALE_MODE_LABELS[value],
            }))}
          />
        </Form.Item>
        <Form.Item label="卡片密度" name="card_density">
          <Segmented
            options={DENSITY_OPTIONS.map((value) => ({ value, label: DENSITY_LABELS[value] }))}
          />
        </Form.Item>
        <Form.Item
          label="显示条目封面"
          name="show_covers"
          valuePropName="checked"
          extra="开启后查看态为可见条目挂载平台条目帧，呈现正式封面"
        >
          <Switch />
        </Form.Item>
        <FrameRegionFields title={BACKGROUND_TITLE} field="background" />
        <FrameRegionFields title={TOP_REGION_TITLE} field="top_region" />
      </Form>

      <section
        aria-label="时间点编辑"
        style={{
          display: 'grid',
          gap: token.marginXS,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          padding: token.paddingXS,
        }}
      >
        <div style={{ display: 'grid', gap: token.marginXXS }}>
          <p style={{ margin: 0, fontWeight: token.fontWeightStrong, fontSize: token.fontSize }}>
            时间点
          </p>
          <p style={{ margin: 0, color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
            新增、删除、重命名时间点，并维护日期、说明和已绑定条目
          </p>
          <p style={{ margin: 0, color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
            {`当前箱子包含 ${enabledEntries.length} 个条目`}
          </p>
        </div>
        <div>
          <Button onClick={addPoint}>新增时间点</Button>
        </div>
        {config.points.length === 0 ? (
          <p style={{ margin: 0, color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
            还没有时间点
          </p>
        ) : (
          config.points.map((point, index) => {
            const pointOptions = enabledEntries.map((entry) => ({
              value: entry.entry_id,
              label: entry.displayTitle.length > 0 ? entry.displayTitle : '未命名条目',
              disabled: assignedIds.has(entry.entry_id) && !point.entry_ids.includes(entry.entry_id),
            }));
            const pointEntries = point.entry_ids
              .map((entryId) => enabledEntries.find((entry) => entry.entry_id === entryId))
              .filter((entry): entry is EntryView => entry !== undefined);

            return (
              <fieldset
                key={point.id}
                data-point-id={point.id}
                style={{
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadius,
                  padding: token.paddingXS,
                  margin: 0,
                  display: 'grid',
                  gap: token.marginXS,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: token.marginXS,
                  }}
                >
                  <strong style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    {`时间点 ${index + 1}`}
                  </strong>
                  <Button type="text" danger size="small" onClick={() => removePoint(point.id)}>
                    删除时间点
                  </Button>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                    gap: token.marginXS,
                  }}
                >
                  <label
                    style={{
                      display: 'grid',
                      gap: token.marginXXS,
                      minWidth: 0,
                    }}
                  >
                    <span style={fieldLabelStyle}>名称</span>
                    <Input
                      value={point.label}
                      aria-label="名称"
                      onChange={(event) => {
                        updatePoint(point.id, { label: event.target.value });
                      }}
                    />
                  </label>
                  <label
                    style={{
                      display: 'grid',
                      gap: token.marginXXS,
                      minWidth: 0,
                    }}
                  >
                    <span style={fieldLabelStyle}>日期</span>
                    <Input
                      value={point.date ?? ''}
                      aria-label="日期"
                      placeholder="2026-07-06 或 阶段一"
                      onChange={(event) => {
                        updatePoint(point.id, { date: event.target.value });
                      }}
                    />
                  </label>
                </div>
                <label style={{ display: 'grid', gap: token.marginXXS, minWidth: 0 }}>
                  <span style={fieldLabelStyle}>说明</span>
                  <Input.TextArea
                    value={point.note ?? ''}
                    aria-label="说明"
                    rows={3}
                    onChange={(event) => {
                      updatePoint(point.id, { note: event.target.value });
                    }}
                  />
                </label>
                <div style={{ display: 'grid', gap: token.marginXXS, minWidth: 0 }}>
                  <span style={fieldLabelStyle}>绑定条目</span>
                  <Select<string[]>
                    mode="multiple"
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="选择要绑定到这个时间点的条目"
                    value={point.entry_ids}
                    options={pointOptions}
                    disabled={enabledEntries.length === 0}
                    onChange={(ids) => {
                      updatePoint(point.id, { entry_ids: [...ids] });
                    }}
                  />
                  {pointEntries.length === 0 ? (
                    <p
                      style={{
                        margin: 0,
                        color: token.colorTextSecondary,
                        fontSize: token.fontSizeSM,
                      }}
                    >
                      这个时间点还没有绑定条目
                    </p>
                  ) : (
                    pointEntries.map((entry) => (
                      <div
                        key={entry.entry_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: token.marginXS,
                          padding: token.paddingXXS,
                          border: `1px solid ${token.colorBorderSecondary}`,
                          borderRadius: token.borderRadius,
                          minWidth: 0,
                        }}
                      >
                        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                          {entry.displayTitle.length > 0 ? entry.displayTitle : '未命名条目'}
                        </span>
                        <Button
                          type="text"
                          danger
                          size="small"
                          onClick={() => {
                            updatePoint(point.id, {
                              entry_ids: point.entry_ids.filter(
                                (entryId) => entryId !== entry.entry_id
                              ),
                            });
                          }}
                        >
                          移出
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </fieldset>
            );
          })
        )}
      </section>
    </div>
  );
}

class TimelineEditor implements ILayoutEditor {
  public state: EditorState = 'active';

  private base: ITimelineConfig;
  private revision: number;
  private pending: LayoutChange | null = null;
  private dirty = false;
  private entries: readonly EntryView[];
  private readonly host: HTMLElement;
  private readonly root: Root;
  private readonly changeHandlers = new Set<(payload: ILayoutEditorEventMap['change']) => void>();
  private readonly dirtyHandlers = new Set<(payload: ILayoutEditorEventMap['dirty']) => void>();

  public constructor(box: BoxRenderView, container: HTMLElement) {
    this.base = readConfig(box.layout_config);
    this.revision = box.revision;
    this.entries = [...box.entries];
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
    this.entries = [...box.entries];
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
        <TimelineEditorView
          key={this.revision}
          config={this.base}
          entries={this.entries}
          onChange={this.handleConfigChange}
        />
      );
    });
  }

  private readonly handleConfigChange = (next: ITimelineConfig): void => {
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
  return new TimelineEditor(box, container);
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
