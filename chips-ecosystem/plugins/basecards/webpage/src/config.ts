/**
 * 网页基础卡片内容模型与视口布局纯函数。
 *
 * 内容形状以《01-卡片文件格式》§6.5 为准（`base.webpage` 平铺字段，`card_type` 正式值
 * `base.webpage`，历史别名 `WebPageCard` 只读取归一）；通用字段 `theme` 按 §6.1
 * 写入保持空串。本模块与 `assets/schemas/webpage-card-config.schema.json` 保持同一口径
 * （08-基础卡片插件接口 §7.3：validateConfig 不得比 schema 宽松）。
 */

/** 展示来源：远程网址 / 卡片内网页目录。 */
export type WebpageSourceType = 'url' | 'bundle';

/** 视口显示模式：固定比例 / 自由展开。 */
export type WebpageDisplayMode = 'fixed' | 'free';

/** 卡片类型正式 ID（与 manifest capabilities.cardTypes[0].id 一致）。 */
export const CARD_TYPE_ID = 'base.webpage';

/** 历史别名（manifest aliases 登记一致；只读取归一，不作新写入值）。 */
export const CARD_TYPE_ALIASES: readonly string[] = ['WebPageCard'];

/** 固定比例正式值（§6.5 const 7:16，宽:高）。 */
export const FIXED_RATIO = '7:16';

/** 自由展开最大高度阈值（宽度倍数，§6.5 const 20）。 */
export const MAX_HEIGHT_RATIO = 20;

/** 网页目录入口文件（§6.5：正式必须为 index.html）。 */
export const DEFAULT_ENTRY_FILE = 'index.html';

/** 网页卡片类型专有内容（不含 `card_type` / `theme` 信封字段）。 */
export interface IWebpageContent {
  source_type: WebpageSourceType;
  source_url: string;
  bundle_root: string;
  entry_file: string;
  resource_paths: string[];
  display_mode: WebpageDisplayMode;
  fixed_ratio: typeof FIXED_RATIO;
  max_height_ratio: typeof MAX_HEIGHT_RATIO;
}

/** 默认内容（§6.5 示例 1：空 url 来源初稿，可通过 validateConfig 与 configSchema）。 */
export const DEFAULT_CONTENT: IWebpageContent = {
  source_type: 'url',
  source_url: '',
  bundle_root: '',
  entry_file: DEFAULT_ENTRY_FILE,
  resource_paths: [],
  display_mode: 'fixed',
  fixed_ratio: FIXED_RATIO,
  max_height_ratio: MAX_HEIGHT_RATIO,
};

// ---------- URL 安全分析（查看态来源判定与编辑器校验的唯一口径） ----------

export type WebpageUrlSecurityReason =
  | 'secure'
  | 'insecure-http'
  | 'empty'
  | 'invalid'
  | 'unsupported-protocol'
  | 'missing-host'
  | 'credentials-blocked';

export interface IWebpageUrlAnalysis {
  readonly input: string;
  readonly normalizedUrl: string;
  readonly protocol: string;
  readonly hostname: string;
  readonly openable: boolean;
  readonly reason: WebpageUrlSecurityReason;
}

/**
 * 分析一个网页地址：只接受 http(s)，拒绝携带凭据的 URL
 * （凭据拒绝口径同《06-资源协议规范》§2.6 `invalid_origin`）。
 */
export function analyzeWebpageUrl(value: unknown): IWebpageUrlAnalysis {
  const input = typeof value === 'string' ? value.trim() : '';
  if (input.length === 0) {
    return {
      input,
      normalizedUrl: '',
      protocol: '',
      hostname: '',
      openable: false,
      reason: 'empty',
    };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    // WHATWG 解析器对特殊协议的空主机（如 `https://`）直接抛错；
    // `scheme://` 后主机为空的输入按 missing-host 归一，其余判 invalid。
    const schemeOnly = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(?:[/?#:]|$)/.exec(input);
    if (schemeOnly !== null) {
      return {
        input,
        normalizedUrl: '',
        protocol: `${schemeOnly[1]!.toLowerCase()}:`,
        hostname: '',
        openable: false,
        reason: 'missing-host',
      };
    }
    return {
      input,
      normalizedUrl: '',
      protocol: '',
      hostname: '',
      openable: false,
      reason: 'invalid',
    };
  }

  const protocol = url.protocol.toLowerCase();
  const hostname = url.hostname.trim();

  if (protocol !== 'http:' && protocol !== 'https:') {
    return {
      input,
      normalizedUrl: '',
      protocol,
      hostname,
      openable: false,
      reason: 'unsupported-protocol',
    };
  }
  if (hostname.length === 0) {
    return {
      input,
      normalizedUrl: '',
      protocol,
      hostname,
      openable: false,
      reason: 'missing-host',
    };
  }
  if (url.username.length > 0 || url.password.length > 0) {
    return {
      input,
      normalizedUrl: '',
      protocol,
      hostname,
      openable: false,
      reason: 'credentials-blocked',
    };
  }

  return {
    input,
    normalizedUrl: url.toString(),
    protocol,
    hostname,
    openable: true,
    reason: protocol === 'http:' ? 'insecure-http' : 'secure',
  };
}

// ---------- 包内相对资源路径 ----------

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 归一一个包内相对路径（相对卡片包根，`/` 分隔）：
 * 拒绝协议引用、查询串、片段、穿段与空段；非法返回 `undefined`。
 */
export function normalizeRelativeResourcePath(value: unknown): string | undefined {
  if (!isNonEmptyString(value)) {
    return undefined;
  }

  const normalized = value.replace(/\\/g, '/').trim().replace(/^\.?\//, '');
  if (!normalized) {
    return undefined;
  }

  if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(normalized) || normalized.includes('?') || normalized.includes('#')) {
    return undefined;
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    return undefined;
  }

  return segments.join('/');
}

/** 去重并保持首次出现顺序的资源路径清单。 */
export function dedupeResourcePaths(paths: readonly unknown[]): string[] {
  const unique = new Set<string>();
  for (const path of paths) {
    const normalized = normalizeRelativeResourcePath(path);
    if (normalized) {
      unique.add(normalized);
    }
  }
  return Array.from(unique);
}

/** 网页目录在卡片包根中的相对路径；非法返回 `undefined`。 */
export function getBundleRootPath(content: IWebpageContent): string | undefined {
  return normalizeRelativeResourcePath(content.bundle_root);
}

/** 网页目录入口文件的包内相对路径（`${bundle_root}/${entry_file}`）。 */
export function getBundleEntryPath(content: IWebpageContent): string | undefined {
  const bundleRoot = getBundleRootPath(content);
  if (!bundleRoot) {
    return undefined;
  }

  const entryFile = normalizeRelativeResourcePath(content.entry_file) ?? DEFAULT_ENTRY_FILE;
  return `${bundleRoot}/${entryFile}`.replace(/\/+/g, '/');
}

// ---------- 归一与校验 ----------

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeSourceType(value: unknown): WebpageSourceType {
  return value === 'bundle' ? 'bundle' : 'url';
}

function normalizeDisplayMode(value: unknown): WebpageDisplayMode {
  return value === 'free' || value === 'fixed' ? value : DEFAULT_CONTENT.display_mode;
}

/**
 * 归一任意输入为网页卡片内容：缺失或非法字段回退默认值（08 §7.1 规则 2）。
 *
 * 输入为《01-卡片文件格式》§6.5 的内容节点平铺字段；`card_type` 接受正式值与历史
 * 别名（读取归一），不参与内容模型。bundle 模式下 `source_url` 归空、url 模式下
 * 包字段归空（旧链路同口径）。
 */
export function readContent(input: unknown): IWebpageContent {
  const record = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const sourceType = normalizeSourceType(record['source_type']);
  const bundleRoot =
    sourceType === 'bundle' ? normalizeRelativeResourcePath(record['bundle_root']) ?? '' : '';
  const entryFile =
    sourceType === 'bundle'
      ? normalizeRelativeResourcePath(record['entry_file']) ?? DEFAULT_ENTRY_FILE
      : DEFAULT_ENTRY_FILE;

  return {
    source_type: sourceType,
    source_url:
      sourceType === 'url' ? asString(record['source_url'])?.trim() ?? '' : '',
    bundle_root: bundleRoot,
    entry_file: entryFile,
    resource_paths:
      sourceType === 'bundle' && Array.isArray(record['resource_paths'])
        ? dedupeResourcePaths(record['resource_paths'])
        : [],
    display_mode: normalizeDisplayMode(record['display_mode']),
    fixed_ratio: FIXED_RATIO,
    max_height_ratio:
      record['max_height_ratio'] === MAX_HEIGHT_RATIO ? MAX_HEIGHT_RATIO : DEFAULT_CONTENT.max_height_ratio,
  };
}

/**
 * 校验网页卡片内容（08 §2.4.3）：纯函数；`undefined` / `null` 视为未提供配置，
 * 必须返回 `true`。口径：schema 未强制全部字段在 validateConfig 入参出现（空配置
 * 不得拒绝），按「出现即校验」执行——字段缺席不阻断，字段出现则类型与取值必须合法；
 * 非空 `source_url` 须为可打开的 http(s) 地址、bundle 模式入口必须为 `index.html`
 * 且资源清单须包含入口，比 schema（类型约束）更严，属 §7.3 允许的业务补充校验。
 */
export function validateConfig(config: unknown): boolean {
  if (config === undefined || config === null) {
    return true;
  }
  if (typeof config !== 'object' || Array.isArray(config)) {
    return false;
  }
  const record = config as Record<string, unknown>;

  const cardType = record['card_type'];
  if (cardType !== undefined && !CARD_TYPE_ALIASES.includes(cardType as string) && cardType !== CARD_TYPE_ID) {
    return false;
  }

  const sourceType = record['source_type'];
  if (sourceType !== undefined && sourceType !== 'url' && sourceType !== 'bundle') {
    return false;
  }

  const sourceUrl = record['source_url'];
  if (sourceUrl !== undefined) {
    if (typeof sourceUrl !== 'string') {
      return false;
    }
    if (sourceUrl.trim().length > 0 && !analyzeWebpageUrl(sourceUrl).openable) {
      return false;
    }
  }

  const bundleRoot = record['bundle_root'];
  if (bundleRoot !== undefined && typeof bundleRoot !== 'string') {
    return false;
  }
  if (typeof bundleRoot === 'string' && bundleRoot.trim().length > 0 && !normalizeRelativeResourcePath(bundleRoot)) {
    return false;
  }

  const entryFile = record['entry_file'];
  if (entryFile !== undefined && typeof entryFile !== 'string') {
    return false;
  }
  if (sourceType === 'bundle' && typeof entryFile === 'string' && entryFile.trim().length > 0) {
    const normalized = normalizeRelativeResourcePath(entryFile);
    if (normalized !== DEFAULT_ENTRY_FILE) {
      return false;
    }
  }

  const resourcePaths = record['resource_paths'];
  if (resourcePaths !== undefined) {
    if (!Array.isArray(resourcePaths) || resourcePaths.some((item) => typeof item !== 'string')) {
      return false;
    }
    if (
      sourceType === 'bundle' &&
      typeof bundleRoot === 'string' &&
      bundleRoot.trim().length > 0
    ) {
      const root = normalizeRelativeResourcePath(bundleRoot)!;
      const entryPath = `${root}/${DEFAULT_ENTRY_FILE}`;
      const normalizedPaths = dedupeResourcePaths(resourcePaths as string[]);
      if (!normalizedPaths.includes(entryPath)) {
        return false;
      }
    }
  }

  const displayMode = record['display_mode'];
  if (displayMode !== undefined && displayMode !== 'fixed' && displayMode !== 'free') {
    return false;
  }

  const fixedRatio = record['fixed_ratio'];
  if (fixedRatio !== undefined && fixedRatio !== FIXED_RATIO) {
    return false;
  }

  const maxHeightRatio = record['max_height_ratio'];
  if (maxHeightRatio !== undefined && maxHeightRatio !== MAX_HEIGHT_RATIO) {
    return false;
  }

  const theme = record['theme'];
  if (theme !== undefined && typeof theme !== 'string') {
    return false;
  }

  const layout = record['layout'];
  if (layout !== undefined && (typeof layout !== 'object' || layout === null || Array.isArray(layout))) {
    return false;
  }

  return true;
}

// ---------- 内容组装 ----------

/**
 * 由内容模型组装节点内容（与 `createInitialContent` / 编辑器 replace 变更共用）。
 * `card_type` 写正式值；通用字段 `theme` 写入保持空串（§6.1）。
 */
export function buildContent(content: IWebpageContent): Record<string, unknown> {
  return {
    card_type: CARD_TYPE_ID,
    theme: '',
    source_type: content.source_type,
    source_url: content.source_url,
    bundle_root: content.bundle_root,
    entry_file: content.entry_file,
    resource_paths: [...content.resource_paths],
    display_mode: content.display_mode,
    fixed_ratio: content.fixed_ratio,
    max_height_ratio: content.max_height_ratio,
  };
}

// ---------- 视口布局（旧视口同步语义保留，矩阵 L38） ----------

/** 视口下发消息类型（插件内自持协议：宿主侧 → 嵌套页）。 */
export const VIEWPORT_MESSAGE_TYPE = 'chips:webpage-card:viewport';
/** 嵌套页内容高度回报消息类型（嵌套页 → 宿主侧）。 */
export const CONTENT_HEIGHT_MESSAGE_TYPE = 'chips:webpage-card:content-height';
/** 视口变更 DOM 事件名（嵌套页 document 级）。 */
export const VIEWPORT_EVENT = 'chips:webpage-card:viewport-change';
/** 视口载荷全局键（嵌套页 window 级）。 */
export const VIEWPORT_GLOBAL_KEY = '__CHIPS_WEBPAGE_CARD_VIEWPORT__';

/** 固定比例 宽:高 = 7:16。 */
export const FIXED_RATIO_WIDTH = 7;
export const FIXED_RATIO_HEIGHT = 16;

/** 容器量测兜底宽度（结构常量，非视觉令牌）。 */
export const FALLBACK_WIDTH = 640;

/** free 模式最小视口高度（结构常量）。 */
export const MIN_FREE_VIEWPORT_HEIGHT = 160;

/** 嵌入检测超时（超过视为拒绝嵌入/加载失败）。 */
export const EMBED_DETECTION_TIMEOUT_MS = 10_000;

/** 同源可达文档量测轮询间隔。 */
export const MEASURE_INTERVAL_MS = 600;

/** 视口载荷（旧协议载荷形状原样保留）。 */
export interface IWebpageViewportPayload {
  version: 1;
  displayMode: WebpageDisplayMode;
  fixedRatio: typeof FIXED_RATIO;
  width: number;
  height: number;
  baseHeight: number;
  maxHeight: number;
  scrollMode: boolean;
}

function clampViewportNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

/** 归一视口载荷：非法数值钳位、枚举回退，保证跨帧下发形状稳定。 */
export function normalizeViewportPayload(payload: unknown): IWebpageViewportPayload {
  const record = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
  return {
    version: 1,
    displayMode: record['displayMode'] === 'free' ? 'free' : 'fixed',
    fixedRatio: FIXED_RATIO,
    width: clampViewportNumber(record['width']),
    height: clampViewportNumber(record['height']),
    baseHeight: clampViewportNumber(record['baseHeight']),
    maxHeight: clampViewportNumber(record['maxHeight']),
    scrollMode: Boolean(record['scrollMode']),
  };
}

/** fixed 模式视口高度：宽:高 7:16，下限 MIN_FREE_VIEWPORT_HEIGHT。 */
export function calculateFixedViewportHeight(width: number): number {
  return Math.max(MIN_FREE_VIEWPORT_HEIGHT, Math.round((width / FIXED_RATIO_WIDTH) * FIXED_RATIO_HEIGHT));
}

/**
 * 视口布局决策：fixed 固定 7:16 且窗内滚动；free 按内容高度展开、
 * 上限为 `max(baseHeight, width × 20)`、超高转滚动（max_height_ratio 契约常量）。
 */
export function calculateViewportLayout(
  measuredHeight: number,
  width: number,
  content: Pick<IWebpageContent, 'display_mode'>,
  baseHeight: number,
): { height: number; scrollMode: boolean } {
  if (content.display_mode === 'fixed') {
    return {
      height: calculateFixedViewportHeight(width),
      scrollMode: true,
    };
  }

  const normalizedHeight = clampViewportNumber(measuredHeight);
  const maxHeight = Math.max(baseHeight, Math.round(width * MAX_HEIGHT_RATIO));
  if (normalizedHeight <= 0) {
    return {
      height: baseHeight,
      scrollMode: true,
    };
  }

  const shouldScroll = normalizedHeight > maxHeight;
  return {
    height: shouldScroll ? maxHeight : Math.max(baseHeight, normalizedHeight),
    scrollMode: shouldScroll,
  };
}

/** 组装视口载荷（fixed 模式 maxHeight 即 baseHeight）。 */
export function createViewportPayload(
  width: number,
  height: number,
  baseHeight: number,
  content: Pick<IWebpageContent, 'display_mode'>,
  scrollMode: boolean,
): IWebpageViewportPayload {
  const maxHeight = content.display_mode === 'fixed'
    ? baseHeight
    : Math.max(baseHeight, Math.round(width * MAX_HEIGHT_RATIO));
  return normalizeViewportPayload({
    version: 1,
    displayMode: content.display_mode,
    fixedRatio: FIXED_RATIO,
    width,
    height,
    baseHeight,
    maxHeight,
    scrollMode,
  });
}
