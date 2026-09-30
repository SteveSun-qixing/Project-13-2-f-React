/** 条目排序方式：手动顺序、按名称升序、按名称降序（递归作用于目录树各层级）。 */
export type SortMode = 'manual' | 'name-asc' | 'name-desc';

/** 目录侧栏宽度档位：紧凑、常规、宽。 */
export type SidebarWidth = 'compact' | 'regular' | 'wide';

/** 条目节点呈现方式：卡片内容、卡片封面；箱子条目固定封面。 */
export type DocumentPresentation = 'content' | 'cover';

/** 区域呈现模式：不显示、箱子图片、内联 HTML 代码。 */
export type FrameRegionMode = 'none' | 'image' | 'html';

/** 布局区域配置（背景区 / 顶部内容区共用形状）。 */
export interface IFrameRegion {
  mode: FrameRegionMode;
  /** 图片模式的箱子自有资源路径：以 `assets/` 开头的包内相对 POSIX 路径。 */
  assetPath?: string;
  /** 代码模式的内联 HTML 文档。 */
  html?: string;
}

/** 目录树节点配置：目录节点组织层级，条目节点绑定箱子条目。 */
export interface IDocumentTreeNode {
  id: string;
  /** 绑定的箱子条目标识；缺省为目录节点。 */
  entryId?: string;
  /** 显示名称覆盖；缺省取条目展示名。 */
  titleOverride?: string;
  /** 条目节点呈现方式；目录节点不携带。 */
  presentation?: DocumentPresentation;
  collapsed: boolean;
  children: IDocumentTreeNode[];
}

/** 文档库布局配置。 */
export interface IDocumentLibraryConfig {
  sort_mode: SortMode;
  tree_nodes: IDocumentTreeNode[];
  sidebar_width: SidebarWidth;
  show_summary: boolean;
  background: IFrameRegion;
  top_region: IFrameRegion;
}

/** 目录树构建的条目引用（`EntryView` 的结构子集）。 */
export interface IDirectoryEntryRef {
  entry_id: string;
  displayTitle: string;
  enabled: boolean;
  snapshot?: Readonly<Record<string, unknown>>;
}

/** 目录树展示节点（查看态与编辑态共用形状）。 */
export interface IDirectoryNode {
  id: string;
  entryId?: string;
  title: string;
  depth: number;
  collapsed: boolean;
  /** 是否由目录树配置产生（false 为未归档条目自动追加）。 */
  configured: boolean;
  /** 引用的条目是否不在箱子条目集合中。 */
  missing: boolean;
  presentation: DocumentPresentation;
  /** 条目目标是否为箱子（固定封面呈现）。 */
  isBox: boolean;
  children: IDirectoryNode[];
}

/** 编辑器产出配置所遵循的 schema 版本，必须落在 manifest 的 schemaVersions 范围内。 */
export const CONFIG_SCHEMA_VERSION = '1.0.0';

/** 默认值；必须与 assets/schemas 下配置 schema 的约束保持一致。 */
export const DEFAULT_CONFIG: IDocumentLibraryConfig = {
  sort_mode: 'manual',
  tree_nodes: [],
  sidebar_width: 'regular',
  show_summary: true,
  background: { mode: 'none' },
  top_region: { mode: 'none' },
};

/** 目录树深度上限。 */
export const MAX_TREE_DEPTH = 8;

/** 目录树节点总数上限。 */
export const MAX_TREE_NODES = 500;

/** 节点标识最大长度。 */
export const NODE_ID_MAX_LENGTH = 120;

/** 节点文本（条目绑定标识、标题覆盖）最大长度。 */
export const NODE_TEXT_MAX_LENGTH = 160;

/** 侧栏宽度档位像素值。 */
export const SIDEBAR_WIDTH_PX: Readonly<Record<SidebarWidth, number>> = {
  compact: 220,
  regular: 280,
  wide: 360,
};

/** 目录树层级缩进步长（px）。 */
export const TREE_INDENT_PX = 16;

export const SORT_OPTIONS: readonly SortMode[] = ['manual', 'name-asc', 'name-desc'];

export const SORT_LABELS: Readonly<Record<SortMode, string>> = {
  manual: '手动顺序',
  'name-asc': '按名称升序',
  'name-desc': '按名称降序',
};

export const SIDEBAR_WIDTH_OPTIONS: readonly SidebarWidth[] = ['compact', 'regular', 'wide'];

export const SIDEBAR_WIDTH_LABELS: Readonly<Record<SidebarWidth, string>> = {
  compact: '紧凑',
  regular: '常规',
  wide: '宽',
};

// ---------- 简体中文文案（R5 直写，不设多语言运行时） ----------

export const EMPTY_TITLE = '这里还没有内容';
export const EMPTY_HINT_TEXT = '在编辑器中添加卡片或箱子，开始填充这个箱子';
export const LIBRARY_ARIA_LABEL = '文档库箱子布局';
export const TREE_LABEL = '文档目录';
export const HIDE_DIRECTORY_LABEL = '隐藏目录';
export const SHOW_DIRECTORY_LABEL = '显示目录';
export const BACKGROUND_TITLE = '背景区域';
export const TOP_REGION_TITLE = '顶部内容区';
export const MISSING_ENTRY_TITLE = '缺失条目';
export const MISSING_ENTRY_HINT = '此目录节点引用的条目当前不在箱子中，配置会继续保留。';
export const GROUP_TITLE_FALLBACK = '目录';
export const OPEN_DOCUMENT_LABEL = '打开文档';
export const ENTRY_KIND_LABELS: Readonly<Record<'card' | 'box', string>> = {
  card: '卡片',
  box: '箱子',
};
export const TAGS_LABEL = '标签';
export const EXPAND_NODE_LABEL = '展开目录';
export const COLLAPSE_NODE_LABEL = '收起目录';
export const SLOT_UNAVAILABLE_TEXT = '条目内容暂时不可用';
export const OPEN_FAILED_TEXT = '条目暂时无法打开，请稍后重试';
export const DISPLAY_SECTION_TITLE = '显示';
export const DISPLAY_SECTION_DESC = '调整目录排序、侧栏宽度与摘要显隐';
export const TREE_SECTION_TITLE = '目录树';
export const TREE_SECTION_DESC =
  '配置目录层级、默认折叠状态和标题覆盖；未放入目录树的条目仍会在查看态展示。';
export const SORT_MANUAL_HINT = '保持目录树与未归档条目的手动顺序';
export const SORT_RUNTIME_HINT = '查看态按目录标题动态排序';
export const SIDEBAR_WIDTH_LABEL = '侧边栏宽度';
export const SHOW_SUMMARY_LABEL = '封面态显示摘要';
export const ENTRY_COUNT_PREFIX = '当前箱子包含';
export const ENTRY_COUNT_SUFFIX = '个条目';
export const ADD_GROUP_LABEL = '添加目录';
export const NODE_GROUP_TEXT = '目录节点';
export const NODE_ENTRY_PREFIX = '条目：';
export const NODE_MISSING_PREFIX = '缺失条目：';
export const PRESENTATION_LABEL_PREFIX = '展示方式：';
export const PRESENTATION_CONTENT_LABEL = '卡片内容';
export const PRESENTATION_COVER_LABEL = '卡片封面';
export const PRESENTATION_BOX_HINT = '箱子条目固定显示封面';
export const COLLAPSED_BY_DEFAULT_LABEL = '默认折叠';
export const MOVE_UP_LABEL = '上移';
export const MOVE_DOWN_LABEL = '下移';
export const INDENT_LABEL = '缩进';
export const OUTDENT_LABEL = '取消缩进';
export const REMOVE_NODE_LABEL = '移除';
export const TREE_EMPTY_TEXT = '尚未配置目录树，未放入目录树的条目会直接展示。';
export const UNCONFIGURED_ENTRIES_TITLE = '未放入目录树的条目';
export const NO_UNCONFIGURED_TEXT = '没有未放入目录树的条目';
export const ADD_ENTRY_PREFIX = '加入：';
export const TITLE_OVERRIDE_PREFIX = '覆盖标题：';

/** 箱子自有资源安全路径：以 `assets/` 开头、不含绝对路径、scheme、`.` 与 `..` 段。 */
const BOX_ASSET_PATH_PATTERN = /^assets\/[^\\:?#/]+(?:\/[^\\:?#/]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSortMode(value: unknown): value is SortMode {
  return value === 'manual' || value === 'name-asc' || value === 'name-desc';
}

function isSidebarWidth(value: unknown): value is SidebarWidth {
  return value === 'compact' || value === 'regular' || value === 'wide';
}

function isPresentation(value: unknown): value is DocumentPresentation {
  return value === 'content' || value === 'cover';
}

function isFrameRegionMode(value: unknown): value is FrameRegionMode {
  return value === 'none' || value === 'image' || value === 'html';
}

/**
 * 判定字符串是否为安全的箱子资源路径。
 *
 * @param value - 待判定路径
 * @returns 合法返回 true，否则 false
 */
export function isSafeBoxAssetPath(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed !== value || !BOX_ASSET_PATH_PATTERN.test(trimmed)) {
    return false;
  }
  if (trimmed.startsWith('/') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return false;
  }
  return trimmed.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..');
}

function normalizeFrameRegion(value: unknown): IFrameRegion {
  const raw = isRecord(value) ? value : {};
  const mode = isFrameRegionMode(raw.mode) ? raw.mode : 'none';
  const rawAssetPath = typeof raw.assetPath === 'string' ? raw.assetPath : '';
  const assetPath =
    rawAssetPath.length > 0 && isSafeBoxAssetPath(rawAssetPath) ? rawAssetPath : undefined;
  const html = typeof raw.html === 'string' && raw.html.trim().length > 0 ? raw.html : undefined;

  if (mode === 'image') {
    return assetPath === undefined ? { mode: 'image' } : { mode: 'image', assetPath };
  }
  if (mode === 'html') {
    return html === undefined
      ? { mode: 'html', html: typeof raw.html === 'string' ? raw.html : '' }
      : { mode: 'html', html };
  }
  return { mode: 'none' };
}

/**
 * 判定区域是否有可呈现内容。
 *
 * @param region - 区域配置
 * @returns 有内容返回 true，否则 false
 */
export function hasFrameRegionContent(region: IFrameRegion): boolean {
  if (region.mode === 'image') {
    return typeof region.assetPath === 'string' && region.assetPath.trim().length > 0;
  }
  if (region.mode === 'html') {
    return typeof region.html === 'string' && region.html.trim().length > 0;
  }
  return false;
}

// ---------- 目录树归一 ----------

function normalizeNodeId(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim().slice(0, NODE_ID_MAX_LENGTH);
  }
  return fallback;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, NODE_TEXT_MAX_LENGTH) : undefined;
}

/**
 * 归一目录树：回退并去重节点标识（全局唯一）、截断文本、目录节点剔除展示方式，
 * 超过深度或节点数上限的子树确定性丢弃，保证渲染不因坏配置失败。
 *
 * @param value - 目录树原始值
 * @returns 归一后的目录树
 */
export function normalizeTreeNodes(value: unknown): IDocumentTreeNode[] {
  const seenIds = new Set<string>();
  let count = 0;

  const walk = (input: unknown, depth: number, path: string): IDocumentTreeNode[] => {
    if (!Array.isArray(input) || depth >= MAX_TREE_DEPTH || count >= MAX_TREE_NODES) {
      return [];
    }
    const nodes: IDocumentTreeNode[] = [];
    input.forEach((item, index) => {
      if (count >= MAX_TREE_NODES) {
        return;
      }
      const raw = isRecord(item) ? item : {};
      const id = normalizeNodeId(raw.id, `${path}-${index + 1}`);
      const dedupedId = seenIds.has(id) ? `${id.slice(0, NODE_ID_MAX_LENGTH)}-${index + 1}` : id;
      seenIds.add(dedupedId);
      count += 1;
      const entryId = normalizeOptionalText(raw.entryId);
      const node: IDocumentTreeNode = {
        id: dedupedId,
        collapsed: raw.collapsed === true,
        children: walk(raw.children, depth + 1, dedupedId),
      };
      if (entryId !== undefined) {
        node.entryId = entryId;
        node.presentation = isPresentation(raw.presentation) ? raw.presentation : 'content';
      }
      const titleOverride = normalizeOptionalText(raw.titleOverride);
      if (titleOverride !== undefined) {
        node.titleOverride = titleOverride;
      }
      nodes.push(node);
    });
    return nodes;
  };

  return walk(value, 0, 'node');
}

/**
 * 归一布局配置：字段缺失或非法时回退默认值，保证渲染不因坏配置失败。
 *
 * @param input - 布局配置原始值
 * @returns 归一后的配置
 */
export function readConfig(input: unknown): IDocumentLibraryConfig {
  const record = isRecord(input) ? input : {};
  return {
    sort_mode: isSortMode(record.sort_mode) ? record.sort_mode : DEFAULT_CONFIG.sort_mode,
    tree_nodes: normalizeTreeNodes(record.tree_nodes),
    sidebar_width: isSidebarWidth(record.sidebar_width)
      ? record.sidebar_width
      : DEFAULT_CONFIG.sidebar_width,
    show_summary:
      typeof record.show_summary === 'boolean' ? record.show_summary : DEFAULT_CONFIG.show_summary,
    background: normalizeFrameRegion(record.background),
    top_region: normalizeFrameRegion(record.top_region),
  };
}

/**
 * 派生当前配置引用的箱子资源列表（`asset_refs` 口径）：图片模式区域的合法路径去重集合。
 *
 * @param config - 归一后的布局配置
 * @returns 以 `assets/` 开头的资源路径数组
 */
export function deriveAssetRefs(config: IDocumentLibraryConfig): string[] {
  return [
    ...new Set(
      [
        config.background.mode === 'image' ? config.background.assetPath : undefined,
        config.top_region.mode === 'image' ? config.top_region.assetPath : undefined,
      ].filter((value): value is string => typeof value === 'string' && value.length > 0)
    ),
  ];
}

// ---------- 目录树校验 ----------

function isTreeNodeShapeValid(
  node: unknown,
  depth: number,
  seenIds: Set<string>,
  stats: { count: number }
): boolean {
  if (!isRecord(node) || depth >= MAX_TREE_DEPTH) {
    return false;
  }
  stats.count += 1;
  if (stats.count > MAX_TREE_NODES) {
    return false;
  }
  if (typeof node.id !== 'string' || node.id.trim().length === 0) {
    return false;
  }
  const id = node.id.trim();
  if (id.length > NODE_ID_MAX_LENGTH || seenIds.has(id)) {
    return false;
  }
  seenIds.add(id);
  if (node.entryId !== undefined) {
    if (
      typeof node.entryId !== 'string' ||
      node.entryId.trim().length === 0 ||
      node.entryId.length > NODE_TEXT_MAX_LENGTH
    ) {
      return false;
    }
    if (node.presentation !== undefined && !isPresentation(node.presentation)) {
      return false;
    }
  } else if (node.presentation !== undefined) {
    return false;
  }
  if (
    node.titleOverride !== undefined &&
    (typeof node.titleOverride !== 'string' || node.titleOverride.length > NODE_TEXT_MAX_LENGTH)
  ) {
    return false;
  }
  if (node.collapsed !== undefined && typeof node.collapsed !== 'boolean') {
    return false;
  }
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) {
      return false;
    }
    for (const child of node.children) {
      if (!isTreeNodeShapeValid(child, depth + 1, seenIds, stats)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * 校验布局配置是否可用于渲染；纯函数、同步、不得抛出。
 * `undefined` / `null` / `{}` 一律按默认值渲染，返回 true。
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
  if (config.sort_mode !== undefined && !isSortMode(config.sort_mode)) {
    return false;
  }
  if (config.sidebar_width !== undefined && !isSidebarWidth(config.sidebar_width)) {
    return false;
  }
  if (config.show_summary !== undefined && typeof config.show_summary !== 'boolean') {
    return false;
  }
  if (config.tree_nodes !== undefined) {
    if (!Array.isArray(config.tree_nodes)) {
      return false;
    }
    const seenIds = new Set<string>();
    const stats = { count: 0 };
    for (const node of config.tree_nodes) {
      if (!isTreeNodeShapeValid(node, 0, seenIds, stats)) {
        return false;
      }
    }
  }
  if (config.background !== undefined && !isFrameRegionShapeValid(config.background)) {
    return false;
  }
  if (config.top_region !== undefined && !isFrameRegionShapeValid(config.top_region)) {
    return false;
  }
  return true;
}

function isFrameRegionShapeValid(region: unknown): boolean {
  if (!isRecord(region)) {
    return false;
  }
  if (!isFrameRegionMode(region.mode)) {
    return false;
  }
  if (region.mode === 'image') {
    return (
      typeof region.assetPath === 'string' &&
      region.assetPath.length > 0 &&
      isSafeBoxAssetPath(region.assetPath)
    );
  }
  if (region.mode === 'html') {
    return typeof region.html === 'string' && region.html.trim().length > 0;
  }
  return true;
}

// ---------- 目录树展示模型 ----------

/**
 * 收集目录树已绑定的条目标识集合。
 *
 * @param nodes - 目录树节点
 * @returns 已绑定条目标识集合
 */
export function collectConfiguredEntryIds(nodes: readonly IDocumentTreeNode[]): Set<string> {
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
}

function isBoxEntry(snapshot: Readonly<Record<string, unknown>> | undefined): boolean {
  return snapshot?.contentType === 'chips/box';
}

function compareTitles(left: string, right: string): number {
  return left.localeCompare(right, 'zh-CN');
}

/**
 * 递归排序目录树：名称比较用简体中文习惯，同名称按节点标识稳定兜底；手动顺序保持呈现顺序。
 *
 * @param nodes - 目录树节点
 * @param sortMode - 排序方式
 * @returns 排序后的新数组
 */
export function sortTreeNodes<T extends { id: string; title: string; children: T[] }>(
  nodes: readonly T[],
  sortMode: SortMode
): T[] {
  const next = nodes.map((node) => ({ ...node, children: sortTreeNodes(node.children, sortMode) }));
  if (sortMode === 'manual') {
    return next;
  }
  const direction = sortMode === 'name-desc' ? -1 : 1;
  return next.sort((left, right) => {
    const compared = compareTitles(left.title, right.title);
    return compared === 0 ? left.id.localeCompare(right.id) : compared * direction;
  });
}

/**
 * 由目录树配置与箱子条目构建展示树：配置节点按层级映射（缺失条目如实标记），
 * 未放入目录树的启用条目按呈现顺序追加在根层，最后按排序方式递归排序。
 *
 * @param params - 配置节点、条目引用与排序方式
 * @returns 展示树
 */
export function buildDirectoryTree(params: {
  configNodes: readonly IDocumentTreeNode[];
  entries: readonly IDirectoryEntryRef[];
  sortMode: SortMode;
}): IDirectoryNode[] {
  const { configNodes, entries, sortMode } = params;
  const entryMap = new Map(entries.map((entry) => [entry.entry_id, entry]));
  const configuredIds = collectConfiguredEntryIds(configNodes);

  const mapConfigNode = (node: IDocumentTreeNode, depth: number): IDirectoryNode => {
    const entry = node.entryId === undefined ? undefined : entryMap.get(node.entryId);
    const isBox = isBoxEntry(entry?.snapshot);
    const missing = node.entryId !== undefined && entry === undefined;
    const fallbackTitle = missing
      ? MISSING_ENTRY_TITLE
      : entry !== undefined
        ? entry.displayTitle
        : GROUP_TITLE_FALLBACK;
    const mapped: IDirectoryNode = {
      id: node.id,
      title: node.titleOverride ?? fallbackTitle,
      depth,
      collapsed: node.collapsed,
      configured: true,
      missing,
      presentation: isBox ? 'cover' : (node.presentation ?? 'content'),
      isBox,
      children: node.children.map((child) => mapConfigNode(child, depth + 1)),
    };
    if (node.entryId !== undefined) {
      mapped.entryId = node.entryId;
    }
    return mapped;
  };

  const configuredNodes = configNodes.map((node) => mapConfigNode(node, 0));
  const unarchivedNodes = entries
    .filter((entry) => entry.enabled && !configuredIds.has(entry.entry_id))
    .map(
      (entry): IDirectoryNode => ({
        id: `unconfigured-${entry.entry_id}`,
        entryId: entry.entry_id,
        title: entry.displayTitle,
        depth: 0,
        collapsed: false,
        configured: false,
        missing: false,
        presentation: isBoxEntry(entry.snapshot) ? 'cover' : 'content',
        isBox: isBoxEntry(entry.snapshot),
        children: [],
      })
    );

  return sortTreeNodes([...configuredNodes, ...unarchivedNodes], sortMode);
}

/**
 * 扁平化可见目录树：折叠节点隐藏全部后代；会话折叠覆盖优先于配置默认值。
 *
 * @param nodes - 展示树
 * @param collapsedOverrides - 会话期折叠覆盖（节点标识 → 是否折叠）
 * @returns 可见节点列表（携带层级深度）
 */
export function flattenVisibleTree(
  nodes: readonly IDirectoryNode[],
  collapsedOverrides: Readonly<Record<string, boolean>>
): IDirectoryNode[] {
  const flattened: IDirectoryNode[] = [];
  const visit = (node: IDirectoryNode, depth: number): void => {
    const collapsed = collapsedOverrides[node.id] ?? node.collapsed;
    flattened.push({ ...node, depth, collapsed });
    if (!collapsed) {
      node.children.forEach((child) => {
        visit(child, depth + 1);
      });
    }
  };
  nodes.forEach((node) => {
    visit(node, 0);
  });
  return flattened;
}

/**
 * 读取封面态纵横比：条目 `layout_hints.aspectRatio` 优先（数字或 `w:h` 形式），非法回退 3:4。
 *
 * @param hints - 条目呈现提示
 * @returns CSS `aspect-ratio` 取值
 */
export function toCoverAspectRatio(hints: Readonly<Record<string, unknown>> | undefined): string {
  const fallback = '3 / 4';
  const raw = hints?.aspectRatio;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return `${raw}`;
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const trimmed = raw.trim();
    return trimmed.includes(':') ? trimmed.replace(':', ' / ') : trimmed;
  }
  return fallback;
}

// ---------- 目录树编辑纯操作 ----------

/** 编辑器平铺节点：节点 + 根到该节点的路径 + 深度。 */
export interface IEditorFlatNode {
  node: IDocumentTreeNode;
  path: readonly number[];
  depth: number;
}

function cloneNode(node: IDocumentTreeNode): IDocumentTreeNode {
  const clone: IDocumentTreeNode = {
    id: node.id,
    collapsed: node.collapsed,
    children: node.children.map(cloneNode),
  };
  if (node.entryId !== undefined) {
    clone.entryId = node.entryId;
  }
  if (node.titleOverride !== undefined) {
    clone.titleOverride = node.titleOverride;
  }
  if (node.presentation !== undefined) {
    clone.presentation = node.presentation;
  }
  return clone;
}

/**
 * 深拷贝目录树。
 *
 * @param nodes - 目录树节点
 * @returns 深拷贝结果
 */
export function cloneTreeNodes(nodes: readonly IDocumentTreeNode[]): IDocumentTreeNode[] {
  return nodes.map(cloneNode);
}

function getChildrenAtPath(
  nodes: readonly IDocumentTreeNode[],
  parentPath: readonly number[]
): IDocumentTreeNode[] {
  let children = nodes as IDocumentTreeNode[];
  for (const index of parentPath) {
    children = children[index]?.children ?? [];
  }
  return children;
}

/**
 * 按路径更新节点。
 *
 * @param nodes - 目录树节点
 * @param path - 根到目标节点的路径
 * @param updater - 节点更新函数
 * @returns 更新后的新树
 */
export function updateNodeAtPath(
  nodes: readonly IDocumentTreeNode[],
  path: readonly number[],
  updater: (node: IDocumentTreeNode) => IDocumentTreeNode
): IDocumentTreeNode[] {
  const next = cloneTreeNodes(nodes);
  const parent = getChildrenAtPath(next, path.slice(0, -1));
  const index = path[path.length - 1];
  if (typeof index === 'number' && parent[index] !== undefined) {
    const current = parent[index];
    if (current !== undefined) {
      parent[index] = updater(current);
    }
  }
  return next;
}

/**
 * 按路径移除节点。
 *
 * @param nodes - 目录树节点
 * @param path - 根到目标节点的路径
 * @returns 新树与被移除的节点
 */
export function removeNodeAtPath(
  nodes: readonly IDocumentTreeNode[],
  path: readonly number[]
): { nodes: IDocumentTreeNode[]; removed?: IDocumentTreeNode } {
  const next = cloneTreeNodes(nodes);
  const parent = getChildrenAtPath(next, path.slice(0, -1));
  const index = path[path.length - 1];
  if (typeof index !== 'number') {
    return { nodes: next };
  }
  const [removed] = parent.splice(index, 1);
  return removed === undefined ? { nodes: next } : { nodes: next, removed };
}

/**
 * 把节点插入到指定父路径下的目标位置。
 *
 * @param nodes - 目录树节点
 * @param parentPath - 父路径
 * @param index - 插入位置
 * @param node - 待插入节点
 * @returns 插入后的新树
 */
export function insertNodeAtPath(
  nodes: readonly IDocumentTreeNode[],
  parentPath: readonly number[],
  index: number,
  node: IDocumentTreeNode
): IDocumentTreeNode[] {
  const next = cloneTreeNodes(nodes);
  const parent = getChildrenAtPath(next, parentPath);
  parent.splice(index, 0, cloneNode(node));
  return next;
}

/**
 * 平铺目录树（编辑器行序）。
 *
 * @param nodes - 目录树节点
 * @param depth - 起始深度
 * @param parentPath - 父路径
 * @returns 平铺节点列表
 */
export function flattenEditorNodes(
  nodes: readonly IDocumentTreeNode[],
  depth = 0,
  parentPath: readonly number[] = []
): IEditorFlatNode[] {
  return nodes.flatMap((node, index) => {
    const path = [...parentPath, index];
    return [{ node, path, depth }, ...flattenEditorNodes(node.children, depth + 1, path)];
  });
}

/**
 * 同级内移动节点。
 *
 * @param nodes - 目录树节点
 * @param path - 根到目标节点的路径
 * @param direction - 移动方向：-1 上移、1 下移
 * @returns 移动后的新树；越界时保持原序
 */
export function moveNodeInTree(
  nodes: readonly IDocumentTreeNode[],
  path: readonly number[],
  direction: -1 | 1
): IDocumentTreeNode[] {
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  if (typeof index !== 'number') {
    return cloneTreeNodes(nodes);
  }
  const siblings = getChildrenAtPath(nodes, parentPath);
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= siblings.length) {
    return cloneTreeNodes(nodes);
  }
  const next = cloneTreeNodes(nodes);
  const parent = getChildrenAtPath(next, parentPath);
  const [node] = parent.splice(index, 1);
  if (node === undefined) {
    return next;
  }
  parent.splice(nextIndex, 0, node);
  return next;
}

/**
 * 缩进节点：挂到前一个同级节点之下（末尾）；无前一个同级时保持原树。
 *
 * @param nodes - 目录树节点
 * @param path - 根到目标节点的路径
 * @returns 缩进后的新树
 */
export function indentNodeInTree(
  nodes: readonly IDocumentTreeNode[],
  path: readonly number[]
): IDocumentTreeNode[] {
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  if (typeof index !== 'number' || index <= 0) {
    return cloneTreeNodes(nodes);
  }
  const removal = removeNodeAtPath(nodes, path);
  if (removal.removed === undefined) {
    return cloneTreeNodes(nodes);
  }
  const nextParent = getChildrenAtPath(removal.nodes, [...parentPath, index - 1]);
  nextParent.push(removal.removed);
  return removal.nodes;
}

/**
 * 取消缩进：把节点移出父层，插入到父节点之后的同级位置；根层节点保持原树。
 *
 * @param nodes - 目录树节点
 * @param path - 根到目标节点的路径
 * @returns 取消缩进后的新树
 */
export function outdentNodeInTree(
  nodes: readonly IDocumentTreeNode[],
  path: readonly number[]
): IDocumentTreeNode[] {
  if (path.length <= 1) {
    return cloneTreeNodes(nodes);
  }
  const parentPath = path.slice(0, -1);
  const grandParentPath = path.slice(0, -2);
  const parentIndex = parentPath[parentPath.length - 1];
  if (typeof parentIndex !== 'number') {
    return cloneTreeNodes(nodes);
  }
  const removal = removeNodeAtPath(nodes, path);
  if (removal.removed === undefined) {
    return cloneTreeNodes(nodes);
  }
  return insertNodeAtPath(removal.nodes, grandParentPath, parentIndex + 1, removal.removed);
}
