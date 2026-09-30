import type { CSSProperties, ReactElement } from 'react';
import React from 'react';
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
  Select,
  SkeletonBlock,
  SkeletonDot,
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
  BOUNDS_FIELD_LABELS,
  CONFIG_SCHEMA_VERSION,
  EMPTY_HINT_TEXT,
  EMPTY_TITLE,
  HOST_MAP_RESERVED_HINT,
  HOST_MAP_UNAVAILABLE_TEXT,
  IMAGE_MODE_HINT,
  MAP_BASEMAP_TITLE,
  MAP_ENTRIES_TITLE,
  MAP_SOURCE_HOST_LABEL,
  MAP_SOURCE_IMAGE_LABEL,
  MAP_VIEW_TITLE,
  MARKER_STYLE_LABELS,
  MARKER_STYLE_OPTIONS,
  PAN_STEP_DEGREES,
  TOP_REGION_TITLE,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  clampZoom,
  hasCustomMapImage,
  hasFrameRegionContent,
  isSafeBoxAssetPath,
  panCenter,
  projectLinear,
  readConfig,
  validateConfig,
} from './config';
import type { GeoPoint, IFrameRegion, IMapConfig, MapEntryLocation, MapSourceMode } from './config';

// ---------- 帧运行时注入 ----------

let frameRuntime: IBoxLayoutFrameRuntime | null = null;

/** 帧运行时在首次调用 renderLayout 前注入句柄。 */
function attachRuntime(runtime: IBoxLayoutFrameRuntime): void {
  frameRuntime = runtime;
}

// ---------- 文案与样式原子 ----------

const OPEN_ENTRY_FAILED_TEXT = '条目暂时无法打开，请稍后重试';
const PREVIEW_FAILED_TEXT = '条目预览暂时不可用';
const UNLOCATED_TITLE = '未定位条目';
const CONTROLS_LABEL = '地图视图控制';
const ZOOM_IN_LABEL = '放大';
const ZOOM_OUT_LABEL = '缩小';
const PAN_NORTH_LABEL = '向北平移';
const PAN_SOUTH_LABEL = '向南平移';
const PAN_WEST_LABEL = '向西平移';
const PAN_EAST_LABEL = '向东平移';
const RESET_VIEW_LABEL = '重置视图';
const OPEN_ENTRY_LABEL = '打开条目';
const CLOSE_PREVIEW_LABEL = '关闭';
const BASEMAP_ALT_TEXT = '地图底图';

/** 结构化主题令牌子集：只声明本包消费的 token 字段，避免对 `theme.useToken` 的类型级方法引用。 */
interface IMapThemeTokens {
  colorText: string;
  colorTextSecondary: string;
  colorError: string;
  colorPrimary: string;
  colorBorderSecondary: string;
  colorBgContainer: string;
  colorFillQuaternary: string;
  fontSize: number | string;
  fontSizeSM: number | string;
  borderRadius: number;
  borderRadiusLG: number;
  marginXXS: number;
  marginXS: number;
  marginSM: number;
  padding: number;
  paddingSM: number;
  paddingXS: number;
  boxShadowSecondary: string;
  boxShadowTertiary: string;
}

function controlButtonStyle(token: IMapThemeTokens): CSSProperties {
  return {
    minHeight: 32,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadius,
    paddingInline: token.paddingXS,
    background: token.colorBgContainer,
    color: token.colorText,
    font: 'inherit',
    fontSize: token.fontSize,
    cursor: 'pointer',
  };
}

// ---------- 底图与区域呈现 ----------

/**
 * 底图层：静态图片模式经箱子资源相对路径呈现（帧内 `<base href>` 解析到箱子作用域）；
 * 未配置资产时呈现内置静态底图网格。Host 地图模式由查看臂诚实降级，不进入本组件。
 */
function BasemapLayer({ source }: { source: IMapConfig['map_source'] }): ReactElement {
  const { token } = theme.useToken();
  if (hasCustomMapImage(source) && source.assetPath !== undefined) {
    return (
      <img
        data-map-asset-image
        src={source.assetPath}
        alt={BASEMAP_ALT_TEXT}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
    );
  }
  return (
    <div
      data-map-default-image
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        background: `repeating-linear-gradient(0deg, ${token.colorBorderSecondary} 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, ${token.colorBorderSecondary} 0 1px, transparent 1px 40px), ${token.colorFillQuaternary}`,
      }}
    />
  );
}

/**
 * 区域呈现表面（顶部内容区）：代码模式内联 HTML、图片模式箱子资源相对路径，
 * 一律交受控文档帧并按内容自适应高度（上限系数 3，沿旧布局口径）。
 */
function FrameRegionSurface({ region, title }: { region: IFrameRegion; title: string }): ReactElement | null {
  if (!hasFrameRegionContent(region)) {
    return null;
  }
  if (region.mode === 'html' && region.html !== undefined) {
    return (
      <EmbeddedDocumentFrame
        title={title}
        srcDoc={region.html}
        autoHeight
        maxHeightFactor={3}
        sandbox="allow-scripts"
      />
    );
  }
  if (region.mode === 'image' && region.assetPath !== undefined && isSafeBoxAssetPath(region.assetPath)) {
    return (
      <EmbeddedDocumentFrame
        title={title}
        src={region.assetPath}
        autoHeight
        maxHeightFactor={3}
        sandbox="allow-scripts"
      />
    );
  }
  return null;
}

// ---------- 条目预览挂载 ----------

function readEntrySummary(entry: EntryView): string {
  const summary = entry.snapshot?.summary;
  return typeof summary === 'string' ? summary : '';
}

interface ISelectedEntryPreviewProps {
  entry: EntryView;
  showCover: boolean;
  onClose: () => void;
}

/** 选中点位预览：按需请求条目票证并挂载条目帧（`show_cover_on_select` 关闭时不挂载）。 */
function SelectedEntryPreview({ entry, showCover, onClose }: ISelectedEntryPreviewProps): ReactElement {
  const { token } = theme.useToken();
  const slotRef = React.useRef<HTMLDivElement | null>(null);
  const [slotMessage, setSlotMessage] = React.useState<string | null>(null);
  const [openMessage, setOpenMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!showCover) {
      return undefined;
    }
    const runtime = frameRuntime;
    const slot = slotRef.current;
    if (runtime === null || slot === null) {
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
          setSlotMessage(PREVIEW_FAILED_TEXT);
        }
      });
    return () => {
      disposed = true;
      release?.();
    };
  }, [entry.entry_id, showCover]);

  const openEntry = (): void => {
    const runtime = frameRuntime;
    if (runtime === null) {
      return;
    }
    setOpenMessage(null);
    void runtime.openDocument(entry.url).catch(() => {
      setOpenMessage(OPEN_ENTRY_FAILED_TEXT);
    });
  };

  const summary = readEntrySummary(entry);

  return (
    <aside
      data-map-selected
      data-entry-id={entry.entry_id}
      style={{
        position: 'absolute',
        insetInline: token.marginSM,
        insetBlockEnd: token.marginSM,
        zIndex: 4,
        display: 'flex',
        alignItems: 'stretch',
        gap: token.marginXS,
        maxWidth: 520,
        padding: token.paddingSM,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
        boxShadow: token.boxShadowSecondary,
        boxSizing: 'border-box',
      }}
    >
      {showCover ? (
        <div
          style={{
            flex: '0 0 120px',
            minHeight: 160,
            overflow: 'hidden',
            borderRadius: token.borderRadius,
            background: token.colorFillQuaternary,
          }}
        >
          {slotMessage !== null ? (
            <div role="status" style={{ padding: token.paddingXS, color: token.colorTextSecondary, textAlign: 'center' }}>
              {slotMessage}
            </div>
          ) : (
            <div ref={slotRef} data-entry-slot style={{ width: '100%', height: '100%' }} />
          )}
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: token.marginXXS,
          minWidth: 0,
        }}
      >
        <h3 style={{ margin: 0, color: token.colorText, overflowWrap: 'anywhere' }}>{entry.displayTitle}</h3>
        {summary !== '' ? (
          <p style={{ margin: 0, color: token.colorTextSecondary }}>{summary}</p>
        ) : null}
        {openMessage !== null ? (
          <p role="alert" style={{ margin: 0, color: token.colorError }}>
            {openMessage}
          </p>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: token.marginXXS }}>
          <button type="button" data-open-entry onClick={openEntry} style={controlButtonStyle(token)}>
            {OPEN_ENTRY_LABEL}
          </button>
          <button type="button" data-close-preview onClick={onClose} style={controlButtonStyle(token)}>
            {CLOSE_PREVIEW_LABEL}
          </button>
        </div>
      </div>
    </aside>
  );
}

// ---------- 空态骨架 ----------

const SKELETON_PIN_SPOTS = [
  { left: 24, top: 36 },
  { left: 56, top: 64 },
  { left: 78, top: 42 },
] as const;

function MapSkeleton(): ReactElement {
  const { token } = theme.useToken();
  return (
    <LayoutSkeleton
      minHeight={320}
      hint={<EmptyHint title={EMPTY_TITLE} description={EMPTY_HINT_TEXT} />}
    >
      <div
        data-map-skeleton
        aria-hidden="true"
        style={{
          position: 'relative',
          width: '100%',
          height: 240,
          overflow: 'hidden',
          borderRadius: token.borderRadiusLG,
          background: token.colorFillQuaternary,
          backgroundImage: `repeating-linear-gradient(0deg, ${token.colorBorderSecondary} 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, ${token.colorBorderSecondary} 0 1px, transparent 1px 40px)`,
          boxSizing: 'border-box',
        }}
      >
        {SKELETON_PIN_SPOTS.map((spot) => (
          <div
            key={`${spot.left}-${spot.top}`}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: `${spot.left}%`,
              top: `${spot.top}%`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: 'translate(-50%, -100%)',
            }}
          >
            <SkeletonBlock width={64} height={44} radius={10} />
            <span
              style={{
                width: 2,
                height: 20,
                flex: '0 0 auto',
                background: token.colorBorderSecondary,
                borderRadius: 1,
              }}
            />
            <SkeletonDot size={12} />
          </div>
        ))}
      </div>
    </LayoutSkeleton>
  );
}

// ---------- 查看态：renderLayout ----------

interface IPositionedEntry {
  entry: EntryView;
  location: MapEntryLocation;
  label: string;
  x: number;
  y: number;
}

interface IMapViewProps {
  box: BoxRenderView;
}

function MapView({ box }: IMapViewProps): ReactElement {
  const { token } = theme.useToken();
  const config = React.useMemo(() => readConfig(box.layout_config), [box.layout_config]);
  const [viewState, setViewState] = React.useState<{ center: GeoPoint; zoom: number }>(() => ({
    center: {
      latitude: config.default_view.latitude,
      longitude: config.default_view.longitude,
    },
    zoom: config.default_view.zoom,
  }));
  const [selectedEntryId, setSelectedEntryId] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    setViewState({
      center: {
        latitude: config.default_view.latitude,
        longitude: config.default_view.longitude,
      },
      zoom: config.default_view.zoom,
    });
    setSelectedEntryId(undefined);
  }, [config]);

  const enabledEntries = React.useMemo(
    () => box.entries.filter((entry) => entry.enabled),
    [box.entries]
  );
  const bounds = config.map_source.bounds;
  const positionedEntries = React.useMemo<IPositionedEntry[]>(() => {
    const result: IPositionedEntry[] = [];
    for (const entry of enabledEntries) {
      const location = config.entries[entry.entry_id];
      if (location === undefined) {
        continue;
      }
      const projected = projectLinear(location, bounds);
      if (projected === undefined) {
        continue;
      }
      result.push({
        entry,
        location,
        label: location.labelOverride ?? entry.displayTitle,
        x: projected.x,
        y: projected.y,
      });
    }
    return result;
  }, [bounds, config.entries, enabledEntries]);
  const locatedIds = React.useMemo(
    () => new Set(positionedEntries.map((item) => item.entry.entry_id)),
    [positionedEntries]
  );
  const unlocatedEntries = React.useMemo(
    () => enabledEntries.filter((entry) => !locatedIds.has(entry.entry_id)),
    [enabledEntries, locatedIds]
  );
  const selectedEntry =
    selectedEntryId === undefined
      ? undefined
      : enabledEntries.find((entry) => entry.entry_id === selectedEntryId);
  const hasTopRegion = hasFrameRegionContent(config.top_region);
  // 中心点非法（如越界经纬度）时回退居中投影（沿旧布局口径）。
  const centerProjection = projectLinear(viewState.center, bounds) ?? { x: 50, y: 50 };
  const mapTransform = `translate(${50 - centerProjection.x}%, ${50 - centerProjection.y}%) scale(${viewState.zoom})`;

  const openEntry = (entry: EntryView): void => {
    const runtime = frameRuntime;
    if (runtime === null) {
      return;
    }
    void runtime.openDocument(entry.url).catch(() => {
      void runtime.notify({ level: 'error', message: OPEN_ENTRY_FAILED_TEXT });
    });
  };

  const handleMarkerActivate = (item: IPositionedEntry): void => {
    if (selectedEntryId === item.entry.entry_id) {
      openEntry(item.entry);
      return;
    }
    setSelectedEntryId(item.entry.entry_id);
  };

  const zoomView = (delta: number): void => {
    setViewState((current) => ({ ...current, zoom: clampZoom(current.zoom + delta) }));
  };

  const panView = (deltaLatitude: number, deltaLongitude: number): void => {
    setViewState((current) => ({ ...current, center: panCenter(current.center, deltaLatitude, deltaLongitude) }));
  };

  const resetView = (): void => {
    setViewState({
      center: {
        latitude: config.default_view.latitude,
        longitude: config.default_view.longitude,
      },
      zoom: config.default_view.zoom,
    });
  };

  const buttonStyle = controlButtonStyle(token);

  return (
    <div
      aria-label="地图箱子布局"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginXS,
        minHeight: '100%',
        padding: token.padding,
        boxSizing: 'border-box',
      }}
    >
      {hasTopRegion ? (
        <div style={{ width: '100%' }}>
          <FrameRegionSurface region={config.top_region} title={TOP_REGION_TITLE} />
        </div>
      ) : null}

      <div
        data-map-stage
        style={{
          position: 'relative',
          minHeight: 320,
          overflow: 'hidden',
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          background: token.colorBgContainer,
          isolation: 'isolate',
        }}
      >
        {enabledEntries.length === 0 ? (
          <MapSkeleton />
        ) : (
          <>
            {config.map_source.mode === 'host-map' ? (
              <div
                data-map-unavailable
                role="status"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  minHeight: 120,
                  padding: token.padding,
                  textAlign: 'center',
                  color: token.colorTextSecondary,
                }}
              >
                {HOST_MAP_UNAVAILABLE_TEXT}
              </div>
            ) : (
              <div
                data-map-world
                style={{
                  position: 'absolute',
                  inset: 0,
                  transform: mapTransform,
                  transformOrigin: 'center',
                  transition: 'transform 180ms ease',
                }}
              >
                <BasemapLayer source={config.map_source} />
                <div data-map-markers style={{ position: 'absolute', inset: 0 }}>
                  {positionedEntries.map((item) => {
                    const selected = selectedEntryId === item.entry.entry_id;
                    return (
                      <button
                        key={item.entry.entry_id}
                        type="button"
                        data-map-marker
                        data-marker-style={config.marker_style}
                        data-entry-id={item.entry.entry_id}
                        title={item.label}
                        onClick={() => handleMarkerActivate(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleMarkerActivate(item);
                          }
                        }}
                        style={{
                          position: 'absolute',
                          left: `${item.x}%`,
                          top: `${item.y}%`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: token.marginXXS,
                          minHeight: 32,
                          maxWidth: '48vw',
                          border: `1px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
                          borderRadius:
                            config.marker_style === 'pin-title' ? token.borderRadius : 999,
                          paddingInline: token.paddingXS,
                          paddingBlock: 4,
                          color: token.colorText,
                          background: token.colorBgContainer,
                          boxShadow: selected ? token.boxShadowSecondary : token.boxShadowTertiary,
                          font: 'inherit',
                          fontSize: token.fontSizeSM,
                          cursor: 'pointer',
                          transform: selected
                            ? 'translate(-50%, -50%) scale(1.04)'
                            : 'translate(-50%, -50%)',
                          zIndex: selected ? 3 : 1,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: config.marker_style === 'pin-title' ? 12 : 10,
                            height: config.marker_style === 'pin-title' ? 12 : 10,
                            flex: '0 0 auto',
                            borderRadius:
                              config.marker_style === 'pin-title'
                                ? '999px 999px 999px 2px'
                                : 999,
                            background: token.colorPrimary,
                            transform:
                              config.marker_style === 'pin-title' ? 'rotate(-45deg)' : undefined,
                          }}
                        />
                        <span
                          style={{
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: 600,
                          }}
                        >
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              data-map-controls
              role="group"
              aria-label={CONTROLS_LABEL}
              style={{
                position: 'absolute',
                top: token.marginSM,
                insetInlineEnd: token.marginSM,
                zIndex: 4,
                display: 'flex',
                flexWrap: 'wrap',
                gap: token.marginXXS,
              }}
            >
              <button type="button" data-map-zoom="in" aria-label={ZOOM_IN_LABEL} onClick={() => zoomView(ZOOM_STEP)} style={buttonStyle}>+</button>
              <button type="button" data-map-zoom="out" aria-label={ZOOM_OUT_LABEL} onClick={() => zoomView(-ZOOM_STEP)} style={buttonStyle}>-</button>
              <button type="button" data-map-pan="north" aria-label={PAN_NORTH_LABEL} onClick={() => panView(PAN_STEP_DEGREES, 0)} style={buttonStyle}>↑</button>
              <button type="button" data-map-pan="south" aria-label={PAN_SOUTH_LABEL} onClick={() => panView(-PAN_STEP_DEGREES, 0)} style={buttonStyle}>↓</button>
              <button type="button" data-map-pan="west" aria-label={PAN_WEST_LABEL} onClick={() => panView(0, -PAN_STEP_DEGREES)} style={buttonStyle}>←</button>
              <button type="button" data-map-pan="east" aria-label={PAN_EAST_LABEL} onClick={() => panView(0, PAN_STEP_DEGREES)} style={buttonStyle}>→</button>
              <button type="button" data-map-reset-view onClick={resetView} style={buttonStyle}>{RESET_VIEW_LABEL}</button>
            </div>

            {selectedEntry !== undefined ? (
              <SelectedEntryPreview
                entry={selectedEntry}
                showCover={config.show_cover_on_select}
                onClose={() => setSelectedEntryId(undefined)}
              />
            ) : null}
          </>
        )}
      </div>

      {unlocatedEntries.length > 0 ? (
        <section
          data-unlocated
          aria-label={UNLOCATED_TITLE}
          style={{ display: 'flex', flexDirection: 'column', gap: token.marginXXS }}
        >
          <strong style={{ color: token.colorText }}>{UNLOCATED_TITLE}</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: token.marginXXS }}>
            {unlocatedEntries.map((entry) => (
              <button
                key={entry.entry_id}
                type="button"
                data-unlocated-entry
                onClick={() => openEntry(entry)}
                style={buttonStyle}
              >
                {entry.displayTitle}
              </button>
            ))}
          </div>
        </section>
      ) : null}
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
    root.render(<MapView box={box} />);
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

interface IMapEditorViewProps {
  config: IMapConfig;
  entries: readonly EntryView[];
  onChange: (next: IMapConfig) => void;
}

/**
 * 布局配置编辑面板：只编辑配置、只产出变更，不写文件、不导入资源
 * （09-箱子布局插件接口 §7.3；资源写入与清理由编辑链路的正式资源桥承担）。
 */
function MapEditorView({ config, entries, onChange }: IMapEditorViewProps): ReactElement {
  const { token } = theme.useToken();
  const [form] = Form.useForm<IMapConfig>();

  const handleValuesChange = (_changed: Partial<IMapConfig>, values: IMapConfig): void => {
    onChange(readConfig(values));
  };

  const clearEntryLocation = (entryId: string): void => {
    form.setFieldValue(['entries', entryId], undefined);
    const values: unknown = form.getFieldsValue(true);
    onChange(readConfig(values));
  };

  const modeValue: unknown = form.getFieldValue(['map_source', 'mode']);
  const modeOptions: { value: MapSourceMode; label: string; disabled?: boolean }[] =
    modeValue === 'host-map'
      ? [
          { value: 'image', label: MAP_SOURCE_IMAGE_LABEL },
          { value: 'host-map', label: MAP_SOURCE_HOST_LABEL, disabled: true },
        ]
      : [{ value: 'image', label: MAP_SOURCE_IMAGE_LABEL }];

  const fieldsetStyle: CSSProperties = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadius,
    padding: token.paddingXS,
    margin: 0,
    minWidth: 0,
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
      <Form<IMapConfig>
        form={form}
        layout="vertical"
        initialValues={config}
        onValuesChange={handleValuesChange}
      >
        <fieldset style={fieldsetStyle} data-editor-section="map_source">
          <legend style={{ paddingInline: token.paddingXXS }}>{MAP_BASEMAP_TITLE}</legend>
          <Form.Item
            label="底图来源"
            name={['map_source', 'mode']}
            extra={modeValue === 'host-map' ? HOST_MAP_RESERVED_HINT : IMAGE_MODE_HINT}
          >
            <Select options={modeOptions} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() => {
              const mode: unknown = form.getFieldValue(['map_source', 'mode']);
              if (mode !== 'image') {
                return null;
              }
              return (
                <Form.Item
                  label="底图图片路径"
                  name={['map_source', 'assetPath']}
                  extra="以 assets/ 开头的箱子资源相对路径；留空使用内置静态底图"
                  rules={[
                    {
                      validator: (_rule, value: unknown) => {
                        if (
                          typeof value === 'string' &&
                          value.length > 0 &&
                          !isSafeBoxAssetPath(value)
                        ) {
                          return Promise.reject(
                            new Error('请输入以 assets/ 开头的合法箱子资源路径')
                          );
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <Input id="map-source-asset-path" placeholder="assets/layouts/map/base-map/world.png" />
                </Form.Item>
              );
            }}
          </Form.Item>
        <div style={{ display: 'grid', gap: token.marginXS, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {(['west', 'south', 'east', 'north'] as const).map((key) => (
            <Form.Item key={key} label={BOUNDS_FIELD_LABELS[key]} name={['map_source', 'bounds', key]}>
              <Input id={`map-bounds-${key}`} inputMode="decimal" />
            </Form.Item>
          ))}
        </div>
        </fieldset>

        <fieldset style={fieldsetStyle} data-editor-section="default_view">
          <legend style={{ paddingInline: token.paddingXXS }}>{MAP_VIEW_TITLE}</legend>
          <div style={{ display: 'grid', gap: token.marginXS, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <Form.Item label="中心纬度" name={['default_view', 'latitude']}>
              <Input id="map-default-latitude" inputMode="decimal" />
            </Form.Item>
            <Form.Item label="中心经度" name={['default_view', 'longitude']}>
              <Input id="map-default-longitude" inputMode="decimal" />
            </Form.Item>
          </div>
          <Form.Item label="缩放" name={['default_view', 'zoom']}>
            <Slider min={ZOOM_MIN} max={ZOOM_MAX} step={ZOOM_STEP} />
          </Form.Item>
          <Form.Item label="点位样式" name="marker_style">
            <Select
              options={MARKER_STYLE_OPTIONS.map((value) => ({ value, label: MARKER_STYLE_LABELS[value] }))}
            />
          </Form.Item>
          <Form.Item
            label="选中点位时显示条目预览"
            name="show_cover_on_select"
            valuePropName="checked"
            extra="关闭后仅显示标题与摘要；开启后选中点位按需挂载条目预览帧"
          >
            <Switch />
          </Form.Item>
        </fieldset>

        <fieldset style={fieldsetStyle} data-editor-section="entries">
          <legend style={{ paddingInline: token.paddingXXS }}>{MAP_ENTRIES_TITLE}</legend>
          <p style={{ margin: 0, color: token.colorTextSecondary }}>
            {`当前箱子包含 ${entries.length} 个条目`}
          </p>
          <Form.Item noStyle shouldUpdate>
            {() => {
              const storedEntries: unknown = form.getFieldValue('entries');
              const located =
                typeof storedEntries === 'object' && storedEntries !== null
                  ? (storedEntries as Record<string, unknown>)
                  : {};
              return (
                <>
                  {entries.map((entry) => {
                    const hasLocation = located[entry.entry_id] !== undefined;
                    return (
                      <div
                        key={entry.entry_id}
                        data-editor-entry={entry.entry_id}
                        style={{ display: 'grid', gap: token.marginXXS, paddingBlock: token.paddingXXS }}
                      >
                        <Form.Item
                          label={entry.displayTitle}
                          name={['entries', entry.entry_id, 'labelOverride']}
                        >
                          <Input id={`map-entry-label-${entry.entry_id}`} placeholder="显示名称覆盖" />
                        </Form.Item>
                        <div
                          style={{
                            display: 'grid',
                            gap: token.marginXXS,
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                          }}
                        >
                          <Form.Item label="纬度" name={['entries', entry.entry_id, 'latitude']}>
                            <Input id={`map-entry-latitude-${entry.entry_id}`} inputMode="decimal" />
                          </Form.Item>
                          <Form.Item label="经度" name={['entries', entry.entry_id, 'longitude']}>
                            <Input id={`map-entry-longitude-${entry.entry_id}`} inputMode="decimal" />
                          </Form.Item>
                        </div>
                        <Button
                          type="default"
                          data-clear-location={entry.entry_id}
                          disabled={!hasLocation}
                          onClick={() => clearEntryLocation(entry.entry_id)}
                        >
                          清除定位
                        </Button>
                      </div>
                    );
                  })}
                </>
              );
            }}
          </Form.Item>
        </fieldset>

        <fieldset style={fieldsetStyle} data-editor-section="top_region">
          <legend style={{ paddingInline: token.paddingXXS }}>{TOP_REGION_TITLE}</legend>
          <Form.Item label="呈现模式" name={['top_region', 'mode']}>
            <Select
              options={(['none', 'image', 'html'] as const).map((value) => ({
                value,
                label: value === 'none' ? '不显示' : value === 'image' ? '图片' : '代码',
              }))}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() => {
              const mode: unknown = form.getFieldValue(['top_region', 'mode']);
              if (mode === 'image') {
                return (
                  <Form.Item
                    label="箱子资源路径"
                    name={['top_region', 'assetPath']}
                    extra="以 assets/ 开头的箱子资源相对路径"
                    rules={[
                      {
                        validator: (_rule, value: unknown) => {
                          if (
                            typeof value === 'string' &&
                            value.length > 0 &&
                            !isSafeBoxAssetPath(value)
                          ) {
                            return Promise.reject(
                              new Error('请输入以 assets/ 开头的合法箱子资源路径')
                            );
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Input id="map-top-region-asset-path" placeholder="assets/layouts/map/top-region/header.png" />
                  </Form.Item>
                );
              }
              if (mode === 'html') {
                return (
                  <Form.Item label="HTML 代码" name={['top_region', 'html']}>
                    <Input.TextArea id="map-top-region-html" rows={6} placeholder="<section>…</section>" />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
        </fieldset>
      </Form>
    </div>
  );
}

class MapEditor implements ILayoutEditor {
  public state: EditorState = 'active';

  private base: IMapConfig;
  private entries: readonly EntryView[];
  private revision: number;
  private pending: LayoutChange | null = null;
  private dirty = false;
  private readonly host: HTMLElement;
  private readonly root: Root;
  private readonly changeHandlers = new Set<(payload: ILayoutEditorEventMap['change']) => void>();
  private readonly dirtyHandlers = new Set<(payload: ILayoutEditorEventMap['dirty']) => void>();

  public constructor(box: BoxRenderView, container: HTMLElement) {
    this.base = readConfig(box.layout_config);
    this.entries = box.entries;
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
    this.entries = box.entries;
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
        <MapEditorView
          key={this.revision}
          config={this.base}
          entries={this.entries}
          onChange={this.handleConfigChange}
        />
      );
    });
  }

  private readonly handleConfigChange = (next: IMapConfig): void => {
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
  return new MapEditor(box, container);
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
