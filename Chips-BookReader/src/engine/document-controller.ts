import { AnimationController, EASING } from "./animation-controller";
import { computeLayout } from "./layout-calculator";
import { PaginationEngine } from "./pagination-engine";
import { PositionTracker } from "./position-tracker";
import { ReadiumCssManager } from "./readium-css-manager";
import { ScrollEngine } from "./scroll-engine";
import type {
  AnyEngineEvent,
  DocumentDirectionality,
  EngineEventType,
  EngineOptions,
  NavigationResult,
  PageDirection,
  PageRippleDetail,
  PaginationMetrics,
  ReadingBoundary,
  ReadingMode,
  ReadingPositionAnchor,
  ReadingProgress,
  ScrollBehavior,
  ScrollMetrics,
  SectionKind,
} from "./types";

import { isStyleElementNode, resolveDocumentScrollingElement } from "../utils/dom";

type EventHandler = (event: AnyEngineEvent) => void;

const BOUNDARY_THRESHOLD_RATIO = 0.04;
const MIN_BOUNDARY_THRESHOLD_PX = 24;
const SUB_PIXEL_TOLERANCE = 2;

/** 点击翻页涟漪的自定义事件名（帧内派发，由引擎监听渲染）。 */
export const PAGE_RIPPLE_EVENT = "chips-book-reader:page-ripple";

/** 帧内动画样式注入的 `<style>` 元素 ID。 */
const FRAME_ANIMATION_STYLE_ID = "book-reader-frame-animation";

/** 帧内动画样式资源地址（与 `ReadiumCssManager` 相同的资源加载方式）。 */
const FRAME_ANIMATION_CSS_URL = new URL("../styles/reader-animation.css", import.meta.url).href;

/** 全书边界回弹时长（毫秒）。 */
const BOUNDARY_BOUNCE_DURATION_MS = 120;

/** 全书边界回弹的 overshoot 像素值。 */
const BOUNDARY_BOUNCE_OVERSHOOT_PX = 2;

/** 章节首屏淡入动画的兜底清理时长（毫秒）。 */
const SECTION_ENTRANCE_FALLBACK_MS = 300;

/** 帧内反馈元素（光晕 / 涟漪）的兜底清理时长（毫秒）。 */
const FRAME_FEEDBACK_FALLBACK_MS = 300;

let frameAnimationCssPromise: Promise<string> | null = null;

function loadFrameAnimationCss(): Promise<string> {
  frameAnimationCssPromise ??= fetch(FRAME_ANIMATION_CSS_URL).then(async (response) => {
    if (!response.ok) {
      throw new Error(`加载翻页动画样式失败：${response.status}`);
    }
    return response.text();
  });
  return frameAnimationCssPromise;
}

/** 根据方向性与翻页方向解析光晕显示的物理边缘。 */
function resolveGlowEdge(directionality: DocumentDirectionality, direction: PageDirection): "left" | "right" | "top" | "bottom" {
  if (directionality.isVertical) {
    return direction === "next" ? "bottom" : "top";
  }

  if (directionality.isRtl) {
    return direction === "next" ? "left" : "right";
  }

  return direction === "next" ? "right" : "left";
}

/** 根据方向性与翻页方向解析边界回弹的位移符号（朝翻页视觉方向 overshoot）。 */
function resolveBounceSign(directionality: DocumentDirectionality, direction: PageDirection): 1 | -1 {
  if (directionality.isVertical) {
    return direction === "next" ? -1 : 1;
  }

  return direction === "next" ? (directionality.isRtl ? 1 : -1) : (directionality.isRtl ? -1 : 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function scheduleAnimationFrame(windowRef: Window, callback: () => void): number {
  if (typeof windowRef.requestAnimationFrame === "function") {
    return windowRef.requestAnimationFrame(callback);
  }

  return windowRef.setTimeout(callback, 16);
}

function cancelAnimationFrameSchedule(windowRef: Window, handle: number): void {
  if (typeof windowRef.cancelAnimationFrame === "function") {
    windowRef.cancelAnimationFrame(handle);
    return;
  }

  windowRef.clearTimeout(handle);
}

function waitForAnimationFrame(windowRef: Window): Promise<void> {
  return new Promise((resolve) => {
    scheduleAnimationFrame(windowRef, () => resolve());
  });
}

async function waitForLayoutPasses(document: Document, count = 2): Promise<void> {
  const view = document.defaultView;
  if (!view) {
    return;
  }

  for (let index = 0; index < count; index += 1) {
    await waitForAnimationFrame(view);
  }
}

function normalizeSectionKind(value: string | null | undefined): SectionKind {
  return value === "illustration" || value === "full-page-image" || value === "cover" ? value : "chapter";
}

function findFragmentTarget(document: Document, fragment: string): Element | null {
  const escaped =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(fragment)
      : fragment.replace(/["\\]/g, "\\$&");

  return (
    document.getElementById(fragment) ??
    document.querySelector(`[id="${escaped}"]`) ??
    document.querySelector(`[name="${escaped}"]`)
  );
}

export class DocumentController {
  private readonly cssManager = new ReadiumCssManager();
  private readonly paginationEngine = new PaginationEngine();
  private readonly scrollEngine = new ScrollEngine();
  private readonly positionTracker = new PositionTracker();
  private readonly animationController = new AnimationController();
  private readonly handlers = new Map<EngineEventType, Set<EventHandler>>();

  private resizeObserver: ResizeObserver | null = null;
  private resizeRafHandle: number | null = null;
  private scrollCleanup: (() => void) | null = null;
  private rippleCleanup: (() => void) | null = null;
  private readonly feedbackTimers = new Set<number>();
  private lastSpreadIndex = 0;

  private readonly handlePageRipple = (event: Event): void => {
    if (this.prefersReducedMotion()) {
      return;
    }

    const detail = (event as CustomEvent<PageRippleDetail>).detail;
    if (!detail) {
      return;
    }

    const view = this.document.defaultView;
    const viewportWidth = Math.max(1, this.document.documentElement.clientWidth || view?.innerWidth || 1);
    const viewportHeight = Math.max(1, this.document.documentElement.clientHeight || view?.innerHeight || 1);
    this.createFrameFeedbackElement("book-reader-ripple", {
      left: clamp(detail.x, 0, viewportWidth),
      top: clamp(detail.y, 0, viewportHeight),
    });
  };

  public constructor(
    private readonly document: Document,
    private options: EngineOptions,
  ) {}

  public async mount(): Promise<void> {
    this.attachPageRippleListener();
    await this.cssManager.injectStyles(this.document);
    await this.ensureFrameAnimationStyles();
    this.applyPresentation();
    this.positionTracker.initialize(this.getReadingMode(), this.document, this.getDirectionality());
    this.attachScrollListener();
    this.attachResizeObserver();
    await waitForLayoutPasses(this.document, 2);
    this.alignToViewport("auto");
    this.playSectionEntrance();
    this.emitLayoutChanged();
    this.emitProgressUpdated();
  }

  public destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.scrollCleanup?.();
    this.scrollCleanup = null;
    this.detachPageRippleListener();
    this.animationController.destroy();

    const view = this.document.defaultView;
    for (const timer of this.feedbackTimers) {
      view?.clearTimeout(timer);
    }
    this.feedbackTimers.clear();

    if (this.resizeRafHandle !== null && this.document.defaultView) {
      cancelAnimationFrameSchedule(this.document.defaultView, this.resizeRafHandle);
      this.resizeRafHandle = null;
    }
  }

  public async update(options: EngineOptions): Promise<void> {
    const anchor = this.positionTracker.captureAnchor(this.document, this.getReadingMode(), this.getDirectionality());
    this.options = options;
    await this.cssManager.injectStyles(this.document);
    this.applyPresentation();
    await waitForLayoutPasses(this.document, 1);
    this.restoreAnchor(anchor, "auto");
    this.emitLayoutChanged();
    this.emitProgressUpdated();
  }

  public turnPage(direction: PageDirection): NavigationResult {
    const mode = this.getReadingMode();

    if (mode === "paginated") {
      const metrics = this.getPaginationMetrics();
      const currentOffset = this.readOffset();
      const currentSpreadIndex = this.paginationEngine.resolveSpreadIndex(currentOffset, metrics.spreadAdvancePx);
      const next = this.paginationEngine.computeTargetOffset(currentSpreadIndex, direction, metrics);

      if (next.targetIndex === currentSpreadIndex || Math.abs(next.targetOffset - currentOffset) <= SUB_PIXEL_TOLERANCE) {
        const boundary = direction === "previous" ? "start" : "end";
        this.emitBoundary(boundary, direction);
        if (this.isBookBoundary(boundary)) {
          this.playBoundaryBounce(direction);
        }
        return { moved: false, reachedBoundary: true, boundary };
      }

      this.positionTracker.update(next.targetIndex, metrics, mode);
      this.lastSpreadIndex = next.targetIndex;

      if (this.canUseSlideAnimation()) {
        this.animatePageSlide(next.targetOffset, metrics.spreadWidthPx, direction);
      } else {
        this.writeOffset(next.targetOffset, "smooth");
      }

      this.emitPageChanged(direction, next.targetIndex, metrics.spreadCount);
      this.playPageGlow(direction);
      this.emitProgressUpdated();
      return { moved: true, reachedBoundary: false };
    }

    const metrics = this.getScrollMetrics();
    const delta = metrics.viewportSize * (direction === "next" ? 1 : -1);
    const next = this.scrollEngine.computeScrollTarget(metrics.scrollOffset, delta, metrics.maxScrollOffset);
    if (Math.abs(next.target - metrics.scrollOffset) <= 1) {
      const boundary = next.reachedBoundary ?? (direction === "previous" ? "start" : "end");
      this.emitBoundary(boundary, direction);
      if (this.isBookBoundary(boundary)) {
        this.playBoundaryBounce(direction);
      }
      return { moved: false, reachedBoundary: true, boundary };
    }

    this.writeOffset(next.target, "smooth");
    this.positionTracker.update(0, {
      ...metrics,
      scrollOffset: next.target,
      scrollFraction: this.scrollEngine.computeScrollFraction(next.target, metrics.maxScrollOffset),
    }, mode);
    this.emitScrollChanged(this.scrollEngine.computeScrollFraction(next.target, metrics.maxScrollOffset));
    this.playPageGlow(direction);
    this.emitProgressUpdated();
    return {
      moved: true,
      reachedBoundary: next.reachedBoundary !== null,
      boundary: next.reachedBoundary ?? undefined,
    };
  }

  public scrollBy(deltaPx: number): NavigationResult {
    if (this.getReadingMode() !== "scroll") {
      return this.turnPage(deltaPx >= 0 ? "next" : "previous");
    }

    const metrics = this.getScrollMetrics();
    const next = this.scrollEngine.computeScrollTarget(metrics.scrollOffset, deltaPx, metrics.maxScrollOffset);
    if (Math.abs(next.target - metrics.scrollOffset) <= 1) {
      const boundary = next.reachedBoundary ?? (deltaPx < 0 ? "start" : "end");
      this.emitBoundary(boundary, deltaPx < 0 ? "previous" : "next");
      return { moved: false, reachedBoundary: true, boundary };
    }

    this.writeOffset(next.target, "auto");
    this.positionTracker.update(0, {
      ...metrics,
      scrollOffset: next.target,
      scrollFraction: this.scrollEngine.computeScrollFraction(next.target, metrics.maxScrollOffset),
    }, "scroll");
    this.emitScrollChanged(this.scrollEngine.computeScrollFraction(next.target, metrics.maxScrollOffset));
    this.emitProgressUpdated();
    return {
      moved: true,
      reachedBoundary: next.reachedBoundary !== null,
      boundary: next.reachedBoundary ?? undefined,
    };
  }

  public goToSpread(spreadIndex: number, behavior: ScrollBehavior = "auto"): void {
    const metrics = this.getPaginationMetrics();
    const targetOffset = this.paginationEngine.computeOffsetForSpread(
      spreadIndex,
      metrics.spreadAdvancePx,
      metrics.maxScrollOffset,
    );

    this.writeOffset(targetOffset, behavior);
    const nextSpreadIndex = this.paginationEngine.resolveSpreadIndex(targetOffset, metrics.spreadAdvancePx);
    this.positionTracker.update(nextSpreadIndex, metrics, "paginated");
    this.lastSpreadIndex = nextSpreadIndex;
    this.emitProgressUpdated();
  }

  public goToBoundary(boundary: ReadingBoundary, behavior: ScrollBehavior = "smooth"): void {
    const mode = this.getReadingMode();
    const targetOffset =
      mode === "paginated"
        ? this.paginationEngine.computeOffsetForBoundary(boundary, this.getPaginationMetrics())
        : this.scrollEngine.computeBoundaryOffset(boundary, this.getScrollMetrics().maxScrollOffset);

    this.writeOffset(targetOffset, behavior);
    this.syncTrackerFromDocument();
    this.emitProgressUpdated();
  }

  public async goToFragment(fragment?: string): Promise<void> {
    if (!fragment) {
      this.goToBoundary("start", "auto");
      return;
    }

    const target = findFragmentTarget(this.document, fragment);
    if (!target) {
      this.goToBoundary("start", "auto");
      return;
    }

    if (this.getReadingMode() === "paginated") {
      const metrics = this.getPaginationMetrics();
      const targetSpread = this.paginationEngine.resolveFragmentSpread(target, metrics.spreadAdvancePx);
      this.goToSpread(targetSpread, "auto");
      return;
    }

    const targetOffset = this.scrollEngine.resolveFragmentOffset(target, this.getDirectionality());
    this.writeOffset(targetOffset, "auto");
    this.syncTrackerFromDocument();
    this.emitProgressUpdated();
  }

  public goToProgress(fraction: number, behavior: ScrollBehavior = "auto"): void {
    const normalizedFraction = clamp(fraction, 0, 1);
    if (this.getReadingMode() === "paginated") {
      const metrics = this.getPaginationMetrics();
      const spreadIndex =
        metrics.spreadCount > 1 ? Math.round(normalizedFraction * (metrics.spreadCount - 1)) : 0;
      this.goToSpread(spreadIndex, behavior);
      return;
    }

    const metrics = this.getScrollMetrics();
    const targetOffset = Math.round(normalizedFraction * metrics.maxScrollOffset);
    this.writeOffset(targetOffset, behavior);
    this.syncTrackerFromDocument();
    this.emitProgressUpdated();
  }

  public isAtBoundary(direction: PageDirection): boolean {
    if (this.getReadingMode() === "paginated") {
      return this.paginationEngine.isAtBoundary(this.readOffset(), this.getPaginationMetrics(), direction);
    }

    const metrics = this.getScrollMetrics();
    return this.scrollEngine.isAtBoundary(metrics, direction === "previous" ? "start" : "end");
  }

  public isNearBoundary(direction: PageDirection): boolean {
    if (this.getReadingMode() === "scroll") {
      return this.scrollEngine.isNearBoundary(this.getScrollMetrics(), direction);
    }

    const metrics = this.getPaginationMetrics();
    const threshold = Math.max(
      MIN_BOUNDARY_THRESHOLD_PX,
      Math.round(metrics.spreadWidthPx * BOUNDARY_THRESHOLD_RATIO),
    );
    const currentOffset = this.readOffset();

    if (direction === "previous") {
      return currentOffset <= threshold;
    }

    return currentOffset >= Math.max(0, metrics.maxScrollOffset - threshold);
  }

  public getProgress(): ReadingProgress {
    const section = this.options.section;
    return this.positionTracker.computeProgress(
      section?.index ?? 0,
      section?.count ?? 1,
      section?.title ?? "",
      section?.weights,
    );
  }

  public getReadingMode(): ReadingMode {
    return this.options.preferences.readingMode;
  }

  public getCurrentAnchor(): ReadingPositionAnchor {
    return this.positionTracker.getCurrentAnchor();
  }

  public on(event: EngineEventType, handler: (event: AnyEngineEvent) => void): () => void {
    const bucket = this.handlers.get(event) ?? new Set<EventHandler>();
    bucket.add(handler);
    this.handlers.set(event, bucket);

    return () => {
      bucket.delete(handler);
      if (bucket.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  private getDirectionality(): DocumentDirectionality {
    return this.cssManager.resolveDirectionality(this.document);
  }

  private getLayout() {
    return computeLayout({
      viewportWidth: this.document.documentElement.clientWidth || this.document.defaultView?.innerWidth || 0,
      viewportHeight: this.document.documentElement.clientHeight || this.document.defaultView?.innerHeight || 0,
      preferredContentWidth: this.options.preferences.contentWidth,
      readingMode: this.options.preferences.readingMode,
      sectionKind: normalizeSectionKind(this.document.body?.dataset.sectionKind),
      fontScale: this.options.preferences.fontScale,
    });
  }

  private applyPresentation(): void {
    this.cssManager.applySettings(this.document, this.options, this.getLayout());
  }

  // ─── 翻页视觉反馈（光晕 / 涟漪 / 回弹 / 章节淡入 / 滑入动画） ──────

  private attachPageRippleListener(): void {
    this.detachPageRippleListener();
    this.document.addEventListener(PAGE_RIPPLE_EVENT, this.handlePageRipple);
    this.rippleCleanup = () => {
      this.document.removeEventListener(PAGE_RIPPLE_EVENT, this.handlePageRipple);
    };
  }

  private detachPageRippleListener(): void {
    this.rippleCleanup?.();
    this.rippleCleanup = null;
  }

  /**
   * 将翻页动画样式注入帧内文档（与宿主共用 `reader-animation.css` 单一来源）。
   *
   * 注入失败时静默降级为无动画翻页，不阻断阅读流程。
   */
  private async ensureFrameAnimationStyles(): Promise<void> {
    const head = this.document.head;
    if (!head) {
      return;
    }

    const existing = this.document.getElementById(FRAME_ANIMATION_STYLE_ID);
    if (isStyleElementNode(existing)) {
      return;
    }

    try {
      const cssText = await loadFrameAnimationCss();
      const styleElement = this.document.createElement("style");
      styleElement.id = FRAME_ANIMATION_STYLE_ID;
      styleElement.type = "text/css";
      styleElement.textContent = cssText;
      head.appendChild(styleElement);
    } catch {
      // 样式资源不可用时保持现有翻页行为
    }
  }

  /** 新章节首屏 200ms 淡入 + 4px 上移复原（换 iframe 时消除硬切感）。 */
  private playSectionEntrance(): void {
    const body = this.document.body;
    const view = this.document.defaultView;
    if (!body || !view) {
      return;
    }

    body.classList.add("book-reader-sectionEnter");

    let removed = false;
    const remove = (): void => {
      if (removed) {
        return;
      }

      removed = true;
      view.clearTimeout(timer);
      this.feedbackTimers.delete(timer);
      body.classList.remove("book-reader-sectionEnter");
    };

    const handleAnimationEnd = (event: AnimationEvent): void => {
      if (event.animationName === "book-reader-section-enter") {
        remove();
      }
    };

    const timer = view.setTimeout(remove, SECTION_ENTRANCE_FALLBACK_MS);
    this.feedbackTimers.add(timer);
    body.addEventListener("animationend", handleAnimationEnd, { once: true });
  }

  /** 翻页方向光晕：对应边缘 4px 高亮弧线 180ms 淡出，并派发光晕触发事件。 */
  private playPageGlow(direction: PageDirection): void {
    if (this.prefersReducedMotion()) {
      return;
    }

    const edge = resolveGlowEdge(this.getDirectionality(), direction);
    this.createFrameFeedbackElement(`book-reader-glow book-reader-glow--${edge}`);
    this.emitPageGlow(direction);
  }

  /** 全书开头 / 结尾边界回弹：沿翻页方向 2px overshoot 后 120ms 弹回。 */
  private playBoundaryBounce(direction: PageDirection): void {
    const body = this.document.body;
    if (this.prefersReducedMotion() || !body) {
      return;
    }

    body.classList.remove("book-reader-sectionEnter");
    const directionality = this.getDirectionality();
    const sign = resolveBounceSign(directionality, direction);
    this.animationController.animateTransform({
      element: body,
      axis: directionality.isVertical ? "y" : "x",
      from: BOUNDARY_BOUNCE_OVERSHOOT_PX * sign,
      to: 0,
      duration: BOUNDARY_BOUNCE_DURATION_MS,
      easing: EASING.easeOutBack,
    });
  }

  /** 是否为全书级边界（章节索引位于全书首尾）。 */
  private isBookBoundary(boundary: ReadingBoundary): boolean {
    const section = this.options.section;
    if (!section) {
      return false;
    }

    return boundary === "start" ? section.index === 0 : section.index >= section.count - 1;
  }

  /** 滑入翻页动画的落位协调：当前内容位移 + 淡出后，落位 scroll 并归位 transform。 */
  private animatePageSlide(targetOffset: number, viewportSize: number, direction: PageDirection): void {
    const body = this.document.body;
    if (!body) {
      this.writeOffset(targetOffset, "smooth");
      return;
    }

    body.classList.remove("book-reader-sectionEnter");
    body.classList.add("book-reader-sliding");
    this.animationController.animateSlide({
      element: body,
      scrollElement: resolveDocumentScrollingElement(this.document),
      toOffset: targetOffset,
      viewportSize,
      direction,
      onComplete: () => {
        body.classList.remove("book-reader-sliding");
      },
      onCancel: () => {
        body.classList.remove("book-reader-sliding");
      },
    });
  }

  /** 是否启用 L2 滑入翻页（分页模式，排除竖排 / RTL / 减弱动效偏好）。 */
  private canUseSlideAnimation(): boolean {
    if (this.getReadingMode() !== "paginated" || !this.document.body) {
      return false;
    }

    const directionality = this.getDirectionality();
    if (directionality.isVertical || directionality.isRtl) {
      return false;
    }

    return !this.prefersReducedMotion();
  }

  private prefersReducedMotion(): boolean {
    const view = this.document.defaultView;
    return Boolean(
      view && typeof view.matchMedia === "function" && view.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }

  /** 在帧内渲染一次性反馈元素（固定定位，挂在根元素下避免受内容层 transform 影响）。 */
  private createFrameFeedbackElement(className: string, position?: { left: number; top: number }): void {
    const view = this.document.defaultView;
    const root = this.document.documentElement;
    if (!view || !root) {
      return;
    }

    const element = this.document.createElement("div");
    element.className = className;
    if (position) {
      element.style.left = `${Math.round(position.left)}px`;
      element.style.top = `${Math.round(position.top)}px`;
    }
    root.appendChild(element);

    let removed = false;
    const remove = (): void => {
      if (removed) {
        return;
      }

      removed = true;
      view.clearTimeout(timer);
      this.feedbackTimers.delete(timer);
      element.remove();
    };

    const timer = view.setTimeout(remove, FRAME_FEEDBACK_FALLBACK_MS);
    this.feedbackTimers.add(timer);
    element.addEventListener("animationend", remove, { once: true });
  }

  private attachResizeObserver(): void {
    const view = this.document.defaultView;
    if (!view || typeof view.ResizeObserver !== "function" || this.resizeObserver) {
      return;
    }

    this.resizeObserver = new view.ResizeObserver(() => {
      if (this.resizeRafHandle !== null) {
        return;
      }

      const anchor = this.positionTracker.captureAnchor(this.document, this.getReadingMode(), this.getDirectionality());
      this.resizeRafHandle = scheduleAnimationFrame(view, async () => {
        this.resizeRafHandle = null;
        this.applyPresentation();
        await waitForLayoutPasses(this.document, 1);
        this.restoreAnchor(anchor, "auto");
        this.emitLayoutChanged();
        this.emitProgressUpdated();
      });
    });
    this.resizeObserver.observe(this.document.documentElement);
  }

  private attachScrollListener(): void {
    const scrollElement = resolveDocumentScrollingElement(this.document);
    const handleScroll = () => {
      this.syncTrackerFromDocument();
      this.emitProgressUpdated();
    };

    scrollElement.addEventListener("scroll", handleScroll, { passive: true });
    this.scrollCleanup = () => {
      scrollElement.removeEventListener("scroll", handleScroll);
    };
  }

  private getPaginationMetrics(): PaginationMetrics {
    const metrics = this.paginationEngine.measure(this.document, this.getDirectionality());
    metrics.currentSpreadIndex = this.paginationEngine.resolveSpreadIndex(this.readOffset(), metrics.spreadAdvancePx);
    return metrics;
  }

  private getScrollMetrics(): ScrollMetrics {
    return this.scrollEngine.measure(this.document, this.getDirectionality());
  }

  private readOffset(): number {
    const scrollElement = resolveDocumentScrollingElement(this.document);
    const directionality = this.getDirectionality();
    const mode = this.getReadingMode();

    if (mode === "paginated") {
      if (directionality.isVertical) {
        return Math.max(0, scrollElement.scrollTop);
      }

      return Math.max(0, Math.abs(scrollElement.scrollLeft));
    }

    if (directionality.isVertical) {
      return Math.max(0, Math.abs(scrollElement.scrollLeft));
    }

    return Math.max(0, scrollElement.scrollTop);
  }

  private writeOffset(value: number, behavior: ScrollBehavior): void {
    const scrollElement = resolveDocumentScrollingElement(this.document);
    const directionality = this.getDirectionality();
    const mode = this.getReadingMode();
    const target = Math.max(0, value);

    if (mode === "paginated" && behavior === "smooth") {
      const axis = directionality.isVertical ? "y" : "x";
      this.animationController.animateScroll({
        element: scrollElement,
        from: this.readOffset(),
        to: target,
        axis,
        isRtl: directionality.isRtl,
      });
      return;
    }

    this.animationController.cancel();
    if (mode === "paginated") {
      if (directionality.isVertical) {
        scrollElement.scrollTo({ top: target, behavior });
        return;
      }

      scrollElement.scrollTo({
        left: directionality.isRtl ? -target : target,
        behavior,
      });
      return;
    }

    if (directionality.isVertical) {
      scrollElement.scrollTo({
        left: directionality.isRtl ? -target : target,
        behavior,
      });
      return;
    }

    scrollElement.scrollTo({ top: target, behavior });
  }

  private restoreAnchor(anchor: ReadingPositionAnchor, behavior: ScrollBehavior): void {
    const targetOffset = this.positionTracker.restoreAnchor(
      anchor,
      this.document,
      this.getReadingMode(),
      this.getDirectionality(),
    );
    this.writeOffset(targetOffset, behavior);
    this.syncTrackerFromDocument();
  }

  private alignToViewport(behavior: ScrollBehavior): void {
    if (this.getReadingMode() !== "paginated") {
      return;
    }

    const metrics = this.getPaginationMetrics();
    const targetOffset = clamp(
      this.paginationEngine.snapToSpread(this.readOffset(), metrics.spreadAdvancePx),
      0,
      metrics.maxScrollOffset,
    );
    this.writeOffset(targetOffset, behavior);
    this.syncTrackerFromDocument();
  }

  private syncTrackerFromDocument(): void {
    if (this.getReadingMode() === "paginated") {
      const metrics = this.getPaginationMetrics();
      const spreadIndex = this.paginationEngine.resolveSpreadIndex(this.readOffset(), metrics.spreadAdvancePx);
      this.positionTracker.update(spreadIndex, metrics, "paginated");

      if (spreadIndex !== this.lastSpreadIndex) {
        const direction: PageDirection = spreadIndex > this.lastSpreadIndex ? "next" : "previous";
        this.lastSpreadIndex = spreadIndex;
        this.emitPageChanged(direction, spreadIndex, metrics.spreadCount);
      }
      return;
    }

    const metrics = this.getScrollMetrics();
    this.positionTracker.update(0, metrics, "scroll");
    this.emitScrollChanged(metrics.scrollFraction);
  }

  private emit<K extends EngineEventType>(type: K, event: Extract<AnyEngineEvent, { type: K }>): void {
    const bucket = this.handlers.get(type);
    if (!bucket || bucket.size === 0) {
      return;
    }

    for (const handler of bucket) {
      handler(event);
    }
  }

  private emitPageChanged(direction: PageDirection, spreadIndex: number, totalSpreads: number): void {
    this.emit("page-changed", {
      type: "page-changed",
      timestamp: performance.now(),
      direction,
      spreadIndex,
      totalSpreads,
    });
  }

  private emitScrollChanged(scrollFraction: number): void {
    this.emit("scroll-changed", {
      type: "scroll-changed",
      timestamp: performance.now(),
      scrollFraction,
    });
  }

  private emitLayoutChanged(): void {
    this.emit("layout-changed", {
      type: "layout-changed",
      timestamp: performance.now(),
    });
  }

  private emitBoundary(boundary: ReadingBoundary, direction: PageDirection): void {
    this.emit("boundary-reached", {
      type: "boundary-reached",
      timestamp: performance.now(),
      boundary,
      direction,
    });
  }

  private emitPageGlow(direction: PageDirection): void {
    this.emit("page-glow", {
      type: "page-glow",
      timestamp: performance.now(),
      direction,
    });
  }

  private emitProgressUpdated(): void {
    this.emit("progress-updated", {
      type: "progress-updated",
      timestamp: performance.now(),
      progress: this.getProgress(),
    });
  }
}
