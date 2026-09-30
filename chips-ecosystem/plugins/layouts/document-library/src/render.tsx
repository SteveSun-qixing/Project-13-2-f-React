import type { CSSProperties, ReactElement } from 'react';
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import {
  Button,
  Checkbox,
  EmbeddedDocumentFrame,
  EmptyHint,
  Form,
  Input,
  LayoutSkeleton,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  Segmented,
  Select,
  SkeletonBlock,
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
  ADD_ENTRY_PREFIX,
  ADD_GROUP_LABEL,
  BACKGROUND_TITLE,
  COLLAPSED_BY_DEFAULT_LABEL,
  COLLAPSE_NODE_LABEL,
  DISPLAY_SECTION_DESC,
  DISPLAY_SECTION_TITLE,
  EMPTY_HINT_TEXT,
  EMPTY_TITLE,
  ENTRY_COUNT_PREFIX,
  ENTRY_COUNT_SUFFIX,
  ENTRY_KIND_LABELS,
  EXPAND_NODE_LABEL,
  GROUP_TITLE_FALLBACK,
  HIDE_DIRECTORY_LABEL,
  INDENT_LABEL,
  LIBRARY_ARIA_LABEL,
  MISSING_ENTRY_HINT,
  MOVE_DOWN_LABEL,
  MOVE_UP_LABEL,
  NODE_ENTRY_PREFIX,
  NODE_GROUP_TEXT,
  NODE_MISSING_PREFIX,
  NO_UNCONFIGURED_TEXT,
  OPEN_DOCUMENT_LABEL,
  OPEN_FAILED_TEXT,
  OUTDENT_LABEL,
  PRESENTATION_BOX_HINT,
  PRESENTATION_CONTENT_LABEL,
  PRESENTATION_COVER_LABEL,
  PRESENTATION_LABEL_PREFIX,
  REMOVE_NODE_LABEL,
  SHOW_DIRECTORY_LABEL,
  SHOW_SUMMARY_LABEL,
  SIDEBAR_WIDTH_LABEL,
  SIDEBAR_WIDTH_LABELS,
  SIDEBAR_WIDTH_OPTIONS,
  SIDEBAR_WIDTH_PX,
  SLOT_UNAVAILABLE_TEXT,
  SORT_LABELS,
  SORT_MANUAL_HINT,
  SORT_OPTIONS,
  SORT_RUNTIME_HINT,
  TAGS_LABEL,
  TITLE_OVERRIDE_PREFIX,
  TOP_REGION_TITLE,
  TREE_EMPTY_TEXT,
  TREE_INDENT_PX,
  TREE_LABEL,
  TREE_SECTION_DESC,
  TREE_SECTION_TITLE,
  UNCONFIGURED_ENTRIES_TITLE,
  CONFIG_SCHEMA_VERSION,
  buildDirectoryTree,
  flattenEditorNodes,
  flattenVisibleTree,
  hasFrameRegionContent,
  indentNodeInTree,
  isSafeBoxAssetPath,
  moveNodeInTree,
  outdentNodeInTree,
  readConfig,
  removeNodeAtPath,
  toCoverAspectRatio,
  updateNodeAtPath,
  validateConfig,
} from './config';
import type {
  DocumentPresentation,
  IEditorFlatNode,
  IFrameRegion,
  IDirectoryNode,
  IDocumentLibraryConfig,
  IDocumentTreeNode,
  SidebarWidth,
} from './config';

// ---------- 帧运行时注入 ----------

let frameRuntime: IBoxLayoutFrameRuntime | null = null;

/** 帧运行时在首次调用 renderLayout 前注入句柄。 */
function attachRuntime(runtime: IBoxLayoutFrameRuntime): void {
  frameRuntime = runtime;
}

// ---------- 窄屏判定 ----------

/** 容器不超过该宽度时目录与预览切为单列（沿旧布局响应式口径）。 */
const NARROW_MAX_WIDTH = 720;

/**
 * 观察容器宽度并返回是否切换单列。
 *
 * @param container - 布局根容器
 * @returns 窄屏返回 true
 */
function useIsNarrow(container: HTMLElement | null): boolean {
  const [narrow, setNarrow] = React.useState(
    () => container !== null && container.clientWidth <= NARROW_MAX_WIDTH
  );

  React.useEffect(() => {
    if (container === null) {
      return undefined;
    }
    setNarrow(container.clientWidth <= NARROW_MAX_WIDTH);
    const observer = new ResizeObserver((records) => {
      const record = records[0];
      if (record !== undefined) {
        setNarrow(record.contentRect.width <= NARROW_MAX_WIDTH);
      }
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [container]);

  return narrow;
}

// ---------- 区域呈现 ----------

/**
 * 区域呈现表面：代码模式以内联 HTML 交给受控文档帧；图片模式以箱子资源相对路径
 * 交给受控文档帧，由布局帧注入的 `chips-resource://` 基址解析到箱子作用域
 * （09-箱子布局插件接口 §6.4）。
 */
function FrameRegionSurface({
  region,
  title,
  variant,
}: {
  region: IFrameRegion;
  title: string;
  variant: 'background' | 'top';
}): ReactElement | null {
  if (!hasFrameRegionContent(region)) {
    return null;
  }
  if (region.mode === 'html' && region.html !== undefined) {
    return variant === 'background' ? (
      <EmbeddedDocumentFrame title={title} srcDoc={region.html} ratio="16:9" sandbox="allow-scripts" />
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
      <EmbeddedDocumentFrame title={title} src={region.assetPath} ratio="16:9" sandbox="allow-scripts" />
    ) : (
      <EmbeddedDocumentFrame title={title} src={region.assetPath} autoHeight sandbox="allow-scripts" />
    );
  }
  return null;
}

// ---------- 条目帧槽位 ----------

/**
 * 条目帧槽位：按需请求条目票证并挂载（票证按 `view.kind` 渲染条目卡片视图或
 * 目标箱子的正式封面，09-箱子布局插件接口 §6.2）；失败呈现简体中文状态提示。
 */
function EntryFrameSlot({ entry }: { entry: EntryView }): ReactElement {
  const { token } = theme.useToken();
  const slotRef = React.useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
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
          setMessage(SLOT_UNAVAILABLE_TEXT);
        }
      });
    return () => {
      disposed = true;
      release?.();
    };
  }, [entry.entry_id]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minWidth: 0,
        minHeight: 240,
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={slotRef}
        data-entry-slot
        style={{ width: '100%', minHeight: 240, overflow: 'hidden' }}
      />
      {message !== null ? (
        <div
          data-entry-status
          role="status"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: token.padding,
            color: token.colorTextSecondary,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}

function readTagLabels(snapshot: Readonly<Record<string, unknown>> | undefined): readonly string[] {
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

function openEntryDocument(entry: EntryView, onError: (message: string) => void): void {
  const runtime = frameRuntime;
  if (runtime === null) {
    return;
  }
  void runtime.openDocument(entry.url).catch(() => {
    onError(OPEN_FAILED_TEXT);
  });
}

// ---------- 右侧预览 ----------

interface IDocumentPreviewProps {
  node: IDirectoryNode;
  entry: EntryView | undefined;
  showSummary: boolean;
}

/** 右侧预览：内容态直接交给平台托管条目帧，封面态呈现封面壳层与元信息（视觉细则 §4.7）。 */
function DocumentPreview({ node, entry, showSummary }: IDocumentPreviewProps): ReactElement {
  const { token } = theme.useToken();
  const [openMessage, setOpenMessage] = React.useState<string | null>(null);

  if (node.entryId === undefined || entry === undefined) {
    return (
      <div data-document-preview data-missing="true">
        <h1 data-document-title style={{ margin: 0, fontSize: token.fontSizeXL, color: token.colorText }}>
          {node.title}
        </h1>
        <p style={{ margin: 0, color: token.colorTextSecondary }}>{MISSING_ENTRY_HINT}</p>
      </div>
    );
  }

  const handleOpen = (): void => {
    setOpenMessage(null);
    openEntryDocument(entry, setOpenMessage);
  };

  if (node.presentation === 'content' && !node.isBox) {
    return (
      <div
        data-document-preview
        data-presentation="content"
        data-entry-id={entry.entry_id}
        style={{ minWidth: 0 }}
      >
        <EntryFrameSlot entry={entry} />
      </div>
    );
  }

  const summary = typeof entry.snapshot?.summary === 'string' ? entry.snapshot.summary.trim() : '';
  const tags = readTagLabels(entry.snapshot);
  const ratio = toCoverAspectRatio(entry.layout_hints);

  return (
    <article
      data-document-preview
      data-presentation="cover"
      data-entry-id={entry.entry_id}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginXS,
        minWidth: 0,
        color: token.colorText,
      }}
    >
      <div
        data-cover-shell
        data-cover-ratio={ratio}
        role="button"
        tabIndex={0}
        aria-label={`${OPEN_DOCUMENT_LABEL}：${node.title}`}
        style={{
          width: 'min(100%, 520px)',
          aspectRatio: ratio,
          overflow: 'hidden',
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
        onClick={handleOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleOpen();
          }
        }}
      >
        <EntryFrameSlot entry={entry} />
      </div>
      <h1 data-document-title style={{ margin: 0, fontSize: token.fontSizeXL }}>
        {node.title}
      </h1>
      <p style={{ margin: 0, color: token.colorTextSecondary }}>
        {node.isBox ? ENTRY_KIND_LABELS.box : ENTRY_KIND_LABELS.card}
      </p>
      {showSummary && summary.length > 0 ? (
        <p data-document-summary style={{ margin: 0, color: token.colorTextSecondary }}>
          {summary}
        </p>
      ) : null}
      {tags.length > 0 ? (
        <div
          data-document-tags
          aria-label={TAGS_LABEL}
          style={{ display: 'flex', flexWrap: 'wrap', gap: token.marginXXS }}
        >
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: '2px 8px',
                borderRadius: token.borderRadiusSM,
                background: token.colorFillQuaternary,
                color: token.colorTextSecondary,
                fontSize: token.fontSizeSM,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <div>
        <Button data-open-document onClick={handleOpen}>
          {OPEN_DOCUMENT_LABEL}
        </Button>
      </div>
      {openMessage !== null ? (
        <p role="alert" style={{ margin: 0, color: token.colorError }}>
          {openMessage}
        </p>
      ) : null}
    </article>
  );
}

// ---------- 空态骨架 ----------

const SKELETON_ROW_INDENTS = [0, 0, 24, 24, 48, 48] as const;

function DocumentLibrarySkeleton(): ReactElement {
  const { token } = theme.useToken();
  return (
    <LayoutSkeleton
      hint={<EmptyHint title={EMPTY_TITLE} description={EMPTY_HINT_TEXT} />}
    >
      <div
        data-library-skeleton
        aria-hidden="true"
        style={{ display: 'grid', gap: token.marginXS, width: '100%' }}
      >
        {SKELETON_ROW_INDENTS.map((indent, index) => (
          <div
            key={`skeleton-row-${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: token.marginSM,
              paddingBlock: token.paddingXS,
              paddingInlineStart: indent,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <SkeletonBlock width={28} height={28} radius={8} />
            <SkeletonLine style={{ flex: 1, maxWidth: 260 }} />
            <SkeletonLine width={64} height={8} />
          </div>
        ))}
      </div>
    </LayoutSkeleton>
  );
}

// ---------- 查看态：renderLayout ----------

interface IDocumentLibraryViewProps {
  box: BoxRenderView;
}

function DocumentLibraryView({ box }: IDocumentLibraryViewProps): ReactElement {
  const { token } = theme.useToken();
  const [rootElement, setRootElement] = React.useState<HTMLDivElement | null>(null);
  const narrow = useIsNarrow(rootElement);
  const config = React.useMemo(() => readConfig(box.layout_config), [box.layout_config]);
  const [collapsedOverrides, setCollapsedOverrides] = React.useState<
    Record<string, boolean>
  >({});
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | undefined>(undefined);
  const [sidebarVisible, setSidebarVisible] = React.useState(true);

  const enabledEntries = React.useMemo(
    () => box.entries.filter((entry) => entry.enabled),
    [box.entries]
  );
  const entryMap = React.useMemo(
    () => new Map(enabledEntries.map((entry) => [entry.entry_id, entry])),
    [enabledEntries]
  );
  const tree = React.useMemo(
    () =>
      buildDirectoryTree({
        configNodes: config.tree_nodes,
        entries: enabledEntries,
        sortMode: config.sort_mode,
      }),
    [config.sort_mode, config.tree_nodes, enabledEntries]
  );
  const flatNodes = React.useMemo(
    () => flattenVisibleTree(tree, collapsedOverrides),
    [collapsedOverrides, tree]
  );
  const selectedNode = React.useMemo(() => {
    if (selectedNodeId !== undefined) {
      const current = flatNodes.find((node) => node.id === selectedNodeId);
      if (current !== undefined) {
        return current;
      }
    }
    return (
      flatNodes.find((node) => node.entryId !== undefined && !node.missing) ?? flatNodes[0]
    );
  }, [flatNodes, selectedNodeId]);
  const selectedEntry =
    selectedNode !== undefined && selectedNode.entryId !== undefined
      ? entryMap.get(selectedNode.entryId)
      : undefined;

  const toggleNode = (node: IDirectoryNode): void => {
    const collapsed = collapsedOverrides[node.id] ?? node.collapsed;
    setCollapsedOverrides((current) => ({ ...current, [node.id]: !collapsed }));
  };

  const handleTreeKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (flatNodes.length === 0) {
      return;
    }
    const currentIndex = Math.max(
      0,
      flatNodes.findIndex((node) => node.id === selectedNode?.id)
    );
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedNodeId(flatNodes[Math.min(flatNodes.length - 1, currentIndex + 1)]?.id);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedNodeId(flatNodes[Math.max(0, currentIndex - 1)]?.id);
      return;
    }
    const current = selectedNode;
    if (current === undefined || current.children.length === 0) {
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setCollapsedOverrides((overrides) => ({ ...overrides, [current.id]: false }));
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setCollapsedOverrides((overrides) => ({ ...overrides, [current.id]: true }));
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedNodeId(current.id);
    }
  };

  const showBackground = hasFrameRegionContent(config.background);
  const showTopRegion = hasFrameRegionContent(config.top_region);
  const mainStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: narrow
      ? 'minmax(0, 1fr)'
      : sidebarVisible
        ? `minmax(0, ${SIDEBAR_WIDTH_PX[config.sidebar_width]}px) minmax(0, 1fr)`
        : 'minmax(0, 1fr)',
    gap: token.margin,
    alignItems: 'start',
    alignContent: 'start',
    minWidth: 0,
  };

  return (
    <div
      ref={setRootElement}
      aria-label={LIBRARY_ARIA_LABEL}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginXS,
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

      {flatNodes.length === 0 ? (
        <DocumentLibrarySkeleton />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
            <button
              type="button"
              data-sidebar-toggle
              aria-expanded={sidebarVisible}
              aria-controls="document-library-tree"
              aria-label={sidebarVisible ? HIDE_DIRECTORY_LABEL : SHOW_DIRECTORY_LABEL}
              title={sidebarVisible ? HIDE_DIRECTORY_LABEL : SHOW_DIRECTORY_LABEL}
              onClick={() => {
                setSidebarVisible((visible) => !visible);
              }}
              style={{
                display: 'inline-grid',
                placeItems: 'center',
                width: 36,
                height: 36,
                padding: 0,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: token.borderRadius,
                background: token.colorBgContainer,
                color: token.colorText,
                cursor: 'pointer',
              }}
            >
              {sidebarVisible ? (
                <MenuFoldOutlined aria-hidden="true" />
              ) : (
                <MenuUnfoldOutlined aria-hidden="true" />
              )}
            </button>
          </div>

          <div data-library-main style={mainStyle}>
            {sidebarVisible ? (
              <nav
                id="document-library-tree"
                data-document-tree
                aria-label={TREE_LABEL}
                onKeyDown={handleTreeKeyDown}
                style={{
                  alignSelf: 'start',
                  display: 'grid',
                  gap: token.paddingXS,
                  minWidth: 0,
                  maxHeight: 'calc(100vh - 64px)',
                  overflow: 'auto',
                  padding: token.paddingSM,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadiusLG,
                  background: token.colorBgContainer,
                  boxSizing: 'border-box',
                }}
              >
                <div role="tree" style={{ display: 'grid', gap: token.marginXXS, minWidth: 0 }}>
                  {flatNodes.map((node) => {
                    const selected = selectedNode?.id === node.id;
                    return (
                      <div
                        key={node.id}
                        data-tree-row
                        data-node-id={node.id}
                        role="treeitem"
                        aria-selected={selected}
                        aria-expanded={node.children.length > 0 ? !node.collapsed : undefined}
                        data-missing={node.missing ? 'true' : undefined}
                        data-unconfigured={node.configured ? undefined : 'true'}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '28px minmax(0, 1fr)',
                          alignItems: 'center',
                          minWidth: 0,
                          borderRadius: token.borderRadius,
                          paddingInlineStart: `calc(${node.depth} * ${TREE_INDENT_PX}px)`,
                          background: selected ? token.colorFillQuaternary : 'transparent',
                        }}
                      >
                        <button
                          type="button"
                          data-tree-toggle
                          disabled={node.children.length === 0}
                          aria-label={node.collapsed ? EXPAND_NODE_LABEL : COLLAPSE_NODE_LABEL}
                          onClick={() => {
                            toggleNode(node);
                          }}
                          style={{
                            width: 28,
                            height: 28,
                            display: 'grid',
                            placeItems: 'center',
                            border: 0,
                            margin: 0,
                            background: 'none',
                            color: token.colorTextSecondary,
                            font: 'inherit',
                            cursor: node.children.length > 0 ? 'pointer' : 'default',
                          }}
                        >
                          {node.children.length > 0 ? (node.collapsed ? '+' : '-') : ''}
                        </button>
                        <button
                          type="button"
                          data-tree-title
                          title={node.title}
                          onClick={() => {
                            setSelectedNodeId(node.id);
                          }}
                          style={{
                            display: 'block',
                            minWidth: 0,
                            padding: `${token.paddingXXS}px ${token.paddingXS}px`,
                            border: 0,
                            margin: 0,
                            background: 'none',
                            color: node.missing ? token.colorTextSecondary : token.colorText,
                            fontStyle: node.missing ? 'italic' : 'normal',
                            font: 'inherit',
                            textAlign: 'start',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                          }}
                        >
                          {node.title}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </nav>
            ) : null}

            {selectedNode !== undefined ? (
              <DocumentPreview
                node={selectedNode}
                entry={selectedEntry}
                showSummary={config.show_summary}
              />
            ) : null}
          </div>
        </>
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
    root.render(<DocumentLibraryView box={box} />);
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
 * （09-箱子布局插件接口 §7.3；资源写入与清理由编辑链路的正式资源桥承担）。
 */
function FrameRegionFields({ title, field }: IFrameRegionFieldsProps): ReactElement {
  const { token } = theme.useToken();
  return (
    <fieldset
      data-editor-section={field}
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        padding: token.paddingXS,
        margin: 0,
        minWidth: 0,
      }}
    >
      <legend style={{ paddingInline: token.paddingXXS }}>{title}</legend>
      <Form.Item label="呈现模式" name={[field, 'mode']}>
        <Select
          options={(['none', 'image', 'html'] as const).map((value) => ({
            value,
            label: value === 'none' ? '不显示' : value === 'image' ? '图片' : '代码',
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
                        return Promise.reject(
                          new Error('请输入以 assets/ 开头的合法箱子资源路径')
                        );
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input id={`${field}-asset-path`} placeholder={`assets/layouts/${field}/banner.png`} />
              </Form.Item>
            );
          }
          if (mode === 'html') {
            return (
              <Form.Item label="HTML 代码" name={[field, 'html']}>
                <Input.TextArea id={`${field}-html`} rows={6} placeholder="<section>…</section>" />
              </Form.Item>
            );
          }
          return null;
        }}
      </Form.Item>
    </fieldset>
  );
}

function readEntryTitle(entry: EntryView): string {
  return entry.displayTitle;
}

function isBoxEntry(entry: EntryView | undefined): boolean {
  return entry?.snapshot?.contentType === 'chips/box';
}

interface ITreeEditorProps {
  nodes: readonly IDocumentTreeNode[];
  entries: readonly EntryView[];
  onChange: (next: IDocumentTreeNode[]) => void;
}

/** 目录树编辑器：层级、标题覆盖、展示方式、默认折叠与节点操作（纯操作见 config.ts）。 */
function TreeEditor({ nodes, entries, onChange }: ITreeEditorProps): ReactElement {
  const { token } = theme.useToken();
  const nodeSequence = React.useRef(0);
  const flatNodes = React.useMemo(() => flattenEditorNodes(nodes), [nodes]);
  const entryMap = React.useMemo(
    () => new Map(entries.map((entry) => [entry.entry_id, entry])),
    [entries]
  );
  const configuredIds = React.useMemo(() => {
    const ids = new Set<string>();
    const visit = (list: readonly IDocumentTreeNode[]): void => {
      for (const node of list) {
        if (node.entryId !== undefined) {
          ids.add(node.entryId);
        }
        visit(node.children);
      }
    };
    visit(nodes);
    return ids;
  }, [nodes]);
  const unconfiguredEntries = entries.filter((entry) => !configuredIds.has(entry.entry_id));

  const rowStyle = (depth: number): CSSProperties => ({
    display: 'grid',
    gap: token.marginXXS,
    minWidth: 0,
    marginInlineStart: depth * TREE_INDENT_PX,
    padding: token.paddingXS,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusSM,
    background: token.colorBgContainer,
  });
  const actionStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: token.marginXXS };

  const addGroup = (): void => {
    nodeSequence.current += 1;
    onChange([
      ...nodes,
      { id: `group-${nodeSequence.current}`, titleOverride: '', collapsed: false, children: [] },
    ]);
  };

  const addEntry = (entry: EntryView): void => {
    onChange([
      ...nodes,
      {
        id: `entry-${entry.entry_id}`,
        entryId: entry.entry_id,
        presentation: isBoxEntry(entry) ? 'cover' : 'content',
        collapsed: false,
        children: [],
      },
    ]);
  };

  return (
    <div style={{ display: 'grid', gap: token.marginSM, minWidth: 0 }}>
      <div style={actionStyle}>
        <Button data-action="add-group" onClick={addGroup}>
          {ADD_GROUP_LABEL}
        </Button>
      </div>

      {flatNodes.length > 0 ? (
        <div style={{ display: 'grid', gap: token.marginXS, minWidth: 0 }}>
          {flatNodes.map(({ node, path, depth }) => {
            const entry =
              node.entryId === undefined ? undefined : entryMap.get(node.entryId);
            const inheritedTitle =
              entry !== undefined
                ? readEntryTitle(entry)
                : node.entryId !== undefined
                  ? node.entryId
                  : GROUP_TITLE_FALLBACK;
            const boxEntry = isBoxEntry(entry);
            const presentation: DocumentPresentation = boxEntry
              ? 'cover'
              : (node.presentation ?? 'content');
            return (
              <div key={node.id} data-editor-node={node.id} style={rowStyle(depth)}>
                <Input
                  data-node-title={node.id}
                  id={`node-title-${node.id}`}
                  value={node.titleOverride ?? ''}
                  placeholder={inheritedTitle}
                  aria-label={`${TITLE_OVERRIDE_PREFIX}${inheritedTitle}`}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    onChange(
                      updateNodeAtPath(nodes, path, (current) => ({
                        ...current,
                        titleOverride: value,
                      }))
                    );
                  }}
                />
                <div
                  style={{
                    minWidth: 0,
                    color: token.colorTextSecondary,
                    fontSize: token.fontSizeSM,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {node.entryId === undefined
                    ? NODE_GROUP_TEXT
                    : entry !== undefined
                      ? `${NODE_ENTRY_PREFIX}${node.entryId}`
                      : `${NODE_MISSING_PREFIX}${node.entryId}`}
                </div>
                {node.entryId !== undefined ? (
                  <div data-node-presentation={node.id} style={{ minWidth: 0 }}>
                    <Segmented<DocumentPresentation>
                      block
                      aria-label={`${PRESENTATION_LABEL_PREFIX}${inheritedTitle}`}
                      value={presentation}
                      disabled={boxEntry}
                      options={[
                        { label: PRESENTATION_CONTENT_LABEL, value: 'content' },
                        { label: PRESENTATION_COVER_LABEL, value: 'cover' },
                      ]}
                      onChange={(value) => {
                        onChange(
                          updateNodeAtPath(nodes, path, (current) => ({
                            ...current,
                            presentation: value === 'cover' ? 'cover' : 'content',
                          }))
                        );
                      }}
                    />
                    {boxEntry ? (
                      <div style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
                        {PRESENTATION_BOX_HINT}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <Checkbox
                  checked={node.collapsed}
                  onChange={(event) => {
                    onChange(
                      updateNodeAtPath(nodes, path, (current) => ({
                        ...current,
                        collapsed: event.target.checked,
                      }))
                    );
                  }}
                >
                  {COLLAPSED_BY_DEFAULT_LABEL}
                </Checkbox>
                <div style={actionStyle}>
                  <Button
                    size="small"
                    data-action="move-up"
                    onClick={() => {
                      onChange(moveNodeInTree(nodes, path, -1));
                    }}
                  >
                    {MOVE_UP_LABEL}
                  </Button>
                  <Button
                    size="small"
                    data-action="move-down"
                    onClick={() => {
                      onChange(moveNodeInTree(nodes, path, 1));
                    }}
                  >
                    {MOVE_DOWN_LABEL}
                  </Button>
                  <Button
                    size="small"
                    data-action="indent"
                    onClick={() => {
                      onChange(indentNodeInTree(nodes, path));
                    }}
                  >
                    {INDENT_LABEL}
                  </Button>
                  <Button
                    size="small"
                    data-action="outdent"
                    onClick={() => {
                      onChange(outdentNodeInTree(nodes, path));
                    }}
                  >
                    {OUTDENT_LABEL}
                  </Button>
                  <Button
                    size="small"
                    danger
                    data-action="remove"
                    onClick={() => {
                      onChange(removeNodeAtPath(nodes, path).nodes);
                    }}
                  >
                    {REMOVE_NODE_LABEL}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <span style={{ color: token.colorTextSecondary }}>{TREE_EMPTY_TEXT}</span>
      )}

      <fieldset
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          padding: token.paddingXS,
          margin: 0,
          minWidth: 0,
        }}
      >
        <legend style={{ paddingInline: token.paddingXXS }}>{UNCONFIGURED_ENTRIES_TITLE}</legend>
        <div style={actionStyle}>
          {unconfiguredEntries.length > 0 ? (
            unconfiguredEntries.map((entry) => (
              <Button
                key={entry.entry_id}
                data-add-entry={entry.entry_id}
                onClick={() => {
                  addEntry(entry);
                }}
              >
                {`${ADD_ENTRY_PREFIX}${readEntryTitle(entry)}`}
              </Button>
            ))
          ) : (
            <span style={{ color: token.colorTextSecondary }}>{NO_UNCONFIGURED_TEXT}</span>
          )}
        </div>
      </fieldset>
    </div>
  );
}

interface IDocumentLibraryEditorViewProps {
  config: IDocumentLibraryConfig;
  entries: readonly EntryView[];
  onChange: (next: IDocumentLibraryConfig) => void;
}

/**
 * 布局配置编辑面板：只编辑配置、只产出变更，不写文件、不导入资源
 * （09-箱子布局插件接口 §7.3）。
 */
function DocumentLibraryEditorView({
  config,
  entries,
  onChange,
}: IDocumentLibraryEditorViewProps): ReactElement {
  const { token } = theme.useToken();
  const [form] = Form.useForm<IDocumentLibraryConfig>();
  const [treeNodes, setTreeNodes] = React.useState<readonly IDocumentTreeNode[]>(
    config.tree_nodes
  );
  const treeNodesRef = React.useRef<readonly IDocumentTreeNode[]>(config.tree_nodes);

  const handleValuesChange = (
    _changed: Partial<IDocumentLibraryConfig>,
    values: IDocumentLibraryConfig
  ): void => {
    onChange(readConfig({ ...values, tree_nodes: treeNodesRef.current }));
  };

  const handleTreeChange = (next: readonly IDocumentTreeNode[]): void => {
    treeNodesRef.current = next;
    setTreeNodes(next);
    onChange(readConfig({ ...form.getFieldsValue(true), tree_nodes: next }));
  };

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
      <Form<IDocumentLibraryConfig>
        layout="vertical"
        initialValues={config}
        onValuesChange={handleValuesChange}
      >
        <fieldset data-editor-section="display" style={fieldsetStyle}>
          <legend style={{ paddingInline: token.paddingXXS }}>{DISPLAY_SECTION_TITLE}</legend>
          <p style={{ margin: 0, color: token.colorTextSecondary }}>{DISPLAY_SECTION_DESC}</p>
          <Form.Item
            label="排序方式"
            name="sort_mode"
            extra={config.sort_mode === 'manual' ? SORT_MANUAL_HINT : SORT_RUNTIME_HINT}
          >
            <Select
              options={SORT_OPTIONS.map((value) => ({ value, label: SORT_LABELS[value] }))}
            />
          </Form.Item>
          <Form.Item label={SIDEBAR_WIDTH_LABEL} name="sidebar_width">
            <Segmented<SidebarWidth>
              options={SIDEBAR_WIDTH_OPTIONS.map((value) => ({
                value,
                label: SIDEBAR_WIDTH_LABELS[value],
              }))}
            />
          </Form.Item>
          <Form.Item label={SHOW_SUMMARY_LABEL} name="show_summary" valuePropName="checked">
            <Switch />
          </Form.Item>
          <p style={{ margin: 0, color: token.colorTextSecondary }}>
            {`${ENTRY_COUNT_PREFIX} ${entries.length} ${ENTRY_COUNT_SUFFIX}`}
          </p>
        </fieldset>

        <fieldset data-editor-section="tree" style={fieldsetStyle}>
          <legend style={{ paddingInline: token.paddingXXS }}>{TREE_SECTION_TITLE}</legend>
          <p style={{ margin: 0, color: token.colorTextSecondary }}>{TREE_SECTION_DESC}</p>
          <TreeEditor nodes={treeNodes} entries={entries} onChange={handleTreeChange} />
        </fieldset>

        <FrameRegionFields title={BACKGROUND_TITLE} field="background" />
        <FrameRegionFields title={TOP_REGION_TITLE} field="top_region" />
      </Form>
    </div>
  );
}

class DocumentLibraryEditor implements ILayoutEditor {
  public state: EditorState = 'active';

  private base: IDocumentLibraryConfig;
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
        <DocumentLibraryEditorView
          key={this.revision}
          config={this.base}
          entries={this.entries}
          onChange={this.handleConfigChange}
        />
      );
    });
  }

  private readonly handleConfigChange = (next: IDocumentLibraryConfig): void => {
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
  return new DocumentLibraryEditor(box, container);
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

/** 编辑器平铺节点类型再导出（供宿主侧类型引用）。 */
export type { IEditorFlatNode };
