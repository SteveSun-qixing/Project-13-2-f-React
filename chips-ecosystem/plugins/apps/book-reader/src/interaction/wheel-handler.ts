import type { PageDirection } from '../engine/types';
import { resolveWheelNavigationThreshold } from '../core/book-model';
import type { InteractionCallbacks, InteractionRuntime } from './types';

const PAGINATED_PIXEL_THRESHOLD_PX = 96;
const WHEEL_NAVIGATION_LOCK_MS = 60;
const TRACKPAD_GESTURE_IDLE_MS = 220;
const DISCRETE_GESTURE_IDLE_MS = 90;
const ACCUMULATOR_RESET_MS = 180;
const DISCRETE_PIXEL_DELTA_THRESHOLD = 48;
const PIXEL_MODE_MOUSE_WHEEL_THRESHOLD_PX = 24;
const LEGACY_WHEEL_DELTA_THRESHOLD = 100;

interface LegacyWheelEvent extends WheelEvent {
  wheelDelta?: number;
  wheelDeltaX?: number;
  wheelDeltaY?: number;
}

function normalizeWheelDelta(event: WheelEvent, document: Document): { x: number; y: number } {
  const viewportHeight = Math.max(
    document.documentElement.clientHeight,
    document.defaultView?.innerHeight ?? 0,
    1
  );
  const multiplier =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 18
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? viewportHeight
        : 1;

  return {
    x: event.deltaX * multiplier,
    y: event.deltaY * multiplier,
  };
}

function readLegacyWheelDelta(event: WheelEvent, axis: 'x' | 'y'): number | null {
  const legacyEvent = event as LegacyWheelEvent;
  const candidate =
    axis === 'x' ? legacyEvent.wheelDeltaX : (legacyEvent.wheelDeltaY ?? legacyEvent.wheelDelta);

  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
}

function isIntegerLike(value: number): boolean {
  return Math.abs(value - Math.round(value)) < 0.001;
}

export class WheelHandler {
  private accumulator = {
    delta: 0,
    timestamp: 0,
    direction: null as PageDirection | null,
  };
  private consumedGesture: {
    direction: PageDirection;
    idleMs: number;
    lastTimestamp: number;
  } | null = null;

  public constructor(
    private readonly callbacks: InteractionCallbacks,
    private readonly runtime: InteractionRuntime
  ) {}

  public attach(target: Document): () => void {
    const handleWheel = (event: WheelEvent): void => {
      const delta = normalizeWheelDelta(event, target);
      const mode = this.runtime.getReadingMode();

      if (mode === 'paginated') {
        const dominantDelta = Math.abs(delta.x) > Math.abs(delta.y) ? delta.x : delta.y;
        if (Math.abs(dominantDelta) <= 0) {
          return;
        }

        event.preventDefault();
        const direction = dominantDelta > 0 ? 'next' : 'previous';
        const now = Date.now();
        this.releaseConsumedGesture(now, direction);
        if (this.consumedGesture) {
          this.consumedGesture.lastTimestamp = now;
          return;
        }

        if (!this.runtime.canNavigate()) {
          this.resetAccumulator();
          return;
        }

        if (this.isDiscretePaginatedWheelEvent(event, delta, dominantDelta)) {
          this.callbacks.onNavigate(direction);
          this.runtime.lockNavigation(WHEEL_NAVIGATION_LOCK_MS);
          this.markGestureConsumed(direction, now, DISCRETE_GESTURE_IDLE_MS);
          return;
        }

        const threshold = this.resolvePaginatedThreshold(event.deltaMode);
        const nextDirection = this.consumeAccumulated(dominantDelta, threshold, direction, now);
        if (!nextDirection) {
          return;
        }

        this.callbacks.onNavigate(nextDirection);
        this.runtime.lockNavigation(WHEEL_NAVIGATION_LOCK_MS);
        this.markGestureConsumed(
          nextDirection,
          now,
          this.resolveGestureIdleMs(event.deltaMode, dominantDelta)
        );
        return;
      }

      if (!this.runtime.canNavigate()) {
        return;
      }

      const threshold = resolveWheelNavigationThreshold({
        readingMode: mode,
        deltaMode: event.deltaMode,
      });

      if (Math.abs(delta.y) < Math.abs(delta.x) || Math.abs(delta.y) <= 0) {
        this.resetAccumulator();
        return;
      }

      const direction: PageDirection = delta.y > 0 ? 'next' : 'previous';
      if (!this.runtime.getController()?.isNearBoundary(direction)) {
        this.resetAccumulator();
        return;
      }

      const nextDirection = this.consumeAccumulated(delta.y, threshold, direction, Date.now());
      if (nextDirection === direction) {
        event.preventDefault();
        this.callbacks.onNavigate(direction);
        this.runtime.lockNavigation(WHEEL_NAVIGATION_LOCK_MS);
        this.resetAccumulator();
      }
    };

    target.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      target.removeEventListener('wheel', handleWheel);
    };
  }

  private resetAccumulator(): void {
    this.accumulator = {
      delta: 0,
      timestamp: 0,
      direction: null,
    };
  }

  private isDiscretePaginatedWheelEvent(
    event: WheelEvent,
    delta: { x: number; y: number },
    dominantDelta: number
  ): boolean {
    if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
      return true;
    }

    const dominantLegacyDelta =
      Math.abs(readLegacyWheelDelta(event, 'x') ?? 0) >
      Math.abs(readLegacyWheelDelta(event, 'y') ?? 0)
        ? readLegacyWheelDelta(event, 'x')
        : readLegacyWheelDelta(event, 'y');
    if (
      dominantLegacyDelta !== null &&
      Math.abs(dominantLegacyDelta) >= LEGACY_WHEEL_DELTA_THRESHOLD
    ) {
      return true;
    }

    const orthogonalDelta = Math.abs(delta.x) > Math.abs(delta.y) ? delta.y : delta.x;
    return (
      Math.abs(orthogonalDelta) < 1 &&
      Math.abs(dominantDelta) >= PIXEL_MODE_MOUSE_WHEEL_THRESHOLD_PX &&
      isIntegerLike(event.deltaX) &&
      isIntegerLike(event.deltaY)
    );
  }

  private resolvePaginatedThreshold(deltaMode: number): number {
    if (deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
      return PAGINATED_PIXEL_THRESHOLD_PX;
    }

    return resolveWheelNavigationThreshold({
      readingMode: 'paginated',
      deltaMode,
    });
  }

  private resolveGestureIdleMs(deltaMode: number, dominantDelta: number): number {
    if (deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
      return DISCRETE_GESTURE_IDLE_MS;
    }

    return Math.abs(dominantDelta) >= DISCRETE_PIXEL_DELTA_THRESHOLD
      ? DISCRETE_GESTURE_IDLE_MS
      : TRACKPAD_GESTURE_IDLE_MS;
  }

  private markGestureConsumed(direction: PageDirection, timestamp: number, idleMs: number): void {
    this.consumedGesture = {
      direction,
      idleMs,
      lastTimestamp: timestamp,
    };
    this.resetAccumulator();
  }

  private releaseConsumedGesture(now: number, direction: PageDirection): void {
    if (!this.consumedGesture) {
      return;
    }

    const shouldReset =
      this.consumedGesture.direction !== direction ||
      now - this.consumedGesture.lastTimestamp > this.consumedGesture.idleMs;

    if (shouldReset) {
      this.consumedGesture = null;
      this.resetAccumulator();
    }
  }

  private consumeAccumulated(
    delta: number,
    threshold: number,
    direction: PageDirection,
    now: number
  ): PageDirection | null {
    const shouldReset =
      now - this.accumulator.timestamp > ACCUMULATOR_RESET_MS ||
      (this.accumulator.direction !== null && this.accumulator.direction !== direction);

    if (shouldReset) {
      this.accumulator.delta = 0;
    }

    this.accumulator.timestamp = now;
    this.accumulator.direction = direction;
    this.accumulator.delta += delta;

    if (Math.abs(this.accumulator.delta) < threshold) {
      return null;
    }

    return this.accumulator.delta > 0 ? 'next' : 'previous';
  }
}
