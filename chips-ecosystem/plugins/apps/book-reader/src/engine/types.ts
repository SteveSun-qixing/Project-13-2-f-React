/**
 * 渲染引擎层公共类型系统。
 *
 * 本文件为分页引擎、滚动引擎、CSS 管理器、布局计算器、位置追踪器、
 * 动画控制器和文档控制器提供统一的类型契约。
 *
 * 仅包含纯类型定义，不包含任何运行时实现。
 */

// ─── 方向与边界 ───────────────────────────────────────────────

/** 翻页方向。 */
export type PageDirection = 'previous' | 'next';

/** 阅读边界位置。 */
export type ReadingBoundary = 'start' | 'end';

/** 阅读模式。 */
export type ReadingMode = 'paginated' | 'scroll';

// ─── 滚动行为 ─────────────────────────────────────────────────

/** 滚动行为，用于 `scrollTo` 等 DOM API 的 `behavior` 参数。 */
export type ScrollBehavior = 'auto' | 'smooth';

// ─── 文档方向性 ───────────────────────────────────────────────

/** 文档书写方向和文本方向信息。 */
export interface DocumentDirectionality {
  /** 是否为竖排书写模式（如 CJK 竖排）。 */
  isVertical: boolean;
  /** 是否为右到左文本方向（如阿拉伯文、希伯来文）。 */
  isRtl: boolean;
}

// ─── 视口度量 ─────────────────────────────────────────────────

/** iframe 视口的尺寸度量信息。 */
export interface ViewportMetrics {
  /** iframe 可视宽度（`clientWidth`）。 */
  viewportWidth: number;
  /** iframe 可视高度（`clientHeight`）。 */
  viewportHeight: number;
  /** 内容总宽度（`scrollWidth`）。 */
  scrollWidth: number;
  /** 内容总高度（`scrollHeight`）。 */
  scrollHeight: number;
  /** 布局宽度，含边框（`offsetWidth`）。 */
  offsetWidth: number;
  /** 布局高度，含边框（`offsetHeight`）。 */
  offsetHeight: number;
}

// ─── 分页度量 ─────────────────────────────────────────────────

/** 分页模式下的度量信息，由 `PaginationEngine.measure()` 产出。 */
export interface PaginationMetrics {
  /**
   * CSS column 产生的总列数。
   *
   * 注意：CSS column 是自动分配的，此值为估算值。
   */
  totalColumns: number;
  /** 每个 spread 包含的列数（1 或 2）。 */
  columnsPerSpread: number;
  /** spread 总数。最后一个 spread 可能不满。 */
  spreadCount: number;
  /** 当前 spread 索引，由调用方在使用时填充。 */
  currentSpreadIndex: number;
  /** 每个 spread 的像素宽度，等于 `scrollingElement.offsetWidth`。 */
  spreadWidthPx: number;
  /** 每次翻页的实际推进步长；双页 spread 时 = `spreadWidthPx + columnGapPx`。 */
  spreadAdvancePx: number;
  /** 每列的像素宽度。 */
  columnWidthPx: number;
  /** 列间距像素值。 */
  columnGapPx: number;
  /** 总可滚动宽度（`scrollWidth`）。 */
  totalScrollableWidth: number;
  /** 最大可滚动偏移量（`scrollWidth - offsetWidth`）。 */
  maxScrollOffset: number;
}

// ─── 滚动度量 ─────────────────────────────────────────────────

/** 滚动模式下的度量信息，由 `ScrollEngine.measure()` 产出。 */
export interface ScrollMetrics {
  /** 当前滚动位置（纵向为 `scrollTop`，竖排为 `|scrollLeft|`）。 */
  scrollOffset: number;
  /** 最大可滚动偏移。 */
  maxScrollOffset: number;
  /** 可视区域尺寸（纵向为 `clientHeight`，竖排为 `clientWidth`）。 */
  viewportSize: number;
  /** 内容总尺寸（纵向为 `scrollHeight`，竖排为 `scrollWidth`）。 */
  contentSize: number;
  /** 滚动进度，0–1 之间线性分布。 */
  scrollFraction: number;
}

// ─── 阅读位置锚点 ─────────────────────────────────────────────

/**
 * 阅读位置锚点，用于位置记录与窗口缩放后的位置恢复。
 *
 * 锚点不持有 DOM 引用，可安全地跨布局周期传递。
 */
export interface ReadingPositionAnchor {
  /** 当前 spread 索引（仅分页模式有意义；滚动模式置 0）。 */
  spreadIndex: number;
  /** 在总 spread 中的比例 0–1（用于缩放后映射到新 spread 数量）。 */
  spreadFraction: number;
  /** 通用滚动进度 0–1（分页模式为 `scrollLeft / maxScroll`，滚动模式为 `scrollTop / maxScroll`）。 */
  scrollFraction: number;
}

// ─── 分页快照（用于窗口缩放恢复） ─────────────────────────────

/** 分页状态快照，在 resize 前捕获、resize 后用于恢复。 */
export interface PaginationSnapshot {
  /** 当前像素偏移。 */
  offset: number;
  /** 当前 spread 宽度。 */
  spreadWidth: number;
  /** 当前最大偏移。 */
  maxOffset: number;
  /** 当前 spread 索引。 */
  spreadIndex: number;
  /** 总 spread 数。 */
  totalSpreads: number;
}

// ─── 阅读进度信息 ─────────────────────────────────────────────

/** 阅读进度，同时覆盖章节内进度和全书进度。 */
export interface ReadingProgress {
  /** 当前阅读模式。 */
  readingMode: ReadingMode;
  /** 当前章节索引（从 0 开始）。 */
  sectionIndex: number;
  /** 总章节数。 */
  sectionCount: number;
  /** 当前章节标题。 */
  sectionTitle: string;
  /** 章节内进度 0–1。 */
  sectionFraction: number;
  /** 全书进度 0–1。 */
  bookFraction: number;
  /** 全书进度百分比（0–100）。 */
  bookPercentage: number;
  /** 当前页码（章节内，从 1 开始；仅分页模式有意义）。 */
  currentPage: number;
  /** 总页数（章节内；仅分页模式有意义）。 */
  totalPages: number;
}

// ─── 章节版式类型 ─────────────────────────────────────────────

/** 章节版式类型，影响布局策略和渲染方式。 */
export type SectionKind = 'chapter' | 'illustration' | 'full-page-image' | 'cover';

// ─── 响应式布局结果 ───────────────────────────────────────────

/** 窗口断点，用于布局策略分层。 */
export type WindowBreakpoint = 'compact' | 'medium' | 'expanded' | 'large';

/** 响应式布局计算结果，由 `LayoutCalculator` 产出。 */
export interface ResponsiveLayout {
  /** 强制列数（"1" 或 "2"），对应 ReadiumCSS `--USER__colCount`。 */
  forcedColCount: '1' | '2';
  /** 单页宽度（单列模式下即内容区宽度，双列模式下为单列宽度）。 */
  pageWidthPx: number;
  /** 页边距像素值。 */
  pageGutterPx: number;
  /** 列间距像素值（仅双列模式 > 0）。 */
  columnGapPx: number;
  /** 最大行长像素值（`--RS__maxLineLength`）。 */
  maxLineLengthPx: number;
  /** 插图宽度像素值。 */
  illustrationWidthPx: number;
  /** 是否使用双页 spread 布局。 */
  shouldUseSpread: boolean;
  /** 整个 spread 的像素宽度，对应分页引擎的视口单位。 */
  spreadWidthPx: number;
  /** 去除页边距后的有效内容宽度。 */
  effectiveContentWidth: number;
  /** 当前窗口所属断点区间。 */
  windowBreakpoint: WindowBreakpoint;
  /** 章节内容的建议上下留白。 */
  verticalPadding: {
    top: number;
    bottom: number;
  };
}

// ─── 引擎事件 ─────────────────────────────────────────────────

/** 引擎事件类型枚举。 */
export type EngineEventType =
  | 'page-changed'
  | 'scroll-changed'
  | 'layout-changed'
  | 'boundary-reached'
  | 'page-glow'
  | 'progress-updated';

/** 引擎事件基接口。 */
export interface EngineEvent {
  /** 事件类型。 */
  type: EngineEventType;
  /** 事件产生的时间戳（`performance.now()`）。 */
  timestamp: number;
}

/** 翻页事件（分页模式下 spread 发生了变化）。 */
export interface PageChangedEvent extends EngineEvent {
  type: 'page-changed';
  /** 翻页方向。 */
  direction: PageDirection;
  /** 翻页后的 spread 索引。 */
  spreadIndex: number;
  /** 总 spread 数。 */
  totalSpreads: number;
}

/** 滚动位置变化事件（滚动模式下发出）。 */
export interface ScrollChangedEvent extends EngineEvent {
  type: 'scroll-changed';
  /** 当前滚动进度 0–1。 */
  scrollFraction: number;
}

/** 布局变化事件（窗口缩放或偏好变化导致布局重新计算）。 */
export interface LayoutChangedEvent extends EngineEvent {
  type: 'layout-changed';
}

/** 到达章节边界事件（翻页或滚动到达章节首尾）。 */
export interface BoundaryReachedEvent extends EngineEvent {
  type: 'boundary-reached';
  /** 到达的边界位置。 */
  boundary: ReadingBoundary;
  /** 触发边界的操作方向。 */
  direction: PageDirection;
}

/** 翻页方向光晕触发事件（翻页瞬间在对应边缘显示高亮弧线）。 */
export interface PageGlowEvent extends EngineEvent {
  type: 'page-glow';
  /** 与光晕显示边缘对应的翻页方向。 */
  direction: PageDirection;
}

/** 点击翻页涟漪的自定义事件负载（帧内派发，由引擎监听渲染）。 */
export interface PageRippleDetail {
  /** 点击触发的翻页方向。 */
  direction: PageDirection;
  /** 点击位置在视口中的横坐标。 */
  x: number;
  /** 点击位置在视口中的纵坐标。 */
  y: number;
}

/** 阅读进度更新事件。 */
export interface ProgressUpdatedEvent extends EngineEvent {
  type: 'progress-updated';
  /** 最新的阅读进度信息。 */
  progress: ReadingProgress;
}

/** 所有引擎事件的联合类型。 */
export type AnyEngineEvent =
  | PageChangedEvent
  | ScrollChangedEvent
  | LayoutChangedEvent
  | BoundaryReachedEvent
  | PageGlowEvent
  | ProgressUpdatedEvent;

// ─── 主题色板（复用 EpubThemePalette） ────────────────────────

export type { EpubThemePalette } from '../domain/epub/types';

// ─── 阅读偏好（复用） ────────────────────────────────────────

export type {
  ReaderPreferences,
  ReaderReadingMode,
  ReaderBackgroundTone,
} from '../core/book-model';

/** 阅读器字体族类型。 */
export type ReaderFontFamily = 'serif' | 'sans';

// ─── 引擎配置 ─────────────────────────────────────────────────

/**
 * 引擎配置，在 `DocumentController` 初始化和 `update()` 时传入。
 *
 * 将阅读偏好和主题色板打包传递，避免引擎层直接依赖 React 状态。
 */
export interface EngineOptions {
  /** 当前阅读偏好。 */
  preferences: import('../core/book-model').ReaderPreferences;
  /** 当前主题色板。 */
  theme: import('../domain/epub/types').EpubThemePalette;
  /** 当前章节上下文，用于进度计算。 */
  section?:
    | {
        index: number;
        count: number;
        title: string;
        weights?: number[] | undefined;
      }
    | undefined;
}

// ─── 导航结果 ─────────────────────────────────────────────────

/** 翻页或滚动操作的返回结果。 */
export interface NavigationResult {
  /** 是否发生了有效移动。 */
  moved: boolean;
  /** 是否到达了章节边界。 */
  reachedBoundary: boolean;
  /** 到达了哪个边界（仅当 `reachedBoundary` 为 `true` 时有值）。 */
  boundary?: ReadingBoundary | undefined;
}

// ─── ReadiumCSS 相关类型 ──────────────────────────────────────

/** ReadiumCSS 配置 profile。 */
export type ReadiumProfile = 'default' | 'rtl' | 'cjk-horizontal' | 'cjk-vertical';

/** ReadiumCSS 样式模块位置。 */
export type ReadiumStyleMod = 'before' | 'default' | 'after';
