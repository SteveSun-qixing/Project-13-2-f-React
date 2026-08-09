interface CurrentAnimation {
  cancel: () => void;
}

export type EasingFunction = (time: number) => number;

export interface AnimationOptions {
  duration: number;
  easing: EasingFunction;
  minDuration: number;
  maxDuration: number;
}

/**
 * 构造 cubic-bezier 缓动函数（CSS `cubic-bezier()` 的 JS 等价实现）。
 *
 * 使用牛顿迭代求解参数曲线上的点，供 JS 驱动的动画复用与 CSS 相同的缓动曲线。
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  const a = (p1: number, p2: number): number => 1 - 3 * p2 + 3 * p1;
  const b = (p1: number, p2: number): number => 3 * p2 - 6 * p1;
  const c = (p: number): number => 3 * p;
  const sample = (t: number, p1: number, p2: number): number =>
    (a(p1, p2) * t + b(p1, p2)) * t * t + c(p1) * t;
  const slope = (t: number, p1: number, p2: number): number =>
    3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1);

  return (time: number): number => {
    if (time <= 0) {
      return 0;
    }
    if (time >= 1) {
      return 1;
    }

    let t = time;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const currentSlope = slope(t, x1, x2);
      if (currentSlope === 0) {
        break;
      }

      const x = sample(t, x1, x2) - time;
      if (Math.abs(x) < 1e-6) {
        break;
      }

      t -= x / currentSlope;
    }

    return sample(Math.min(1, Math.max(0, t)), y1, y2);
  };
}

export const EASING = {
  easeOutCubic: (time: number) => 1 - Math.pow(1 - time, 3),
  easeInOutCubic: (time: number) =>
    time < 0.5 ? 4 * time * time * time : 1 - Math.pow(-2 * time + 2, 3) / 2,
  easeOutBack: (time: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(time - 1, 3) + c1 * Math.pow(time - 1, 2);
  },
  linear: (time: number) => time,
  /** 滑入翻页共享缓动 `cubic-bezier(0.22, 0.61, 0.36, 1)`。 */
  slide: cubicBezier(0.22, 0.61, 0.36, 1),
} as const;

// ─── 滑入翻页动画参数 ──────────────────────────────────────────

/** 当前页退出位移比例（相对视口宽度）。 */
const SLIDE_EXIT_RATIO = 0.3;
/** 目标页入场初始位移比例（相对视口宽度）。 */
const SLIDE_ENTER_RATIO = 0.08;
/** 当前页位移 + 淡出时长。 */
const SLIDE_EXIT_DURATION_MS = 180;
/** 目标页滑入 + 淡入时长。 */
const SLIDE_ENTER_DURATION_MS = 220;
/** 落位近零判定容差（像素）。 */
const SLIDE_SETTLE_TOLERANCE_PX = 2;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function writeScroll(element: Element, value: number, axis: "x" | "y", isRtl = false): void {
  const target = Math.max(0, value);
  const signedValue = axis === "x" && isRtl ? -target : target;

  if ("scrollTo" in element && typeof element.scrollTo === "function") {
    if (axis === "x") {
      element.scrollTo({ left: signedValue, behavior: "auto" });
      return;
    }

    element.scrollTo({ top: signedValue, behavior: "auto" });
    return;
  }

  const htmlElement = element as HTMLElement;
  if (axis === "x") {
    htmlElement.scrollLeft = signedValue;
    return;
  }

  htmlElement.scrollTop = signedValue;
}

export class AnimationController {
  private readonly options: AnimationOptions;
  private currentAnimation: CurrentAnimation | null = null;

  public constructor(options?: Partial<AnimationOptions>) {
    this.options = {
      duration: options?.duration ?? 280,
      easing: options?.easing ?? EASING.easeOutCubic,
      minDuration: options?.minDuration ?? 120,
      maxDuration: options?.maxDuration ?? 450,
    };
  }

  public animateScroll(params: {
    element: Element;
    from: number;
    to: number;
    axis: "x" | "y";
    isRtl?: boolean;
    onComplete?: () => void;
    onCancel?: () => void;
  }): void {
    this.cancel();

    const distance = Math.abs(params.to - params.from);
    if (distance < 2) {
      writeScroll(params.element, params.to, params.axis, params.isRtl);
      params.onComplete?.();
      return;
    }

    const duration = clamp(
      this.options.duration * Math.max(0.4, Math.min(1.3, distance / 1440)),
      this.options.minDuration,
      this.options.maxDuration,
    );
    const startTime = performance.now();
    let rafId = 0;
    let finished = false;

    const finish = (cancelled: boolean): void => {
      if (finished) {
        return;
      }

      finished = true;
      writeScroll(params.element, params.to, params.axis, params.isRtl);
      this.currentAnimation = null;

      if (cancelled) {
        params.onCancel?.();
      } else {
        params.onComplete?.();
      }
    };

    const tick = (currentTime: number) => {
      const rawProgress = Math.min(1, (currentTime - startTime) / duration);
      const easedProgress = this.options.easing(rawProgress);
      const currentValue = params.from + (params.to - params.from) * easedProgress;

      writeScroll(params.element, currentValue, params.axis, params.isRtl);

      if (rawProgress < 1) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      finish(false);
    };

    rafId = requestAnimationFrame(tick);

    this.currentAnimation = {
      cancel: () => {
        cancelAnimationFrame(rafId);
        finish(true);
      },
    };
  }

  /**
   * 通用数值缓动核心：按缓动函数在 `from` 与 `to` 之间逐帧过渡，
   * 通过 `apply` 回调写入动画目标；被取消时立即收敛到目标值。
   */
  private tween(params: {
    from: number;
    to: number;
    duration: number;
    easing: EasingFunction;
    apply: (value: number) => void;
    onComplete?: () => void;
    onCancel?: () => void;
  }): void {
    this.cancel();

    const { from, to, duration, easing, apply } = params;
    if (Math.abs(to - from) < 0.5) {
      apply(to);
      params.onComplete?.();
      return;
    }

    const startTime = performance.now();
    let rafId = 0;
    let finished = false;

    const finish = (cancelled: boolean): void => {
      if (finished) {
        return;
      }

      finished = true;
      apply(to);
      this.currentAnimation = null;

      if (cancelled) {
        params.onCancel?.();
      } else {
        params.onComplete?.();
      }
    };

    const tick = (currentTime: number): void => {
      const rawProgress = Math.min(1, (currentTime - startTime) / duration);
      apply(from + (to - from) * easing(rawProgress));

      if (rawProgress < 1) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      finish(false);
    };

    rafId = requestAnimationFrame(tick);

    this.currentAnimation = {
      cancel: () => {
        cancelAnimationFrame(rafId);
        finish(true);
      },
    };
  }

  /**
   * 对元素执行 transform 位移动画（`translateX` / `translateY`）。
   *
   * 用于边界回弹等基于缓动体系的短促位移反馈。
   */
  public animateTransform(params: {
    element: HTMLElement;
    from: number;
    to: number;
    axis?: "x" | "y";
    duration?: number;
    easing?: EasingFunction;
    onComplete?: () => void;
    onCancel?: () => void;
  }): void {
    const { element, from, to } = params;
    const axis = params.axis ?? "x";
    const duration = params.duration ?? this.options.duration;
    const easing = params.easing ?? this.options.easing;

    this.tween({
      from,
      to,
      duration,
      easing,
      apply: (value) => {
        element.style.transform = axis === "x" ? `translateX(${value}px)` : `translateY(${value}px)`;
      },
      onComplete: params.onComplete,
      onCancel: params.onCancel,
    });
  }

  /**
   * 双阶段滑入翻页动画（仅横排 LTR 分页模式使用）。
   *
   * 阶段一（180ms）：当前内容沿翻页方向位移视口宽度 30% + 淡出；
   * 阶段二（220ms）：`scrollTo` 落位到目标偏移后，目标页从对侧 8% 滑入 + 淡入。
   * 两阶段共享 `EASING.slide` 缓动（`cubic-bezier(0.22, 0.61, 0.36, 1)`）。
   *
   * 中断（取消）时快速收敛：立即归位 transform/opacity 并落位到目标偏移。
   */
  public animateSlide(params: {
    element: HTMLElement;
    scrollElement: Element;
    toOffset: number;
    viewportSize: number;
    direction: "previous" | "next";
    onComplete?: () => void;
    onCancel?: () => void;
  }): void {
    this.cancel();

    const { element, scrollElement, toOffset, viewportSize, direction } = params;
    const currentOffset = Math.abs(scrollElement.scrollLeft);

    if (Math.abs(currentOffset - toOffset) <= SLIDE_SETTLE_TOLERANCE_PX) {
      writeScroll(scrollElement, toOffset, "x");
      params.onComplete?.();
      return;
    }

    const exitSign = direction === "next" ? -1 : 1;
    const enterSign = direction === "next" ? 1 : -1;
    const exitPx = viewportSize * SLIDE_EXIT_RATIO * exitSign;
    const enterStartPx = viewportSize * SLIDE_ENTER_RATIO * enterSign;

    let scrolled = false;
    let finished = false;
    let rafId = 0;
    const startTime = performance.now();
    const easing = EASING.slide;

    const settle = (): void => {
      if (scrolled) {
        return;
      }

      scrolled = true;
      writeScroll(scrollElement, toOffset, "x");
    };

    const resetVisuals = (): void => {
      element.style.transform = "";
      element.style.opacity = "";
    };

    const finish = (cancelled: boolean): void => {
      if (finished) {
        return;
      }

      finished = true;
      resetVisuals();
      settle();
      this.currentAnimation = null;

      if (cancelled) {
        params.onCancel?.();
      } else {
        params.onComplete?.();
      }
    };

    const tick = (currentTime: number): void => {
      const elapsed = currentTime - startTime;

      if (elapsed < SLIDE_EXIT_DURATION_MS) {
        const eased = easing(Math.min(1, elapsed / SLIDE_EXIT_DURATION_MS));
        element.style.transform = `translateX(${exitPx * eased}px)`;
        element.style.opacity = String(1 - eased);
        rafId = requestAnimationFrame(tick);
        return;
      }

      settle();

      const enterElapsed = elapsed - SLIDE_EXIT_DURATION_MS;
      if (enterElapsed < SLIDE_ENTER_DURATION_MS) {
        const eased = easing(Math.min(1, enterElapsed / SLIDE_ENTER_DURATION_MS));
        element.style.transform = `translateX(${enterStartPx * (1 - eased)}px)`;
        element.style.opacity = String(eased);
        rafId = requestAnimationFrame(tick);
        return;
      }

      finish(false);
    };

    rafId = requestAnimationFrame(tick);

    this.currentAnimation = {
      cancel: () => {
        cancelAnimationFrame(rafId);
        finish(true);
      },
    };
  }

  public cancel(): void {
    this.currentAnimation?.cancel();
  }

  public isAnimating(): boolean {
    return this.currentAnimation !== null;
  }

  public destroy(): void {
    this.cancel();
  }
}
